// The small element tree Satori renders. Templates build it with `box`, `text`
// and `image` instead of JSX, so they stay plain functions that run on the server.

export type Style = Record<string, string | number>;

export interface PosterNode {
  type: string;
  props: { style?: Style; src?: string; children?: PosterChild | PosterChild[] };
}
export type PosterChild = PosterNode | string;

/** A flex container (Satori needs `display: flex` on every element with more than one child). */
export const box = (style: Style, ...children: PosterChild[]): PosterNode =>
  ({ type: "div", props: { style: { display: "flex", ...style }, children } });

/** One run of text. Satori clamps lines (`lineClamp`) only on a block element. */
export const text = (style: Style, value: string): PosterNode => ({ type: "div", props: { style: { display: style.lineClamp ? "block" : "flex", ...style }, children: value } });

export const image = (src: string, style: Style): PosterNode => ({ type: "img", props: { src, style } });

/** An inline SVG drawing as an image (shapes, stars). */
export const svgImage = (markup: string, style: Style): PosterNode =>
  image(`data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`, style);
