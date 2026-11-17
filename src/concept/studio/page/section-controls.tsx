"use client";

import { ArrowDown, ArrowUp, Lock, Plus, X } from "lucide-react";
import { t, type MessageKey } from "../../i18n";
import { addSection, availableKinds, moveSection, removeSection, setVariant, variantsOf, type PageSection, type SectionKind } from "../../page/sections";
import { Card } from "../../ui/card";
import { Chip, Field, Segmented, TextInput } from "../../ui/controls";
import { IconButton } from "../../ui/button";

interface Props {
  sections: PageSection[];
  instagram: string;
  onChange: (sections: PageSection[]) => void;
  onInstagram: (handle: string) => void;
}

/** Add, remove and reorder sections and pick a look for each. The booking flow row is fixed: it is shown so the owner sees where it sits. */
export function SectionControls({ sections, instagram, onChange, onInstagram }: Props) {
  const top = sections[0]?.kind === "hero" ? 1 : 0;
  const rows = sections.map((section, index) => (
    <li key={section.kind}>
      <Row section={section} first={index <= top} last={index === sections.length - 1} onChange={onChange} sections={sections} />
    </li>
  ));
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {rows.slice(0, top)}
        <li>
          <Card className="flex items-center gap-3 p-3 text-sm">
            <Lock size={16} className="shrink-0 text-text-secondary" />
            <span className="min-w-0">
              <span className="block font-medium">{t("pageEditor.flow")}</span>
              <span className="block text-xs text-text-secondary">{t("pageEditor.flow.text")}</span>
            </span>
          </Card>
        </li>
        {rows.slice(top)}
      </ul>
      {sections.some((s) => s.kind === "instagram") && (
        <Field label={t("pageEditor.instagram")} hint={t("pageEditor.instagram.hint")}>
          <TextInput value={instagram} onChange={(event) => onInstagram(event.target.value)} placeholder="salong.eko" autoCapitalize="none" autoComplete="off" spellCheck={false} />
        </Field>
      )}
      {availableKinds(sections).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("pageEditor.addSection")}</p>
          <div className="flex flex-wrap gap-2">
            {availableKinds(sections).map((kind) => (
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

function Row({ section, first, last, sections, onChange }: { section: PageSection; first: boolean; last: boolean; sections: PageSection[]; onChange: (sections: PageSection[]) => void }) {
  const name = t(`page.section.${section.kind}`);
  const hero = section.kind === "hero";
  return (
    <Card className="space-y-2.5 p-3">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 font-medium">{name}</p>
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
        onChange={(variant) => onChange(setVariant(sections, section.kind as SectionKind, variant))}
        options={variantsOf(section.kind).map((value) => ({ value, label: t(`page.variant.${section.kind}.${value}` as MessageKey) }))}
        className="w-full"
      />
    </Card>
  );
}
