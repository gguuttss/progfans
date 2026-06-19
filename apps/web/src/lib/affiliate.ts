// Amazon Associates: append our tracking tag to amazon.* links so qualifying
// purchases earn a commission. Set AMAZON_ASSOCIATE_TAG (e.g. "progfans-20").
// Unset → links are returned untouched.
const TAG = process.env.AMAZON_ASSOCIATE_TAG?.trim();

export function withAmazonTag(url: string): string {
  if (!TAG) return url;
  try {
    const u = new URL(url);
    if (!/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname)) return url;
    u.searchParams.set("tag", TAG);
    return u.toString();
  } catch {
    return url;
  }
}
