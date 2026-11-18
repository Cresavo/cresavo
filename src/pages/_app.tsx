import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import "@/concept/ui/brand-theme.css";
import "@/concept/site/site-base.css";

// The pages router (the two public sites) gets the same brand tokens and UI font as the app router.
const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} site`}>
      <Component {...pageProps} />
    </div>
  );
}
