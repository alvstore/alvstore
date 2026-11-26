import type { Metadata } from "next";

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

export const HOME_METADATA: Metadata = {
  title: "ALVStore — Bespoke Private Cinemas & Home Theaters",
  description:
    "Bespoke private cinemas, 4K laser projection & Dirac Live calibration across India. Authorised Denon, Marantz, JBL Synthesis & KEF partner.",
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  openGraph: {
    type: "website",
    title: "ALVStore — Bespoke Private Cinemas & Home Theaters",
    description:
      "Engineered private cinemas, native 4K laser projection, and Dirac Live spatial acoustics designed, installed, and calibrated across India.",
    siteName: "ALVStore",
    url: `${SITE_URL}/`,
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
      "Bespoke private cinemas, native 4K laser projection, and Dirac Live spatial acoustics engineered nationwide.",
    images: [OG_IMAGE_URL],
  },
};

export const CONTACT_METADATA: Metadata = {
  title: "Contact ALVStore — Private Cinema Consultation",
  description:
    "Visit our Udaipur studio or book a pan-India home theater consultation, room acoustic blueprint, and 4K laser projection demo. Call +91 98876 01200.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    type: "website",
    title: "Contact ALVStore — Private Cinema Consultation",
    description:
      "Book a private cinema consultation, acoustic site survey, or in-studio 4K laser demo in Udaipur or anywhere in India.",
    siteName: "ALVStore",
    url: `${SITE_URL}/contact`,
    locale: "en_IN",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Contact ALVStore Cinema Engineering Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@alvstore",
    title: "Contact ALVStore — Private Cinema Consultation",
    description:
      "Visit ALVStore in Udaipur or arrange an on-site home cinema & acoustic consultation across India.",
    images: [OG_IMAGE_URL],
  },
};

const ORGANIZATION_NODE = {
  "@type": ["HomeAndConstructionBusiness", "ElectronicsStore"],
  "@id": `${SITE_URL}/#organization`,
  name: "ALVStore",
  alternateName: "ALVStore Cinema Engineering",
  foundingDate: "2009",
  url: `${SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: LOGO_IMAGE_URL,
  },
  image: [OG_IMAGE_URL, LOGO_IMAGE_URL],
  description:
    "Bespoke private cinema design, native 4K laser projection, architectural spatial acoustics, and reference Denon, Marantz, JBL Synthesis, Bowers & Wilkins & KEF systems.",
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
    { "@type": "Country", name: "India" },
    { "@type": "AdministrativeArea", name: "Rajasthan" },
    { "@type": "AdministrativeArea", name: "Delhi NCR" },
    { "@type": "AdministrativeArea", name: "Gujarat" },
    { "@type": "AdministrativeArea", name: "Maharashtra" },
  ],
  knowsAbout: [
    "Bespoke Private Cinemas",
    "Native 4K Laser Projection",
    "Dirac Live Room Calibration",
    "Architectural Acoustic Treatment",
    "Dolby Atmos 9.4.6 Spatial Audio",
    "Denon & Marantz Amplification",
    "JBL Synthesis Reference Systems",
    "Bowers & Wilkins Architectural Audio",
    "KEF Uni-Q Loudspeakers",
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
    name: "Private Cinema & Acoustic Engineering Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Bespoke Private Cinema Design & Engineering",
          serviceType: "Home Theater Design & Acoustic Engineering",
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: { "@type": "Country", name: "India" },
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Native 4K Laser Projection Installation",
          serviceType: "Sony SXRD & JVC D-ILA 4K Projection Setup",
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: { "@type": "Country", name: "India" },
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Dirac Live & Audyssey Room Acoustic Calibration",
          serviceType: "Acoustic Room Calibration & Multi-Sub Integration",
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: { "@type": "Country", name: "India" },
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Projector Optical Service & Equipment Care",
          serviceType: "After-Sales Cinema Calibration & Maintenance",
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: { "@type": "Country", name: "India" },
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
        name: "ALVStore — Bespoke Private Cinemas & Home Theaters",
        description:
          "Bespoke private cinemas, 4K laser projection & Dirac Live calibration across India. Authorised Denon, Marantz, JBL Synthesis & KEF partner.",
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
        name: "Contact ALVStore — Private Cinema Consultation",
        description:
          "Visit our Udaipur studio or book a pan-India home theater consultation, room acoustic blueprint, and 4K laser projection demo.",
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
            name: "Contact",
            item: `${SITE_URL}/contact`,
          },
        ],
      },
    ],
  };
}
