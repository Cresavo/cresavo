"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Locale } from "@/lib/locale";
import { t } from "../../i18n";
import { BrowserCallError, connectBrowserCall, type BrowserCall, type ConnectFailure } from "../../receptionist/browser-webrtc";
import { ReceptionistCall } from "../../receptionist/call-session";
import { studioStoreHost } from "../../receptionist/host";
import type { MintedSession } from "../../receptionist/server/session";
import type { CallEnd, CallRecord, TranscriptLine } from "../../receptionist/types";
import { BrowserStudioStore } from "../../store/browser-studio-store";
import { salonClock } from "../../tools/clock";
import { logForSupport } from "../../ui/friendly-copy";

// One test call from this tab. The call session decides everything; this hook
// only connects it to the microphone, keeps the screen in step and saves the
// finished call with the salon.

export type TestCallFailure = ConnectFailure | "rate-limited" | "daily-limit" | "not-configured" | "start";

export type TestCallState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "live"; seconds: number; maxSeconds: number; lines: readonly TranscriptLine[] }
  | { phase: "ended"; record: CallRecord; saved: boolean }
  | { phase: "failed"; reason: TestCallFailure };

const TENANT = "demo";
/** How long the goodbye may take to play before the line is closed anyway. */
const GOODBYE_MS = 8000;

async function mint(input: { salonName: string; language: Locale; greeting: string }, signal: AbortSignal): Promise<MintedSession | TestCallFailure> {
  let response: Response;
  try {
    response = await fetch("/api/concept/receptionist/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  } catch {
    return "start";
  }
  if (response.ok) return (await response.json()) as MintedSession;
  const error = await response.json().then((body: { error?: string }) => body.error, () => undefined);
  if (error === "rate_limited") return "rate-limited";
  if (error === "daily_limit") return "daily-limit";
  if (error === "not_configured") return "not-configured";
  return "start";
}

export function useTestCall(salon: { salonName: string; language: Locale; greeting: string }, speaker: RefObject<HTMLAudioElement | null>) {
  const [state, setState] = useState<TestCallState>({ phase: "idle" });
  const live = useRef<{ session: ReceptionistCall; transport: BrowserCall; timer: number; maxSeconds: number; pending: Set<Promise<unknown>> } | null>(null);
  const starting = useRef<AbortController | null>(null);
  /** The line of a call that is ending, kept so leaving the page can still close it while the goodbye plays. */
  const ending = useRef<BrowserCall | null>(null);

  const show = useCallback(() => {
    const call = live.current;
    if (call) setState({ phase: "live", seconds: call.session.seconds, maxSeconds: call.maxSeconds, lines: [...call.session.lines] });
  }, []);

  /** Closes the line and saves the call. Runs once per call. */
  const finish = useCallback(async (reason: CallEnd, waitForGoodbye = false) => {
    const call = live.current;
    if (!call) return;
    live.current = null;
    ending.current = call.transport;
    window.clearInterval(call.timer);
    call.transport.stopMicrophone();
    // A booking the receptionist is committing right now belongs in this call's record.
    await Promise.allSettled([...call.pending]);
    call.session.end(reason);
    if (waitForGoodbye) await call.transport.drained(GOODBYE_MS);
    call.transport.close();
    if (ending.current === call.transport) ending.current = null;
    const record = call.session.record();
    const host = studioStoreHost(new BrowserStudioStore(), TENANT, Date.now);
    const saved = await host.commit({ type: "receptionist/call", call: record }).then((result) => result.ok, () => false);
    setState({ phase: "ended", record, saved });
  }, []);

  const start = useCallback(async () => {
    if (live.current || starting.current || !speaker.current) return;
    const abort = new AbortController();
    starting.current = abort;
    setState({ phase: "starting" });
    /** Clears the attempt only if it is still this one: a cancelled attempt must not drop a newer one. */
    const settle = () => {
      if (starting.current === abort) starting.current = null;
    };
    const fail = (reason: TestCallFailure) => {
      settle();
      if (!abort.signal.aborted) setState({ phase: "failed", reason });
    };

    const minted = await mint(salon, abort.signal);
    if (typeof minted === "string") return fail(minted);

    const host = studioStoreHost(new BrowserStudioStore(), TENANT, Date.now);
    const session = new ReceptionistCall({
      id: minted.callId,
      channel: "browser-test",
      host,
      salon,
      limits: minted.limits,
      startedAt: salonClock(),
      now: Date.now,
      handover: {
        title: t("receptionist.handover.title"),
        body: ({ reason, caller, phone }) => [reason, caller && t("receptionist.handover.caller", { caller }), phone && t("receptionist.handover.phone", { phone })].filter(Boolean).join("\n"),
      },
    });

    const pending = new Set<Promise<unknown>>();
    let transport: BrowserCall;
    try {
      transport = await connectBrowserCall({
        clientSecret: minted.clientSecret,
        speaker: speaker.current,
        signal: abort.signal,
        handlers: {
          onOpen: () => session.open().forEach((event) => transport.send(event)),
          onClose: (reason) => void finish(reason),
          onEvent: (event) => {
            const handled = session.handle(event).then((step) => {
              step.send.forEach((sent) => transport.send(sent));
              if (step.hangUp) void finish(step.hangUp, step.hangUp === "receptionist");
              else show();
            });
            pending.add(handled);
            void handled.finally(() => pending.delete(handled));
          },
        },
      });
    } catch (error) {
      logForSupport("RECEPTIONIST_CONNECT", error instanceof BrowserCallError ? error.reason : "unknown");
      return fail(error instanceof BrowserCallError ? error.reason : "connection");
    }
    settle();
    if (abort.signal.aborted) return transport.close();

    const timer = window.setInterval(() => {
      const step = session.tick();
      step.send.forEach((sent) => transport.send(sent));
      if (step.hangUp) void finish(step.hangUp);
      else show();
    }, 1000);
    live.current = { session, transport, timer, maxSeconds: minted.limits.maxSeconds, pending };
    show();
  }, [salon, speaker, finish, show]);

  /** The person at the screen ends the call. */
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
