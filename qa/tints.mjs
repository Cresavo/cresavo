// Same-hue text on tinted backgrounds (e.g. green text on a green chip): passes AA maybe, but reads poorly.
// Flags text whose colour has the background's hue, on a visibly tinted background, with contrast below QA_TINT_LIMIT (default 5.5:1).
import { launch, newContext, save, settle, shot, DEMO } from "./lib.mjs";
import { MAIN_PAGES } from "./pages.mjs";

const LIMIT = Number(process.env.QA_TINT_LIMIT ?? 5.5);
const browser = await launch();
const found = [];
for (const mode of [{ name: "light", dark: false }, { name: "dark", dark: true }]) {
  const ctx = await newContext(browser, { viewport: "desktop", dark: mode.dark });
  const page = await ctx.newPage();
  for (const path of MAIN_PAGES) {
    await page.goto(DEMO + path); await settle(page);
    const hits = await page.evaluate((LIMIT) => {
      const parse = c => { const srgb = c.startsWith("color(srgb"); const m = c.replace("color(srgb", "").match(/[\d.]+(e-?\d+)?/g)?.map(Number) ?? [0, 0, 0, 0]; const k = srgb ? 255 : 1; return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m.length > 3 ? m[3] : 1 }; };
      const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
      const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let acc = { r: 255, g: 255, b: 255, a: 1 }; for (const l of layers.reverse()) acc = over(l, acc); return acc; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const hsl = c => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l }; };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n; (n = walker.nextNode());) {
        const el = n.parentElement; if (!el || seen.has(el) || !n.textContent.trim()) continue; seen.add(el);
        const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
        if (!r.width || !r.height || st.visibility === "hidden" || +st.opacity === 0) continue;
        // Text over a photo or gradient (a hero) has no single background colour: skip it.
        let onImage = false; for (let e = el, i = 0; e && i < 6; e = e.parentElement, i++) { if (getComputedStyle(e).backgroundImage !== "none" || e.querySelector(":scope > img, :scope > picture")) { onImage = true; break; } }
        if (onImage) continue;
        const fg = over(parse(st.color), bgOf(el)), bg = bgOf(el);
        const hb = hsl(bg), hf = hsl(fg);
        if (hb.s < 0.15 || hf.s < 0.15) continue; // only tinted backgrounds with coloured text
        const dh = Math.min(Math.abs(hb.h - hf.h), 360 - Math.abs(hb.h - hf.h));
        const cr = ratio(fg, bg);
        if (dh <= 25 && cr < LIMIT) out.push({ text: n.textContent.trim().slice(0, 50), ratio: Math.round(cr * 100) / 100, fg: st.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, size: st.fontSize, weight: st.fontWeight, cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 80) });
      }
      return out;
    }, LIMIT);
    for (const h of hits) found.push({ mode: mode.name, path, ...h });
    if (hits.length) await shot(page, `tints-${mode.name}-${path.replace(/\W+/g, "_")}`);
  }
  await ctx.close();
}
await browser.close();
save("tints.json", found);
for (const f of found) console.log(`${f.mode} ${f.path} "${f.text}" ${f.ratio}:1 ${f.fg} on ${f.bg} ${f.size}/${f.weight}`);
console.log(`${found.length} same-hue low-contrast text items`);
