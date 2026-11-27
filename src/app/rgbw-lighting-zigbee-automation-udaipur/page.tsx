import UdaipurSolutionScreen from "@/screens/public/UdaipurSolutionScreen";
import { UDAIPUR_PILLAR_MAP } from "@/lib/udaipur-pillars";
import { buildSolutionJsonLd, buildSolutionMetadata } from "@/lib/seo-metadata";

const pillar = UDAIPUR_PILLAR_MAP["rgbw-lighting-zigbee-automation-udaipur"];

export const metadata = buildSolutionMetadata(pillar);

export default function RgbwLightingZigbeeAutomationUdaipurPage() {
  const jsonLd = buildSolutionJsonLd(pillar);
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UdaipurSolutionScreen pillar={pillar} />
    </>
  );
}
