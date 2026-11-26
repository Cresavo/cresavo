import type { ClientEvent, ServerEvent } from "./call-session";
import { REALTIME_ORIGIN } from "./flag";
import type { ReceptionistTransport, TransportHandlers } from "./transport";

// The "Try in the browser" transport: this tab's microphone and speaker,
// connected straight to the Realtime API over WebRTC. It authenticates with
// the one-minute client secret from our server and never sees the API key.

export type ConnectFailure = "microphone-blocked" | "no-microphone" | "unsupported" | "connection";

export class BrowserCallError extends Error {
  constructor(readonly reason: ConnectFailure) {
    super(reason);
  }
}

function microphoneFailure(error: unknown): ConnectFailure {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "microphone-blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "no-microphone";
  return "connection";
}

export interface BrowserCall extends ReceptionistTransport {
  /** Stops the microphone at once while the line stays open for the goodbye to play. */
  stopMicrophone(): void;
  /** Resolves when the audio that was queued when it was called has been played, or after `timeoutMs`. */
  drained(timeoutMs: number): Promise<void>;
}

/**
 * Asks for the microphone, then connects. Rejects with a `BrowserCallError`
 * that says which of the two failed, so the page can say what to do next.
 */
export async function connectBrowserCall(options: { clientSecret: string; speaker: HTMLAudioElement; handlers: TransportHandlers; signal?: AbortSignal }): Promise<BrowserCall> {
  const { clientSecret, speaker, handlers, signal } = options;
  if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new BrowserCallError("unsupported");

  let microphone: MediaStream;
  try {
    microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (error) {
    throw new BrowserCallError(microphoneFailure(error));
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
  /** The audio ended without us asking. */
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
  // The microphone was unplugged or the browser took it back.
  for (const track of microphone.getAudioTracks()) track.onended = () => lost("error");

  try {
    for (const track of microphone.getTracks()) peer.addTrack(track, microphone);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const response = await fetch(`${REALTIME_ORIGIN}/v1/realtime/calls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
      body: offer.sdp,
      signal,
    });
    if (!response.ok) throw new BrowserCallError("connection");
    await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
  } catch (error) {
    close();
    throw error instanceof BrowserCallError ? error : new BrowserCallError("connection");
  }

  return {
    channel: "browser-test",
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
