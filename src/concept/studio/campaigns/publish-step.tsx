import { useState } from "react";
import { CalendarClock, Send } from "lucide-react";
import { CHANNELS } from "../../campaigns/channels";
import { draftLink, resolvePoster, type Draft } from "../../campaigns/draft";
import type { Channel, DateKey, DemoState } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { Button } from "../../ui/button";
import { Chip, Field, SegmentedControl, TextInput } from "../../ui/controls";
import { ChannelPreview } from "./channel-preview";
import { PosterView } from "./poster-view";

interface PublishStepProps {
  state: DemoState;
  today: DateKey;
  draft: Draft;
  /** Day the posts are scheduled for when the owner does not publish right away. */
  scheduleDefault: DateKey;
  onChange: (patch: Partial<Draft>) => void;
  onPublish: (publishOn: DateKey) => void;
}

/** Step 4: see each channel's post, choose where it goes, publish now or schedule. */
export function PublishStep({ state, today, draft, scheduleDefault, onChange, onPublish }: PublishStepProps) {
  const [selected, setSelected] = useState<Channel>(draft.channels[0] ?? "instagram");
  const [scheduling, setScheduling] = useState(false);
  const [day, setDay] = useState(scheduleDefault);
  const source = { name: draft.name, to: draft.to, link: draftLink(state, draft), poster: resolvePoster(state, draft) };
  const preview = draft.channels.includes(selected) ? selected : draft.channels[0];
  const toggle = (channel: Channel) =>
    onChange({ channels: CHANNELS.filter((c) => (c === channel ? !draft.channels.includes(c) : draft.channels.includes(c))) });
  const poster = (format: "post" | "story") => <PosterView source={source} salon={state.salon} theme={state.page.theme} format={format} />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {preview && <SegmentedControl label={t("campaigns.publish.preview")} value={preview} onChange={setSelected}
          options={draft.channels.map(value => ({ value, label: t(`channel.${value}`) }))} />}
        {preview && (
          <ChannelPreview
            channel={preview}
            text={draft.copy[preview] ?? ""}
            subject={draft.name}
            salonName={state.salon.name}
            post={poster("post")}
            story={poster("story")}
          />
        )}
      </div>
      <div className="space-y-5 lg:pt-1">
        <div className="space-y-2">
          <span className="block text-sm font-medium">{t("campaigns.publish.where")}</span>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((channel) => (
              <Chip key={channel} active={draft.channels.includes(channel)} onClick={() => toggle(channel)}>
                {t(`channel.${channel}`)}
              </Chip>
            ))}
          </div>
        </div>
        <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">{t("campaigns.publish.link", { link: draftLink(state, draft) })}</p>
        <div className="space-y-3">
          <div>
            <Button size="lg" width="responsive" icon={<Send size={18} />} disabled={!draft.channels.length} onClick={() => onPublish(today)}>
              {t("campaigns.publish.everywhere")}
            </Button>
          </div>
          {scheduling ? (
            <div className="space-y-3 rounded-lg bg-surface-2 p-4">
              <Field width="date" label={t("campaigns.publish.day")} hint={formatDate(day)}>
                <TextInput type="date" value={day} min={today} onChange={(event) => event.target.value && setDay(event.target.value)} />
              </Field>
              <Button variant="secondary" width="responsive" icon={<CalendarClock size={18} />} disabled={!draft.channels.length} onClick={() => onPublish(day)}>
                {day > today ? t("campaigns.publish.scheduleOn", { day: formatDate(day) }) : t("campaigns.publish.everywhere")}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="lg" width="responsive" icon={<CalendarClock size={18} />} disabled={!draft.channels.length} onClick={() => setScheduling(true)}>
              {t("campaigns.publish.schedule")}
            </Button>
          )}
        </div>
        <p className="text-xs text-text-secondary">{tc("campaigns.publish.note", draft.channels.length)}</p>
      </div>
    </div>
  );
}
