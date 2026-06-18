import "server-only";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const storageConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

/** Upload bytes to a public Supabase Storage bucket; returns the public URL. */
export async function uploadToBucket(
  bucket: string,
  path: string,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);
  // Cache-bust so a replaced avatar shows immediately.
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}?v=${Date.now()}`;
}
