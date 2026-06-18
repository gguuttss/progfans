import { type Browser, type Page, chromium } from "playwright";
import { sleep } from "../royalroad/util";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let browser: Browser | null = null;
let page: Page | null = null;

async function getPage(): Promise<Page> {
  if (!page) {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ userAgent: UA });
  }
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

/**
 * Fetch any Goodreads page. The first navigation solves the AWS WAF challenge;
 * the resulting cookie is reused for the rest of the session.
 *
 * GR is a React app: meta tags (og:*) are server-rendered and present in the
 * initial HTML, but body content (the book description) is client-hydrated.
 * Pass `waitFor` to block until a content selector hydrates before reading —
 * otherwise we can capture a half-rendered page (its <title> reads "Loading...").
 */
export async function fetchGoodreads(url: string, waitFor?: string, attempt = 1): Promise<string> {
  const p = await getPage();
  try {
    // "commit" resolves as soon as navigation starts; the WAF challenge then
    // reloads into the real page, which we wait for via the content selector.
    await p.goto(url, { waitUntil: "commit", timeout: 60000 });
    // Wait for the real page past the WAF challenge: a results table (search/
    // list pages) or a book-page title (book pages have no tableList).
    await p.waitForSelector("table.tableList tr, .searchSubNavContainer, h1", {
      timeout: 30000,
    });
    // Optionally wait for a specific content selector to hydrate. Best-effort:
    // a book legitimately missing this element shouldn't abort the fetch.
    if (waitFor) {
      await p.waitForSelector(waitFor, { timeout: 15000 }).catch(() => {});
    }
  } catch (err) {
    if (attempt <= 2) {
      await sleep(3000);
      return fetchGoodreads(url, waitFor, attempt + 1);
    }
    console.warn(`  goodreads fetch gave up on ${url} (${(err as Error).message})`);
  }
  await sleep(400);
  return p.content();
}

export function searchBooks(query: string): Promise<string> {
  return fetchGoodreads(
    `https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`,
  );
}
