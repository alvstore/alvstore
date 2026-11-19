import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "@/index.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ALV Store — Premium Home Theater & Apple Products | Udaipur, Rajasthan",
  description:
    "Premium Dolby Atmos home theater installations, 4K laser projection, acoustic design & Apple products. Expert installations in Udaipur, Jaipur & across Rajasthan.",
  authors: [{ name: "ALV Store" }],
  robots: "index, follow",
  openGraph: {
    type: "website",
    title: "ALV Store — Premium Home Theater & Apple Products",
    description:
      "Premium Dolby Atmos home theater installations, 4K laser projection, acoustic design & Apple products in Udaipur, Rajasthan.",
    siteName: "ALV Store",
  },
  twitter: {
    card: "summary_large_image",
    site: "@alvstore",
    title: "ALV Store — Premium Home Theater & Apple Products",
    description:
      "Premium Dolby Atmos home theater installations, 4K laser projection, acoustic design & Apple products in Udaipur, Rajasthan.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // translate="no" prevents browser auto-translate from mutating React's
    // DOM (a common source of "removeChild" crashes in React apps).
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
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
