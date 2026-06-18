const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");

const BUCKET = "covers";

export const isHosted = (url: string | null | undefined): boolean =>
  !!url && url.includes(`/storage/v1/object/public/${BUCKET}/`);

/**
 * Download an external cover image and upload it to our Supabase Storage bucket
 * via the Storage REST API (avoids the supabase-js realtime/WebSocket dep);
 * returns our public URL.
 */
export async function hostCover(seriesId: number, sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 1024)
    throw new Error(`too small (${buf.byteLength}b — likely a placeholder)`);

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `${seriesId}.${ext}`;

  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 120)}`);

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
