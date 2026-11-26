import { PRIVATE_NOINDEX_METADATA } from "@/lib/seo-metadata";

export const metadata = PRIVATE_NOINDEX_METADATA;

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
