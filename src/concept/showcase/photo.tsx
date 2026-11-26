/** The showcase photos in public/showcase: 1536 × 1024 with a 768 px copy, except the bold detail, a 760 × 1024 crop with a 400 px copy. */
export type PhotoName = `${"klassisk" | "vagad"}-${"hero" | "hands" | "products" | "detail"}`;

const PORTRAIT: PhotoName = "vagad-detail";

/** A pre-sized webp with a narrow and a wide source; the browser picks by the layout's `sizes`. */
export function Photo({ name, alt, sizes, className, eager = false }: { name: PhotoName; alt: string; sizes: string; className?: string; eager?: boolean }) {
  const [wide, small] = name === PORTRAIT ? [760, 400] : [1536, 768];
  return (
    // Pre-optimised files from public/showcase; next/image only serves /demo/** here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={`/showcase/${name}.webp`}
      srcSet={`/showcase/${name}-sm.webp ${small}w, /showcase/${name}.webp ${wide}w`}
      sizes={sizes}
      width={wide}
      height={1024}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
    />
  );
}
