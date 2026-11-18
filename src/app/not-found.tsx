"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const NotFoundPage = dynamic(() => import("@/screens/NotFound"), { ssr: false });

export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundPage />
    </Suspense>
  );
}
