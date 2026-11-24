"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/PageLoading";

const Page = dynamic(() => import("@/screens/Employees"), { ssr: false, loading: PageLoading });

export default function RoutePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Page />
    </Suspense>
  );
}
