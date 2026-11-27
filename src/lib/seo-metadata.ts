import type { Metadata } from "next";
import type { UdaipurSolutionPillar } from "./udaipur-pillars";

export const SITE_URL = "https://alvstore.com";
export const OG_IMAGE_URL = `${SITE_URL}/og-studio.png`;
export const LOGO_IMAGE_URL = `${SITE_URL}/alvstore-logo.png`;

export const PRIVATE_NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const PUBLIC_ROBOTS_METADATA: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

export const HOME_METADATA: Metadata = {
  title: "ALVStore Udaipur — Home Theater, Speakers & Zigbee Studio",
  description:
    "Udaipur's AV, home theater & smart lighting studio since 2009. 4K laser projectors, speakers, cafe & lounge pro audio, RGBW lights & Zigbee 3.0 automation.",
  robots: PUBLIC_ROBOTS_METADATA,
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  openGraph: {
    type: "website",
    title: "ALVStore Udaipur — Home Theater, Speakers & Zigbee Studio",
    description:
      "Private cinemas, 4K laser projectors, pro cafe & lounge sound systems, RGBW architectural lighting & Zigbee 3.0 automation in Udaipur & pan-India.",
    siteName: "ALVStore",
    url: `${SITE_URL}/`,
    locale: "en_IN",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "ALVStore Udaipur — Home Theater, Pro Audio, Projectors, RGBW Lighting & Zigbee Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@alvstore",
    title: "ALVStore Udaipur — Home Theater, Speakers & Zigbee Studio",
    description:
      "Bespoke private cinemas, 4K laser projectors, lounge/cafe speakers, RGBW lights & Zigbee automation in Udaipur.",
    images: [OG_IMAGE_URL],
  },
};

export const CONTACT_METADATA: Metadata = {
  title: "Contact ALVStore Udaipur — AV, Lighting & Cinema Studio",
  description:
    "Visit ALVStore in Sector 11, Hiran Magri, Udaipur or book a site survey for home theater, speakers, projectors, lounge audio, RGBW lights & Zigbee automation.",
  robots: PUBLIC_ROBOTS_METADATA,
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    type: "website",
    title: "Contact ALVStore Udaipur — AV, Lighting & Cinema Studio",
    description:
      "Book a private cinema consultation, cafe/lounge sound survey, or RGBW & Zigbee demo in Udaipur. Call +91 98876 01200.",
    siteName: "ALVStore",
    url: `${SITE_URL}/contact`,
    locale: "en_IN",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Contact ALVStore Udaipur AV & Smart Lighting Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@alvstore",
    title: "Contact ALVStore Udaipur — AV, Lighting & Cinema Studio",
    description:
      "Visit our Udaipur studio or schedule an on-site home theater, commercial audio & Zigbee automation survey.",
    images: [OG_IMAGE_URL],
  },
};

export function buildSolutionMetadata(pillar: UdaipurSolutionPillar): Metadata {
  const url = `${SITE_URL}/${pillar.slug}`;
  return {
    title: pillar.seoTitle,
    description: pillar.seoDescription,
    keywords: pillar.targetKeywords,
    robots: PUBLIC_ROBOTS_METADATA,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      title: pillar.seoTitle,
      description: pillar.seoDescription,
      siteName: "ALVStore",
      url,
      locale: "en_IN",
      images: [
        {
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: `${pillar.serviceName} — ALVStore Udaipur`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@alvstore",
      title: pillar.seoTitle,
      description: pillar.seoDescription,
      images: [OG_IMAGE_URL],
    },
  };
}

export const ORGANIZATION_NODE = {
  "@type": ["HomeAndConstructionBusiness", "ElectronicsStore"],
  "@id": `${SITE_URL}/#organization`,
  name: "ALVStore",
  alternateName: "ALVStore Cinema, Pro Audio & Automation Studio Udaipur",
  foundingDate: "2009",
  url: `${SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: LOGO_IMAGE_URL,
  },
  image: [OG_IMAGE_URL, LOGO_IMAGE_URL],
  description:
    "Udaipur's audio-visual, home theater, 4K laser projection, commercial lounge/cafe sound, RGBW architectural lighting & Zigbee 3.0 automation studio since 2009.",
  telephone: "+919887601200",
  email: "sales@alvstore.in",
  hasMap:
    "https://www.google.com/maps/place/ALVStore/@24.5565502,73.6183586,13z/data=!4m10!1m2!2m1!1salvstore+udaipur!3m6!1s0x3967ef9b8c78f0ff:0xf8f768b025f591e0!8m2!3d24.5565502!4d73.6945763!15sChBhbHZzdG9yZSB1ZGFpcHVyWhIiEGFsdnN0b3JlIHVkYWlwdXKSARFlbGVjdHJvbmljc19zdG9yZeABAA!16s%2Fg%2F1tfktqnp?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D",
  priceRange: "₹₹₹₹",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Shop No. 2, 229, Alok School Road, Sector 11, Hiran Magri",
    addressLocality: "Udaipur",
    addressRegion: "Rajasthan",
    postalCode: "313001",
    addressCountry: "IN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 24.5565502,
    longitude: 73.6945763,
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+919887601200",
    email: "sales@alvstore.in",
    contactType: "customer service",
    areaServed: "IN",
  },
  areaServed: [
    { "@type": "City", name: "Udaipur" },
    { "@type": "City", name: "Nathdwara" },
    { "@type": "City", name: "Kumbhalgarh" },
    { "@type": "City", name: "Chittorgarh" },
    { "@type": "City", name: "Mount Abu" },
    { "@type": "AdministrativeArea", name: "Rajasthan" },
    { "@type": "AdministrativeArea", name: "Gujarat" },
    { "@type": "AdministrativeArea", name: "Delhi NCR" },
    { "@type": "AdministrativeArea", name: "Maharashtra" },
    { "@type": "Country", name: "India" },
  ],
  knowsAbout: [
    "Bespoke Private Cinemas & Home Theaters",
    "Native 4K Laser Projectors & Motorized Screens",
    "Home & Pro Speakers, Subwoofers & PA Systems",
    "Cafe, Lounge & Rooftop Multi-Zone Audio",
    "RGBW & Tunable White Architectural Lighting",
    "Zigbee 3.0 Smart Home & Hospitality Automation",
    "Dirac Live & Audyssey Room Acoustic Calibration",
    "Dolby Atmos Spatial Audio",
    "Denon, Marantz, Arcam, JBL Synthesis, Bowers & Wilkins & KEF",
  ],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "10:00",
      closes: "20:00",
    },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Udaipur Cinema, Audio, Lighting & Automation Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Bespoke Home Theater & Private Cinema Installation",
          serviceType: "Home Theater Design & Dolby Atmos Acoustic Engineering",
          url: `${SITE_URL}/home-theater-udaipur`,
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: [{ "@type": "City", name: "Udaipur" }, { "@type": "Country", name: "India" }],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Home, Outdoor & Pro Audio Speakers",
          serviceType: "Tower, In-Ceiling, Outdoor IP65 & PA Loudspeakers",
          url: `${SITE_URL}/speakers-udaipur`,
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: [{ "@type": "City", name: "Udaipur" }, { "@type": "Country", name: "India" }],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Native 4K Laser Projectors & Screens",
          serviceType: "Sony SXRD, JVC D-ILA, UST Laser TVs & Optical Calibration",
          url: `${SITE_URL}/projectors-udaipur`,
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: [{ "@type": "City", name: "Udaipur" }, { "@type": "Country", name: "India" }],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Cafe, Lounge & Rooftop Commercial Sound & PA",
          serviceType: "Multi-Zone 70V/100V BGM Audio, Club Subwoofers & Venue Lighting",
          url: `${SITE_URL}/commercial-audio-lounge-cafe-udaipur`,
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: [{ "@type": "City", name: "Udaipur" }, { "@type": "AdministrativeArea", name: "Rajasthan" }],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "RGBW Architectural Lighting & Zigbee 3.0 Automation",
          serviceType: "24V RGBCW Lighting & Wireless Zigbee Smart Home Retrofits",
          url: `${SITE_URL}/rgbw-lighting-zigbee-automation-udaipur`,
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: [{ "@type": "City", name: "Udaipur" }, { "@type": "Country", name: "India" }],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Dirac Live Calibration & Projector Optical Maintenance",
          serviceType: "Acoustic Room Calibration & After-Sales Maintenance",
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: [{ "@type": "City", name: "Udaipur" }, { "@type": "Country", name: "India" }],
        },
      },
    ],
  },
} as const;

const WEBSITE_NODE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: "ALVStore",
  inLanguage: "en-IN",
  publisher: { "@id": `${SITE_URL}/#organization` },
} as const;

export function buildHomeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION_NODE,
      WEBSITE_NODE,
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#webpage`,
        url: `${SITE_URL}/`,
        name: HOME_METADATA.title,
        description: HOME_METADATA.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: OG_IMAGE_URL,
        },
        inLanguage: "en-IN",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
        ],
      },
    ],
  };
}

export function buildContactJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION_NODE,
      WEBSITE_NODE,
      {
        "@type": "ContactPage",
        "@id": `${SITE_URL}/contact#webpage`,
        url: `${SITE_URL}/contact`,
        name: CONTACT_METADATA.title,
        description: CONTACT_METADATA.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en-IN",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/contact#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Contact Udaipur Studio",
            item: `${SITE_URL}/contact`,
          },
        ],
      },
    ],
  };
}

export function buildSolutionJsonLd(pillar: UdaipurSolutionPillar) {
  const url = `${SITE_URL}/${pillar.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION_NODE,
      WEBSITE_NODE,
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: pillar.serviceName,
        serviceType: pillar.serviceType,
        description: pillar.seoDescription,
        provider: { "@id": `${SITE_URL}/#organization` },
        areaServed: [
          { "@type": "City", name: "Udaipur" },
          { "@type": "AdministrativeArea", name: "Rajasthan" },
          { "@type": "Country", name: "India" },
        ],
        url,
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: pillar.seoTitle,
        description: pillar.seoDescription,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${url}#service` },
        mainEntity: { "@id": `${url}#service` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: OG_IMAGE_URL,
        },
        inLanguage: "en-IN",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: pillar.navLabel,
            item: url,
          },
        ],
      },
    ],
  };
}
