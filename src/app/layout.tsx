import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "@/index.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://alvstore.com"),
  title: "ALVStore — Bespoke Private Cinemas, 4K Laser Projection & Luxury Home Theaters",
  description:
    "ALVStore designs, engineers, and installs bespoke private cinemas and reference home theaters across India. Authorized partner for Denon, Marantz, JBL Synthesis, Bowers & Wilkins, KEF, Sony 4K & JVC laser projection with Dirac Live acoustic calibration.",
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
  alternates: {
    canonical: "https://alvstore.com",
  },
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
    title: "ALVStore — Bespoke Private Cinemas & Reference Home Theaters",
    description:
      "Engineered private cinemas, native 4K laser projection, and reference spatial acoustics. Designed, installed, and calibrated nationwide.",
    siteName: "ALVStore",
    url: "/",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    site: "@alvstore",
    title: "ALVStore — Bespoke Private Cinemas & Luxury Home Theaters",
    description:
      "Engineered private cinemas, native 4K laser projection, and reference spatial acoustics nationwide.",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "HomeAndConstructionBusiness",
      "@id": "https://alvstore.com/#organization",
      "name": "ALVStore",
      "alternateName": "ALVStore Cinema Engineering",
      "url": "https://alvstore.com",
      "logo": "https://alvstore.com/alvstore-logo.png",
      "description":
        "Bespoke private cinema design, native 4K laser projection, architectural spatial acoustics, and reference amplification.",
      "telephone": "+919887601200",
      "email": "sales@alvstore.in",
      "hasMap":
        "https://www.google.com/maps/place/ALVStore/@24.5565502,73.6183586,13z/data=!4m10!1m2!2m1!1salvstore+udaipur!3m6!1s0x3967ef9b8c78f0ff:0xf8f768b025f591e0!8m2!3d24.5565502!4d73.6945763!15sChBhbHZzdG9yZSB1ZGFpcHVyWhIiEGFsdnN0b3JlIHVkYWlwdXKSARFlbGVjdHJvbmljc19zdG9yZeABAA!16s%2Fg%2F1tfktqnp?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D",
      "priceRange": "₹₹₹₹",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Shop No. 2, 229, Alok School Road, Sector 11, Hiran Magri",
        "addressLocality": "Udaipur",
        "addressRegion": "Rajasthan",
        "postalCode": "313001",
        "addressCountry": "IN",
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 24.5565502,
        "longitude": 73.6945763,
      },
      "areaServed": [
        { "@type": "Country", "name": "India" },
        { "@type": "AdministrativeArea", "name": "Rajasthan" },
        { "@type": "AdministrativeArea", "name": "Delhi NCR" },
        { "@type": "AdministrativeArea", "name": "Gujarat" },
        { "@type": "AdministrativeArea", "name": "Maharashtra" },
      ],
      "knowsAbout": [
        "Bespoke Private Cinemas",
        "Native 4K Laser Projection",
        "Dirac Live Room Calibration",
        "Architectural Acoustic Treatment",
        "Dolby Atmos 9.4.6 Spatial Audio",
        "Denon & Marantz Amplification",
        "JBL Synthesis Reference Systems",
      ],
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          "opens": "10:00",
          "closes": "20:00",
        },
      ],
    },
  ],
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
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
