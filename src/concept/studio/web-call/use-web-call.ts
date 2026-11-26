"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { t } from "../../i18n";
import { ReceptionistCall, type ServerEvent } from "../../receptionist/call-session";
import { studioStoreHost } from "../../receptionist/host";
import { ratesFor } from "../../receptionist/limits";
import type { CallEnd, CallRecord, TranscriptLine } from "../../receptionist/types";
import { connectWebCall, reportEnded, unlockSpeaker, WebCallError, type WebCall, type WebCallFailure } from "../../receptionist/web-call/browser";
import { UNHEARD_NOTE, webCallOpening, type WebCallSalon } from "../../receptionist/web-call/persona";
import { BrowserStudioStore } from "../../store/browser-studio-store";
import { salonClock } from "../../tools/clock";
import { logForSupport } from "../../ui/friendly-copy";

// One web call from this tab. The call session (the same engine a phone call
// would use) decides what Maja does; this hook connects it to the microphone,
// keeps the screen in step, tells the server when the call ends, and saves the
// finished call with the sample salon in this browser.

export type WebCallState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "live"; seconds: number; maxSeconds: number; lines: readonly TranscriptLine[] }
  | { phase: "ended"; record: CallRecord; saved: boolean }
  | { phase: "failed"; reason: WebCallFailure; retryAfter?: number };

const TENANT = "demo";
const GOODBYE_MS = 8000;
/** Connecting, the microphone prompt included, gives up after this long. */
const CONNECT_MS = 45_000;

const systemNote = (text: string) => ({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });

interface Live {
  session: ReceptionistCall;
  transport: WebCall;
  timer: number;
  maxSeconds: number;
  pending: Set<Promise<unknown>>;
}

export function useWebCall(token: string, salon: WebCallSalon, speaker: RefObject<HTMLAudioElement | null>) {
  const [state, setState] = useState<WebCallState>({ phase: "idle" });
  const live = useRef<Live | null>(null);
  const starting = useRef<AbortController | null>(null);
  const ending = useRef<WebCall | null>(null);

  const show = useCallback(() => {
    const call = live.current;
    if (call) setState({ phase: "live", seconds: call.session.seconds, maxSeconds: call.maxSeconds, lines: [...call.session.lines] });
  }, []);

  const finish = useCallback(async (reason: CallEnd, waitForGoodbye = false) => {
    const call = live.current;
    if (!call) return;
    live.current = null;
    ending.current = call.transport;
    window.clearInterval(call.timer);
    call.transport.stopMicrophone();
    call.session.end(reason);
    await Promise.allSettled([...call.pending]);
    if (waitForGoodbye) await call.transport.drained(GOODBYE_MS);
    call.transport.close();
    reportEnded(token, call.transport.accepted.callId);
    if (ending.current === call.transport) ending.current = null;
    const record = call.session.record();
    const host = studioStoreHost(new BrowserStudioStore(), TENANT, Date.now);
    const saved = await host.commit({ type: "receptionist/call", call: record }).then((result) => result.ok, () => false);
    setState({ phase: "ended", record, saved });
  }, [token]);

  const start = useCallback(async () => {
    if (live.current || starting.current || !speaker.current) return;
    // Inside the tap, before any await: lets iPhone Safari play her voice.
    unlockSpeaker(speaker.current);
    const abort = new AbortController();
    starting.current = abort;
    setState({ phase: "starting" });
    const settle = () => {
      if (starting.current === abort) starting.current = null;
    };
    const deadline = window.setTimeout(() => {
      if (starting.current !== abort) return;
      abort.abort();
      settle();
      setState({ phase: "failed", reason: "connection" });
    }, CONNECT_MS);

    const host = studioStoreHost(new BrowserStudioStore(), TENANT, Date.now);
    let session: ReceptionistCall | undefined;
    const pending = new Set<Promise<unknown>>();
    let droppedEarly = false;
    let responding = false;
    let transport: WebCall | undefined;
    let acceptedId: string | undefined;
    // Events from before the connection is handed over (the data channel can open first) wait here, not get lost.
    const early: (Record<string, unknown> & { type: string })[] = [];
    const send = (event: Record<string, unknown> & { type: string }) => (transport ? transport.send(event) : void early.push(event));

    const onEvent = (event: ServerEvent & { item_id?: string }) => {
      if (!session) return;
      if (event.type === "response.created") responding = true;
      if (event.type === "response.done") responding = false;
      // Talked over, but nothing usable heard (a cough, a "mm" that cut in): ask again, from the last agreed detail.
      const unheard = event.type === "conversation.item.input_audio_transcription.failed"
        || (event.type === "conversation.item.input_audio_transcription.completed" && !(event.transcript ?? "").trim());
      if (unheard) {
        send(systemNote(UNHEARD_NOTE));
        if (!responding) send({ type: "response.create" });
      }
      const current = session;
      const handled = current.handle(event).then((step) => {
        step.send.forEach((sent) => send(sent));
        if (step.hangUp) void finish(step.hangUp, step.hangUp === "receptionist");
        else show();
      });
      pending.add(handled);
      void handled.finally(() => pending.delete(handled));
    };

    try {
      transport = await connectWebCall({
        token,
        salon,
        speaker: speaker.current,
        signal: abort.signal,
        onAccepted: (accepted) => {
          acceptedId = accepted.callId;
          session = new ReceptionistCall({
            // The salon's own id for the record; OpenAI's call id is only used to end the call on the server.
            id: `call-${crypto.randomUUID()}`,
            channel: "browser-test",
            host,
            salon: { salonName: salon.salonName, language: salon.language, greeting: "" },
            limits: accepted.limits,
            startedAt: salonClock(),
            now: Date.now,
            opening: webCallOpening(salon),
            rates: ratesFor(accepted.model),
            handover: {
              title: t("webCall.handover.title"),
              body: ({ reason, caller, phone, email }) => [
                reason,
                caller && t("webCall.handover.caller", { caller }),
                phone && t("webCall.handover.phone", { phone }),
                email && t("webCall.handover.email", { email }),
              ].filter(Boolean).join("\n"),
            },
          });
        },
        handlers: {
          onOpen: () => session?.open().forEach((event) => send(event)),
          onClose: (reason) => {
            if (live.current?.session === session) void finish(reason);
            else droppedEarly = true;
          },
          onEvent,
        },
      });
    } catch (error) {
      window.clearTimeout(deadline);
      settle();
      // The server had already started the call: make sure it is hung up there too.
      if (acceptedId) reportEnded(token, acceptedId);
      const failure = error instanceof WebCallError ? error : new WebCallError("connection");
      logForSupport("RECEPTIONIST_WEB_CALL", failure.reason);
      if (!abort.signal.aborted) setState({ phase: "failed", reason: failure.reason, retryAfter: failure.retryAfter });
      return;
    }
    window.clearTimeout(deadline);
    settle();
    if (abort.signal.aborted || !session) {
      transport.close();
      reportEnded(token, transport.accepted.callId);
      return;
    }
    if (droppedEarly) {
      transport.close();
      reportEnded(token, transport.accepted.callId);
      setState({ phase: "failed", reason: "connection" });
      return;
    }
    const call = session;
    const line = transport;
    early.splice(0).forEach((event) => line.send(event));
    const timer = window.setInterval(() => {
      const step = call.tick();
      step.send.forEach((sent) => line.send(sent));
      if (step.hangUp) void finish(step.hangUp);
      else show();
    }, 1000);
    live.current = { session: call, transport: line, timer, maxSeconds: transport.accepted.limits.maxSeconds, pending };
    show();
  }, [salon, speaker, finish, show, token]);

  const hangUp = useCallback(() => {
    starting.current?.abort();
    starting.current = null;
    if (live.current) void finish("caller");
    else setState({ phase: "idle" });
  }, [finish]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  // Leaving the page hangs up: the microphone never stays open behind another page.
  useEffect(() => () => {
    starting.current?.abort();
    ending.current?.close();
    void finish("caller");
  }, [finish]);

  return { state, start, hangUp, reset };
}
