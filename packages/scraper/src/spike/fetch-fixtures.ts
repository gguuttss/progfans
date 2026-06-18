// Spike: download a handful of real Royal Road pages as parser fixtures.
// Run: pnpm --filter @progfans/scraper exec tsx src/spike/fetch-fixtures.ts
import { mkdir, writeFile } from "node:fs/promises";

const UA = "progfans-catalog-bot/0.1 (+https://github.com/gguuttss/progfans/issues)";

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir("fixtures", { recursive: true });

  const list = await get("https://www.royalroad.com/fictions/best-rated");
  await writeFile("fixtures/best-rated.html", list);
  console.log("saved best-rated list:", list.length, "bytes");

  const ids = [...new Set([...list.matchAll(/\/fiction\/(\d+)\//g)].map((m) => m[1]))].slice(0, 6);
  console.log("discovered fiction ids:", ids);

  for (const id of ids) {
    const html = await get(`https://www.royalroad.com/fiction/${id}`);
    await writeFile(`fixtures/fiction-${id}.html`, html);
    console.log(`saved fiction ${id}: ${html.length} bytes`);
    await sleep(2000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
