import AlvStudioContact from "@/screens/public/AlvStudioContact";
import { CONTACT_METADATA, buildContactJsonLd } from "@/lib/seo-metadata";

export const metadata = CONTACT_METADATA;

export default function RoutePage() {
  const jsonLd = buildContactJsonLd();
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AlvStudioContact />
    </>
  );
}
