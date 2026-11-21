import type { Ref } from "react";
import type { Campaign, PosterFormat, Salon } from "../../data/types";
import { FONT_PAIRS, type PageTheme } from "../../page/theme";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { isEngineStyle } from "../../campaigns/poster-layout";
import { EnginePoster } from "./engine-poster";
import { Poster } from "./poster";

/** What a poster needs from a campaign, whether it is still a draft or already published. */
export type PosterSource = Pick<Campaign, "name" | "to" | "link" | "poster">;

interface PosterViewProps {
  source: PosterSource;
  salon: Salon;
  format: PosterFormat;
  /** The booking page's look: its colours and heading font carry over to the poster. */
  theme?: PageTheme;
  /** The salon's review score, for the signature on engine posters. */
  rating?: { average: number; count: number };
  ref?: Ref<SVGSVGElement>;
}

/** The salon's poster for a campaign, with its own name, end day and booking link. */
export function PosterView({ source, salon, format, theme, rating, ref }: PosterViewProps) {
  if (!source.poster) return null;
  const label = `${source.name}: ${source.poster.headline} ${source.poster.detail}`;
  if (isEngineStyle(source.poster.style)) {
    return <EnginePoster ref={ref} poster={source.poster} format={format} kicker={source.name} label={label} context={{ salon, link: source.link, theme, rating }} />;
  }
  return (
    <Poster
      ref={ref}
      poster={source.poster}
      format={format}
      kicker={source.name}
      until={t("campaigns.posterUntil", { date: formatDate(source.to) })}
      footer={[`${salon.name} · ${salon.address}`, t("campaigns.posterBook", { link: source.link ?? "" })]}
      label={`${source.name}: ${source.poster.headline} ${source.poster.detail}`}
      brand={theme && { colors: theme.colors, heading: FONT_PAIRS[theme.fonts].heading }}
    />
  );
}
