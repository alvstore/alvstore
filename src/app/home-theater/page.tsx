import { redirect } from "next/navigation";

/** The old storefront route; the gallery now lives at the root. */
export default function LegacyStorefrontRoute() {
  redirect("/");
}
