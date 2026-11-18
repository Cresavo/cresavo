import type { PosterFormat } from "../data/types";
import { POSTER_FORMATS } from "./poster-layout";

// Poster to PNG in the browser: the SVG is drawn on a canvas. An SVG drawn as
// an image may not load other files, so the photos are inlined first.

async function dataUri(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function standaloneSvg(svg: SVGSVGElement, width: number, height: number): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  await Promise.all(
    [...copy.querySelectorAll("image")].map(async (image) => {
      const href = image.getAttribute("href");
      if (href) image.setAttribute("href", await dataUri(href));
    }),
  );
  return new XMLSerializer().serializeToString(copy);
}

/** Renders the poster to a PNG blob at the format's export size. */
export async function posterToPng(svg: SVGSVGElement, format: PosterFormat): Promise<Blob> {
  const { width, height, exportScale } = POSTER_FORMATS[format];
  const [w, h] = [width * exportScale, height * exportScale];
  const markup = await standaloneSvg(svg, w, h);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(image, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
