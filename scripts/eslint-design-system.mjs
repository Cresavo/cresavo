// Report each occurrence separately so the adoption baseline is countable.
const raw = new Set(["button", "dialog", "input", "select", "textarea"]);
const hex = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])/gi;
const size = /(?:^|[\s:])!?-?(?:p[trblxyse]?|m[trblxyse]?|space-[xy]|gap(?:-[xy])?|(?:min-|max-)?[wh]|size|text|leading|tracking|inset(?:-[xy])?|top|right|bottom|left|start|end|basis|rounded(?:-[a-z]+)?|translate-[xy])-\[((?:[^\]\s]|\\.)+)\]/g;

function strings(check) {
  return {
    Literal(node) { if (typeof node.value === "string") check(node, node.value); },
    TemplateElement(node) { check(node, node.value.raw); },
  };
}

export const designSystem = {
  rules: {
    "shared-controls": {
      create(context) {
        return { JSXOpeningElement(node) {
          if (raw.has(node.name.name)) context.report({ node: node.name, message: "Use the shared UI control for <{{tag}}>.", data: { tag: node.name.name } });
        } };
      },
    },
    "no-hex": {
      create(context) {
        return strings((node, value) => {
          if (!value.includes("#")) return;
          const attr = context.sourceCode.getAncestors(node).findLast(parent => parent.type === "JSXAttribute");
          if (!["className", "style"].includes(attr?.name.name)) return;
          for (const [color] of value.matchAll(hex)) {
            context.report({ node, message: "Use a theme colour in place of {{color}}.", data: { color } });
          }
        });
      },
    },
    "token-sizes": {
      create(context) {
        return strings((node, value) => {
          for (const [utility, dimension] of value.matchAll(size)) {
            // A colour, font family or URL inside text-[…] is not a size.
            if (!/(?:\d(?:px|r?em|%|[dls]?v[wh]|ch|ex|pt)|^0$|^(?:length:|calc\(|clamp\(|min\(|max\())/i.test(dimension)) continue;
            context.report({ node, message: "Use a named size for {{utility}}.", data: { utility: utility.trim() } });
          }
        });
      },
    },
  },
};
