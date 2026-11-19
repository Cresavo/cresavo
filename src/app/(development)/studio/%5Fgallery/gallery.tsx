"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ArrowUp, CalendarDays, ChevronRight, Plus, Search } from "lucide-react";
import { t } from "@/concept/i18n";
import { teamWith } from "@/concept/packs/base";
import { fullName } from "@/concept/selectors";
import { Avatar, StaffAvatar } from "@/concept/ui/avatar";
import { Button, ButtonLink, IconButton } from "@/concept/ui/button";
import { Badge, DemoBadge, Tag } from "@/concept/ui/badge";
import { Card, Section, Stat } from "@/concept/ui/card";
import { BarList, ColumnChart, CompareBars, Meter, PairedColumns } from "@/concept/ui/charts";
import { Checkbox, Chip, Field, Input, SearchInput, SegmentedControl, Select, Switch, Textarea } from "@/concept/ui/controls";
import { ConsentSheet } from "@/concept/ui/consent-sheet";
import { ConfirmDialog } from "@/concept/ui/confirm-dialog";
import { EmptyState } from "@/concept/ui/empty-state";
import { Skeleton, SuccessCheck } from "@/concept/ui/feedback";
import { ListRow } from "@/concept/ui/list-row";
import { MediaDialog } from "@/concept/ui/media-dialog";
import { Menu, Tabs } from "@/concept/ui/navigation";
import { Notice } from "@/concept/ui/notice";
import { PageHeader } from "@/concept/ui/page-header";
import { Sheet } from "@/concept/ui/sheet";
import { StickyActionBar } from "@/concept/ui/sticky-action-bar";
import { ThemeControl } from "@/concept/ui/theme-control";
import { showActionFailure, showToast, Toast, Toaster } from "@/concept/ui/toast";
import { Wordmark } from "@/concept/ui/wordmark";

const [sampleStaff] = teamWith({ title: "", bio: "" }, { title: "", bio: "" });
const wrap = "flex flex-wrap items-center gap-3";
const variants = ["primary", "secondary", "tertiary", "danger"] as const;
const states = ["normal", "disabled", "loading"] as const;
const views = ["day", "week"] as const;
type Dialog = "sheet" | "side" | "consent" | "highRisk" | "confirm" | "confirmSave" | "media";

function ActionExamples({ save }: { save: () => void }) {
  return <Section title={t("gallery.actions")}>
    {variants.map(variant => <div key={variant} className="space-y-2">
      <h3 className="text-h3 font-medium">{t(`gallery.${variant}`)}</h3>
      <div className={wrap}>{states.map(state => {
        const props = { variant, loading: state === "loading", disabled: state === "disabled", onClick: save };
        const label = t(state === "loading" ? "ui.loading" : `gallery.${state}`);
        return <div key={state} className="flex flex-wrap items-center gap-1">
          <Button {...props}>{label}</Button>
          <IconButton {...props} label={label}><Plus aria-hidden size={18} /></IconButton>
        </div>;
      })}</div>
    </div>)}
    <h3 className="text-h3 font-medium">{t("gallery.sizes")}</h3>
    <div className={wrap}>{(["sm", "md", "lg"] as const).map(size =>
      <Button key={size} size={size} variant="secondary" icon={<Plus size={16} />} onClick={save}>{t("common.save")}</Button>)}</div>
    <Button align="start" variant="secondary" className="w-full" onClick={save} icon={<Plus size={16} />}>{t("common.save")}</Button>
    <Button align="between" variant="tertiary" className="w-full" onClick={save}>{t("nav.calendar")}<ChevronRight size={16} aria-hidden /></Button>
  </Section>;
}

function Fields() {
  return <Section title={t("gallery.fields")} className="max-w-lg">
    <Field label={t("services.name")} hint={t("gallery.hint")}><Input /></Field>
    <Field label={t("services.name")} error={t("gallery.error")}><Input required /></Field>
    <Field label={t("gallery.disabled")}><Input disabled /></Field>
    <Field label={t("gallery.search")}><SearchInput /></Field>
    <SearchInput aria-label={t("booking.ask.title")} placeholder={t("booking.ask.placeholder")}
      endAction={<IconButton label={t("booking.ask.submit")}><Search aria-hidden size={18} /></IconButton>} />
    {(["normal", "invalid", "disabled"] as const).map(state =>
      <Field key={state} label={t("gallery.select")} error={state === "invalid" ? t("gallery.chooseView") : undefined}>
        <Select disabled={state === "disabled"} defaultValue={state === "invalid" ? "" : "day"}>
          <option value="">{t("gallery.chooseView")}</option>
          {views.map(view => <option value={view} key={view}>{t(`calendar.${view}`)}</option>)}
        </Select>
      </Field>)}
    <Field label={t("schedule.date")}><Input type="date" /></Field>
    <Field label={t("gallery.time")}><Input type="time" /></Field>
    <Field label={t("pageEditor.colour.accent")}><Input type="color" /></Field>
    <Checkbox label={t("protection.newOnly")} />
    <fieldset>
      <legend className="text-body font-medium">{t("gallery.select")}</legend>
      {views.map(view => <label key={view} className="mr-4 inline-flex min-h-target cursor-pointer items-center gap-2">
        <Input type="radio" name="gallery-view" value={view} defaultChecked={view === "day"} /> {t(`calendar.${view}`)}
      </label>)}
    </fieldset>
    {(["normal", "invalid", "disabled"] as const).map(state =>
      <Field key={state} label={t("gallery.notes")} error={state === "invalid" ? t("gallery.enterNotes") : undefined}>
        <Textarea disabled={state === "disabled"} />
      </Field>)}
  </Section>;
}

function Charts() {
  const data = views.map((view, i) => ({ id: view, label: t(`calendar.${view}`), value: i + 2, previous: i + 1, highlight: !i }));
  return <Section title={t("gallery.charts")} className="max-w-lg">
    <Stat label={t("calendar.day")} value={String(data[0].value)} />
    <ColumnChart data={data} format={String} label={t("gallery.charts")} />
    <BarList data={data} format={String} />
    <PairedColumns data={data.map(d => ({ current: d.value, previous: d.previous }))} labels={[data[0].label, data[1].label]} label={t("gallery.charts")} />
    <CompareBars data={data} format={String} />
    <Meter value={0.5} />
  </Section>;
}

export function Gallery() {
  const title = useRef<HTMLHeadingElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const [view, setView] = useState("day");
  const [checked, setChecked] = useState(false);
  const [chip, setChip] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [row, setRow] = useState<"enter" | "exit" | "hidden">("enter");
  const [success, setSuccess] = useState(0);
  const options = views.map(value => ({ value, label: t(`calendar.${value}`) }));
  const close = () => setDialog(null);
  const undo = { label: t("common.undo"), run: () => showToast(t("gallery.undone")) };
  const save = () => { setSuccess(n => n + 1); showToast(t("gallery.saved"), undo); };
  const finish = () => { close(); save(); };
  const note = t("gallery.empty");
  return <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 text-body lg:px-8">
    <PageHeader title={t("gallery.title")} titleRef={title} subtitle={t("gallery.subtitle")}
      back={<ButtonLink href="/studio" variant="tertiary">{t("common.back")}</ButtonLink>}
      primaryAction={{ label: t("gallery.preview"), onClick: () => setDialog("sheet") }} />
    <ThemeControl />
    <DemoBadge />
    <ActionExamples save={save} />
    <Section title={t("gallery.controls")}>
      <SegmentedControl value={view} onChange={setView} options={options} label={t("gallery.select")} />
      <SegmentedControl value={view} onChange={setView} label={t("gallery.row")}
        options={[{ value: "day", label: t("gallery.row"), count: 2 }, { value: "week", label: t("gallery.sheet"), count: 0 }]} />
      <SegmentedControl value={view} onChange={setView} label={t("gallery.chooseView")}
        options={options.map(option => ({ ...option, label: `${option.label} · ${t("gallery.normal")}`,
          content: <span className="flex flex-col py-2">{option.label}<span className="text-meta">{t("gallery.normal")}</span></span> }))} />
      <div className={wrap}><Chip active={chip} onClick={() => setChip(!chip)} count={0}>{t("calendar.day")}</Chip>
        <Chip active={!chip} onClick={() => setChip(!chip)}>{t("calendar.week")}</Chip></div>
      <div className={wrap}>{[false, true].map(disabled => <Switch key={String(disabled)} checked={disabled ? !checked : checked}
        disabled={disabled} onChange={() => setChecked(!checked)} label={t(disabled ? "gallery.disabled" : "gallery.switch")} />)}</div>
      <Switch showLabel checked={checked} onChange={() => setChecked(!checked)} label={t("protection.newOnly")} />
    </Section>
    <Fields />
    <Section title={t("gallery.layout")}>
      <Card style={{ "--action-layout-height": "calc(4 * var(--touch-target))" } as CSSProperties}><StickyActionBar label={t("gallery.layout")} actions={<Button variant="secondary" onClick={save}>{t("common.save")}</Button>}>
        <ListRow title={t("gallery.row")} meta={t("gallery.neutral")} leading={<CalendarDays aria-hidden size={24} />}
          trailing={<ChevronRight aria-hidden size={18} />} onClick={() => setDialog("sheet")} />
        {row !== "hidden" && <ListRow title={t("gallery.confirm")} meta={t("gallery.row")} motion={row}
          onClick={() => setDialog("confirm")} onExited={() => setRow("hidden")} />}
        <ListRow title={t("nav.calendar")} href="/studio/calendar" />
        <ListRow title={t("nav.settings")} meta={<Badge tone="accent">{t("gallery.accent")}</Badge>} />
      </StickyActionBar></Card>
      {row === "hidden" && <Button variant="secondary" onClick={() => setRow("enter")}>{t("common.undo")}</Button>}
      <EmptyState icon={<CalendarDays aria-hidden />} title={note}
        action={<Button variant="secondary" onClick={() => setDialog("sheet")}>{t("gallery.preview")}</Button>} />
    </Section>
    <Section title={t("gallery.feedback")}>
      <div className={wrap}>{(["neutral", "accent", "warn", "danger"] as const).map(tone =>
        <Badge key={tone} tone={tone}>{t(tone === "danger" ? "gallery.failed" : `gallery.${tone}`)}</Badge>)}
        <Tag>{t("gallery.tag")}</Tag></div>
      {(["danger", "warning", "success", "info"] as const).map(tone => <Notice key={tone} tone={tone}>
        {t(({ danger: "gallery.failed", warning: "gallery.warn", success: "gallery.saved", info: "gallery.neutral" } as const)[tone])}
      </Notice>)}
      <Skeleton /><SuccessCheck key={success} />
      <Toast message={t("gallery.saved")} /><Toast message={t("gallery.saved")} action={undo} />
      <div className={wrap}>
        <Button variant="secondary" onClick={save}>{t("gallery.notifications")}</Button>
        <Button variant="secondary" onClick={() => showActionFailure("gallery.failed")}>{t("gallery.showFailure")}</Button>
      </div>
    </Section>
    <Section title={t("gallery.dialogs")}>
      <div className={wrap}>{(["sheet", "consent", "highRisk", "confirm", "confirmSave"] as const).map(kind =>
        <Button variant="secondary" key={kind} onClick={() => setDialog(kind)}>{t(`gallery.${kind}`)}</Button>)}
        <Button variant="secondary" onClick={() => setDialog("side")}>{t("assistant.open")}</Button>
        <Button variant="secondary" onClick={() => setDialog("media")}>{t("gallery.media")}</Button>
      </div>
      {dialog === "media" && <MediaDialog title={t("gallery.media")} closeLabel={t("common.close")} ratio={16 / 9} mediaRef={media} onClose={close}>
        <video ref={media} tabIndex={0} aria-label={t("gallery.media")} src="/site/tour-16x9.mp4" preload="metadata" controls playsInline />
      </MediaDialog>}
      <Sheet title={t("gallery.sheet")} description={t("gallery.row")} open={dialog === "sheet"} onClose={close}
        footer={<Button onClick={finish}>{t("common.save")}</Button>}><DemoBadge /></Sheet>
      <Sheet variant="side" title={t("assistant.title")} open={dialog === "side"} onClose={close}>
        <div className="flex min-h-0 flex-1 flex-col justify-between p-4">
          <DemoBadge />
          <div className="flex items-end gap-1 rounded-md bg-surface p-1 ring-1 ring-input-border focus-within:ring-2 focus-within:ring-focus">
            <Textarea variant="composer" rows={1} aria-label={t("assistant.message")} placeholder={t("assistant.placeholder")} />
            <IconButton label={t("assistant.send")} variant="primary" onClick={finish}><ArrowUp size={18} aria-hidden /></IconButton>
          </div>
        </div>
      </Sheet>
      {(["consent", "highRisk"] as const).map(kind => <ConsentSheet key={kind} open={dialog === kind} onClose={close} onConfirm={finish}
        title={t(`gallery.${kind}`)} summary={t("gallery.summary")} highRisk={kind === "highRisk"} verb={t("gallery.allow")}
        grants={kind === "highRisk" ? [t("gallery.grantRead"), t("gallery.grantWrite")] : [t("gallery.grantRead")]} />)}
      <ConfirmDialog open={dialog === "confirm"} onClose={close} onConfirm={() => { close(); if (row !== "hidden") setRow("exit"); }} destructive
        title={t("gallery.confirm")} description={t("ui.demo")} verb={t("gallery.confirm")} />
      <ConfirmDialog open={dialog === "confirmSave"} onClose={close} onConfirm={finish}
        title={t("gallery.confirmSave")} description={t("ui.demo")} verb={t("common.save")} />
    </Section>
    <Section title={t("gallery.navigation")}>
      <Tabs value={view} onChange={setView} label={t("gallery.select")} tabs={options.map(o => ({ id: o.value, label: o.label, panel: o.label }))} />
      <Menu label={t("gallery.navigation")} links={[{ href: "/studio/calendar", label: t("nav.calendar") }]} />
      <div className={wrap}>{(["xs", "sm", "md", "lg", "xl"] as const).map(size => <Avatar key={size} size={size} name={fullName(sampleStaff)} />)}
        <StaffAvatar person={sampleStaff} size="md" /><StaffAvatar person={{ ...sampleStaff, photo: undefined }} size="md" /></div>
      <ThemeControl compact />
      <div className={wrap}><Wordmark className="w-32" />
        <span className="rounded-md bg-black p-3"><Wordmark className="w-32" inverse /></span></div>
    </Section>
    <Charts />
    <Toaster />
  </div>;
}
