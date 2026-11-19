"use client";

import { useState } from "react";
import { BellRing, MessageCircle, BookOpen, Gift, Globe, Megaphone, Package, PackageOpen, Star, TrendingUp, type LucideIcon } from "lucide-react";
import type { ModuleKey } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { formatNumber } from "@/concept/i18n/format";
import { CORE_PRICE_SEK, enabledModules, MODULES, monthlyTotal, PRESET_IDS, presetOf } from "@/concept/modules/registry";
import { setupOf } from "@/concept/onboarding/setup";
import { PACKS, type Pack } from "@/concept/packs";
import { dispatch, startBusiness } from "@/concept/store";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Button } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Chip, Switch } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";
import { showToast } from "@/concept/ui/toast";

const ICONS: Record<ModuleKey, LucideIcon> = {
  journal: BookOpen,
  stock: Package,
  campaigns: Megaphone,
  finance: TrendingUp,
  reviews: Star,
  waitlist: BellRing,
  assistant: MessageCircle,
  giftcards: Gift,
  packages: PackageOpen,
  domain: Globe,
};

const price = (sek: number) => t("features.price", { price: formatNumber(sek) });

export default function FeaturesPage() {
  const { state } = useStudio();
  const [switching, setSwitching] = useState<Pack | null>(null);
  const packName = (pack: Pack) => t(`pack.${pack.id}.name`);

  const switchPack = async (pack: Pack) => {
    setSwitching(null);
    await startBusiness({ ...setupOf(state), pack: pack.id, modules: undefined });
    showToast(t("features.pack.switched", { pack: packName(pack) }));
  };

  return (
    <MorePage title={t("nav.features")} subtitle={t("features.subtitle")}>
      <div className="space-y-8">
        <Card className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 bg-action-bg p-5 ring-action/20">
          <div>
            <p className="text-sm font-medium text-text-secondary">{t("features.total")}</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight" aria-live="polite">{price(monthlyTotal(enabledModules(state.modules)))}</p>
          </div>
          <p className="text-sm text-text-secondary">{t("features.totalNote")}</p>
        </Card>

        {/* Two starting points; any switch below then makes it the owner's own mix. */}
        <div role="group" aria-label={t("features.preset.label")} className="flex flex-wrap items-center gap-2">
          <p className="mr-1 text-sm text-text-secondary">{t("features.preset.label")}</p>
          {PRESET_IDS.map((preset) => (
            <Chip
              key={preset}
              active={presetOf(state.modules) === preset}
              onClick={() => {
                dispatch({ type: "module/preset", preset });
                showToast(t(`features.preset.${preset}.applied`));
              }}
            >
              {t(`features.preset.${preset}`)}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="flex items-start gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t("features.core")}</p>
              <p className="text-sm text-text-secondary">{t("features.core.description")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums">{price(CORE_PRICE_SEK)}</p>
              <Badge tone="accent" className="mt-1">{t("features.alwaysOn")}</Badge>
            </div>
          </Card>
          {MODULES.map((module) => {
            const Icon = ICONS[module.id];
            const on = state.modules[module.id];
            return (
              <Card key={module.id} className="flex items-start gap-4 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-action-bg text-text">
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t(module.name)}</p>
                  <p className="text-sm text-text-secondary">{t(module.description)}</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">{price(module.priceSek)}</p>
                </div>
                <Switch
                  checked={on}
                  label={t(module.name)}
                  onChange={() => {
                    dispatch({ type: "module/toggle", key: module.id });
                    showToast(t(on ? "features.turnedOff" : "features.turnedOn", { name: t(module.name) }));
                  }}
                />
              </Card>
            );
          })}
        </div>
        <p className="-mt-4 text-sm text-text-secondary">{t("features.hint")}</p>

        <Section title={t("features.pack.title")}>
          <p className="text-sm text-text-secondary">{t("features.pack.text")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {PACKS.map((pack) => {
              const current = pack.id === state.pack;
              return (
                <Card key={pack.id} className="flex flex-col gap-3 p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">{packName(pack)}</p>
                    <p className="text-sm text-text-secondary">{t(`pack.${pack.id}.description`)}</p>
                    <p className="text-xs text-text-secondary">{t("features.pack.words", { customers: `${pack.vocabulary.customer}s`, services: `${pack.vocabulary.service}s` })}</p>
                  </div>
                  {current ? <Badge tone="accent" className="self-start">{t("features.pack.current")}</Badge> : <Button variant="secondary" size="sm" className="self-start" onClick={() => setSwitching(pack)}>{t("features.pack.use")}</Button>}
                </Card>
              );
            })}
          </div>
        </Section>
      </div>
      {switching && (
        <Sheet
          open
          onClose={() => setSwitching(null)}
          title={t("features.pack.switchTitle", { pack: packName(switching) })}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSwitching(null)}>{t("features.pack.cancel")}</Button>
              <Button onClick={() => switchPack(switching)}>{t("features.pack.use")}</Button>
            </>
          }
        >
          <p className="text-[15px]">{t("features.pack.switchText", { pack: packName(switching) })}</p>
        </Sheet>
      )}
    </MorePage>
  );
}
