import "../env";
import * as cheerio from "cheerio";
import { fetchHtml } from "../royalroad/client";

const html = await fetchHtml("/fiction/46901");
const $ = cheerio.load(html);
console.log("labels found on page:");
$("span.label").each((_, el) => {
  const t = $(el).text().trim().replace(/\s+/g, " ");
  if (t) console.log(`  "${t}"`);
});
