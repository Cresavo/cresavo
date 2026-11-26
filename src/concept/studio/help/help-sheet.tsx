"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Eye, History, LifeBuoy, Sparkles } from "lucide-react";
import { askHelp, type HelpReply } from "../../help/client";
import { startShowMe } from "../../help/pointer/store";
import { t } from "../../i18n";
import { canOpen } from "../../ops/access";
import { useRole } from "../../ops/role";
import { ListRow } from "../../ui/list-row";
import { HISTORY_PAGE } from "../nav";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { StatusDot } from "../../ui/feedback";
import { friendlyMessage, FriendlyNotice, logForSupport } from "../../ui/friendly-message";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { SetupGaps } from "./setup-gaps";
import { ShowMeField, ShowMeResult, useShowMeSearch } from "./show-me-field";
import { TicketForm } from "./ticket-form";
import { useHasUnseenUpdates } from "./whats-new-seen";

const EXAMPLES = ["help.example.book", "help.example.undo", "help.example.restore", "help.example.order", "help.example.support"] as const;

type View = { kind: "ask" } | { kind: "loading" } | { kind: "answer"; reply: HelpReply } | { kind: "failed" };

/**
 * One question, two answers: "Show me" points at the place in the studio straight away (on the device), and the
 * help articles explain it below. Then a ticket when that is not enough.
 */
export function HelpSheet({ open, onClose, onWhatsNew }: { open: boolean; onClose: () => void; onWhatsNew: () => void }) {
  const { state } = useStudio();
  const unseen = useHasUnseenUpdates();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [view, setView] = useState<View>({ kind: "ask" });
  const [ticketing, setTicketing] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const search = useShowMeSearch();
  const router = useRouter();
  const role = useRole();

  // Help opens on its landing view: History, What's new and the examples live only there, and a guide that
  // points at them (or a question asked last time) must not find a stale answer instead.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView({ kind: "ask" });
      setQuestion("");
      setTicketing(false);
      search.clear();
    }
  }

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAsked(trimmed);
    search.find(trimmed);
    setView({ kind: "loading" });
    try {
      const reply = await askHelp(trimmed, !!state.industry);
      setRequestId(reply.requestId);
      setView({ kind: "answer", reply });
    } catch (error) {
      logForSupport("HELP_ARTICLES_UNAVAILABLE", error);
      setView({ kind: "failed" });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  const close = () => {
    setTicketing(false);
    onClose();
  };

  /** The sheet closes first, so the guide can point at the studio behind it. */
  const show = (entryId: string) => {
    close();
    startShowMe(entryId);
  };

  if (ticketing) {
    return (
      <Sheet open={open} onClose={close} title={t("ticket.title")} description={t("ticket.description")}>
        <TicketForm question={asked || question} requestId={requestId} onBack={() => setTicketing(false)} onDone={close} />
      </Sheet>
    );
  }

  const reply = view.kind === "answer" ? view.reply : null;
  const entry = reply?.articles[0]?.entry;
  return (
    <Sheet open={open} onClose={close} title={t("help.title")} description={t("help.description")}>
      <div className="space-y-4 pt-2">
        <ShowMeField value={question} onChange={setQuestion} onSubmit={submit} busy={view.kind === "loading"} />

        {search.match && <ShowMeResult match={search.match} onShow={show} />}

        {view.kind === "ask" && role === "owner" && state.industry && <SetupGaps onShow={close} />}

        {view.kind === "ask" && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{t("help.common")}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((key) => (
                <Button key={key} variant="secondary" size="sm" align="start" onClick={() => void ask(t(key))}>
                  {t(key)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {view.kind === "ask" && (
          <div data-help="whats-new" className="border-t border-hairline pt-2">
            <ListRow
              helpId="help.whats-new"
              onClick={onWhatsNew}
              title={t("whatsNew.title")}
              meta={unseen ? t("whatsNew.dot") : t("whatsNew.row")}
              leading={<Sparkles size={22} aria-hidden className="shrink-0 text-text-secondary" />}
              trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
            />
          </div>
        )}

        {/* History and undo lives here, under Help, rather than in More. */}
        {view.kind === "ask" && canOpen(role, HISTORY_PAGE) && (
          <div data-help="history" className="border-t border-hairline pt-2">
            <ListRow
              helpId="help.history"
              onClick={() => { close(); router.push(HISTORY_PAGE); }}
              title={t("nav.log")}
              meta={t("nav.log.description")}
              leading={<History size={22} aria-hidden className="shrink-0 text-text-secondary" />}
              trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
            />
          </div>
        )}

        {view.kind === "loading" && <p role="status" className="flex items-center gap-2 text-sm text-text-secondary"><StatusDot />{t("help.looking")}</p>}

        {view.kind === "failed" && (
          <FriendlyNotice message={friendlyMessage({ what: "help.failed", why: "help.failedWhy", next: "help.failedNext" })}
            action={<Button size="sm" variant="secondary" onClick={() => void ask(asked)}>{t("help.retry")}</Button>} />
        )}

        {reply && (
          <div className="space-y-3" aria-live="polite">
            {reply.answer ? (
              <div className="space-y-3 rounded-lg bg-surface-2 p-4">
                <p className="whitespace-pre-line text-body leading-relaxed">{reply.answer}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  {reply.source === "ai" && <Badge tone="accent">{t("help.byAi")}</Badge>}
                  <span>{t("help.from", { titles: reply.articles.map((article) => article.title).join(", ") })}</span>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-surface-2 p-4 text-body">{t("help.noAnswer")}</p>
            )}
            {entry && entry !== search.match?.best?.id && (
              <Button variant="secondary" icon={<Eye size={18} />} onClick={() => show(entry)}>
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
