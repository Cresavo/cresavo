"use client";

import { useState } from "react";
import { checkOwnSlug, productDomain, subdomainHost } from "../../page/address";
import { slugify } from "../../page/slug";
import { useWorkspaceSlug, withAddressLock } from "../../store";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Field, TextInput } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { CopyField } from "./copy-field";
import { DomainSection } from "./domain-section";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Choosing the last part of the booking link. The stored value is still the salon's `slug`. */
export function BookingLinkSection() {
  const { state } = useStudio();
  const [slug, setSlug] = useState(state.salon.slug);
  const otherSlug = useWorkspaceSlug(state.industry ? "demo" : "own");
  const check = checkOwnSlug(slug, state.salon.slug, !!state.industry, otherSlug);
  const problem = !check.ok && slug.trim() ? t(`address.slug.${check.problem}`) : undefined;
  const changed = check.ok && check.slug !== state.salon.slug;
  const save = () => {
    if (!check.ok) return;
    void withAddressLock(() => dispatchWithUndoToast({ type: "salon/slug", slug: check.slug }, t("address.slug.saved", { address: state.industry ? bookingHome(check.slug) : subdomainHost(check.slug) })));
  };
  return (
    <Section title={t("address.title")}>
      <Card className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-text-secondary">{t(state.industry ? "setup.local" : "address.help")}</p>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <Field width="short" label={t("address.slug.label")} hint={problem ?? t("address.slug.hint")}>
            <TextInput value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} onBlur={() => setSlug((value) => slugify(value) || value)} autoCapitalize="none" autoComplete="off" spellCheck={false} aria-invalid={!!problem} />
          </Field>
          <Button type="submit" width="responsive" disabled={!changed}>{t("address.slug.save")}</Button>
        </form>
      </Card>
    </Section>
  );
}

/** Advanced: the salon's own address under the product domain, and a domain of its own. Not offered to a trial salon. */
export function OwnAddressSection() {
  const { state } = useStudio();
  if (state.industry) return null;
  return (
    <>
      <Section title={t("address.level2.title")}>
        <Card className="space-y-2 p-4 sm:p-5">
          <CopyField label={t("address.level2", { price: t("address.included") })} value={`https://${subdomainHost(state.salon.slug)}`} />
          <p className="text-xs text-text-secondary">{t("address.level2.note", { domain: productDomain() })}</p>
        </Card>
      </Section>
      <Section title={t("domain.title")}>
        <DomainSection />
      </Section>
    </>
  );
}
