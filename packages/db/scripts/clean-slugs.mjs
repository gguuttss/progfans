// Regenerate stale series slugs from their (now-clean) titles. Merged canonicals
// kept their old slug while their title became the GR series name, so the URL
// can mismatch (e.g. /series/stone-vs-viper-1 -> "The Anime Trope System").
// Keeps slugs that already match the title; only rewrites the mismatched ones.
// Dry run:  node clean-slugs.mjs        Apply:  node clean-slugs.mjs --apply
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// Matches the scraper's slugify (packages/scraper/src/royalroad/util.ts) so
// cosmetic-only differences aren't treated as stale.
const slugify = (s) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "untitled";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rows = await sql`select id, slug, title from series order by id`;

const used = new Set();
const dirty = [];
for (const r of rows) {
  const base = slugify(r.title);
  // Leave it if the current slug equals the title's slug, is a truncation of it
  // (current is a prefix of base), or is a "-N" dedup suffix. Anything else —
  // an annotation suffix ("-stubbed") or a totally different (merged) title — is
  // stale and gets rewritten.
  const clean = base.startsWith(r.slug) || new RegExp(`^${escapeRe(base)}-\\d+$`).test(r.slug);
  if (clean) used.add(r.slug);
  else dirty.push({ id: Number(r.id), from: r.slug, base });
}

const plan = [];
for (const r of dirty) {
  let slug = r.base;
  let n = 2;
  while (used.has(slug)) slug = `${r.base}-${n++}`;
  used.add(slug);
  plan.push({ id: r.id, from: r.from, to: slug });
}

console.log(`${plan.length} of ${rows.length} slugs need cleaning\n`);
for (const p of plan.slice(0, 20)) console.log(`  ${p.from}  ->  ${p.to}`);
if (plan.length > 20) console.log(`  … and ${plan.length - 20} more`);

if (APPLY) {
  // Two-pass (temp first) so a new slug can't collide with another row's old one.
  await sql.begin(async (tx) => {
    for (const p of plan) await tx`update series set slug=${`-tmp-${p.id}`} where id=${p.id}`;
    for (const p of plan)
      await tx`update series set slug=${p.to}, updated_at=now() where id=${p.id}`;
  });
  console.log(`\n✅ updated ${plan.length} slugs`);
} else {
  console.log(`\n(dry run — pass --apply to write)`);
}

await sql.end();
