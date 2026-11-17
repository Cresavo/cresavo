"use client";

import { useState } from "react";
import { checkOwnSlug, productDomain, subdomainHost } from "../../page/address";
import { slugify } from "../../page/slug";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Field, TextInput } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { CopyField } from "./copy-field";
import { DomainSection } from "./domain-section";

/** Where customers find the booking page: the address on this site, a name under the product domain, and an own domain. */
export function AddressSection() {
  const { state } = useStudio();
  const [slug, setSlug] = useState(state.salon.slug);
  const check = checkOwnSlug(slug, state.salon.slug);
  const problem = !check.ok && slug.trim() ? t(`address.slug.${check.problem}`) : undefined;
  const changed = check.ok && check.slug !== state.salon.slug;
  const save = () => {
    if (!check.ok || !dispatch({ type: "salon/slug", slug: check.slug })) return;
    showToast(t("address.slug.saved", { address: subdomainHost(check.slug) }), { label: t("common.undo"), run: undo });
  };
  return (
    <>
      <Section title={t("address.title")} className="lg:col-span-2">
        <Card className="space-y-4 p-4 sm:p-5">
          <p className="text-sm text-eko-muted">{t("address.help")}</p>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <Field label={t("address.slug.label")} hint={problem ?? t("address.slug.hint")}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextInput value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} onBlur={() => setSlug((value) => slugify(value) || value)} autoCapitalize="none" autoComplete="off" spellCheck={false} aria-invalid={!!problem} className="sm:max-w-xs" />
                <Button type="submit" disabled={!changed}>{t("address.slug.save")}</Button>
              </div>
            </Field>
          </form>
          <div className="grid gap-2 sm:grid-cols-2">
            <CopyField label={t("address.level1")} value={`${window.location.origin}${bookingHome(state.salon.slug)}`} />
            <CopyField label={t("address.level2", { price: t("address.included") })} value={`https://${subdomainHost(state.salon.slug)}`} />
          </div>
          <p className="text-xs text-eko-muted">{t("address.level2.note", { domain: productDomain() })}</p>
        </Card>
      </Section>
      <Section title={t("domain.title")} className="lg:col-span-2">
        <DomainSection />
      </Section>
    </>
  );
}
