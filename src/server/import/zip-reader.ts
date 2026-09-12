import "server-only";
import { promises as fs } from "node:fs";
import type { Readable } from "node:stream";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { AppError } from "@/shared/contracts/api-error";
import { importLimits } from "./constants";
import { assertNoCollisions, generatedReason, isForbiddenGitPath, normalizeZipPath, safePath, stripSingleRoot } from "./path-policy";

export type ZipImportEntry = { entry: Entry; sourcePath: string; path: string; mode: "100644" | "100755" };
export type ZipPreflight = {
  zip: ZipFile; entries: ZipImportEntry[]; excluded: Array<{ path: string; reason: string }>;
  emptyDirectoryCount: number; singleRootDetected: boolean;
};

export class ZipReader {
  async preflight(filePath: string, options: { excludeGenerated: boolean; stripSingleRoot: boolean }): Promise<ZipPreflight> {
    const header = Buffer.alloc(4);
    const file = await fs.open(filePath, "r");
    try { await file.read(header, 0, 4, 0); } finally { await file.close(); }
    if (!isZipMagic(header)) throw new AppError("INVALID_ZIP", "The uploaded file is not a valid ZIP archive.", 400);
    let zip: ZipFile;
    try {
      zip = await openZip(filePath);
    } catch (error) {
      throw new AppError("INVALID_ZIP", "The ZIP directory could not be read safely.", 400, false, {}, { cause: error });
    }
    try {
      const limits = importLimits();
      const accepted: ZipImportEntry[] = [];
      const excluded: Array<{ path: string; reason: string }> = [];
      const directories: string[] = [];
      let fileCount = 0, uncompressed = 0;
      const entries = await collectEntries(zip);
      for (const entry of entries) {
        const rawName = entry.fileName;
        const path = normalizeZipPath(rawName);
        const directory = /\/$/.test(rawName) || (entry.externalFileAttributes & 0x10) !== 0;
        if (entry.generalPurposeBitFlag & 0x1) throw new AppError("INVALID_ZIP", `Encrypted entry is not supported: ${safePath(path)}`, 400);
        const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
        const fileType = unixMode & 0o170000;
        if (fileType === 0o120000 || (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000)) {
          throw new AppError("UNSAFE_ZIP_PATH", `Links and special files are not allowed: ${safePath(path)}`, 400);
        }
        if (directory) { directories.push(path); continue; }
        fileCount += 1;
        uncompressed += entry.uncompressedSize;
        if (fileCount > limits.maxFiles) throw new AppError("TOO_MANY_FILES", `Archive contains more than ${limits.maxFiles} files.`, 400);
        if (entry.uncompressedSize > limits.maxSingleFileBytes) throw new AppError("FILE_TOO_LARGE", `File exceeds the 50 MiB import limit: ${safePath(path)}. Remove it or use Git LFS separately.`, 400);
        if (uncompressed > limits.maxUncompressedBytes) throw new AppError("ZIP_UNCOMPRESSED_TOO_LARGE", "Archive expands beyond the 250 MiB limit.", 400);
        if (isForbiddenGitPath(path)) throw new AppError("UNSAFE_ZIP_PATH", `.git content is not allowed: ${safePath(path)}`, 400);
        const reason = options.excludeGenerated ? generatedReason(path) : null;
        if (reason) excluded.push({ path: safePath(path), reason });
        else accepted.push({ entry, sourcePath: path, path, mode: unixMode & 0o111 ? "100755" : "100644" });
      }
      if (!accepted.length) throw new AppError("ZIP_HAS_NO_IMPORTABLE_FILES", "The archive contains no importable files after validation and exclusions.", 400);
      const emptyDirectoryCount = directories.filter((directory) => !accepted.some((file) => file.sourcePath.startsWith(`${directory}/`))).length;
      assertNoCollisions(accepted.map(({ path }) => path));
      let singleRootDetected = false;
      if (options.stripSingleRoot) {
        const stripped = stripSingleRoot(accepted.map(({ path }) => path));
        singleRootDetected = stripped.detected;
        accepted.forEach((item, index) => { item.path = stripped.paths[index] ?? item.path; });
      }
      return { zip, entries: accepted, excluded, emptyDirectoryCount, singleRootDetected };
    } catch (error) {
      zip.close();
      if (error instanceof AppError) throw error;
      if (error instanceof Error && /invalid relative path|absolute path/i.test(error.message)) {
        throw new AppError("UNSAFE_ZIP_PATH", "Archive contains unsafe path metadata.", 400);
      }
      throw new AppError("INVALID_ZIP", "The ZIP directory could not be read safely.", 400, false, {}, { cause: error });
    }
  }

  async readEntry(zip: ZipFile, entry: Entry): Promise<Buffer> {
    const stream = await new Promise<Readable>((resolve, reject) => zip.openReadStream(entry, (error, value) => error || !value ? reject(error ?? new Error("Missing ZIP stream")) : resolve(value)));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
}

function collectEntries(zip: ZipFile): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: Entry[] = [];
    zip.on("entry", (entry) => { entries.push(entry); zip.readEntry(); });
    zip.once("end", () => resolve(entries));
    zip.once("error", reject);
    zip.readEntry();
  });
}

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => yauzl.open(path, { lazyEntries: true, autoClose: false, decodeStrings: true }, (error, zip) => error || !zip ? reject(error ?? new Error("Invalid ZIP")) : resolve(zip)));
}

function isZipMagic(header: Buffer): boolean {
  return header[0] === 0x50 && header[1] === 0x4b && ((header[2] === 0x03 && header[3] === 0x04) || (header[2] === 0x05 && header[3] === 0x06) || (header[2] === 0x07 && header[3] === 0x08));
}
