import { Head, Html, Main, NextScript, type DocumentProps } from "next/document";

// The pages router serves the landing sketch: Swedish at /landing, English under /en.
export default function Document({ __NEXT_DATA__ }: DocumentProps) {
  return (
    <Html lang={__NEXT_DATA__.page.startsWith("/en/") ? "en" : "sv"}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
