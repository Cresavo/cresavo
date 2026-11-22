"use client";

import { ArrowDown, ArrowUp, Lock, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { t, type MessageKey } from "../../i18n";
import { MAX_ABOUT_HEADING, MAX_ABOUT_TEXT, type PageAbout } from "../../page/about";
import { addSection, availableKinds, moveSection, removeSection, setVariant, variantsOf, type PageSection } from "../../page/sections";
import { Card } from "../../ui/card";
import { Chip, Field, Segmented, Textarea, TextInput } from "../../ui/controls";
import { IconButton } from "../../ui/button";
import { ReorderItem, ReorderList } from "../reorder";

interface Props {
  sections: PageSection[];
  reviewsEnabled: boolean;
  instagram: string;
  about: PageAbout;
  /** The business name, for the heading the page uses when none is typed. */
  name: string;
  onChange: (sections: PageSection[]) => void;
  onInstagram: (handle: string) => void;
  onAbout: (about: PageAbout) => void;
}

/** Add, remove and reorder sections and pick a look for each. The booking flow row is fixed: it is shown so the owner sees where it sits. */
export function SectionControls({ sections, reviewsEnabled, instagram, about, name, onChange, onInstagram, onAbout }: Props) {
  const aboutHeading = t("booking.about", { name });
  const hero = sections[0]?.kind === "hero" ? sections[0] : undefined;
  const movable = hero ? sections.slice(1) : sections;
  const items = movable.map((section) => ({ section, id: section.kind, name: t(`page.section.${section.kind}`) }));
  const canAdd = availableKinds(sections).filter((kind) => reviewsEnabled || kind !== "reviews");

  return (
    <div className="space-y-4">
      <ReorderList
        items={items}
        onReorder={(items) => {
          const ordered = items.map(({ section }) => section);
          onChange(hero ? [hero, ...ordered] : ordered);
        }}
      >
        <ul className="space-y-2">
          {hero && <li><Row section={hero} sections={sections} onChange={onChange} /></li>}
          <li>
            <Card className="flex items-center gap-3 p-3 text-sm">
              <Lock size={16} className="shrink-0 text-text-secondary" />
              <span className="min-w-0">
                <span className="block font-medium">{t("pageEditor.flow")}</span>
                <span className="block text-xs text-text-secondary">{t("pageEditor.flow.text")}</span>
              </span>
            </Card>
          </li>
          {items.map(({ id, name, section }, index) => (
            <ReorderItem key={id} id={id} name={name} as="li">
              {(handle) => (
                <Row section={section} handle={handle} first={index === 0} last={index === movable.length - 1} onChange={onChange} sections={sections} />
              )}
            </ReorderItem>
          ))}
        </ul>
      </ReorderList>
      {sections.some((s) => s.kind === "instagram") && (
        <Field width="short" label={t("pageEditor.instagram")} hint={t("pageEditor.instagram.hint")}>
          <TextInput value={instagram} onChange={(event) => onInstagram(event.target.value)} placeholder={t("pageEditor.instagramExample")} autoCapitalize="none" autoComplete="off" spellCheck={false} />
        </Field>
      )}
      {sections.some((s) => s.kind === "about") && (
        <div className="space-y-4">
          <Field label={t("pageEditor.about.heading")} hint={t("pageEditor.about.heading.hint", { fallback: aboutHeading })}>
            <TextInput value={about.heading} onChange={(event) => onAbout({ ...about, heading: event.target.value })} placeholder={aboutHeading} maxLength={MAX_ABOUT_HEADING} />
          </Field>
          <Field label={t("pageEditor.about.text")} hint={t("pageEditor.about.text.hint", { max: MAX_ABOUT_TEXT })}>
            <Textarea value={about.text} onChange={(event) => onAbout({ ...about, text: event.target.value })} rows={8} maxLength={MAX_ABOUT_TEXT} />
          </Field>
        </div>
      )}
      {canAdd.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("pageEditor.addSection")}</p>
          <div className="flex flex-wrap gap-2">
            {canAdd.map((kind) => (
              <Chip key={kind} active={false} onClick={() => onChange(addSection(sections, kind))}>
                <Plus size={14} />
                {t(`page.section.${kind}`)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ section, handle, first, last, sections, onChange }: {
  section: PageSection;
  handle?: ReactNode;
  first?: boolean;
  last?: boolean;
  sections: PageSection[];
  onChange: (sections: PageSection[]) => void;
}) {
  const name = t(`page.section.${section.kind}`);
  const hero = section.kind === "hero";
  return (
    <Card className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1">
        {handle}
        <p className="min-w-0 flex-1 break-words font-medium max-[319px]:basis-1/2">{name}</p>
        {hero ? <span className="px-2 text-xs text-text-secondary">{t("pageEditor.alwaysTop")}</span> : (
          <>
            <IconButton label={t("pageEditor.moveUp", { section: name })} disabled={first} onClick={() => onChange(moveSection(sections, section.kind, -1))}><ArrowUp size={18} /></IconButton>
            <IconButton label={t("pageEditor.moveDown", { section: name })} disabled={last} onClick={() => onChange(moveSection(sections, section.kind, 1))}><ArrowDown size={18} /></IconButton>
          </>
        )}
        <IconButton label={t("pageEditor.remove", { section: name })} onClick={() => onChange(removeSection(sections, section.kind))}><X size={18} /></IconButton>
      </div>
      <Segmented
        label={t("pageEditor.look", { section: name })}
        value={section.variant}
        onChange={(variant) => onChange(setVariant(sections, section.kind, variant))}
        options={variantsOf(section.kind).map((value) => ({ value, label: t(`page.variant.${section.kind}.${value}` as MessageKey) }))}
      />
    </Card>
  );
}
