import { Head, Html, Main, NextScript } from "next/document";

// The pages router serves the public product site in English.
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
