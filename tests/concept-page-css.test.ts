import { describe, expect, it } from "vitest";
import { MAX_CSS_LENGTH, PAGE_ROOT, sanitizeCss } from "@/concept/page/css";

const clean = (css: string) => sanitizeCss(css);

describe("custom CSS", () => {
  it("scopes every rule under the booking page root", () => {
    expect(clean("h1 { color: red }")).toBe(`${PAGE_ROOT} h1{color:red}`);
    expect(clean("h1, .card > p { letter-spacing: 0.02em; margin: 0 }")).toBe(`${PAGE_ROOT} h1,${PAGE_ROOT} .card > p{letter-spacing:0.02em;margin:0}`);
    expect(clean("body { background: #fff }")).toBe(`${PAGE_ROOT}{background:#fff}`);
    expect(clean("html body h2 { color: blue }")).toBe(`${PAGE_ROOT} body h2{color:blue}`);
    expect(clean(":root { --ui-action: #102030 }")).toBe(`${PAGE_ROOT}{--ui-action:#102030}`);
    expect(clean(":root { --ui-danger: #00ff00; --ui-success-bg: red; color: red }")).toBe(`${PAGE_ROOT}{color:red}`);
    expect(clean("* { box-sizing: border-box }")).toBe("");
    expect(clean("* { margin: 0 }")).toBe(`${PAGE_ROOT} *{margin:0}`);
    expect(clean('a[href^="https://x.example"] { color: red }')).toBe(`${PAGE_ROOT} a[href^="https://x.example"]{color:red}`);
  });

  it("keeps media queries and scopes what is inside", () => {
    expect(clean("@media (min-width: 640px) { h1 { font-size: 3rem } }")).toBe(`@media (min-width: 640px){${PAGE_ROOT} h1{font-size:3rem}}`);
    expect(clean("@media screen { @media print { h1 { color: red } } }")).toBe("");
    expect(clean("@media (min-width:1px){ }")).toBe("");
  });

  it("drops @import, @font-face and every other at-rule", () => {
    for (const css of [
      '@import url("https://evil.example/x.css");',
      "@import 'https://evil.example/x.css';",
      '@IMPORT url(//evil.example/x.css) screen;',
      "@charset 'utf-8'; @namespace svg url(http://www.w3.org/2000/svg);",
      "@font-face { font-family: x; src: url(https://evil.example/f.woff2) }",
      "@keyframes spin { from { color: red } to { color: blue } }",
      "@page { margin: 0 }",
      "@-moz-document url-prefix() { h1 { color: red } }",
      "@supports (display: grid) { h1 { color: red } }",
    ]) expect(clean(css), css).toBe("");
    expect(clean('@import url("https://evil.example/x.css"); h1 { color: red }')).toBe(`${PAGE_ROOT} h1{color:red}`);
  });

  it("cannot close the style element or start a tag", () => {
    for (const css of [
      "</style><script>alert(1)</script>",
      "h1 { color: red } </style><script>alert(1)</script> h2 { color: blue }",
      "h1 { content: '</style><img src=x onerror=alert(1)>' }",
      "h1 { color: red; } </STYLE ><svg onload=alert(1)>",
      "<!-- h1 { color: red } -->",
    ]) {
      const out = clean(css);
      expect(out, css).not.toMatch(/<|<\/|script|onerror|onload/i);
    }
    expect(clean("</style><script>alert(1)</script> h1 { color: red }")).toBe("");
  });

  it("drops declarations with script hooks, keeping the harmless ones next to them", () => {
    for (const bad of [
      "width: expression(alert(1))",
      "width: EXPRESSION ( alert(1) )",
      "color: red; background: url(javascript:alert(1))",
      "background-image: url('javascript:alert(1)')",
      "background: url(  JaVaScRiPt:alert(1) )",
      "behavior: url(xss.htc)",
      "-moz-binding: url(https://evil.example/xbl.xml#x)",
      "background: url(vbscript:msgbox(1))",
      "background: url(data:image/svg+xml;base64,PHN2Zz4=)",
      "background: url(data:text/html,<script>alert(1)</script>)",
      "background-image: image-set('https://evil.example/x.png' 1x)",
      "width: calc(expression(alert(1)))",
    ]) {
      const out = clean(`h1 { ${bad}; margin: 0 }`);
      expect(out, bad).not.toMatch(/expression|javascript|vbscript|behavior|binding|data:|image-set|url\(\s*'?javascript/i);
      expect(out, bad).toBe(bad.startsWith("color: red") ? `${PAGE_ROOT} h1{color:red;margin:0}` : `${PAGE_ROOT} h1{margin:0}`);
    }
  });

  it("allows only same-origin images in backgrounds", () => {
    expect(clean("h1 { background: url(/demo/salon.webp) center / cover }")).toBe(`${PAGE_ROOT} h1{background:url(/demo/salon.webp) center / cover}`);
    expect(clean('h1 { background-image: url("/demo/hair.webp") }')).toBe(`${PAGE_ROOT} h1{background-image:url("/demo/hair.webp")}`);
    expect(clean("h1 { background: url('/img/a.svg') }")).toContain("/img/a.svg");
    for (const url of [
      "https://evil.example/x.png",
      "http://evil.example/x.png",
      "//evil.example/x.png",
      "/\\evil.example/x.png",
      "/../../etc/passwd.png",
      "/demo/../x.png",
      "/demo/a.html",
      "/demo/script.js",
      "demo/relative.png",
      "ftp://x/x.png",
      "/demo/a.png?x=1",
      "/demo/a.png#frag",
      "",
    ]) expect(clean(`h1 { background: url(${url}) }`), url).toBe("");
    expect(clean("h1 { background: url(/a.png), url(https://evil.example/b.png) }")).toBe("");
    expect(clean("h1 { color: url(/demo/salon.webp) }")).toBe("");
    expect(clean("h1 { border-image-source: url(/demo/salon.webp) }")).toBe("");
    expect(clean("h1 { cursor: url(/demo/a.png), auto }")).toBe("");
    expect(clean("h1 { list-style-image: url(/demo/a.png) }")).toBe("");
    expect(clean("h1 { content: url(/demo/a.png) }")).toBe("");
  });

  it("cannot be tricked by escapes, comments or odd spacing", () => {
    for (const css of [
      "h1 { background: \\75rl(https://evil.example/x.png) }",
      "h1 { background: u\\rl(https://evil.example/x.png) }",
      "h1 { background: ur/**/l(https://evil.example/x.png) }",
      "h1 { background: url/**/(https://evil.example/x.png) }",
      "h1 { width: exp\\72ession(alert(1)) }",
      "h1 { width: expr/**/ession(alert(1)) }",
      "h1 { background: java\\0script:alert(1) }",
      "h1 { background: url(java\tscript:alert(1)) }",
      "@\\69mport url(https://evil.example/x.css);",
      "@im/**/port url(https://evil.example/x.css);",
      "h1 { background: url(\"https://evil.example/x.png\" ) }",
      "h1 { background: URL(HTTPS://evil.example/x.png) }",
    ]) {
      const out = clean(css);
      expect(out, css).not.toMatch(/evil|alert|expression|import|\\/i);
    }
  });

  it("cannot break out of a rule or inject a selector", () => {
    for (const css of [
      "h1 { color: red } body { background: url(https://evil.example/x.png) }",
      "h1 { color: red; } } body { color: blue }",
      "h1 { color: red } } } .x { position: fixed }",
      "h1 {{ color: red }}",
      "h1 { color: red; } h2 { background: url(https://evil.example/y.png)",
      "a { color: red; } @media screen { } } html { display: none }",
    ]) {
      const out = clean(css);
      expect(out, css).not.toMatch(/evil/);
      for (const rule of out.split("\n")) expect(rule === "" || rule.startsWith(PAGE_ROOT) || rule.startsWith("@media"), `${css} -> ${rule}`).toBe(true);
    }
    expect(clean("h1 { color: red } } body { color: blue }")).toBe(`${PAGE_ROOT} h1{color:red}`);
  });

  it("refuses selectors that could reach outside the page or carry code", () => {
    for (const selector of ["h1 }", "{h1", "h1 @x", "h1 \\ h2", "h1\"", "h1 ' h2", `a[href="x]`, "a".repeat(300)]) {
      expect(clean(`${selector} { color: red }`), selector).toBe("");
    }
    expect(clean("h1, ,h2 { color: red }")).toBe("");
    expect(clean("{ color: red }")).toBe("");
    expect(clean("h1 { }")).toBe("");
  });

  it("allows only properties that cannot change how the page behaves", () => {
    for (const css of [
      "position: fixed",
      "position: sticky",
      "position: absolute",
      "visibility: hidden",
      "pointer-events: none",
      "z-index: 99999",
      "content: 'x'",
      "clip-path: inset(0)",
      "animation: spin 1s infinite",
      "transition: all 1s",
      "-webkit-user-modify: read-write",
      "src: url(/a.woff)",
      "filter: url(/x.svg#f)",
    ]) expect(clean(`h1 { ${css} }`), css).toBe("");
    expect(clean("h1 { position: relative; margin-top: 2px }")).toBe(`${PAGE_ROOT} h1{position:relative;margin-top:2px}`);
    expect(clean("h1 { color: red !important }")).toBe(`${PAGE_ROOT} h1{color:red}`);
  });

  it("keeps ordinary styling", () => {
    const css = clean(`
      /* calmer headings */
      h1, h2 { font-family: "Iowan Old Style", Georgia, serif; letter-spacing: .02em; text-transform: uppercase }
      .rounded-2xl { border-radius: 24px; box-shadow: 0 8px 24px rgb(0 0 0 / 8%) }
      a:hover { text-decoration: underline; color: #2f5d50 }
      button { background: linear-gradient(#fff, #eee); border: 1px solid rgb(10 20 30) }
    `);
    expect(css.split("\n")).toHaveLength(4);
    expect(css).toContain('font-family:"Iowan Old Style", Georgia, serif');
    expect(css).toContain(`${PAGE_ROOT} a:hover{text-decoration:underline;color:#2f5d50}`);
    expect(css).toContain("box-shadow:0 8px 24px rgb(0 0 0 / 8%)");
  });

  it("copes with junk, huge input and strange characters", () => {
    expect(clean("")).toBe("");
    expect(clean("   \n\t ")).toBe("");
    expect(clean("}}}{{{;;;")).toBe("");
    expect(clean("h1 { color: red")).toBe("");
    expect(clean("/* unterminated h1 { color: red }")).toBe("");
    expect(clean("h1 { color: 'unterminated }")).toBe("");
    expect(clean("h1 { color: red\u0000; margin: 0 }")).toBe(`${PAGE_ROOT} h1{color:red;margin:0}`);
    expect(clean("x".repeat(MAX_CSS_LENGTH * 3))).toBe("");
    const many = clean("h1 { color: red }\n".repeat(1000));
    expect(many.split("\n").length).toBeLessThanOrEqual(200);
    expect(clean(`${"h1 { color: red }".repeat(1)}${" ".repeat(MAX_CSS_LENGTH)}h2 { color: blue }`)).toBe(`${PAGE_ROOT} h1{color:red}`);
    expect(() => clean("(".repeat(50000) + "[".repeat(50000))).not.toThrow();
  });

  it("puts nothing on the page that could run script, for any input", () => {
    const parts = ["<", ">", "</style>", "<script>", "url(", ")", "{", "}", ";", ":", "@import", "expression(", "javascript:", "\\", "/*", "*/", "'", '"', "h1", "body", "color", "background", "red", " ", "\n", "!important", "behavior", "-moz-binding", "https://evil.example/", "/demo/a.png", "position", "fixed", ",", "@media screen"];
    let seed = 1234567;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 3000; i++) {
      const input = Array.from({ length: 1 + Math.floor(next() * 14) }, () => parts[Math.floor(next() * parts.length)]).join(next() < 0.5 ? "" : " ");
      const out = clean(input);
      expect(out, input).not.toMatch(/[<\\]|expression|javascript:|vbscript|behavior|binding|@import|evil|data:|\bscript\b/i);
      for (const rule of out.split("\n").filter(Boolean)) expect(rule.startsWith(PAGE_ROOT) || rule.startsWith("@media"), `${input} -> ${rule}`).toBe(true);
      expect((out.match(/url\(/gi) ?? []).length === (out.match(/url\(\s*["']?\/(?!\/)[\w\-./]+\.(?:png|jpe?g|webp|gif|avif|svg)["']?\s*\)/gi) ?? []).length, `${input} -> ${out}`).toBe(true);
    }
  });
});
