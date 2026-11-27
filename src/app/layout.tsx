import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "@/index.css";
import { Providers } from "./providers";
import { OG_IMAGE_URL, SITE_URL } from "@/lib/seo-metadata";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ALVStore Udaipur — Home Theater, Speakers & Zigbee Studio",
  description:
    "Udaipur's AV, home theater & smart lighting studio since 2009. 4K laser projectors, speakers, cafe & lounge pro audio, RGBW lights & Zigbee 3.0 automation.",
  keywords: [
    "best home theater in Udaipur",
    "home theater installation Udaipur",
    "4K laser projector dealer Udaipur",
    "best speakers showroom Udaipur",
    "cafe and lounge sound system Udaipur",
    "commercial PA speakers Udaipur",
    "RGBW architectural lighting Udaipur",
    "Zigbee smart home automation Udaipur",
    "Dirac Live acoustic calibration",
    "Denon Marantz JBL KEF Udaipur",
    "Sony JVC 4K laser cinema",
    "rooftop restaurant audio lighting Udaipur",
  ],
  authors: [{ name: "ALVStore" }],
  // Default to noindex so unlisted/404 and utility routes never emit index,follow;
  // public landing pages explicitly opt in via PUBLIC_ROBOTS_METADATA.
  robots: {
    index: false,
    follow: false,
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
