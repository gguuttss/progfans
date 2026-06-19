// Amazon Associates: append our US tracking tag to amazon.* links so qualifying
// purchases earn a commission. Defaults to our store ID; AMAZON_ASSOCIATE_TAG
// can override it (e.g. to test a different marketplace tag).
const TAG = process.env.AMAZON_ASSOCIATE_TAG?.trim() || "progfans-20";

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
