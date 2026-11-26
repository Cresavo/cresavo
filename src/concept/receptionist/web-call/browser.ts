import type { ClientEvent, ServerEvent } from "../call-session";
import type { CallLimits } from "../limits";
import type { ReceptionistTransport, TransportHandlers } from "../transport";

// The browser half of the public web call: this tab's microphone and speaker
// over WebRTC. The offer goes to our own server, which adds the session and
// gets OpenAI's answer, so the browser never holds any OpenAI credential.

export type WebCallFailure =
  | "microphone-blocked" | "no-microphone" | "unsupported" | "connection"
  | "closed" | "not-configured" | "rate-limited" | "session-limited" | "daily-limit" | "page-expired" | "busy";

export class WebCallError extends Error {
  constructor(readonly reason: WebCallFailure, readonly retryAfter?: number) {
    super(reason);
  }
}

function microphoneFailure(error: unknown): WebCallFailure {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "microphone-blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "no-microphone";
  return "connection";
}

const SERVER_ERRORS: Record<string, WebCallFailure> = {
  closed: "closed",
  not_configured: "not-configured",
  rate_limited: "rate-limited",
  session_limited: "session-limited",
  daily_limit: "daily-limit",
  page_expired: "page-expired",
  invalid_token: "page-expired",
  provider_unavailable: "busy",
};

export interface AcceptedCall {
  callId: string;
  limits: CallLimits;
  model: string;
}

export interface WebCall extends ReceptionistTransport {
  readonly accepted: AcceptedCall;
  /** Stops the microphone at once while the line stays open for the goodbye to play. */
  stopMicrophone(): void;
  /** Resolves when the queued audio has played, or after `timeoutMs`. */
  drained(timeoutMs: number): Promise<void>;
}

/**
 * Lets this page play the receptionist's voice. iPhone Safari only plays audio
 * that a tap started, so this runs synchronously inside the tap, before any await.
 */
export function unlockSpeaker(speaker: HTMLAudioElement) {
  speaker.muted = false;
  speaker.setAttribute("playsinline", "");
  if (!speaker.srcObject && typeof MediaStream !== "undefined") speaker.srcObject = new MediaStream();
  void speaker.play().catch(() => undefined);
}

export interface ConnectOptions {
  token: string;
  salon: { salonName: string; language: "sv" | "en"; ownerName: string };
  speaker: HTMLAudioElement;
  handlers: TransportHandlers;
  /** Called with the server's answer, before audio flows, so the call session exists when the line opens. */
  onAccepted: (call: AcceptedCall) => void;
  signal?: AbortSignal;
}

export async function connectWebCall(options: ConnectOptions): Promise<WebCall> {
  const { speaker, handlers, signal } = options;
  if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new WebCallError("unsupported");
  if (signal?.aborted) throw new WebCallError("connection");
  let microphone: MediaStream;
  try {
    microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (error) {
    throw new WebCallError(microphoneFailure(error));
  }
  if (signal?.aborted) {
    for (const track of microphone.getTracks()) track.stop();
    throw new WebCallError("connection");
  }

  const peer = new RTCPeerConnection();
  const events = peer.createDataChannel("oai-events");
  let closed = false;
  let playing = false;
  let onDrained: (() => void) | undefined;

  const close = () => {
    if (closed) return;
    closed = true;
    for (const track of microphone.getTracks()) track.stop();
    events.close();
    peer.close();
    speaker.srcObject = null;
  };
  const lost = (reason: "caller" | "error") => {
    if (closed) return;
    close();
    handlers.onClose(reason);
  };

  peer.ontrack = (event) => {
    speaker.srcObject = event.streams[0] ?? new MediaStream([event.track]);
    void speaker.play().catch(() => undefined);
  };
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === "failed" || peer.connectionState === "closed") lost("error");
  };
  events.onopen = () => handlers.onOpen();
  // The server hung up (time limit, kill switch): the data channel closes.
  events.onclose = () => lost("error");
  events.onmessage = (message) => {
    let event: ServerEvent;
    try {
      event = JSON.parse(String(message.data)) as ServerEvent;
    } catch {
      return;
    }
    if (event.type === "output_audio_buffer.started") playing = true;
    if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") {
      playing = false;
      onDrained?.();
    }
    handlers.onEvent(event);
  };
  for (const track of microphone.getAudioTracks()) track.onended = () => lost("error");

  const abandon = () => close();
  signal?.addEventListener("abort", abandon, { once: true });
  let accepted: AcceptedCall;
  try {
    for (const track of microphone.getTracks()) peer.addTrack(track, microphone);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    let response: Response;
    try {
      response = await fetch("/api/concept/receptionist/web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: options.token, sdp: offer.sdp, salon: options.salon }),
        signal,
      });
    } catch {
      throw new WebCallError("connection");
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string; callId?: string; sdp?: string; limits?: CallLimits; model?: string };
    if (!response.ok || !body.sdp || !body.callId || !body.limits) {
      const retry = Number(response.headers.get("retry-after"));
      throw new WebCallError(SERVER_ERRORS[body.error ?? ""] ?? "connection", Number.isFinite(retry) && retry > 0 ? retry : undefined);
    }
    accepted = { callId: body.callId, limits: body.limits, model: body.model ?? "" };
    options.onAccepted(accepted);
    await peer.setRemoteDescription({ type: "answer", sdp: body.sdp });
  } catch (error) {
    close();
    throw error instanceof WebCallError ? error : new WebCallError("connection");
  } finally {
    signal?.removeEventListener("abort", abandon);
  }
  if (closed) throw new WebCallError("connection");

  return {
    channel: "browser-test",
    accepted,
    send(event: ClientEvent) {
      if (!closed && events.readyState === "open") events.send(JSON.stringify(event));
    },
    close,
    stopMicrophone() {
      for (const track of microphone.getTracks()) track.stop();
    },
    drained(timeoutMs) {
      if (closed || !playing) return new Promise((resolve) => window.setTimeout(resolve, Math.min(timeoutMs, 600)));
      return new Promise((resolve) => {
        const timer = window.setTimeout(resolve, timeoutMs);
        onDrained = () => {
          window.clearTimeout(timer);
          resolve();
        };
      });
    },
  };
}

/** Tells the server the call is over, so it is hung up at OpenAI too. Survives the page closing. */
export function reportEnded(token: string, callId: string) {
  void fetch("/api/concept/receptionist/web-call/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, callId }),
    keepalive: true,
  }).catch(() => undefined);
}
