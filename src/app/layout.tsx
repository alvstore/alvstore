import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "@/index.css";
import { Providers } from "./providers";
import { OG_IMAGE_URL, SITE_URL } from "@/lib/seo-metadata";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ALVStore — Bespoke Private Cinemas & Home Theaters",
  description:
    "Bespoke private cinemas, 4K laser projection & Dirac Live calibration across India. Authorised Denon, Marantz, JBL Synthesis & KEF partner.",
  keywords: [
    "private cinema design",
    "bespoke home theaters",
    "luxury home theater India",
    "4K laser projection home cinema",
    "Dirac Live acoustic calibration",
    "Denon AV receivers India",
    "Marantz reference cinema separates",
    "JBL Synthesis theater systems",
    "Bowers and Wilkins architectural audio",
    "KEF architectural speakers",
    "Sony 4K laser projectors",
    "JVC D-ILA laser cinema",
    "custom home theater installation",
    "acoustic room treatment",
  ],
  authors: [{ name: "ALVStore" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "ALVStore — Bespoke Private Cinemas & Home Theaters",
    description:
      "Engineered private cinemas, native 4K laser projection, and reference spatial acoustics designed, installed, and calibrated nationwide.",
    siteName: "ALVStore",
    url: SITE_URL,
    locale: "en_IN",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "ALVStore — Bespoke Private Cinemas & Reference Home Theaters",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@alvstore",
    title: "ALVStore — Bespoke Private Cinemas & Home Theaters",
    description:
      "Bespoke private cinemas, native 4K laser projection, and reference spatial acoustics engineered nationwide.",
    images: [OG_IMAGE_URL],
  },
  icons: {
    icon: [
      { url: "/icon.svg?v=20261125", type: "image/svg+xml" },
      { url: "/alvstore-mark.png?v=20261125", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=20261125", sizes: "any" },
    ],
    shortcut: [{ url: "/favicon.ico?v=20261125", type: "image/x-icon" }],
    apple: [{ url: "/apple-icon.png?v=20261125", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // translate="no" prevents browser auto-translate from mutating React's
    // DOM (a common source of "removeChild" crashes in React apps).
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        {/* Self-hosted variable fonts: no third-party requests, no layout shift. */}
        <link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              @font-face { font-family: 'Archivo Studio'; src: url('/fonts/archivo-latin.woff2') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; font-display: swap; font-style: normal; }
              @font-face { font-family: 'Newsreader Studio'; src: url('/fonts/newsreader-latin.woff2') format('woff2'); font-weight: 200 800; font-display: swap; font-style: normal; }
              @font-face { font-family: 'Newsreader Studio'; src: url('/fonts/newsreader-italic-latin.woff2') format('woff2'); font-weight: 200 800; font-display: swap; font-style: italic; }
            `,
          }}
        />
      </head>
      <body>
        {/* Share the Emotion cache between streamed server and client styles. */}
        <AppRouterCacheProvider options={{ key: "mui" }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
