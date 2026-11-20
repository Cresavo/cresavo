"use client";

import { HOLD_MINUTES, OFFER_MODES, type OfferRules } from "../../booking/waitlist-types";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { dispatch, withBookingLock } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Field, SegmentedControl, Select } from "../../ui/controls";
import { showToast } from "../../ui/toast";

/** How freed times reach the waiting list. Takes effect at once; lives on this page, not in Settings. */
export function OfferSettings({ state }: { state: DemoState }) {
  const rules = state.waitlistRules;
  const change = async (next: Partial<OfferRules>) => {
    if ((Object.keys(next) as (keyof OfferRules)[]).every((key) => next[key] === rules[key])) return;
    // A refused lock request (an embedded page) is a failure to report, like a refused change.
    if (!await withBookingLock(() => dispatch({ type: "waitlist/rules", rules: next })).catch(() => false)) showToast(t("offers.rulesFailed"));
  };
  return (
    <Section title={t("offers.settings")}>
      <Card className="space-y-4 p-4 md:max-w-form">
        <div className="space-y-2">
          <p aria-hidden className="text-body font-medium">{t("offers.mode")}</p>
          <SegmentedControl
            label={t("offers.mode")}
            value={rules.mode}
            onChange={(mode) => change({ mode })}
            options={OFFER_MODES.map((mode) => ({ value: mode, label: t(`offers.mode.${mode}`) }))}
          />
          <p className="text-meta text-text-secondary">{t(rules.paused ? "offers.pausedHint" : `offers.mode.${rules.mode}.hint`)}</p>
        </div>
        {rules.mode !== "off" && (
          <>
            <Field label={t("offers.minutes")} hint={t("offers.quiet")} width="short">
              <Select width="short" value={rules.minutes} onChange={(e) => change({ minutes: Number(e.target.value) })}>
                {HOLD_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{t("offers.minutesOption", { count: minutes })}</option>)}
              </Select>
            </Field>
            <Button variant="secondary" width="responsive" onClick={() => change({ paused: !rules.paused })}>{t(rules.paused ? "offers.resume" : "offers.pause")}</Button>
          </>
        )}
      </Card>
    </Section>
  );
}
