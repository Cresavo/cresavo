import { BRAND } from "../brand";
import { cx } from "./cx";

// The product wordmark: the original outlined paths from
// design/brand/libovo-v0.9/logo/*.svg (all five variants share them; only the
// fill differs). The fill is the text token, which is the kit's light variant
// (#2C242E) in the light theme and its dark variant (#FBF5F0) in the dark one.
// Renaming the product means replacing these paths and BRAND.name.

/**
 * The full wordmark. Give it a width (110–140 px in the mobile bar, never below 92 px); the height follows.
 * `inverse` is the kit's white variant, for a fixed dark brand surface such as a plum hero.
 */
export function Wordmark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 24 296.010 104" role="img" aria-label={BRAND.name} className={cx("h-auto", inverse ? "fill-white" : "fill-text", className)}>
      <g transform="translate(0,118.975) scale(0.115, -0.115)">
      <path d="M242 92C193 92 182 92 182 172V750H58V121C58 49 97 -10 186 -10H231Z" transform="translate(0,0)" />
      <path d="M182 576V700H58V576ZM182 0V500H58V0Z" transform="translate(239,0)" />
      <path d="M298 -10C458 -10 543 109 543 249C543 389 458 508 298 508C246 508 213 496 181 475V750H57V0H173L175 28C210 4 243 -10 298 -10ZM290 406C370 406 416 342 416 249C416 156 370 92 290 92C210 92 175 156 175 249C175 342 210 406 290 406Z" transform="translate(455,0)" />
      <path d="M281 -10C441 -10 534 109 534 249C534 389 441 508 281 508C121 508 28 389 28 249C28 109 121 -10 281 -10ZM281 406C361 406 407 342 407 249C407 156 361 92 281 92C201 92 155 156 155 249C155 342 201 406 281 406Z" transform="translate(1002,0)" />
      <path d="M493 500H371L248 154L125 500H3L195 0H301Z" transform="translate(1540,0)" />
      <path d="M281 -10C441 -10 534 109 534 249C534 389 441 508 281 508C121 508 28 389 28 249C28 109 121 -10 281 -10ZM281 406C361 406 407 342 407 249C407 156 361 92 281 92C201 92 155 156 155 249C155 342 201 406 281 406Z" transform="translate(2012,0)" />
      </g>
    </svg>
  );
}
