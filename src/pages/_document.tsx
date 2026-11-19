import { siteLocale } from "@/concept/site/language";
import { type DocumentProps, Head, Html, Main, NextScript } from "next/document";

export default function Document({ __NEXT_DATA__ }: DocumentProps) {
  return (
    <Html lang={siteLocale(__NEXT_DATA__.page)}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
