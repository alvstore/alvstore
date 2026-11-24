import { NextRequest, NextResponse } from "next/server";
import { backendServerUrl } from "@/lib/backend-url";

export const dynamic = "force-dynamic";

const HOP_BY_HOP_REQ = new Set(["host", "connection", "content-length", "transfer-encoding", "accept-encoding"]);
const HOP_BY_HOP_RES = new Set(["connection", "keep-alive", "content-length", "content-encoding", "transfer-encoding"]);

/**
 * Forward `/api/backend/*` to the Express API using buffered Web Responses.
 * External Next.js `rewrites()` pipe raw streams into Passenger/LsNode, which
 * truncates small POST JSON responses (`Content-Length: 0`) on Hostinger.
 */
async function proxyBackend(req: NextRequest): Promise<NextResponse> {
  const base = backendServerUrl().replace(/\/+$/, "");
  const suffix = req.nextUrl.pathname.replace(/^\/api\/backend/, "");
  const targetUrl = `${base}/api${suffix}${req.nextUrl.search}`;

  const reqHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQ.has(key.toLowerCase())) reqHeaders.set(key, value);
  });

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: reqHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    const resHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_RES.has(key.toLowerCase())) resHeaders.set(key, value);
    });

    const payload = req.method === "HEAD" ? null : await upstream.arrayBuffer();
    return new NextResponse(payload, { status: upstream.status, headers: resHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Backend unavailable", code: "BAD_GATEWAY" } },
      { status: 502 }
    );
  }
}

export const GET = proxyBackend;
export const POST = proxyBackend;
export const PUT = proxyBackend;
export const PATCH = proxyBackend;
export const DELETE = proxyBackend;
export const OPTIONS = proxyBackend;
export const HEAD = proxyBackend;
