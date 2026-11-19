import http from "node:http";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

/** Local TLS + two genuinely cross-site hostnames, without a public tunnel or production secrets. */
export async function httpsPreview(upstream) {
  const directory = mkdtempSync(path.join(tmpdir(), "alv-preview-tls-"));
  const key = path.join(directory, "key.pem"), cert = path.join(directory, "cert.pem");
  let server;
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=preview.e2b.app", "-addext", "subjectAltName=DNS:preview.e2b.app,DNS:arena.test"], { stdio: "ignore" });
    server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
      const port = server.address().port;
      if (request.headers.host?.startsWith("arena.test:")) {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(`<!doctype html><html><head><title>Embedded preview test</title></head><body style="margin:0"><iframe title="ALV preview" src="https://preview.e2b.app:${port}/login" style="border:0;width:100vw;height:100vh"></iframe></body></html>`);
        return;
      }
      if (request.url === "/__test/cookie-policy") {
        // Test-only wire-level proof: never echo cookie values or tokens.
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ unpartitionedProbeReceived: (request.headers.cookie ?? "").split(/;\s*/).some(cookie => cookie.startsWith("alv-unpartitioned-probe=")) }));
        return;
      }
      const target = new URL(request.url, upstream);
      const transport = target.protocol === "https:" ? https : http;
      const proxy = transport.request(target, { method: request.method, headers: { ...request.headers, "x-forwarded-host": request.headers.host, "x-forwarded-proto": "https" }, rejectUnauthorized: false }, result => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      });
      proxy.on("error", error => { response.writeHead(502); response.end(error.message); });
      request.pipe(proxy);
    });
    server.listen(0, "0.0.0.0");
    await once(server, "listening");
    return {
      parent: `https://arena.test:${server.address().port}`,
      async close() {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        rmSync(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    server?.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
