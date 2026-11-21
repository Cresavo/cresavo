import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori, { type Font } from "satori";
import { ENGINE_FORMATS, posterTree, type EngineFormat, type EngineTemplate, type PosterData } from "./templates";

// Server-side poster rendering: template tree → SVG with the text drawn as
// paths and the photos embedded, so the browser can show it and turn it into
// a PNG without fonts or network. See next.config.ts for the bundled fonts.

const FONT_DIR = join(process.cwd(), "src/concept/campaigns/poster-engine/fonts");
const FONT_FILES: { file: string; name: string; weight: Font["weight"]; style?: Font["style"] }[] = [
  { file: "Inter-SemiBold.otf", name: "Inter", weight: 600 },
  { file: "Inter-ExtraBold.otf", name: "Inter", weight: 800 },
  { file: "InterDisplay-Black.otf", name: "Inter Display", weight: 900 },
  { file: "Caladea-Regular.ttf", name: "Caladea", weight: 400 },
  { file: "Caladea-Italic.ttf", name: "Caladea", weight: 400, style: "italic" },
];

let fonts: Promise<Font[]> | undefined;
const loadFonts = () => (fonts ??= Promise.all(FONT_FILES.map(async ({ file, name, weight, style = "normal" }) =>
  ({ name, weight, style, data: await readFile(join(FONT_DIR, file)) }))));

export async function renderPosterSvg(template: EngineTemplate, data: PosterData, format: EngineFormat): Promise<string> {
  const { width, height } = ENGINE_FORMATS[format];
  return satori(posterTree(template, data, format) as Parameters<typeof satori>[0], { width, height, fonts: await loadFonts() });
}
