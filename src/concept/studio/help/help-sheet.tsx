"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Eye, History, LifeBuoy, Send } from "lucide-react";
import { askHelp, type HelpReply } from "../../help/client";
import { showMe } from "../../help/show-me";
import { t } from "../../i18n";
import { canOpen } from "../../ops/access";
import { useRole } from "../../ops/role";
import { ListRow } from "../../ui/list-row";
import { HISTORY_PAGE } from "../nav";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { TicketForm } from "./ticket-form";

const EXAMPLES = ["help.example.book", "help.example.undo", "help.example.restore", "help.example.order", "help.example.support"] as const;

type View = { kind: "ask" } | { kind: "loading" } | { kind: "answer"; reply: HelpReply } | { kind: "failed" };

/** Ask a question, get the answer from the help articles, be shown where to click, or create a ticket. */
export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStudio();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [view, setView] = useState<View>({ kind: "ask" });
  const [ticketing, setTicketing] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const role = useRole();

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAsked(trimmed);
    setView({ kind: "loading" });
    try {
      const reply = await askHelp(trimmed, !!state.industry);
      setRequestId(reply.requestId);
      setView({ kind: "answer", reply });
    } catch {
      setView({ kind: "failed" });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  const show = async (reply: HelpReply) => {
    onClose();
    const found = await showMe(reply.articles[0], pathname, (path) => router.push(path));
    if (!found) showToast(t("help.showMeFailed"));
  };

  const close = () => {
    setTicketing(false);
    onClose();
  };

  if (ticketing) {
    return (
      <Sheet open={open} onClose={close} title={t("ticket.title")} description={t("ticket.description")}>
        <TicketForm question={asked || question} requestId={requestId} onBack={() => setTicketing(false)} onDone={close} />
      </Sheet>
    );
  }

  const reply = view.kind === "answer" ? view.reply : null;
  return (
    <Sheet open={open} onClose={close} title={t("help.title")} description={t("help.description")}>
      <div className="space-y-4 pt-2">
        <form onSubmit={submit} className="flex gap-2" role="search">
          <TextInput value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("help.placeholder")} aria-label={t("help.label")} maxLength={300} />
          <Button type="submit" icon={<Send size={16} />} disabled={!question.trim() || view.kind === "loading"}>
            {t("help.ask")}
          </Button>
        </form>

        {view.kind === "ask" && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("help.common")}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void ask(t(key))}
                  className="min-h-9 rounded-full bg-surface px-3.5 py-1.5 text-left text-sm font-medium ring-1 ring-inset ring-hairline hover:bg-surface-2"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* History and undo lives here, under Help, rather than in More. */}
        {view.kind === "ask" && canOpen(role, HISTORY_PAGE) && (
          <div data-help="history" className="border-t border-hairline pt-2">
            <ListRow
              onClick={() => { close(); router.push(HISTORY_PAGE); }}
              title={t("nav.log")}
              meta={t("nav.log.description")}
              leading={<History size={22} aria-hidden className="shrink-0 text-text-secondary" />}
              trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
            />
          </div>
        )}

        {view.kind === "loading" && <p className="animate-pulse text-sm text-text-secondary">{t("help.looking")}</p>}

        {view.kind === "failed" && <p className="rounded-md bg-warning-bg p-3 text-sm text-text">{t("help.failed")}</p>}

        {reply && (
          <div className="space-y-3" aria-live="polite">
            {reply.answer ? (
              <div className="space-y-3 rounded-lg bg-surface-2 p-4">
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{reply.answer}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  {reply.source === "ai" && <Badge tone="accent">{t("help.byAi")}</Badge>}
                  <span>{t("help.from", { titles: reply.articles.map((article) => article.title).join(", ") })}</span>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-surface-2 p-4 text-[15px]">{t("help.noAnswer")}</p>
            )}
            {reply.articles[0]?.show && (
              <Button variant="secondary" icon={<Eye size={18} />} onClick={() => void show(reply)}>
                {t("help.showMe")}
              </Button>
            )}
          </div>
        )}

        {(view.kind === "answer" || view.kind === "failed") && (
          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
            <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("help.notEnough")}</p>
            <Button variant="ghost" icon={<LifeBuoy size={18} />} onClick={() => setTicketing(true)}>
              {t("help.createTicket")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
