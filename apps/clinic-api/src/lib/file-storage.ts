import { randomUUID } from "node:crypto";
import { createWriteStream, createReadStream, existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

// Local-disk storage for case-sheet attachments (X-rays, lab reports) and,
// as of Phase 4, lab-order result files -- no cloud storage account
// configured for this project, same reasoning as the main platform's KYC
// file-storage.ts. Kept behind this narrow interface so swapping in real
// cloud storage later is a one-file change.
//
// Never served from a public static path -- these are patient health
// records. Every read goes through an authenticated clinic-staff route that
// streams the file server-side. `category` namespaces the two use cases on
// disk (uploads/case-sheets/... vs uploads/lab-results/...) without needing
// two near-duplicate storage modules.

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // X-rays/scans run larger than KYC docs

export class FileValidationError extends Error {}

export interface SavedFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
}

function safeSegment(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) throw new FileValidationError("Invalid id");
  return cleaned;
}

export async function saveUploadedFile(
  // "branding" is the one public category (logo, doctor photo, and now the
  // hero image, gallery photos and blog covers -- all published on the
  // clinic's own website). Patient files stay in the private categories and
  // are only ever streamed through an authenticated route.
  category: "case-sheets" | "lab-results" | "branding",
  entityId: string,
  originalFileName: string,
  mimeType: string,
  fileStream: Readable,
): Promise<SavedFile> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new FileValidationError("Only PDF, JPG, and PNG files are accepted");
  }

  const dir = path.join(UPLOADS_ROOT, category, safeSegment(entityId));
  await mkdir(dir, { recursive: true });

  const ext = path.extname(originalFileName).slice(0, 10) || "";
  const storedName = `${randomUUID()}${ext}`;
  const absolutePath = path.join(dir, storedName);

  let bytesWritten = 0;
  fileStream.on("data", (chunk: Buffer) => {
    bytesWritten += chunk.length;
    if (bytesWritten > MAX_FILE_BYTES) {
      fileStream.destroy(new FileValidationError("File exceeds the 10MB limit"));
    }
  });

  try {
    await pipeline(fileStream, createWriteStream(absolutePath));
  } catch (err) {
    await unlink(absolutePath).catch(() => {});
    throw err instanceof FileValidationError ? err : new FileValidationError("Upload failed");
  }

  return {
    // Always POSIX-style, never path.join -- on Windows that yields
    // backslashes, which (a) break when interpolated into a URL, so the
    // public branding images 404'd, and (b) stop resolving at all if the
    // database is ever moved to a Linux host, which the production
    // deployment runbook calls for. The stored value is a portable
    // identifier, not a host filesystem path.
    storagePath: path.posix.join(category, safeSegment(entityId), storedName),
    fileName: originalFileName,
    mimeType,
  };
}

/** Resolves a stored (POSIX-style) path against the uploads root for this
 * host. Tolerates legacy backslash-separated values written before the
 * separator was normalized. */
function toAbsolute(storagePath: string): string | null {
  const normalized = storagePath.replace(/\\/g, "/");
  const absolutePath = path.resolve(UPLOADS_ROOT, ...normalized.split("/").filter(Boolean));
  if (!absolutePath.startsWith(UPLOADS_ROOT)) return null;
  if (!existsSync(absolutePath)) return null;
  return absolutePath;
}

/** Content type from the stored file's extension -- branding images are
 * served without a DB-recorded mime type, unlike case-sheet attachments
 * and lab results which store theirs alongside the row. */
export function mimeFromPath(storagePath: string): string {
  const ext = path.extname(storagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

/** Absolute on-disk path for a stored file, or null if it's gone/escaping
 * the uploads root. Needed by pdfkit's `doc.image()`, which takes a path
 * rather than a stream. */
export function resolveStoredPath(storagePath: string): string | null {
  return toAbsolute(storagePath);
}

export function readStoredFile(storagePath: string): Readable | null {
  const absolutePath = toAbsolute(storagePath);
  if (!absolutePath) return null;
  return createReadStream(absolutePath);
}
