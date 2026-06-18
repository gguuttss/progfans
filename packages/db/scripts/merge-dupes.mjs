import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// Strip trailing "[...]" / "(...)" annotations (status, genre, "Book N") to
// recover a clean title, e.g. "Past Life Hero (stubbed)" -> "Past Life Hero".
const cleanTitle = (t) => {
  let s = (t ?? "").trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*[([][^()[\]]*[)\]]\s*$/, "").trim();
  } while (s !== prev && s.length > 2);
  return s.length > 2 ? s : (t ?? "").trim();
};

// Move a series' user references + fill gaps + union tropes/links, then delete it.
async function mergeInto(tx, winner, loser) {
  // User references — move, dropping any that would collide with the winner's.
  await tx`update list_entries le set series_id=${winner} where le.series_id=${loser}
    and not exists (select 1 from list_entries x where x.user_id=le.user_id and x.series_id=${winner})`;
  await tx`delete from list_entries where series_id=${loser}`;

  await tx`update profile_favorites f set series_id=${winner} where f.series_id=${loser}
    and not exists (select 1 from profile_favorites x where x.user_id=f.user_id and x.series_id=${winner})`;
  await tx`delete from profile_favorites where series_id=${loser}`;

  await tx`update tier_list_items i set series_id=${winner} where i.series_id=${loser}
    and not exists (select 1 from tier_list_items x where x.tier_list_id=i.tier_list_id and x.series_id=${winner})`;
  await tx`delete from tier_list_items where series_id=${loser}`;

  // Fill gaps on the winner from the loser.
  await tx`update series w set
      cover_url=coalesce(w.cover_url,l.cover_url),
      description=coalesce(w.description,l.description),
      first_published_at=coalesce(w.first_published_at,l.first_published_at),
      has_ebook=w.has_ebook or l.has_ebook,
      has_audio=w.has_audio or l.has_audio,
      has_ku=w.has_ku or l.has_ku,
      updated_at=now()
    from series l where w.id=${winner} and l.id=${loser}`;

  // Union tropes, and carry sources the winner lacks (esp. Amazon/Audible links).
  await tx`insert into series_tropes (series_id, trope_id, source, confidence)
    select ${winner}, trope_id, source, confidence from series_tropes where series_id=${loser}
    on conflict (series_id, trope_id) do nothing`;
  await tx`insert into series_ratings (series_id, source, value, votes, fetched_at)
    select ${winner}, source, value, votes, fetched_at from series_ratings where series_id=${loser}
    on conflict (series_id, source) do nothing`;
  await tx`insert into series_popularity (series_id, source, value, fetched_at)
    select ${winner}, source, value, fetched_at from series_popularity where series_id=${loser}
    on conflict (series_id, source) do nothing`;
  await tx`insert into source_links (series_id, source, url, external_id, is_affiliate)
    select ${winner}, source, url, external_id, is_affiliate from source_links where series_id=${loser}
    on conflict (series_id, source) do nothing`;

  await tx`delete from series where id=${loser}`;
}

// Strip Goodreads rating/link/popularity from a series (used to un-duplicate a
// GR link shared by two distinct RR fictions, keeping it on the canonical one).
async function stripGoodreads(tx, id) {
  await tx`delete from series_ratings where series_id=${id} and source='goodreads'`;
  await tx`delete from series_popularity where series_id=${id} and source='goodreads'`;
  await tx`delete from source_links where series_id=${id} and source='goodreads'`;
}

const dupeUrls = await sql`
  select url from source_links where source='goodreads'
  group by url having count(*) > 1`;

const merges = [];
const skips = [];
for (const { url } of dupeUrls) {
  const rows = await sql`
    select s.id, s.title, s.eligibility_status as elig
    from source_links sl join series s on s.id=sl.series_id
    where sl.source='goodreads' and sl.url=${url} order by s.id`;
  const mi = rows.filter((r) => r.elig === "manual_include");
  const el = rows.filter((r) => r.elig === "eligible");
  if (rows.length === 2 && mi.length === 1 && el.length === 1) {
    merges.push({ winner: el[0], loser: mi[0] });
  } else {
    skips.push(rows);
  }
}

// Two distinct RR fictions sharing a GR link — keep both, strip GR from the older.
const stripIds = [612, 583]; // Until Death (Old Version), The Agartha Loop (40237)

console.log(`${merges.length} merges (manual_include -> eligible RR):`);
for (const m of merges) {
  const clean = cleanTitle(m.winner.title);
  const retitle = clean !== m.winner.title.trim() ? `  ->  "${clean}"` : "";
  console.log(`  keep [${m.winner.id}] "${m.winner.title.trim()}"${retitle}`);
  console.log(`   del [${m.loser.id}] "${m.loser.title}"`);
}
console.log(`\n${skips.length} pairs NOT auto-merged (both-eligible) -> strip GR from older:`);
for (const s of skips) console.log("  " + s.map((r) => `[${r.id}] "${r.title}"`).join("  vs  "));
console.log(`  stripping GR link from ids: ${stripIds.join(", ")}`);

if (APPLY) {
  await sql.begin(async (tx) => {
    for (const m of merges) {
      await mergeInto(tx, m.winner.id, m.loser.id);
      const clean = cleanTitle(m.winner.title);
      if (clean !== m.winner.title.trim()) {
        await tx`update series set title=${clean}, updated_at=now() where id=${m.winner.id}`;
      }
    }
    for (const id of stripIds) await stripGoodreads(tx, id);
  });
  const [{ n }] = await sql`select count(*)::int as n from (
    select url from source_links where source='goodreads' group by url having count(*)>1) x`;
  console.log(`\n✅ applied. Remaining duplicated GR urls: ${n}`);
} else {
  console.log(`\n(dry run — re-run with \`-- --apply\`)`);
}

await sql.end();
