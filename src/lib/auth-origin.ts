/**
 * Rewrites internal Next.js standalone bind addresses (`0.0.0.0:3000`) to the
 * public origin using forwarded/Host headers or configured AUTH_URL.
 */
export function resolvePublicOrigin(
  requestUrl: string,
  headers: Pick<Headers, "get">,
  configuredOrigin?: string | null
): string | null {
  try {
    const parsed = new URL(requestUrl);
    const fwdHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const hdrHost = fwdHost || headers.get("host")?.split(",")[0]?.trim();
    const validHeaderHost = hdrHost && !hdrHost.startsWith("0.0.0.0") ? hdrHost : null;

    if (parsed.hostname !== "0.0.0.0" && validHeaderHost === null) {
      return null;
    }
    if (parsed.hostname !== "0.0.0.0") {
      return null;
    }

    if (configuredOrigin) {
      return new URL(configuredOrigin).origin;
    }
    if (validHeaderHost) {
      const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${proto}://${validHeaderHost}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function rewritePublicUrl(targetUrl: string, publicOrigin: string): string {
  try {
    const u = new URL(targetUrl, publicOrigin);
    if (u.hostname === "0.0.0.0") {
      return new URL(`${u.pathname}${u.search}${u.hash}`, publicOrigin).toString();
    }
  } catch {
    // keep original if unparseable
  }
  return targetUrl;
}
