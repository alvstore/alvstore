import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { env } from "../env.js";
import { requireAuth } from "../auth/middleware.js";

export const storageRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const SAFE_SEGMENT = /^[\w.\-\/ ]+$/;

function resolveSafe(bucket: string, objectPath: string): string | null {
  if (!SAFE_SEGMENT.test(bucket) || bucket.includes("..")) return null;
  if (!SAFE_SEGMENT.test(objectPath) || objectPath.includes("..")) return null;
  const base = path.resolve(env.uploadsDir, bucket);
  const full = path.resolve(base, objectPath);
  if (!full.startsWith(base)) return null;
  return full;
}

// Upload (multipart: fields `path`, optional `upsert`; file field `file`)
storageRouter.post("/:bucket/upload", requireAuth, upload.single("file"), (req, res) => {
  const { bucket } = req.params;
  const objectPath = String(req.body.path ?? "");
  if (!req.file || !objectPath) {
    res.status(400).json({ error: { message: "file and path are required" } });
    return;
  }
  const full = resolveSafe(bucket, objectPath);
  if (!full) {
    res.status(400).json({ error: { message: "invalid path" } });
    return;
  }
  const upsert = req.body.upsert === "true" || req.body.upsert === true;
  if (fs.existsSync(full) && !upsert) {
    // supabase semantics: error unless upsert
    res.status(400).json({ error: { message: "The resource already exists", code: "Duplicate" } });
    return;
  }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, req.file.buffer);
  res.json({ data: { path: objectPath }, error: null });
});

// Download / public URL target
storageRouter.get("/files/:bucket/*", (req, res) => {
  const { bucket } = req.params;
  const objectPath = (req.params as Record<string, string>)[0] ?? "";
  const full = resolveSafe(bucket, objectPath);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.status(404).json({ error: { message: "Object not found" } });
    return;
  }
  // content-type by extension (basic)
  const ext = path.extname(full).toLowerCase();
  const types: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf",
    ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".txt": "text/plain",
    ".csv": "text/csv", ".json": "application/json",
  };
  res.setHeader("Content-Type", types[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  fs.createReadStream(full).pipe(res);
});

// Delete
storageRouter.delete("/:bucket/*", requireAuth, (req, res) => {
  const { bucket } = req.params;
  const objectPath = (req.params as Record<string, string>)[0] ?? "";
  const full = resolveSafe(bucket, objectPath);
  if (full && fs.existsSync(full)) fs.rmSync(full);
  res.json({ data: { removed: [objectPath] }, error: null });
});

// helper used by shim to build public URLs
export function publicUrl(bucket: string, objectPath: string): string {
  void crypto;
  return `/api/backend/storage/files/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}
