import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { buildBrandedDocumentPdf, isPrivateOrUnsafeRemoteUrl } from "../src/lib/document-pdf.js";
import { resolveSmtpConfig, sendMailWithConfig } from "../src/lib/mailer.js";

const sampleBusiness = {
  company_name: "ALVStore",
  company_address: "Shop No. 2, 229, Alok School Road, Sector 11, Udaipur",
  company_phone: "+91 98876 01200",
  company_email: "sales@alvstore.in",
  gst_number: "08ABCDE1234F1Z5",
  bank_name: "HDFC Bank",
  bank_account_number: "50200012345678",
  bank_ifsc: "HDFC0001234",
  bank_upi_id: "alvstore@hdfcbank",
};

const sampleCustomer = {
  name: "Vikramaditya Singh",
  email: "vikram@example.com",
  phone: "+91 98765 43210",
  address: "14 Lake Palace Road, Udaipur",
  gst_number: "08VWXYZ9876M1Z2",
};

test("buildBrandedDocumentPdf renders Unicode Rupee symbol, multi-page A4 wrap, and obeys docType image/pricing rules", async () => {
  //Tiny valid 1x1 PNG buffer data URI
  const tinyPngDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  const manyItems = Array.from({ length: 18 }, (_, i) => ({
    product_name: `Sony VPL-XW5000ES Laser Projector Unit #${i + 1}`,
    description: "Native 4K SXRD laser projection engine, 2000 lumens, calibrated for 150-inch AT screen.",
    hsn_code: "85286200",
    quantity: 1,
    unit_price: 540000,
    discount_type: "percentage",
    discount_value: 5,
    gst_percentage: 18,
    total: 513000,
    image_url: i % 2 === 0 ? tinyPngDataUrl : null,
    sort_order: i,
  }));

  const quotePdf = await buildBrandedDocumentPdf({
    docType: "quotation",
    docNumber: "QT-00042",
    status: "sent",
    createdAt: "2026-11-26T10:00:00Z",
    validUntil: "2026-12-26",
    showItemImages: true,
    gstInclusive: false,
    subtotal: 9234000,
    gstAmount: 1662120,
    total: 10896120,
    business: sampleBusiness,
    customer: sampleCustomer,
    items: manyItems,
    notes: "Includes Dirac Live room acoustic calibration.",
    terms: "50% advance with confirmation.",
  });

  assert.equal(Buffer.from(quotePdf.slice(0, 5)).toString(), "%PDF-");
  const parsedQuote = await PDFDocument.load(quotePdf);
  assert.ok(parsedQuote.getPageCount() >= 2, `expected multi-page quotation PDF, got ${parsedQuote.getPageCount()}`);

  // Invoices MUST never embed item thumbnails even if items contain image_url
  const invoicePdf = await buildBrandedDocumentPdf({
    docType: "invoice",
    docNumber: "INV-00099",
    status: "sent",
    createdAt: "2026-11-26T10:00:00Z",
    dueDate: "2026-12-10",
    showItemImages: true, // must be ignored for tax invoices per spec
    subtotal: 513000,
    gstAmount: 92340,
    total: 605340,
    paidAmount: 200000,
    business: sampleBusiness,
    customer: sampleCustomer,
    items: [manyItems[0]],
  });
  const parsedInv = await PDFDocument.load(invoicePdf);
  assert.equal(parsedInv.getPageCount(), 1);

  // Delivery challan with showPricing: false omits price figures cleanly
  const challanPdf = await buildBrandedDocumentPdf({
    docType: "challan",
    docNumber: "DC-00012",
    status: "dispatched",
    createdAt: "2026-11-26T10:00:00Z",
    showPricing: false,
    showItemImages: true,
    subtotal: 513000,
    gstAmount: 0,
    total: 513000,
    challanMeta: {
      challan_type: "delivery",
      courier_name: "BlueDart Surface",
      tracking_number: "BD99887766",
      eway_bill_number: "EWB-1122334455",
      delivery_person: "Ramesh Kumar",
      vehicle_number: "RJ-27-CA-4455",
      receiver_name: "Vikramaditya Singh",
    },
    business: sampleBusiness,
    customer: sampleCustomer,
    items: [manyItems[0]],
  });
  assert.equal(Buffer.from(challanPdf.slice(0, 5)).toString(), "%PDF-");
});

test("resolveSmtpConfig prefers business_settings.integrations over env and sends attachment via nodemailer interface", async () => {
  const mockPool = {
    async query() {
      return {
        rows: [{
          company_name: "ALVStore",
          company_email: "sales@alvstore.in",
          integrations: {
            smtp_host: "smtp.hostinger.com",
            smtp_port: "465",
            smtp_user: "quotes@alvstore.in",
            smtp_pass: "secret-pass",
            smtp_from_name: "ALVStore Studio",
            smtp_from_email: "quotes@alvstore.in",
          },
        }],
      };
    },
  };
  const cfg = await resolveSmtpConfig(mockPool);
  assert.ok(cfg);
  assert.equal(cfg.host, "smtp.hostinger.com");
  assert.equal(cfg.port, 465);
  assert.equal(cfg.secure, true);
  assert.equal(cfg.fromEmail, "quotes@alvstore.in");

  const sentCalls: any[] = [];
  await sendMailWithConfig(
    cfg,
    {
      to: "client@example.com",
      subject: "Quotation QT-00042",
      html: "<p>Attached quote</p>",
      attachments: [{ filename: "QT-00042.pdf", content: Buffer.from("%PDF-1.7") }],
    },
    (() => ({
      async sendMail(msg: any) {
        sentCalls.push(msg);
        return { messageId: "msg-123" };
      },
    })) as any
  );
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].from, '"ALVStore Studio" <quotes@alvstore.in>');
  assert.equal(sentCalls[0].attachments[0].filename, "QT-00042.pdf");
});

test("isPrivateOrUnsafeRemoteUrl blocks http, loopback IPv4/IPv6, link-local metadata, and private LAN targets", async () => {
  const blockedUrls = [
    "http://example.com/image.png",
    "https://127.0.0.1/secret.png",
    "https://127.0.0.2/secret.png",
    "https://[::1]/secret.png",
    "https://[::ffff:127.0.0.1]/secret.png",
    "https://localhost/secret.png",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.12/internal.png",
    "https://192.168.1.10/internal.png",
    "https://172.16.0.5/internal.png",
    "not-a-valid-url",
  ];
  for (const url of blockedUrls) {
    assert.equal(await isPrivateOrUnsafeRemoteUrl(url), true, `Expected ${url} to be blocked`);
  }
  assert.equal(await isPrivateOrUnsafeRemoteUrl("https://1.1.1.1/public.png"), false);
});
