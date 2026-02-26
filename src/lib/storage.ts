import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export type StorageBackend = "local" | "s3" | "vercel_blob";

export type UploadResult = {
  url: string;
  key: string;
  backend: StorageBackend;
  size: number;
};

function resolveBackend(): StorageBackend {
  const raw = (process.env.STORAGE_BACKEND ?? "local").toLowerCase();
  if (raw === "s3") return "s3";
  if (raw === "vercel_blob" || raw === "vercel" || raw === "blob") return "vercel_blob";
  return "local";
}

function makeFileId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveUpload(pageId: string, file: File): Promise<UploadResult> {
  const backend = resolveBackend();

  if (backend !== "local") {
    throw new Error(`storage_backend_not_supported:${backend}`);
  }

  const ext = path.extname(file.name) || "";
  const id = makeFileId();
  const filename = `${id}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", pageId);
  const filepath = path.join(dir, filename);

  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buf);

  return {
    url: `/uploads/${pageId}/${filename}`,
    key: `${pageId}/${filename}`,
    backend,
    size: buf.length,
  };
}

export async function deleteUpload(pageId: string, key: string) {
  const backend = resolveBackend();
  if (backend !== "local") {
    throw new Error(`storage_backend_not_supported:${backend}`);
  }
  const filepath = path.join(process.cwd(), "public", "uploads", pageId, key.split("/").pop() ?? key);
  await unlink(filepath);
}
