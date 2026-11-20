import { siteLocale } from "@/concept/site/language";
import Document, { type DocumentContext, type DocumentInitialProps, Head, Html, Main, NextScript } from "next/document";

type Props = DocumentInitialProps & { nonce?: string };

// The proxy sets a per-request CSP nonce; the Pages Router needs it passed to Head and NextScript.
export default class SiteDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<Props> {
    const initialProps = await Document.getInitialProps(ctx);
    const nonce = ctx.req?.headers["x-nonce"];
    return { ...initialProps, nonce: typeof nonce === "string" ? nonce : undefined };
  }

  render() {
    const { nonce } = this.props;
    return (
      <Html lang={siteLocale(this.props.__NEXT_DATA__.page)}>
        <Head nonce={nonce} />
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
