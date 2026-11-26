import { getBackendAuthHeaders, supabase } from "@/integrations/supabase/client";

export type BrandedDocType = "quotation" | "invoice" | "challan";

export interface PdfRequestOpts {
  docType: BrandedDocType;
  id?: string | null;
  token?: string | null;
  download?: boolean;
  filename?: string;
}

export function buildDocumentPdfUrl(opts: PdfRequestOpts): string {
  const params = new URLSearchParams();
  params.set("type", opts.docType);
  if (opts.token) params.set("token", opts.token);
  else if (opts.id) params.set("id", opts.id);
  if (opts.download) params.set("download", "1");
  return `/api/backend/functions/document-pdf?${params.toString()}`;
}

export async function fetchDocumentPdfBlob(opts: PdfRequestOpts): Promise<Blob> {
  const url = buildDocumentPdfUrl(opts);
  const res = await fetch(url, {
    method: "GET",
    headers: opts.token ? {} : { ...getBackendAuthHeaders() },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error || `Failed to generate PDF (${res.status})`);
  }
  return await res.blob();
}

export async function downloadDocumentPdf(opts: PdfRequestOpts): Promise<void> {
  const blob = await fetchDocumentPdfBlob({ ...opts, download: true });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = opts.filename || `${opts.docType}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function openDocumentPdf(opts: PdfRequestOpts): Promise<void> {
  const blob = await fetchDocumentPdfBlob({ ...opts, download: false });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIM = 800;

/**
 * Validates and downscales/converts product images (including WebP) to PNG/JPEG
 * so pdf-lib can reliably embed every uploaded thumbnail cleanly without failure.
 */
export async function normalizeImageForPdfUpload(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_MIME.has(file.type.toLowerCase())) {
    throw new Error("Only PNG, JPEG, or WebP images are allowed.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image size must be 5 MB or less.");
  }
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return file;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Invalid or corrupted image."));
    el.src = dataUrl;
  });

  const needsResize = img.width > MAX_IMAGE_DIM || img.height > MAX_IMAGE_DIM;
  const isWebp = file.type.toLowerCase() === "image/webp";
  if (!needsResize && !isWebp) {
    return file;
  }

  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const outMime = file.type.toLowerCase() === "image/png" || isWebp ? "image/png" : "image/jpeg";
  const outExt = outMime === "image/png" ? "png" : "jpg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))), outMime, 0.88);
  });
  const baseName = file.name.replace(/\.[^.]+$/, "") || "item";
  return new File([blob], `${baseName}.${outExt}`, { type: outMime });
}

export async function uploadDocumentItemImage(file: File, folder = "document-items"): Promise<string> {
  const normalized = await normalizeImageForPdfUpload(file);
  const ext = normalized.name.split(".").pop()?.toLowerCase() || "png";
  const rand = Math.random().toString(36).slice(2, 10);
  const objectPath = `${folder}/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(objectPath, normalized, { upsert: true });
  if (error) {
    throw new Error(error.message || "Failed to upload item image");
  }
  const { data } = supabase.storage.from("uploads").getPublicUrl(objectPath);
  return data.publicUrl;
}

export function reorderListItems<T extends { sort_order?: number | null }>(
  items: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, idx) => ({ ...item, sort_order: idx }));
}
