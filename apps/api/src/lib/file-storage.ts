import { randomUUID } from "node:crypto";
import { createWriteStream, createReadStream, existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

// Local-disk file storage for KYC documents (platform trust layer). No
// cloud storage account exists anywhere in this project's env config --
// building against S3/Cloudinary credentials that don't exist would just
// be an unusable stub, and this needs to actually work today. Kept behind
// this narrow interface (save/read/delete by a stable `storagePath`) so
// swapping in real cloud storage later is a one-file change, not a rewrite
// of every call site.
//
// These are PAN cards, GST certificates, and cancelled cheques -- never
// served from a public static path. Every read goes through an
// authenticated route (biz-kyc.ts / admin-kyc.ts) that streams the file
// server-side to the business's own owner or an admin, the same
// never-return-the-raw-secret posture already used for
// Business.razorpayKeySecret elsewhere in this codebase.

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "kyc");

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB, matching the document-format ceiling every KYC provider researched (Razorpay) actually enforces.

export class FileValidationError extends Error {}

export interface SavedFile {
  storagePath: string; // relative path, stored in KycDocument.storagePath
  fileName: string; // original filename, for display
  mimeType: string;
}

/** Sanitizes a businessId into a safe path segment (uuid/cuid-shaped, but never trust input blindly for path construction). */
function safeSegment(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) throw new FileValidationError("Invalid id");
  return cleaned;
}

export async function saveUploadedFile(
  businessId: string,
  originalFileName: string,
  mimeType: string,
  fileStream: Readable,
): Promise<SavedFile> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new FileValidationError("Only PDF, JPG, and PNG files are accepted");
  }

  const dir = path.join(UPLOAD_ROOT, safeSegment(businessId));
  await mkdir(dir, { recursive: true });

  const ext = path.extname(originalFileName).slice(0, 10) || "";
  const storedName = `${randomUUID()}${ext}`;
  const absolutePath = path.join(dir, storedName);

  let bytesWritten = 0;
  fileStream.on("data", (chunk: Buffer) => {
    bytesWritten += chunk.length;
    if (bytesWritten > MAX_FILE_BYTES) {
      fileStream.destroy(new FileValidationError("File exceeds the 5MB limit"));
    }
  });

  try {
    await pipeline(fileStream, createWriteStream(absolutePath));
  } catch (err) {
    // Partial write on failure/oversize -- clean up rather than leave a
    // truncated file sitting on disk.
    await unlink(absolutePath).catch(() => {});
    throw err instanceof FileValidationError ? err : new FileValidationError("Upload failed");
  }

  return {
    storagePath: path.join(safeSegment(businessId), storedName),
    fileName: originalFileName,
    mimeType,
  };
}

/** Returns a readable stream for a previously saved file, or null if it's gone from disk. */
export function readStoredFile(storagePath: string): Readable | null {
  const absolutePath = path.join(UPLOAD_ROOT, storagePath);
  // Guard against path traversal even though storagePath is always
  // server-generated (safeSegment + randomUUID), never taken from a client.
  if (!absolutePath.startsWith(UPLOAD_ROOT)) return null;
  if (!existsSync(absolutePath)) return null;
  return createReadStream(absolutePath);
}
