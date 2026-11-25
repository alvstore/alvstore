import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { resolvePublicOrigin, rewritePublicUrl } from "@/lib/auth-origin";

async function handleAuth(method: "GET" | "POST", req: NextRequest) {
  const publicOrigin = resolvePublicOrigin(
    req.url,
    req.headers,
    process.env.AUTH_URL || process.env.NEXTAUTH_URL
  );

  let targetReq = req;
  if (publicOrigin) {
    const url = new URL(req.url);
    const rewrittenUrl = new URL(`${url.pathname}${url.search}`, publicOrigin);
    targetReq = new NextRequest(
      rewrittenUrl,
      method === "POST"
        ? { method: req.method, headers: req.headers, body: await req.arrayBuffer() }
        : { method: req.method, headers: req.headers }
    );
  }

  const res = await (method === "GET" ? handlers.GET(targetReq) : handlers.POST(targetReq));
  if (!publicOrigin) return res;

  const location = res.headers.get("location");
  if (location && location.includes("0.0.0.0")) {
    const headers = new Headers(res.headers);
    headers.set("location", rewritePublicUrl(location, publicOrigin));
    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
  return res;
}

export const GET = (req: NextRequest) => handleAuth("GET", req);
export const POST = (req: NextRequest) => handleAuth("POST", req);
