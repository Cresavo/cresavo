"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Sparkles } from "lucide-react";
import { isAiConfigured, runAiTask } from "../ai/api-client";
import { t } from "../i18n";
import { interpretCommand, type IntentResult } from "../intent";
import { useRole } from "../ops/role";
import { useStudio } from "../studio/use-studio";
import { dispatch, undo } from "../store";
import { cx } from "../ui/cx";
import { showToast } from "../ui/toast";
import { buildIntentContext } from "./intent-context";
import { commandExamples } from "./examples";
import { proposalFor, type Choice, type Proposal } from "./proposal";
import { ProposalCard, type Source } from "./proposal-card";
import { useSpeech } from "./use-speech";

interface View {
  proposal: Proposal;
  source: Source;
  pending: boolean;
}

/**
 * "What would you like to do?" at the top of every studio page. The rule-based
 * parser answers instantly; when the server has an AI key the AI answer
 * replaces it a moment later. Nothing changes until the owner approves.
 */
export function CommandBox() {
  const { state, today, minutes } = useStudio();
  const role = useRole();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const latestRun = useRef(0);
  const spoken = useRef(false);
  const examples = useMemo(() => commandExamples(state, today, role), [state, today, role]);

  useEffect(() => {
    const refresh = () => { void isAiConfigured().then(setAiReady); };
    refresh();
    window.addEventListener("concept-ai-settings", refresh);
    return () => window.removeEventListener("concept-ai-settings", refresh);
  }, []);

  const dismiss = (clear: boolean) => {
    latestRun.current += 1;
    setView(null);
    setOpen(false);
    if (clear) setText("");
  };

  const submit = async (raw: string, voice = false) => {
    const command = raw.trim();
    if (!command) return;
    spoken.current = voice;
    const run = ++latestRun.current;
    const context = buildIntentContext(state, today, minutes);
    const show = (intent: IntentResult, source: Source, pending: boolean) =>
      setView({ proposal: proposalFor(state, intent, command, { today, minutes }, examples, role), source, pending });
    const checkAi = aiReady;
    setOpen(true);
    show(interpretCommand(command, context), "rules", checkAi);
    if (!checkAi) return;
    try {
      const { output, log } = await runAiTask<IntentResult>("interpret-command", { text: command, context });
      if (latestRun.current !== run) return;
      if (log.source === "ai") show(output, "ai", false);
      else setView((current) => current && { ...current, pending: false });
    } catch {
      if (latestRun.current === run) setView((current) => current && { ...current, pending: false });
    }
  };

  const speech = useSpeech({
    onText: (heard) => {
      setText(heard);
      void submit(heard, true);
    },
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        latestRun.current += 1;
        setView(null);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const approve = (proposal: Extract<Proposal, { kind: "change" }>) => {
    if (dispatch(proposal.action, { actor: "ai", source: spoken.current ? "voice" : "command" })) showToast(proposal.toast, { label: t("common.undo"), run: undo });
    else showToast(t("command.failed"));
    dismiss(true);
  };

  const pick = (choice: Choice) => {
    if ("proposal" in choice) {
      setView((current) => current && { ...current, proposal: choice.proposal });
      return;
    }
    setText(choice.text);
    void submit(choice.text);
  };

  const edit = () => {
    dismiss(false);
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    speech.stop();
    dismiss(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(text);
  };

  const showExamples = open && !view && !text.trim();
  return (
    <div ref={root} data-help="command-box" className="relative" onKeyDown={onKeyDown}>
      <form
        role="search"
        onSubmit={onSubmit}
        className="flex min-h-12 items-center gap-1 rounded-2xl bg-eko-surface pl-4 pr-1.5 shadow-card ring-1 ring-eko-line/70 focus-within:ring-2 focus-within:ring-eko-accent"
      >
        <Sparkles size={18} className="mr-1 shrink-0 text-eko-accent" />
        <input
          ref={input}
          value={speech.listening ? speech.interim : text}
          readOnly={speech.listening}
          onChange={(event) => {
            setText(event.target.value);
            setView(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={speech.listening ? t("command.listening") : t("command.placeholder")}
          aria-label={t("command.label")}
          enterKeyHint="go"
          className="bare-input min-w-0 flex-1 bg-transparent py-3 text-[15px] placeholder:text-eko-muted"
        />
        {text.trim() && !speech.listening && (
          <button type="submit" aria-label={t("command.send")} title={t("command.send")} className="flex size-9 items-center justify-center rounded-xl bg-eko-accent text-eko-on-accent">
            <ArrowUp size={18} />
          </button>
        )}
        {speech.supported && (
          <button
            type="button"
            aria-label={t("command.voice")}
            title={t("command.voice")}
            aria-pressed={speech.listening}
            onClick={speech.toggle}
            className={cx(
              "flex size-9 items-center justify-center rounded-xl hover:bg-eko-sunken hover:text-eko-ink",
              speech.listening ? "animate-pulse bg-eko-accent-soft text-eko-accent" : "text-eko-muted",
            )}
          >
            <Mic size={18} />
          </button>
        )}
      </form>
      {(view || showExamples) && (
        <div
          role="region"
          aria-live="polite"
          aria-label={t("command.result")}
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[70dvh] overflow-y-auto rounded-2xl bg-eko-surface shadow-sheet ring-1 ring-eko-line"
        >
          {view ? (
            <ProposalCard proposal={view.proposal} source={view.source} pending={view.pending} onApprove={approve} onPick={pick} onEdit={edit} onClose={() => dismiss(true)} />
          ) : (
            <div className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{t("command.try")}</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setText(example);
                      void submit(example);
                    }}
                    className="min-h-9 rounded-full bg-eko-surface px-3.5 py-1.5 text-left text-sm font-medium ring-1 ring-inset ring-eko-line hover:bg-eko-sunken"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
