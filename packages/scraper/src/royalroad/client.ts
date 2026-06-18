import { sleep } from "./util";

const BASE = "https://www.royalroad.com";
const UA = "progfans-catalog-bot/0.1 (+https://github.com/gguuttss/progfans/issues)";

// Politeness: serialize requests with a minimum spacing.
const MIN_INTERVAL_MS = 1500;
const MAX_RETRIES = 4;
let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/** Fetch a Royal Road page (path or absolute URL) politely, with retry/backoff. */
export async function fetchHtml(pathOrUrl: string, attempt = 1): Promise<string> {
  await throttle();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : BASE + pathOrUrl;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (res.status === 429 || res.status >= 500) throw new Error(`retryable HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return await res.text();
  } catch (err) {
    if (attempt <= MAX_RETRIES) {
      const backoff = 2000 * 2 ** (attempt - 1);
      console.warn(
        `  retry ${attempt}/${MAX_RETRIES} ${url} in ${backoff}ms (${(err as Error).message})`,
      );
      await sleep(backoff);
      return fetchHtml(pathOrUrl, attempt + 1);
    }
    throw err;
  }
}
