import { Head, Html, Main, NextScript } from "next/document";

// The pages router serves the platform's two public sites (coming soon and the demo landing), both in English.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
