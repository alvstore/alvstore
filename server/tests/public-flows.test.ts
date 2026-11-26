import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { renderBrandedEmailHtml } from "../src/lib/mailer.js";
import {
  appendChallanTimeline,
  CHALLAN_POD_ALLOWED_STATUSES,
  isQuotationExpired,
  validatePublicQuotationResponse,
} from "../src/lib/public-documents.js";

test("validatePublicQuotationResponse enforces expiry, signature, and idempotent state checks", () => {
  const now = new Date("2026-11-26T10:00:00+05:30");

  assert.equal(isQuotationExpired("2026-11-25", now), true);
  assert.equal(isQuotationExpired("2026-11-26", now), false);

  const expired = validatePublicQuotationResponse({
    status: "sent",
    validUntil: "2026-11-20",
    action: "accept",
    signatureName: "Aarav",
    signatureData: "data:image/png;base64,iVBORw0=",
    now,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.code, "EXPIRED");

  const alreadyAccepted = validatePublicQuotationResponse({
    status: "accepted",
    validUntil: "2026-12-01",
    action: "accept",
    signatureName: "Aarav",
    signatureData: "data:image/png;base64,iVBORw0=",
    now,
  });
  assert.equal(alreadyAccepted.ok, false);
  if (!alreadyAccepted.ok) assert.equal(alreadyAccepted.status, 409);

  const missingSig = validatePublicQuotationResponse({
    status: "sent",
    validUntil: "2026-12-01",
    action: "accept",
    signatureName: "Aarav",
    signatureData: "",
    now,
  });
  assert.equal(missingSig.ok, false);

  const validAccept = validatePublicQuotationResponse({
    status: "draft",
    validUntil: "2026-12-01",
    action: "accept",
    signatureName: "Aarav",
    signatureData: "data:image/png;base64,iVBORw0=",
    now,
  });
  assert.equal(validAccept.ok, true);

  const validReject = validatePublicQuotationResponse({
    status: "sent",
    validUntil: "2026-12-01",
    action: "reject",
    now,
  });
  assert.equal(validReject.ok, true);
});

test("appendChallanTimeline appends structured milestones and CHALLAN_POD_ALLOWED_STATUSES guards POD", () => {
  const first = appendChallanTimeline([], { status: "dispatched", note: "Handed to BlueDart" });
  const second = appendChallanTimeline(first, { status: "delivered", note: "Signed at gate", by: "Receiver" });
  assert.equal(second.length, 2);
  assert.equal(second[0].label, "Dispatched");
  assert.equal(second[1].status, "delivered");
  assert.ok(CHALLAN_POD_ALLOWED_STATUSES.has("dispatched"));
  assert.ok(CHALLAN_POD_ALLOWED_STATUSES.has("out_for_delivery"));
  assert.equal(CHALLAN_POD_ALLOWED_STATUSES.has("draft"), false);
  assert.equal(CHALLAN_POD_ALLOWED_STATUSES.has("delivered"), false);
});

test("renderBrandedEmailHtml escapes untrusted header inputs and renders CTA cleanly", () => {
  const html = renderBrandedEmailHtml({
    companyName: "ALVStore <Apple>",
    title: "Quotation <script>alert(1)</script>",
    bodyHtml: "<p>Hello Customer</p>",
    ctaLabel: "Review & Accept",
    ctaUrl: "https://alvstore.com/sales/public/abc",
  });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
  assert.equal(html.includes("https://alvstore.com/sales/public/abc"), true);
});

test("Express route guards protect document-pdf, stock, challan-transition, and quotations writes", async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  try {
    const pdfUnauth = await fetch(
      `${base}/api/functions/document-pdf?type=quotation&id=00000000-0000-0000-0000-000000000001`
    );
    assert.equal(pdfUnauth.status, 401);

    const pdfBadType = await fetch(`${base}/api/functions/document-pdf?type=bogus&token=abc`);
    assert.equal(pdfBadType.status, 400);

    const pdfBadToken = await fetch(`${base}/api/functions/document-pdf?type=quotation&token=not-a-uuid`);
    assert.equal(pdfBadToken.status, 400);

    const viewBadToken = await fetch(`${base}/api/functions/public-quotation-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-uuid" }),
    });
    assert.equal(viewBadToken.status, 400);

    const podTraversal = await fetch(`${base}/api/functions/public-challan-pod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "00000000-0000-0000-0000-000000000001",
        receiver_name: "Receiver",
        receiver_signature: "data:image/png;base64,iVBORw0=",
        pod_photo_url: "/api/backend/storage/files/uploads/pod/../secret.png",
      }),
    });
    assert.equal(podTraversal.status, 400);

    const stockUnauth = await fetch(`${base}/api/functions/document-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: "invoice", doc_id: "00000000-0000-0000-0000-000000000001" }),
    });
    assert.equal(stockUnauth.status, 401);

    const transitionUnauth = await fetch(`${base}/api/functions/challan-transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challan_id: "00000000-0000-0000-0000-000000000001", target_status: "dispatched" }),
    });
    assert.equal(transitionUnauth.status, 401);

    const anonQuoteUpdate = await fetch(`${base}/api/data/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "quotations", op: "update", values: { status: "accepted" } }),
    });
    assert.equal(anonQuoteUpdate.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
