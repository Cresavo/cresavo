"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, ShieldCheck, ShieldOff } from "lucide-react";
import { formatTime, toKey } from "../../data/dates";
import { t, tc } from "../../i18n";
import { relativeDay } from "../../i18n/format";
import { dispatch } from "../../store";
import { activeGrant, grantStatus, type GrantHours } from "../../support/access";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

function clock(ms: number, today: string): string {
  const d = new Date(ms);
  return `${relativeDay(toKey(d), today)} ${formatTime(d.getHours() * 60 + d.getMinutes())}`;
}

/** The owner lets support read the account for an hour or a day, and sees every grant. */
export function SupportAccess() {
  const { state, today } = useStudio();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const active = activeGrant(state, now);

  const grant = (hours: GrantHours) => {
    const at = Date.now();
    setNow(at);
    if (dispatch({ type: "support/grant", hours, at })) showToast(t("support.granted", { hours }));
  };
  const revoke = () => {
    const at = Date.now();
    setNow(at);
    if (dispatch({ type: "support/revoke", at })) showToast(t("support.revoked"));
  };

  return (
    <Section title={t("support.title")} className="lg:col-span-2">
      <Card data-help="support-access" className="space-y-4 p-4">
        <p className="text-sm text-eko-muted">{t("support.text")}</p>
        {active ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-eko-accent-soft p-3 text-eko-accent">
            <ShieldCheck size={20} className="shrink-0" />
            <p className="min-w-0 flex-1 text-sm font-medium">{t("support.active", { until: clock(active.until, today) })}</p>
            <Button variant="secondary" size="sm" icon={<ShieldOff size={16} />} onClick={revoke}>{t("support.stop")}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<LifeBuoy size={18} />} onClick={() => grant(1)}>{t("support.allow1")}</Button>
            <Button variant="secondary" icon={<LifeBuoy size={18} />} onClick={() => grant(24)}>{t("support.allow24")}</Button>
          </div>
        )}
        {state.supportGrants.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("support.history")}</p>
            <ul className="divide-y divide-eko-line rounded-xl bg-eko-sunken px-3 text-sm">
              {state.supportGrants.map((grantItem) => {
                const status = grantStatus(grantItem, now);
                const hours = Math.round((grantItem.until - grantItem.grantedAt) / 3_600_000);
                return (
                  <li key={grantItem.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{t("support.entry", { when: clock(grantItem.grantedAt, today), duration: tc("support.hours", hours) })}</span>
                    <Badge tone={status === "active" ? "accent" : "neutral"}>
                      {status === "revoked" ? t("support.stoppedAt", { when: clock(grantItem.revokedAt!, today) }) : t(`support.status.${status}`)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </Section>
  );
}
