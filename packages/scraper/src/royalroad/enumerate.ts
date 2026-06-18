import * as cheerio from "cheerio";
import { fetchHtml } from "./client";
import { parseIntComma } from "./util";

export type ListItem = {
  externalId: string;
  title: string;
  followers: number;
  ratingValue: number | null;
};

/** Parse a Royal Road fiction list page (best-rated, popular, tag search, …). */
export function parseListPage(html: string): ListItem[] {
  const $ = cheerio.load(html);
  return $("div.fiction-list-item")
    .toArray()
    .map((el) => {
      const $el = $(el);
      const href = $el.find("h2.fiction-title a").attr("href") ?? "";
      const externalId = (href.match(/\/fiction\/(\d+)/) ?? [])[1] ?? "";
      const title = $el.find("h2.fiction-title a").text().trim();

      const followersText = $el
        .find(".stats span")
        .toArray()
        .map((s) => $(s).text())
        .find((t) => /Followers/i.test(t));
      const followers = parseIntComma(followersText);

      const ratingLabel = $el.find('[aria-label^="Rating:"]').attr("aria-label") ?? "";
      const rv = (ratingLabel.match(/Rating:\s*([\d.]+)/) ?? [])[1];

      return { externalId, title, followers, ratingValue: rv ? Number(rv) : null };
    })
    .filter((i) => i.externalId);
}

/** Crawl a list, paginating up to maxPages, keeping items at/above the follower floor. */
export async function enumerateList(
  listPath: string,
  opts: { maxPages: number; minFollowers: number },
): Promise<ListItem[]> {
  const eligible = new Map<string, ListItem>();
  for (let page = 1; page <= opts.maxPages; page++) {
    const sep = listPath.includes("?") ? "&" : "?";
    const items = parseListPage(await fetchHtml(`${listPath}${sep}page=${page}`));
    if (items.length === 0) break;
    for (const it of items) {
      if (it.followers >= opts.minFollowers && !eligible.has(it.externalId)) {
        eligible.set(it.externalId, it);
      }
    }
    console.log(`  page ${page}: ${items.length} listed, ${eligible.size} eligible so far`);
  }
  return [...eligible.values()];
}
