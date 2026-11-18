"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const Page = dynamic(() => import("@/screens/ResetPassword"), { ssr: false });

export default function RoutePage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
