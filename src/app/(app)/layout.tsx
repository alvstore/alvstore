import { PRIVATE_NOINDEX_METADATA } from "@/lib/seo-metadata";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata = PRIVATE_NOINDEX_METADATA;

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}
