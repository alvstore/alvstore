import AlvStudioHome from "@/screens/public/AlvStudioHome";
import { HOME_METADATA, buildHomeJsonLd } from "@/lib/seo-metadata";

export const metadata = HOME_METADATA;

export default function RoutePage() {
  const jsonLd = buildHomeJsonLd();
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AlvStudioHome />
    </>
  );
}
