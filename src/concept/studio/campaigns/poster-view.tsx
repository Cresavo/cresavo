import type { Ref } from "react";
import type { Campaign, PosterFormat, Salon } from "../../data/types";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { Poster } from "./poster";

/** What a poster needs from a campaign, whether it is still a draft or already published. */
export type PosterSource = Pick<Campaign, "name" | "to" | "link" | "poster">;

interface PosterViewProps {
  source: PosterSource;
  salon: Salon;
  format: PosterFormat;
  ref?: Ref<SVGSVGElement>;
}

/** The salon's poster for a campaign, with its own name, end day and booking link. */
export function PosterView({ source, salon, format, ref }: PosterViewProps) {
  if (!source.poster) return null;
  return (
    <Poster
      ref={ref}
      poster={source.poster}
      format={format}
      kicker={source.name}
      until={t("campaigns.posterUntil", { date: formatDate(source.to) })}
      footer={[`${salon.name} · ${salon.address}`, t("campaigns.posterBook", { link: source.link ?? "" })]}
      label={`${source.name}: ${source.poster.headline} ${source.poster.detail}`}
    />
  );
}
