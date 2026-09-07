import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import { handleApi } from "@/server/api-handler";
import { githubFor, syncRateLimit } from "@/server/github-context";
import { ImportService } from "@/server/import/import-service";
import { importFieldsSchema } from "@/shared/contracts/import";
import { AppError } from "@/shared/contracts/api-error";
import { importLimits } from "@/server/import/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleApi(request, async (context) => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), "ziptogit-"));
    try {
      const { archivePath, fields } = await receiveMultipart(request, tempDir);
      const parsed = importFieldsSchema.safeParse(fields);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Check the import form values.", 400, false, Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])));
      const github = await githubFor(context);
      const result = await new ImportService(github).execute(archivePath, parsed.data);
      syncRateLimit(context, github);
      return result;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
}

async function receiveMultipart(request: Request, directory: string): Promise<{ archivePath: string; fields: Record<string, string> }> {
  if (!request.body) throw new AppError("INVALID_ZIP", "Archive upload is empty.", 400);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) throw new AppError("VALIDATION_ERROR", "Expected multipart form data.", 400);
  const archivePath = join(directory, "archive.zip");
  const fields: Record<string, string> = {};
  let archiveSeen = false;
  const writes: Promise<void>[] = [];
  const parser = Busboy({ headers: Object.fromEntries(request.headers), limits: { files: 1, fields: 20, fileSize: importLimits().maxZipBytes, fieldSize: 2_000 } });
  parser.on("field", (name, value) => { fields[name] = value; });
  parser.on("file", (name, stream, info) => {
    if (name !== "archive") { stream.resume(); return; }
    archiveSeen = true;
    if (!info.filename.toLowerCase().endsWith(".zip")) stream.emit("error", new AppError("INVALID_ZIP", "Choose a .zip archive.", 400));
    const counter = new Transform({ transform(chunk: Buffer, _encoding, callback) { callback(null, chunk); } });
    stream.once("limit", () => counter.destroy(new AppError("ZIP_TOO_LARGE", "ZIP exceeds the 100 MiB upload limit.", 400)));
    writes.push(pipeline(stream, counter, createWriteStream(archivePath)));
  });
  const done = new Promise<void>((resolve, reject) => { parser.once("finish", resolve); parser.once("error", reject); });
  Readable.fromWeb(request.body as never).pipe(parser);
  await done;
  await Promise.all(writes);
  if (!archiveSeen) throw new AppError("INVALID_ZIP", "Archive field is required.", 400);
  return { archivePath, fields };
}
