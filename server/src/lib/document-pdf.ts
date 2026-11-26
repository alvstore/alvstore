import dns from "node:dns/promises";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFEmbeddedPage, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { env, serverRoot } from "../env.js";

export type BrandedDocumentType = "quotation" | "invoice" | "challan";

export interface DocumentPdfItem {
  product_id?: string | null;
  product_name: string;
  description?: string | null;
  hsn_code?: string | null;
  quantity: number;
  unit_price: number;
  discount_type?: "percentage" | "fixed" | string | null;
  discount_value?: number | null;
  gst_percentage?: number | null;
  total: number;
  image_url?: string | null;
  sort_order?: number | null;
}

export interface DocumentPdfBusiness {
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  gst_number?: string | null;
  logo_url?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  bank_upi_id?: string | null;
}

export interface DocumentPdfCustomer {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gst_number?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
}

export interface DocumentPdfChallanMeta {
  challan_type?: string | null;
  shipping_address?: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  eway_bill_number?: string | null;
  delivery_person?: string | null;
  vehicle_number?: string | null;
  dispatched_at?: string | Date | null;
  expected_delivery_at?: string | Date | null;
  delivered_at?: string | Date | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  pod_photo_url?: string | null;
}

export interface BrandedDocumentPdfInput {
  docType: BrandedDocumentType;
  docNumber: string;
  status: string;
  createdAt: string | Date;
  validUntil?: string | Date | null;
  dueDate?: string | Date | null;
  paymentTerms?: string | null;
  salespersonName?: string | null;
  showItemImages?: boolean;
  showPricing?: boolean;
  gstInclusive?: boolean;
  globalDiscountType?: "percentage" | "fixed" | string | null;
  globalDiscountValue?: number | null;
  subtotal: number;
  gstAmount: number;
  total: number;
  paidAmount?: number | null;
  notes?: string | null;
  terms?: string | null;
  signatureData?: string | null;
  signatureName?: string | null;
  signedAt?: string | Date | null;
  rejectionReason?: string | null;
  challanMeta?: DocumentPdfChallanMeta | null;
  business: DocumentPdfBusiness;
  customer?: DocumentPdfCustomer | null;
  items: DocumentPdfItem[];
}

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 34;
const CONTENT_W = A4_W - MARGIN * 2;
const BOTTOM_LIMIT = 46;

const C = {
  obsidian: rgb(11 / 255, 12 / 255, 14 / 255),
  brass: rgb(156 / 255, 123 / 255, 73 / 255),
  ink: rgb(17 / 255, 24 / 255, 39 / 255),
  slate: rgb(71 / 255, 85 / 255, 105 / 255),
  muted: rgb(100 / 255, 116 / 255, 139 / 255),
  line: rgb(226 / 255, 232 / 255, 240 / 255),
  surface: rgb(248 / 255, 250 / 255, 252 / 255),
  chalk: rgb(246 / 255, 244 / 255, 238 / 255),
  white: rgb(1, 1, 1),
  successBg: rgb(236 / 255, 253 / 255, 245 / 255),
  successInk: rgb(6 / 255, 95 / 255, 70 / 255),
  warnBg: rgb(254 / 255, 243 / 255, 199 / 255),
  warnInk: rgb(146 / 255, 64 / 255, 14 / 255),
  dangerBg: rgb(254 / 255, 242 / 255, 242 / 255),
  dangerInk: rgb(153 / 255, 27 / 255, 27 / 255),
  infoBg: rgb(239 / 255, 246 / 255, 255 / 255),
  infoInk: rgb(30 / 255, 58 / 255, 138 / 255),
};

let cachedRegularFont: Uint8Array | null = null;
let cachedBoldFont: Uint8Array | null = null;

function loadFontBytes(): { regular: Uint8Array; bold: Uint8Array } {
  if (!cachedRegularFont) {
    cachedRegularFont = new Uint8Array(fs.readFileSync(path.join(serverRoot, "assets/fonts/NotoSans-Regular.ttf")));
  }
  if (!cachedBoldFont) {
    cachedBoldFont = new Uint8Array(fs.readFileSync(path.join(serverRoot, "assets/fonts/NotoSans-Bold.ttf")));
  }
  return { regular: cachedRegularFont, bold: cachedBoldFont };
}

function safePdfText(value: unknown): string {
  const s = String(value ?? "");
  // Strip emoji / astral plane symbols (> U+FFFF) and non-printable control chars (keep \n).
  return s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]|[\uD800-\uDFFF]/g, "");
}

function formatInr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const cleaned = safePdfText(text).trim();
  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
          current = word;
        } else {
          // Break oversized token safely across characters
          let slice = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(slice + ch, fontSize) > maxWidth && slice) {
              lines.push(slice);
              slice = ch;
            } else {
              slice += ch;
            }
          }
          current = slice;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function isPrivateOrBlockedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (clean.startsWith("::ffff:")) {
    const tail = clean.slice(7);
    if (net.isIPv4(tail)) return isPrivateOrBlockedIp(tail);
    if (/^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(tail)) {
      const [h1, h2] = tail.split(":").map((part) => parseInt(part, 16));
      return isPrivateOrBlockedIp(`${(h1 >> 8) & 0xff}.${h1 & 0xff}.${(h2 >> 8) & 0xff}.${h2 & 0xff}`);
    }
    return true;
  }
  if (net.isIPv4(clean)) {
    const parts = clean.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(clean)) {
    return (
      clean === "::" ||
      clean === "::1" ||
      clean.startsWith("64:ff9b:") ||
      clean.startsWith("fc") ||
      clean.startsWith("fd") ||
      clean.startsWith("fe8") ||
      clean.startsWith("fe9") ||
      clean.startsWith("fea") ||
      clean.startsWith("feb")
    );
  }
  return true;
}

export async function isPrivateOrUnsafeRemoteUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:") return true;
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (net.isIP(host)) return isPrivateOrBlockedIp(host);
  try {
    const resolved = await dns.lookup(host, { all: true, verbatim: true });
    if (!resolved.length) return true;
    return resolved.some((entry) => isPrivateOrBlockedIp(entry.address));
  } catch {
    return true;
  }
}

async function resolveImageBytes(url: string | null | undefined): Promise<Uint8Array | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image/")) {
    const commaIdx = trimmed.indexOf(",");
    if (commaIdx === -1) return null;
    const header = trimmed.slice(0, commaIdx).toLowerCase();
    if (!header.includes("base64")) return null;
    if (!header.includes("image/png") && !header.includes("image/jpeg") && !header.includes("image/jpg")) {
      return null;
    }
    return new Uint8Array(Buffer.from(trimmed.slice(commaIdx + 1), "base64"));
  }

  // Local uploaded file path (`/api/backend/storage/files/<bucket>/<objectPath>`)
  const storageMatch = trimmed.match(/^\/api\/backend\/storage\/files\/([^/]+)\/(.+)$/);
  if (storageMatch) {
    const bucket = decodeURIComponent(storageMatch[1]);
    const objPath = storageMatch[2].split("/").map(decodeURIComponent).join("/");
    if (bucket.includes("..") || objPath.includes("..")) return null;
    const base = path.resolve(env.uploadsDir, bucket);
    const full = path.resolve(base, objPath);
    if (!full.startsWith(base) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
    return new Uint8Array(fs.readFileSync(full));
  }

  // Public brand / static image (`/alvstore-logo-dark.png`, `/alvstore-logo.png`, etc.)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    const pubBase = path.resolve(serverRoot, "..", "public");
    const rel = trimmed.replace(/^\/+/, "").split("?")[0];
    if (rel.includes("..")) return null;
    const full = path.resolve(pubBase, rel);
    if (full.startsWith(pubBase) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      return new Uint8Array(fs.readFileSync(full));
    }
    return null;
  }

  // Remote HTTPS image with strict DNS + IP SSRF guard and no redirects
  if (trimmed.startsWith("https://")) {
    try {
      if (await isPrivateOrUnsafeRemoteUrl(trimmed)) return null;
      const resp = await fetch(trimmed, {
        redirect: "manual",
        signal: AbortSignal.timeout(4000),
      });
      if (!resp.ok || (resp.status >= 300 && resp.status < 400)) return null;
      const len = Number(resp.headers.get("content-length") || 0);
      if (Number.isFinite(len) && len > 3 * 1024 * 1024) return null;
      const arr = new Uint8Array(await resp.arrayBuffer());
      if (arr.byteLength === 0 || arr.byteLength > 3 * 1024 * 1024) return null;
      return arr;
    } catch {
      return null;
    }
  }
  return null;
}

async function embedImageSafe(doc: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  const bytes = await resolveImageBytes(url);
  if (!bytes || bytes.byteLength < 8) return null;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  try {
    if (isPng) return await doc.embedPng(bytes);
    if (isJpg) return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
  return null;
}

function statusColors(status: string) {
  const s = status.toLowerCase();
  if (["accepted", "delivered", "paid"].includes(s)) return { bg: C.successBg, ink: C.successInk };
  if (["rejected", "cancelled", "expired", "unpaid"].includes(s)) return { bg: C.dangerBg, ink: C.dangerInk };
  if (["sent", "dispatched", "in_transit", "out_for_delivery", "packed", "partial"].includes(s)) {
    return { bg: C.infoBg, ink: C.infoInk };
  }
  return { bg: C.warnBg, ink: C.warnInk };
}

function docTitleLabel(docType: BrandedDocumentType): string {
  if (docType === "invoice") return "TAX INVOICE";
  if (docType === "challan") return "DELIVERY CHALLAN";
  return "QUOTATION";
}

function drawRightText(page: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size: number, color = C.ink) {
  const safe = safePdfText(text);
  const w = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: rightX - w, y, size, font, color });
}

export async function buildBrandedDocumentPdf(input: BrandedDocumentPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { regular, bold } = loadFontBytes();
  const fontReg = await pdfDoc.embedFont(regular);
  const fontBold = await pdfDoc.embedFont(bold);

  // Tax Invoices never embed item thumbnails per approved spec
  const showImages = input.docType !== "invoice" && Boolean(input.showItemImages);
  const showPricing = input.docType === "challan" ? input.showPricing !== false : true;

  // Pre-embed brand crest / dark logo + signature + POD photo + item thumbnails cleanly
  const logoImage =
    (await embedImageSafe(pdfDoc, "/alvstore-logo-dark.png")) ||
    (await embedImageSafe(pdfDoc, input.business.logo_url));
  const signatureImage = await embedImageSafe(pdfDoc, input.signatureData);
  const podImage = await embedImageSafe(pdfDoc, input.challanMeta?.pod_photo_url);

  const sortedItems = [...input.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const itemImages = new Map<number, PDFImage | null>();
  if (showImages) {
    await Promise.all(
      sortedItems.map(async (item, idx) => {
        itemImages.set(idx, item.image_url ? await embedImageSafe(pdfDoc, item.image_url) : null);
      })
    );
  }

  let page = pdfDoc.addPage([A4_W, A4_H]);
  let y = A4_H;

  // Header band on page 1
  const drawFirstPageHeader = () => {
    const headerH = 88;
    page.drawRectangle({ x: 0, y: A4_H - headerH, width: A4_W, height: headerH, color: C.obsidian });
    page.drawRectangle({ x: 0, y: A4_H - headerH - 2, width: A4_W, height: 2, color: C.brass });

    let leftTextX = MARGIN;
    if (logoImage) {
      const dims = logoImage.scaleToFit(108, 30);
      page.drawImage(logoImage, { x: MARGIN, y: A4_H - 36 - dims.height / 2 + 8, width: dims.width, height: dims.height });
      leftTextX = MARGIN;
    }

    const brandName = safePdfText(input.business.company_name || "ALVStore");
    if (!logoImage) {
      page.drawText(brandName, { x: leftTextX, y: A4_H - 34, size: 16, font: fontBold, color: C.chalk });
    }
    const addrLines = wrapLines(
      [input.business.company_address, [input.business.company_phone, input.business.company_email].filter(Boolean).join(" · "), input.business.gst_number ? `GSTIN: ${input.business.gst_number}` : ""]
        .filter(Boolean)
        .join("\n"),
      fontReg,
      7.8,
      280
    );
    let infoY = A4_H - (logoImage ? 52 : 48);
    for (const line of addrLines.slice(0, 3)) {
      page.drawText(line, { x: MARGIN, y: infoY, size: 7.8, font: fontReg, color: rgb(195 / 255, 198 / 255, 204 / 255) });
      infoY -= 10;
    }

    // Right side document type + number + dates + status
    const rightEdge = A4_W - MARGIN;
    drawRightText(page, docTitleLabel(input.docType), rightEdge, A4_H - 28, fontBold, 14, C.brass);
    drawRightText(page, input.docNumber || "DRAFT", rightEdge, A4_H - 46, fontBold, 12, C.white);
    const metaParts: string[] = [`Date: ${formatDate(input.createdAt)}`];
    if (input.validUntil) metaParts.push(`Valid Until: ${formatDate(input.validUntil)}`);
    if (input.dueDate) metaParts.push(`Due: ${formatDate(input.dueDate)}`);
    drawRightText(page, metaParts.join("  |  "), rightEdge, A4_H - 59, fontReg, 8, rgb(210 / 255, 214 / 255, 220 / 255));

    const badgeText = input.status.replace(/_/g, " ").toUpperCase();
    const sc = statusColors(input.status);
    const badgeW = fontBold.widthOfTextAtSize(badgeText, 7.2) + 12;
    page.drawRectangle({ x: rightEdge - badgeW, y: A4_H - 78, width: badgeW, height: 13, color: sc.bg });
    page.drawText(badgeText, { x: rightEdge - badgeW + 6, y: A4_H - 74.2, size: 7.2, font: fontBold, color: sc.ink });

    y = A4_H - headerH - 18;
  };

  const drawContinuationHeader = () => {
    page.drawRectangle({ x: 0, y: A4_H - 38, width: A4_W, height: 38, color: C.obsidian });
    page.drawRectangle({ x: 0, y: A4_H - 40, width: A4_W, height: 2, color: C.brass });
    page.drawText(safePdfText(`${input.business.company_name || "ALVStore"} — ${docTitleLabel(input.docType)}`), {
      x: MARGIN,
      y: A4_H - 24,
      size: 9.5,
      font: fontBold,
      color: C.chalk,
    });
    drawRightText(page, `${input.docNumber} (Continued)`, A4_W - MARGIN, A4_H - 24, fontReg, 8.5, C.brass);
    y = A4_H - 54;
  };

  drawFirstPageHeader();

  // Party & Logistics Information Band
  if (input.customer || input.challanMeta || input.paymentTerms || input.salespersonName) {
    const colW = (CONTENT_W - 18) / 2;
    const leftLines: { text: string; bold?: boolean }[] = [];
    if (input.customer) {
      wrapLines(input.customer.name, fontBold, 8.3, colW - 16).forEach(l => leftLines.push({ text: l, bold: true }));
      if (input.customer.address) wrapLines(input.customer.address, fontReg, 8.3, colW - 16).forEach(l => leftLines.push({ text: l }));
      if (input.customer.phone) wrapLines(`Tel: ${input.customer.phone}`, fontReg, 8.3, colW - 16).forEach(l => leftLines.push({ text: l }));
      if (input.customer.email) wrapLines(`Email: ${input.customer.email}`, fontReg, 8.3, colW - 16).forEach(l => leftLines.push({ text: l }));
      if (input.customer.gst_number) wrapLines(`GSTIN: ${input.customer.gst_number}`, fontReg, 8.3, colW - 16).forEach(l => leftLines.push({ text: l }));
    }

    const rightLabel = input.docType === "challan" ? "DISPATCH & SHIPPING DETAILS" : "SHIP TO / REFERENCE";
    const rightLines: { text: string; bold?: boolean }[] = [];
    if (input.docType === "challan" && input.challanMeta) {
      const m = input.challanMeta;
      if (m.challan_type) rightLines.push({ text: `Type: ${m.challan_type.replace(/_/g, " ").toUpperCase()}`, bold: true });
      const shipAddr = m.shipping_address || input.customer?.shipping_address || input.customer?.address;
      if (shipAddr) wrapLines(`Ship To: ${shipAddr}`, fontReg, 8.3, colW - 16).forEach(l => rightLines.push({ text: l }));
      if (m.courier_name || m.tracking_number) wrapLines(`Courier: ${[m.courier_name, m.tracking_number ? `#${m.tracking_number}` : ""].filter(Boolean).join(" · ")}`, fontReg, 8.3, colW - 16).forEach(l => rightLines.push({ text: l }));
      if (m.eway_bill_number) wrapLines(`e-Way Bill: ${m.eway_bill_number}`, fontReg, 8.3, colW - 16).forEach(l => rightLines.push({ text: l }));
      if (m.delivery_person || m.vehicle_number) wrapLines(`Dispatch: ${[m.delivery_person, m.vehicle_number].filter(Boolean).join(" · ")}`, fontReg, 8.3, colW - 16).forEach(l => rightLines.push({ text: l }));
      if (m.expected_delivery_at) rightLines.push({ text: `ETA: ${formatDate(m.expected_delivery_at)}` });
    } else if (input.customer?.shipping_address) {
      wrapLines(input.customer.name, fontBold, 8.3, colW - 16).forEach(l => rightLines.push({ text: l, bold: true }));
      wrapLines(
        [input.customer.shipping_address, [input.customer.shipping_city, input.customer.shipping_state, input.customer.shipping_pincode].filter(Boolean).join(", ")]
          .filter(Boolean)
          .join("\n"),
        fontReg,
        8.3,
        colW - 16
      ).forEach(l => rightLines.push({ text: l }));
    } else if (input.customer) {
      rightLines.push({ text: "Same as Billing Address" });
    }
    if (input.salespersonName) wrapLines(`Salesperson: ${input.salespersonName}`, fontReg, 8.3, colW - 16).forEach(l => rightLines.push({ text: l }));
    if (input.paymentTerms) wrapLines(`Payment Terms: ${input.paymentTerms.replace(/_/g, " ").toUpperCase()}`, fontReg, 8.3, colW - 16).forEach(l => rightLines.push({ text: l }));

    const maxLines = Math.max(leftLines.length, rightLines.length, 1);
    const boxH = 24 + maxLines * 11.5;
    const boxY = y - boxH;
    page.drawRectangle({ x: MARGIN, y: boxY, width: colW, height: boxH, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
    page.drawRectangle({ x: MARGIN + colW + 18, y: boxY, width: colW, height: boxH, color: C.surface, borderColor: C.line, borderWidth: 0.75 });

    page.drawText(input.docType === "invoice" ? "INVOICE TO" : "BILL TO", { x: MARGIN + 8, y: y - 13, size: 7.2, font: fontBold, color: C.brass });
    page.drawText(rightLabel, { x: MARGIN + colW + 26, y: y - 13, size: 7.2, font: fontBold, color: C.brass });

    let ly = y - 26;
    for (const l of leftLines) {
      page.drawText(safePdfText(l.text), { x: MARGIN + 8, y: ly, size: 8.3, font: l.bold ? fontBold : fontReg, color: l.bold ? C.ink : C.slate });
      ly -= 11.5;
    }
    let ry = y - 26;
    for (const l of rightLines) {
      page.drawText(safePdfText(l.text), { x: MARGIN + colW + 26, y: ry, size: 8.3, font: l.bold ? fontBold : fontReg, color: l.bold ? C.ink : C.slate });
      ry -= 11.5;
    }
    y = boxY - 14;
  }

  // Column geometry (fixed alignment regardless of mixed images)
  const wNum = 22;
  const wImg = showImages ? 50 : 0;
  const wQty = 32;
  const wRate = showPricing ? 68 : 0;
  const wDisc = showPricing ? 42 : 0;
  const wGst = showPricing ? 38 : 0;
  const wAmt = showPricing ? 76 : 0;
  const wHsn = showPricing ? 0 : 68;
  const wItem = CONTENT_W - wNum - wImg - wQty - wRate - wDisc - wGst - wAmt - wHsn;

  const xNum = MARGIN;
  const xImg = xNum + wNum;
  const xItem = xImg + wImg;
  const xHsn = xItem + wItem;
  const xQty = showPricing ? xItem + wItem : xHsn + wHsn;
  const xRate = xQty + wQty;
  const xDisc = xRate + wRate;
  const xGst = xDisc + wDisc;
  const xAmt = xGst + wGst;

  const drawTableHeader = () => {
    const thH = 22;
    page.drawRectangle({ x: MARGIN, y: y - thH, width: CONTENT_W, height: thH, color: C.obsidian });
    const ty = y - 14.5;
    page.drawText("#", { x: xNum + 6, y: ty, size: 7.5, font: fontBold, color: C.chalk });
    if (showImages) page.drawText("IMAGE", { x: xImg + 6, y: ty, size: 7.5, font: fontBold, color: C.chalk });
    page.drawText("ITEM & SPECIFICATION", { x: xItem + 6, y: ty, size: 7.5, font: fontBold, color: C.chalk });
    if (showPricing) {
      drawRightText(page, "QTY", xQty + wQty - 6, ty, fontBold, 7.5, C.chalk);
      drawRightText(page, "RATE", xRate + wRate - 6, ty, fontBold, 7.5, C.chalk);
      drawRightText(page, "DISC", xDisc + wDisc - 6, ty, fontBold, 7.5, C.chalk);
      drawRightText(page, "GST%", xGst + wGst - 6, ty, fontBold, 7.5, C.chalk);
      drawRightText(page, "AMOUNT", xAmt + wAmt - 6, ty, fontBold, 7.5, C.chalk);
    } else {
      page.drawText("HSN", { x: xHsn + 6, y: ty, size: 7.5, font: fontBold, color: C.chalk });
      drawRightText(page, "QTY", xQty + wQty - 6, ty, fontBold, 7.5, C.chalk);
    }
    y -= thH;
  };

  const ensureSpace = (neededH: number, withTableHeader = false) => {
    if (y - neededH >= BOTTOM_LIMIT) return;
    page = pdfDoc.addPage([A4_W, A4_H]);
    drawContinuationHeader();
    if (withTableHeader) drawTableHeader();
  };

  drawTableHeader();

  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    const titleLines = wrapLines(item.product_name || "Item", fontBold, 9, wItem - 12);
    const descLines = item.description ? wrapLines(item.description, fontReg, 7.8, wItem - 12) : [];
    const hsnLine = showPricing && item.hsn_code ? [`HSN: ${item.hsn_code}`] : [];
    const textHeight = titleLines.length * 11 + descLines.length * 9.8 + hsnLine.length * 9.8;
    const rowH = Math.max(showImages ? 52 : 24, textHeight + 12);

    ensureSpace(rowH, true);

    const rowBottom = y - rowH;
    if (i % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: rowBottom, width: CONTENT_W, height: rowH, color: C.surface });
    }
    page.drawLine({ start: { x: MARGIN, y: rowBottom }, end: { x: MARGIN + CONTENT_W, y: rowBottom }, thickness: 0.5, color: C.line });

    const topTextY = y - 14;
    page.drawText(String(i + 1), { x: xNum + 6, y: topTextY, size: 8.5, font: fontReg, color: C.muted });

    if (showImages) {
      const boxSize = 40;
      const boxX = xImg + 5;
      const boxY = y - 6 - boxSize;
      page.drawRectangle({ x: boxX, y: boxY, width: boxSize, height: boxSize, color: C.white, borderColor: C.line, borderWidth: 0.75 });
      const embeddedImg = itemImages.get(i);
      if (embeddedImg) {
        const dims = embeddedImg.scaleToFit(boxSize - 4, boxSize - 4);
        page.drawImage(embeddedImg, {
          x: boxX + (boxSize - dims.width) / 2,
          y: boxY + (boxSize - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      } else {
        page.drawText("IMG", { x: boxX + 12.5, y: boxY + 17, size: 7.2, font: fontBold, color: C.muted });
      }
    }

    let cy = topTextY;
    for (const tl of titleLines) {
      page.drawText(tl, { x: xItem + 6, y: cy, size: 9, font: fontBold, color: C.ink });
      cy -= 11;
    }
    for (const dl of descLines) {
      page.drawText(dl, { x: xItem + 6, y: cy, size: 7.8, font: fontReg, color: C.slate });
      cy -= 9.8;
    }
    for (const hl of hsnLine) {
      page.drawText(hl, { x: xItem + 6, y: cy, size: 7.6, font: fontReg, color: C.muted });
      cy -= 9.8;
    }

    if (showPricing) {
      drawRightText(page, String(item.quantity ?? 1), xQty + wQty - 6, topTextY, fontReg, 8.5, C.ink);
      drawRightText(page, formatInr(Number(item.unit_price || 0)), xRate + wRate - 6, topTextY, fontReg, 8.2, C.ink);
      const dv = Number(item.discount_value || 0);
      const discText = dv > 0 ? (item.discount_type === "fixed" ? formatInr(dv) : `${dv}%`) : "—";
      drawRightText(page, discText, xDisc + wDisc - 6, topTextY, fontReg, 8.2, C.slate);
      const gstText = item.gst_percentage !== null && item.gst_percentage !== undefined ? `${Number(item.gst_percentage)}%` : "18%";
      drawRightText(page, gstText, xGst + wGst - 6, topTextY, fontReg, 8.2, C.slate);
      drawRightText(page, formatInr(Number(item.total || 0)), xAmt + wAmt - 6, topTextY, fontBold, 8.6, C.ink);
    } else {
      page.drawText(safePdfText(item.hsn_code || "—"), { x: xHsn + 6, y: topTextY, size: 8.2, font: fontReg, color: C.slate });
      drawRightText(page, String(item.quantity ?? 1), xQty + wQty - 6, topTextY, fontBold, 9, C.ink);
    }

    y = rowBottom;
  }

  y -= 14;

  // Totals & Bank / Notes / Signature Block
  if (showPricing) {
    const totalsBoxW = 220;
    const totalsX = MARGIN + CONTENT_W - totalsBoxW;
    const summaryRows: { label: string; value: string; bold?: boolean }[] = [
      { label: "Subtotal", value: formatInr(input.subtotal) },
    ];
    if ((input.globalDiscountValue ?? 0) > 0) {
      const discDisplay =
        input.globalDiscountType === "fixed"
          ? `-${formatInr(Number(input.globalDiscountValue))}`
          : `-${Number(input.globalDiscountValue)}%`;
      summaryRows.push({ label: "Discount", value: discDisplay });
    }
    summaryRows.push({ label: "CGST", value: formatInr(input.gstAmount / 2) });
    summaryRows.push({ label: "SGST", value: formatInr(input.gstAmount / 2) });
    summaryRows.push({ label: "Grand Total", value: formatInr(input.total), bold: true });
    if (input.docType === "invoice" && (input.paidAmount ?? 0) > 0) {
      summaryRows.push({ label: "Paid", value: formatInr(Number(input.paidAmount)) });
      summaryRows.push({ label: "Balance Due", value: formatInr(Math.max(0, input.total - Number(input.paidAmount))), bold: true });
    }

    const totalsH = summaryRows.length * 14 + 14 + (input.gstInclusive ? 11 : 0);
    ensureSpace(totalsH + 10);

    page.drawRectangle({ x: totalsX, y: y - totalsH, width: totalsBoxW, height: totalsH, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
    let ty = y - 15;
    for (const r of summaryRows) {
      const f = r.bold ? fontBold : fontReg;
      const col = r.bold ? C.ink : C.slate;
      page.drawText(r.label, { x: totalsX + 10, y: ty, size: r.bold ? 9.5 : 8.3, font: f, color: col });
      drawRightText(page, r.value, totalsX + totalsBoxW - 10, ty, f, r.bold ? 9.8 : 8.5, col);
      ty -= 14;
    }
    if (input.gstInclusive) {
      drawRightText(page, "* Inclusive of GST", totalsX + totalsBoxW - 10, y - totalsH + 5, fontReg, 7.2, C.muted);
    }
    y -= totalsH + 14;
  }

  // Bank Details + Notes/Terms + Signatures
  const hasBank = Boolean(input.business.bank_name) && input.docType !== "challan";
  if (hasBank) {
    const bankH = 54;
    ensureSpace(bankH + 8);
    page.drawRectangle({ x: MARGIN, y: y - bankH, width: CONTENT_W, height: bankH, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
    page.drawText("BANK DETAILS FOR PAYMENT", { x: MARGIN + 10, y: y - 14, size: 7.3, font: fontBold, color: C.brass });
    const leftBank = `Bank: ${input.business.bank_name}${input.business.bank_branch ? ` (${input.business.bank_branch})` : ""}`;
    const midBank = input.business.bank_account_number ? `A/C: ${input.business.bank_account_number}` : "";
    const rightBank = [input.business.bank_ifsc ? `IFSC: ${input.business.bank_ifsc}` : "", input.business.bank_upi_id ? `UPI: ${input.business.bank_upi_id}` : ""]
      .filter(Boolean)
      .join(" · ");
    page.drawText(safePdfText(leftBank), { x: MARGIN + 10, y: y - 28, size: 8.2, font: fontReg, color: C.ink });
    page.drawText(safePdfText([midBank, rightBank].filter(Boolean).join("   |   ")), { x: MARGIN + 10, y: y - 41, size: 8.2, font: fontReg, color: C.slate });
    y -= bankH + 12;
  }

  const drawTextBlock = (heading: string, bodyText: string | null | undefined) => {
    if (!bodyText || !bodyText.trim()) return;
    const lines = wrapLines(bodyText, fontReg, 8.2, CONTENT_W - 16);
    const h = 20 + lines.length * 11;
    ensureSpace(h + 8);
    page.drawText(heading, { x: MARGIN, y: y - 10, size: 7.4, font: fontBold, color: C.brass });
    let ly = y - 22;
    for (const l of lines) {
      page.drawText(l, { x: MARGIN, y: ly, size: 8.2, font: fontReg, color: C.slate });
      ly -= 11;
    }
    y -= h + 6;
  };

  drawTextBlock("NOTES", input.notes);
  drawTextBlock("TERMS & CONDITIONS", input.terms);
  if (input.rejectionReason) drawTextBlock("CUSTOMER FEEDBACK / REJECTION REASON", input.rejectionReason);

  if (signatureImage || input.signatureName || podImage || input.challanMeta?.receiver_name) {
    const sigH = 74;
    ensureSpace(sigH + 8);
    page.drawRectangle({ x: MARGIN, y: y - sigH, width: CONTENT_W, height: sigH, color: C.surface, borderColor: C.line, borderWidth: 0.75 });
    const sigLabel = input.docType === "challan" ? "PROOF OF DELIVERY / RECEIVER SIGNATURE" : "CUSTOMER ACCEPTANCE & SIGNATURE";
    page.drawText(sigLabel, { x: MARGIN + 10, y: y - 13, size: 7.2, font: fontBold, color: C.brass });
    if (signatureImage) {
      const dims = signatureImage.scaleToFit(140, 36);
      page.drawImage(signatureImage, { x: MARGIN + 10, y: y - 54, width: dims.width, height: dims.height });
    }
    const nameLine = input.signatureName || input.challanMeta?.receiver_name || "";
    const metaLine = [
      nameLine,
      input.challanMeta?.receiver_phone ? `Tel: ${input.challanMeta.receiver_phone}` : "",
      input.signedAt ? `Signed: ${formatDate(input.signedAt)}` : input.challanMeta?.delivered_at ? `Delivered: ${formatDate(input.challanMeta.delivered_at)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (metaLine) {
      page.drawText(safePdfText(metaLine), { x: MARGIN + 10, y: y - 66, size: 8, font: fontBold, color: C.ink });
    }
    if (podImage) {
      const dims = podImage.scaleToFit(90, 52);
      page.drawImage(podImage, { x: MARGIN + CONTENT_W - dims.width - 10, y: y - 62, width: dims.width, height: dims.height });
    }
    y -= sigH + 10;
  }

  // Branded A4 footer across every page
  const pages = pdfDoc.getPages();
  const rawFooterLeft = [
    input.business.company_name || "ALVStore",
    input.business.company_email || "sales@alvstore.in",
    input.business.company_phone,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const footerLeft = wrapLines(rawFooterLeft, fontReg, 7.5, CONTENT_W - 80)[0] || "";
  pages.forEach((p, idx) => {
    p.drawLine({ start: { x: MARGIN, y: 32 }, end: { x: A4_W - MARGIN, y: 32 }, thickness: 0.5, color: C.line });
    p.drawText(footerLeft, { x: MARGIN, y: 20, size: 7.5, font: fontReg, color: C.muted });
    drawRightText(p, `Page ${idx + 1} of ${pages.length}`, A4_W - MARGIN, 20, fontReg, 7.5, C.muted);
  });

  return pdfDoc.save();
}
