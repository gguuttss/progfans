import {
  type Grade,
  type MaxCounts,
  RATING_CAP,
  RATING_FLOOR,
  SCORE_MIN_VOTES,
  scoreSeries,
  type SeriesStats,
  VOLUME_WEIGHT,
} from "@progfans/db/rating";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { EMPTY_LINKS, type LinkSource, type SeriesEditPayload } from "./series-edit";
import type { TierListView, TierRowData, TierSeries } from "./tier";

export type SourceRating = { value: number; votes: number };

const toRating = (value: unknown, votes: unknown): SourceRating | null =>
  value == null ? null : { value: Number(value), votes: Number(votes ?? 0) };

/**
 * The tier score as a SQL expression, so we can sort the *whole* catalog by it
 * (not just a fetched page). Mirrors `scoreSeries` exactly, reusing the same
 * constants. Columns expected in scope: rr/gr/pf (.value, .votes). NULL when no
 * platform crosses its threshold (sorts last). Constants are code-controlled.
 */
function tierScoreSql(max: MaxCounts) {
  const pts = (val: string, votes: string, p: "royalroad" | "goodreads" | "progfans") =>
    `(case when ${votes} >= ${SCORE_MIN_VOTES[p]} then greatest(0, least(1, (${val} - ${RATING_FLOOR[p]}) / ${RATING_CAP[p] - RATING_FLOOR[p]})) * 30 else 0 end)`;
  const q = (votes: string, p: "royalroad" | "goodreads" | "progfans") =>
    `(case when ${votes} >= ${SCORE_MIN_VOTES[p]} then 1 else 0 end)`;
  const vol = (votes: string, m: number, w: number) =>
    m > 0 && w > 0
      ? `(case when ${votes} > 0 then ln(${votes} + 1) / ln(${m} + 1) * ${w} else 0 end)`
      : "0";

  const rating = `(${pts("rr.value", "rr.votes", "royalroad")} + ${pts("gr.value", "gr.votes", "goodreads")} + ${pts("pf.value", "pf.votes", "progfans")})`;
  const nq = `(${q("rr.votes", "royalroad")} + ${q("gr.votes", "goodreads")} + ${q("pf.votes", "progfans")})`;
  const volume = `(${vol("gr.votes", max.goodreads, VOLUME_WEIGHT.goodreads)} + ${vol("pf.votes", max.progfans, VOLUME_WEIGHT.progfans)})`;
  return sql.raw(`(case when ${nq} > 0 then ${rating} * 3.0 / ${nq} + ${volume} else null end)`);
}

/** Catalog-wide max rating counts per platform — the ceiling for the volume score. */
export async function getScoreMaxCounts(): Promise<MaxCounts> {
  const [r] = await db.execute<Record<string, unknown>>(sql`
    select
      coalesce(max(case when source = 'royalroad' then votes end), 0) as rr,
      coalesce(max(case when source = 'goodreads' then votes end), 0) as gr
    from series_ratings`);
  const [p] = await db.execute<Record<string, unknown>>(sql`
    select coalesce(max(c), 0) as pf
    from (select count(score) c from list_entries where score is not null group by series_id) x`);
  return {
    royalroad: Number(r?.rr ?? 0),
    goodreads: Number(r?.gr ?? 0),
    progfans: Number(p?.pf ?? 0),
  };
}

function scoreFor(
  rr: SourceRating | null,
  gr: SourceRating | null,
  pf: SourceRating | null,
  max: MaxCounts,
): { grade: Grade; score: number } {
  const stats: SeriesStats = {
    royalroad: rr ? { mean: rr.value, count: rr.votes } : null,
    goodreads: gr ? { mean: gr.value, count: gr.votes } : null,
    progfans: pf ? { mean: pf.value, count: pf.votes } : null,
  };
  const { grade, score } = scoreSeries(stats, max);
  return { grade, score: Math.round(score) };
}

export type CatalogItem = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: string;
  authors: string;
  lengthWords: number | null;
  lengthChapters: number | null;
  rr: SourceRating | null;
  gr: SourceRating | null;
  progfans: SourceRating | null;
  tropes: string[];
  grade: Grade;
  score: number; // 0–100 tier score (0 when grade is "?")
  myStatus: string | null; // signed-in user's list status for this series
  myScore: number | null;
  myNotes: string | null;
};

// Sort keys: overall tier score, per-source rating/review counts, user's score.
export type CatalogSort =
  | "tier"
  | "popularity"
  | "rating_rr"
  | "rating_gr"
  | "rating_pf"
  | "reviews_rr"
  | "reviews_gr"
  | "reviews_pf"
  | "my_score";

export type CatalogParams = {
  q?: string;
  tropes?: string[]; // series must carry ALL of these
  excludeTropes?: string[]; // series must carry NONE of these
  statuses?: string[];
  sort?: CatalogSort;
  userId?: string;
  page?: number; // 1-based
  pageSize?: number;
};

export const CATALOG_PAGE_SIZE = 20;

// WHERE conditions shared by getCatalog (page) and getCatalogCount (total).
function catalogConds(p: CatalogParams) {
  // Show auto-qualified RR series *and* manually included (imported) books.
  const conds = [sql`s.eligibility_status in ('eligible', 'manual_include')`];
  if (p.q?.trim()) {
    const term = p.q.trim();
    const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    // Match the series (title/description FTS), any of its books by title, or
    // any of its authors by name — so "unsouled" → Cradle and "Will Wight"
    // returns all his series.
    conds.push(sql`(
      s.search_vector @@ plainto_tsquery('english', ${term})
      or exists (select 1 from books b where b.series_id = s.id and b.title ilike ${like})
      or exists (
        select 1 from series_authors sa join authors a on a.id = sa.author_id
        where sa.series_id = s.id and a.name ilike ${like}
      )
    )`);
  }
  if (p.statuses?.length) {
    const list = sql.join(
      p.statuses.map((s) => sql`${s}`),
      sql`, `,
    );
    conds.push(sql`s.status::text in (${list})`);
  }
  if (p.tropes?.length) {
    // AND semantics: a series must carry every selected trope.
    const list = sql.join(
      p.tropes.map((s) => sql`${s}`),
      sql`, `,
    );
    conds.push(sql`s.id in (
      select st.series_id from series_tropes st
      join tropes t on t.id = st.trope_id
      where t.slug in (${list})
      group by st.series_id
      having count(distinct t.slug) = ${p.tropes.length}
    )`);
  }
  if (p.excludeTropes?.length) {
    const list = sql.join(
      p.excludeTropes.map((s) => sql`${s}`),
      sql`, `,
    );
    conds.push(sql`s.id not in (
      select st.series_id from series_tropes st
      join tropes t on t.id = st.trope_id
      where t.slug in (${list})
    )`);
  }
  return conds;
}

export async function getCatalogCount(p: CatalogParams = {}): Promise<number> {
  const where = sql.join(catalogConds(p), sql` and `);
  const [r] = await db.execute<Record<string, unknown>>(
    sql`select count(*)::int as n from series s where ${where}`,
  );
  return Number(r?.n ?? 0);
}

export async function getCatalog(p: CatalogParams = {}): Promise<CatalogItem[]> {
  const userId = p.userId;
  const max = await getScoreMaxCounts();
  const conds = catalogConds(p);
  const page = Math.max(1, p.page ?? 1);
  const pageSize = p.pageSize ?? CATALOG_PAGE_SIZE;

  const listJoin = userId
    ? sql`left join list_entries le on le.series_id = s.id and le.user_id = ${userId}`
    : sql``;
  const listSelect = userId
    ? sql`le.status::text as my_status, le.score as my_score, le.notes as my_notes`
    : sql`null::text as my_status, null::int as my_score, null::text as my_notes`;
  const listGroup = userId ? sql`, le.status, le.score, le.notes` : sql``;

  let sort = p.sort ?? "tier";
  if (sort === "my_score" && !userId) sort = "tier";

  // Rating sorts gate on the vote threshold so a flukey 5.0/3-votes can't top
  // the list (the figures themselves are still shown everywhere).
  const ORDER: Record<CatalogSort, ReturnType<typeof sql>> = {
    tier: sql`${tierScoreSql(max)} desc nulls last, s.popularity desc`,
    popularity: sql`s.popularity desc`,
    rating_rr: sql`(case when rr.votes >= ${SCORE_MIN_VOTES.royalroad} then rr.value end) desc nulls last, s.popularity desc`,
    rating_gr: sql`(case when gr.votes >= ${SCORE_MIN_VOTES.goodreads} then gr.value end) desc nulls last, s.popularity desc`,
    rating_pf: sql`(case when pf.votes >= ${SCORE_MIN_VOTES.progfans} then pf.value end) desc nulls last, s.popularity desc`,
    reviews_rr: sql`rr.votes desc nulls last, s.popularity desc`,
    reviews_gr: sql`gr.votes desc nulls last, s.popularity desc`,
    reviews_pf: sql`pf.votes desc nulls last, s.popularity desc`,
    my_score: sql`le.score desc nulls last, s.popularity desc`,
  };

  const where = sql.join(conds, sql` and `);

  const rows = await db.execute<Record<string, unknown>>(sql`
    select
      s.id, s.slug, s.title, s.cover_url, s.status, s.popularity,
      s.description,
      s.length_words, s.length_chapters,
      coalesce(string_agg(distinct a.name, ', '), '') as authors,
      rr.value::float as rr_value, rr.votes as rr_votes,
      gr.value::float as gr_value, gr.votes as gr_votes,
      pf.value as pf_value, pf.votes as pf_votes,
      ${listSelect},
      coalesce((
        select json_agg(t.name order by t.name)
        from series_tropes st join tropes t on t.id = st.trope_id
        where st.series_id = s.id
      ), '[]'::json) as tropes
    from series s
    left join series_authors sa on sa.series_id = s.id
    left join authors a on a.id = sa.author_id
    left join series_ratings rr on rr.series_id = s.id and rr.source = 'royalroad'
    left join series_ratings gr on gr.series_id = s.id and gr.source = 'goodreads'
    left join (
      select series_id, avg(score)::float as value, count(score)::int as votes
      from list_entries where score is not null group by series_id
    ) pf on pf.series_id = s.id
    ${listJoin}
    where ${where}
    group by s.id, rr.value, rr.votes, gr.value, gr.votes, pf.value, pf.votes${listGroup}
    order by ${ORDER[sort]}
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `);

  return rows.map((r) => {
    const rr = toRating(r.rr_value, r.rr_votes);
    const gr = toRating(r.gr_value, r.gr_votes);
    const progfans = toRating(r.pf_value, r.pf_votes);
    const { grade, score } = scoreFor(rr, gr, progfans, max);
    return {
      id: Number(r.id),
      slug: String(r.slug),
      title: String(r.title),
      description: (r.description as string | null) ?? null,
      coverUrl: (r.cover_url as string | null) ?? null,
      status: String(r.status),
      authors: String(r.authors),
      lengthWords: r.length_words == null ? null : Number(r.length_words),
      lengthChapters: r.length_chapters == null ? null : Number(r.length_chapters),
      rr,
      gr,
      progfans,
      tropes: (r.tropes as string[]) ?? [],
      grade,
      score,
      myStatus: (r.my_status as string | null) ?? null,
      myScore: r.my_score == null ? null : Number(r.my_score),
      myNotes: (r.my_notes as string | null) ?? null,
    };
  });
}

export type SeriesDetail = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: string;
  authors: string[];
  firstPublishedAt: string | null;
  lengthWords: number | null;
  lengthChapters: number | null;
  lengthAudioMinutes: number | null;
  romance: string | null;
  pov: string | null;
  mcGender: string | null;
  formats: { web: boolean; ebook: boolean; ku: boolean; audio: boolean };
  ratings: { source: string; value: number; votes: number }[];
  tropes: { slug: string; name: string; category: string }[];
  links: { source: string; url: string; isAffiliate: boolean }[];
  books: SeriesBook[];
  grade: Grade;
  score: number;
};

export type SeriesBook = {
  id: number;
  position: number | null;
  title: string;
  coverUrl: string | null;
  description: string | null;
  gr: { value: number; votes: number } | null;
  goodreadsUrl: string | null;
};

export async function getSeries(slug: string): Promise<SeriesDetail | null> {
  const max = await getScoreMaxCounts();
  const [s] = await db.execute<Record<string, unknown>>(sql`
    select s.*, coalesce((
      select json_agg(a.name order by a.name)
      from series_authors sa join authors a on a.id = sa.author_id
      where sa.series_id = s.id
    ), '[]'::json) as authors
    from series s where s.slug = ${slug} limit 1
  `);
  if (!s) return null;
  const id = s.id;

  const [ratings, tropes, links, progfans, bookRows] = await Promise.all([
    db.execute<Record<string, unknown>>(
      sql`select source, value::float as value, votes from series_ratings where series_id = ${id}`,
    ),
    db.execute<Record<string, unknown>>(sql`
      select t.slug, t.name, t.category from series_tropes st
      join tropes t on t.id = st.trope_id where st.series_id = ${id} order by t.category, t.name`),
    db.execute<Record<string, unknown>>(
      sql`select source, url, is_affiliate from source_links where series_id = ${id}`,
    ),
    db.execute<Record<string, unknown>>(sql`
      select avg(score)::float as value, count(score)::int as votes
      from list_entries where series_id = ${id} and score is not null`),
    db.execute<Record<string, unknown>>(sql`
      select b.id, b.position, b.title, b.cover_url, b.description,
        (select value::float from book_ratings where book_id = b.id and source = 'goodreads') as gr_value,
        (select votes from book_ratings where book_id = b.id and source = 'goodreads') as gr_votes,
        (select url from book_links where book_id = b.id and source = 'goodreads') as gr_url
      from books b where b.series_id = ${id} order by b.position nulls last, b.id`),
  ]);

  // progfans's own rating (1–10 list scores), shown alongside the external ones.
  const pf = progfans[0]?.value == null ? null : toRating(progfans[0].value, progfans[0].votes);
  const allRatings = [
    ...ratings.map((r) => ({
      source: String(r.source),
      value: Number(r.value),
      votes: Number(r.votes),
    })),
    ...(pf ? [{ source: "progfans", value: pf.value, votes: pf.votes }] : []),
  ];

  const rr = toRating(
    ratings.find((r) => r.source === "royalroad")?.value,
    ratings.find((r) => r.source === "royalroad")?.votes,
  );
  const gr = toRating(
    ratings.find((r) => r.source === "goodreads")?.value,
    ratings.find((r) => r.source === "goodreads")?.votes,
  );

  return {
    id: Number(s.id),
    slug: String(s.slug),
    title: String(s.title),
    description: (s.description as string | null) ?? null,
    coverUrl: (s.cover_url as string | null) ?? null,
    status: String(s.status),
    authors: (s.authors as string[]) ?? [],
    firstPublishedAt: (s.first_published_at as string | null) ?? null,
    lengthWords: s.length_words == null ? null : Number(s.length_words),
    lengthChapters: s.length_chapters == null ? null : Number(s.length_chapters),
    lengthAudioMinutes: s.length_audio_minutes == null ? null : Number(s.length_audio_minutes),
    romance: (s.romance as string | null) ?? null,
    pov: (s.pov as string | null) ?? null,
    mcGender: (s.mc_gender as string | null) ?? null,
    formats: {
      web: Boolean(s.has_web),
      ebook: Boolean(s.has_ebook),
      ku: Boolean(s.has_ku),
      audio: Boolean(s.has_audio),
    },
    ratings: allRatings,
    tropes: tropes.map((t) => ({
      slug: String(t.slug),
      name: String(t.name),
      category: String(t.category),
    })),
    links: links.map((l) => ({
      source: String(l.source),
      url: String(l.url),
      isAffiliate: Boolean(l.is_affiliate),
    })),
    books: bookRows.map((b) => ({
      id: Number(b.id),
      position: b.position == null ? null : Number(b.position),
      title: String(b.title),
      coverUrl: (b.cover_url as string | null) ?? null,
      description: (b.description as string | null) ?? null,
      gr: b.gr_value == null ? null : { value: Number(b.gr_value), votes: Number(b.gr_votes ?? 0) },
      goodreadsUrl: (b.gr_url as string | null) ?? null,
    })),
    ...scoreFor(rr, gr, pf, max),
  };
}

export type ListEntry = { status: string; score: number | null; notes: string | null };

export async function getUserListEntry(
  userId: string,
  seriesId: number,
): Promise<ListEntry | null> {
  const [r] = await db.execute<Record<string, unknown>>(sql`
    select status::text as status, score, notes
    from list_entries where user_id = ${userId} and series_id = ${seriesId} limit 1`);
  if (!r) return null;
  return {
    status: String(r.status),
    score: r.score == null ? null : Number(r.score),
    notes: (r.notes as string | null) ?? null,
  };
}

export type UserListItem = {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  authors: string;
  listStatus: string; // the list owner's status (used for grouping)
  ownerScore: number | null; // the owner's score for this series
  // The signed-in viewer's own entry — drives the add/edit button on each row.
  viewerStatus: string | null;
  viewerScore: number | null;
  viewerNotes: string | null;
};

/**
 * A user's (public) list. `ownerId` owns the list being shown; `viewerId` is the
 * signed-in visitor (may be the owner, someone else, or nobody) whose own entry
 * for each series powers the per-row add/edit button.
 */
export async function getUserList(ownerId: string, viewerId?: string): Promise<UserListItem[]> {
  const viewerJoin = viewerId
    ? sql`left join list_entries lv on lv.series_id = s.id and lv.user_id = ${viewerId}`
    : sql``;
  const viewerSelect = viewerId
    ? sql`lv.status::text as viewer_status, lv.score as viewer_score, lv.notes as viewer_notes`
    : sql`null::text as viewer_status, null::int as viewer_score, null::text as viewer_notes`;
  const viewerGroup = viewerId ? sql`, lv.status, lv.score, lv.notes` : sql``;

  const rows = await db.execute<Record<string, unknown>>(sql`
    select
      s.id, s.slug, s.title, s.cover_url,
      coalesce(string_agg(distinct a.name, ', '), '') as authors,
      le.status::text as list_status, le.score as owner_score,
      ${viewerSelect}
    from list_entries le
    join series s on s.id = le.series_id
    left join series_authors sa on sa.series_id = s.id
    left join authors a on a.id = sa.author_id
    ${viewerJoin}
    where le.user_id = ${ownerId}
    group by s.id, le.status, le.score, le.updated_at${viewerGroup}
    order by le.updated_at desc`);

  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    coverUrl: (r.cover_url as string | null) ?? null,
    authors: String(r.authors),
    listStatus: String(r.list_status),
    ownerScore: r.owner_score == null ? null : Number(r.owner_score),
    viewerStatus: (r.viewer_status as string | null) ?? null,
    viewerScore: r.viewer_score == null ? null : Number(r.viewer_score),
    viewerNotes: (r.viewer_notes as string | null) ?? null,
  }));
}

export type FullProfile = {
  id: string;
  username: string;
  bio: string | null;
  location: string | null;
  birthday: string | null;
  birthdayPrecision: string | null;
  gender: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
};

export async function getFullProfile(username: string): Promise<FullProfile | null> {
  const [r] = await db.execute<Record<string, unknown>>(sql`
    select id, username, bio, location, birthday, birthday_precision, gender, avatar_url, is_admin, created_at
    from profiles where username = ${username.toLowerCase()} limit 1`);
  if (!r) return null;
  return {
    id: String(r.id),
    username: String(r.username),
    bio: (r.bio as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    birthday: (r.birthday as string | null) ?? null,
    birthdayPrecision: (r.birthday_precision as string | null) ?? null,
    gender: (r.gender as string | null) ?? null,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    isAdmin: Boolean(r.is_admin),
    createdAt: String(r.created_at),
  };
}

// ── Moderation ────────────────────────────────────────────────────────────

/** Current editable state of a series, as the edit form's starting values. */
export async function getSeriesEditState(seriesId: number): Promise<SeriesEditPayload | null> {
  const [s] = await db.execute<Record<string, unknown>>(sql`
    select title, description, status::text as status, pov::text as pov,
      mc_gender::text as mc_gender, romance::text as romance,
      has_web, has_ebook, has_ku, has_audio
    from series where id = ${seriesId}`);
  if (!s) return null;
  const [tropes, links, books, bookLinks] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      select t.slug from series_tropes st join tropes t on t.id = st.trope_id
      where st.series_id = ${seriesId} order by t.slug`),
    db.execute<Record<string, unknown>>(
      sql`select source, url from source_links where series_id = ${seriesId}`,
    ),
    db.execute<Record<string, unknown>>(sql`
      select id, title, position, description from books
      where series_id = ${seriesId} order by position nulls last, id`),
    db.execute<Record<string, unknown>>(sql`
      select bl.book_id, bl.source, bl.url from book_links bl
      join books b on b.id = bl.book_id where b.series_id = ${seriesId}`),
  ]);
  const linkMap = { ...EMPTY_LINKS };
  for (const l of links) {
    const src = String(l.source) as LinkSource;
    if (src in linkMap) linkMap[src] = String(l.url);
  }
  const linksByBook = new Map<number, Record<string, string>>();
  for (const l of bookLinks) {
    const bid = Number(l.book_id);
    const m = linksByBook.get(bid) ?? {};
    m[String(l.source)] = String(l.url);
    linksByBook.set(bid, m);
  }
  return {
    title: String(s.title),
    description: (s.description as string | null) ?? null,
    status: String(s.status),
    pov: (s.pov as string | null) ?? null,
    mcGender: (s.mc_gender as string | null) ?? null,
    romance: (s.romance as string | null) ?? null,
    formats: {
      web: Boolean(s.has_web),
      ebook: Boolean(s.has_ebook),
      ku: Boolean(s.has_ku),
      audio: Boolean(s.has_audio),
    },
    tropes: tropes.map((t) => String(t.slug)),
    links: linkMap,
    books: books.map((b) => {
      const bl = linksByBook.get(Number(b.id)) ?? {};
      return {
        id: Number(b.id),
        title: String(b.title),
        position: b.position == null ? null : Number(b.position),
        description: (b.description as string | null) ?? null,
        links: {
          goodreads: bl.goodreads ?? "",
          amazon: bl.amazon ?? "",
          audible: bl.audible ?? "",
        },
      };
    }),
  };
}

export type PendingChange = {
  id: number;
  kind: string;
  seriesId: number | null;
  payload: unknown;
  note: string | null;
  createdAt: string;
  proposer: string | null;
  seriesTitle: string | null;
  seriesSlug: string | null;
};

export async function getPendingChanges(): Promise<PendingChange[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select cr.id, cr.kind, cr.series_id, cr.payload, cr.note, cr.created_at,
      p.username as proposer, s.title as series_title, s.slug as series_slug
    from change_requests cr
    left join profiles p on p.id = cr.proposer_id
    left join series s on s.id = cr.series_id
    where cr.status = 'pending'
    order by cr.created_at`);
  return rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    seriesId: r.series_id == null ? null : Number(r.series_id),
    payload: r.payload,
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at),
    proposer: (r.proposer as string | null) ?? null,
    seriesTitle: (r.series_title as string | null) ?? null,
    seriesSlug: (r.series_slug as string | null) ?? null,
  }));
}

export async function pendingChangeCount(): Promise<number> {
  const [r] = await db.execute<Record<string, unknown>>(
    sql`select count(*)::int as n from change_requests where status = 'pending'`,
  );
  return Number(r?.n ?? 0);
}

/** Approved new-book requests not yet added to the catalog — the admin's TODO. */
export async function getApprovedBookRequests(): Promise<PendingChange[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select cr.id, cr.kind, cr.series_id, cr.payload, cr.note, cr.created_at, p.username as proposer
    from change_requests cr
    left join profiles p on p.id = cr.proposer_id
    where cr.status = 'approved' and cr.kind = 'new_series'
    order by cr.created_at`);
  return rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    seriesId: null,
    payload: r.payload,
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at),
    proposer: (r.proposer as string | null) ?? null,
    seriesTitle: null,
    seriesSlug: null,
  }));
}

export type ListStats = {
  plan: number;
  reading: number;
  paused: number;
  read: number;
  dropped: number;
  total: number;
};

export async function getListStats(userId: string): Promise<ListStats> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select status::text as status, count(*)::int as n
    from list_entries where user_id = ${userId} group by status`);
  const stats: ListStats = { plan: 0, reading: 0, paused: 0, read: 0, dropped: 0, total: 0 };
  for (const r of rows) {
    const k = String(r.status) as keyof ListStats;
    if (k in stats) stats[k] = Number(r.n);
    stats.total += Number(r.n);
  }
  return stats;
}

export type ActivityItem = {
  slug: string;
  title: string;
  coverUrl: string | null;
  status: string;
  score: number | null;
  updatedAt: string;
};

export async function getRecentActivity(userId: string, limit = 5): Promise<ActivityItem[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.slug, s.title, s.cover_url, le.status::text as status, le.score, le.updated_at
    from list_entries le join series s on s.id = le.series_id
    where le.user_id = ${userId}
    order by le.updated_at desc limit ${limit}`);
  return rows.map((r) => ({
    slug: String(r.slug),
    title: String(r.title),
    coverUrl: (r.cover_url as string | null) ?? null,
    status: String(r.status),
    score: r.score == null ? null : Number(r.score),
    updatedAt: String(r.updated_at),
  }));
}

export async function isFavorite(userId: string, seriesId: number): Promise<boolean> {
  const [r] = await db.execute<Record<string, unknown>>(sql`
    select 1 from profile_favorites where user_id = ${userId} and series_id = ${seriesId} limit 1`);
  return Boolean(r);
}

export async function favoriteCount(userId: string): Promise<number> {
  const [r] = await db.execute<Record<string, unknown>>(
    sql`select count(*)::int as n from profile_favorites where user_id = ${userId}`,
  );
  return Number(r?.n ?? 0);
}

export type FavoriteSeries = {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
};

export async function getFavorites(userId: string): Promise<FavoriteSeries[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.slug, s.title, s.cover_url
    from profile_favorites f join series s on s.id = f.series_id
    where f.user_id = ${userId}
    order by f.position, f.created_at limit 10`);
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    coverUrl: (r.cover_url as string | null) ?? null,
  }));
}

export type SearchSuggestion = {
  id: number;
  slug: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  // The book whose title matched, when the series title itself didn't — shown
  // as a hint so it's clear why e.g. "Cradle" appeared for a search of "reaper".
  matchedBook: string | null;
};

/**
 * Typeahead for the navbar dropdown. Matches a series by its title, by any of
 * its books' titles (→ the parent series), or by author name (→ their series).
 */
export async function getSearchSuggestions(q: string, limit = 7): Promise<SearchSuggestion[]> {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.slug, s.title, s.cover_url,
      coalesce(string_agg(distinct a.name, ', '), '') as authors,
      case when s.title ilike ${like} then null
        else (select b.title from books b
              where b.series_id = s.id and b.title ilike ${like}
              order by length(b.title) limit 1)
      end as matched_book
    from series s
    left join series_authors sa on sa.series_id = s.id
    left join authors a on a.id = sa.author_id
    where s.eligibility_status in ('eligible', 'manual_include')
      and (
        s.title ilike ${like}
        or exists (select 1 from books b where b.series_id = s.id and b.title ilike ${like})
        or exists (
          select 1 from series_authors sa2 join authors a2 on a2.id = sa2.author_id
          where sa2.series_id = s.id and a2.name ilike ${like}
        )
      )
    group by s.id
    order by (lower(s.title) = lower(${term})) desc, (s.title ilike ${like}) desc, s.popularity desc
    limit ${limit}`);
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    authors: String(r.authors),
    coverUrl: (r.cover_url as string | null) ?? null,
    matchedBook: (r.matched_book as string | null) ?? null,
  }));
}

export type TropeOption = { slug: string; name: string; category: string };

export async function getTropeOptions(): Promise<TropeOption[]> {
  const rows = await db.execute<Record<string, unknown>>(
    sql`select slug, name, category from tropes order by category, name`,
  );
  return rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name),
    category: String(r.category),
  }));
}

// ── Tier lists ──────────────────────────────────────────────────────────────

/**
 * Every series the user tracks (any status), newest first — pre-fills the
 * builder's "Unranked" tray so they start from their own shelf.
 */
export async function getTrackedSeries(userId: string): Promise<TierSeries[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.slug, s.title, s.cover_url
    from list_entries le join series s on s.id = le.series_id
    where le.user_id = ${userId}
    order by le.updated_at desc`);
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    coverUrl: (r.cover_url as string | null) ?? null,
  }));
}

/** A full tier list by slug (with tiers + their series in order), or null. */
export async function getTierList(slug: string): Promise<TierListView | null> {
  const [head] = await db.execute<Record<string, unknown>>(sql`
    select t.id, t.slug, t.title, t.owner_id, t.remixed_from, t.created_at,
      p.username as owner_username,
      src.slug as remixed_from_slug, src.title as remixed_from_title
    from tier_lists t
    left join profiles p on p.id = t.owner_id
    left join tier_lists src on src.id = t.remixed_from
    where t.slug = ${slug} limit 1`);
  if (!head) return null;

  const rows = await db.execute<Record<string, unknown>>(sql`
    select tr.id as tier_id, tr.label, tr.color, tr.position as tier_pos,
      s.id, s.slug, s.title, s.cover_url, ti.position as item_pos
    from tier_list_tiers tr
    left join tier_list_items ti on ti.tier_id = tr.id
    left join series s on s.id = ti.series_id
    where tr.tier_list_id = ${Number(head.id)}
    order by tr.position, ti.position`);

  const byTier = new Map<number, TierRowData>();
  const order: number[] = [];
  for (const r of rows) {
    const tierId = Number(r.tier_id);
    if (!byTier.has(tierId)) {
      byTier.set(tierId, { label: String(r.label), color: String(r.color), items: [] });
      order.push(tierId);
    }
    if (r.id != null) {
      byTier.get(tierId)!.items.push({
        id: Number(r.id),
        slug: String(r.slug),
        title: String(r.title),
        coverUrl: (r.cover_url as string | null) ?? null,
      });
    }
  }

  return {
    id: Number(head.id),
    slug: String(head.slug),
    title: String(head.title),
    ownerId: (head.owner_id as string | null) ?? null,
    ownerUsername: (head.owner_username as string | null) ?? null,
    remixedFrom: head.remixed_from == null ? null : Number(head.remixed_from),
    remixedFromSlug: (head.remixed_from_slug as string | null) ?? null,
    remixedFromTitle: (head.remixed_from_title as string | null) ?? null,
    createdAt: String(head.created_at),
    tiers: order.map((id) => byTier.get(id)!),
  };
}

export type TierListSummary = {
  id: number;
  slug: string;
  title: string;
  ownerUsername: string | null;
  createdAt: string;
  ranked: number;
  votes: number;
  voted: boolean;
  covers: string[];
};

export type TierSort = "new" | "top" | "trending";

/** All public tier lists, sorted by recency / upvotes / trending, with covers. */
export async function getTierLists(
  sort: TierSort,
  viewerId?: string,
  limit = 60,
): Promise<TierListSummary[]> {
  const votedSelect = viewerId ? sql`(uv.user_id is not null)` : sql`false`;
  const votedJoin = viewerId
    ? sql`left join tier_list_votes uv on uv.tier_list_id = t.id and uv.user_id = ${viewerId}`
    : sql``;
  const orderBy =
    sort === "top"
      ? sql`coalesce(v.cnt, 0) desc, t.created_at desc`
      : sort === "trending"
        ? sql`coalesce(rv.cnt, 0) desc, coalesce(v.cnt, 0) desc, t.created_at desc`
        : sql`t.created_at desc`;

  const rows = await db.execute<Record<string, unknown>>(sql`
    select t.id, t.slug, t.title, t.created_at,
      p.username as owner_username,
      coalesce(v.cnt, 0)::int as votes,
      ${votedSelect} as voted,
      coalesce(ic.cnt, 0)::int as ranked
    from tier_lists t
    left join profiles p on p.id = t.owner_id
    left join (select tier_list_id, count(*) as cnt from tier_list_votes group by tier_list_id) v
      on v.tier_list_id = t.id
    left join (
      select tier_list_id, count(*) as cnt from tier_list_votes
      where created_at > now() - interval '7 days' group by tier_list_id
    ) rv on rv.tier_list_id = t.id
    left join (select tier_list_id, count(*) as cnt from tier_list_items group by tier_list_id) ic
      on ic.tier_list_id = t.id
    ${votedJoin}
    where t.is_public = true
    order by ${orderBy}
    limit ${limit}`);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => Number(r.id));
  const coverRows = await db.execute<Record<string, unknown>>(sql`
    select x.tier_list_id, x.cover_url
    from (
      select ti.tier_list_id, s.cover_url,
        row_number() over (partition by ti.tier_list_id order by tr.position, ti.position) as rn
      from tier_list_items ti
      join tier_list_tiers tr on tr.id = ti.tier_id
      join series s on s.id = ti.series_id
      where ti.tier_list_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )}) and s.cover_url is not null
    ) x
    where x.rn <= 8
    order by x.tier_list_id, x.rn`);

  const coversByList = new Map<number, string[]>();
  for (const r of coverRows) {
    const lid = Number(r.tier_list_id);
    const list = coversByList.get(lid) ?? [];
    list.push(String(r.cover_url));
    coversByList.set(lid, list);
  }

  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    ownerUsername: (r.owner_username as string | null) ?? null,
    createdAt: String(r.created_at),
    ranked: Number(r.ranked),
    votes: Number(r.votes),
    voted: Boolean(r.voted),
    covers: coversByList.get(Number(r.id)) ?? [],
  }));
}

/** Upvote count + whether the viewer has upvoted, for one tier list. */
export async function getTierVoteState(
  tierListId: number,
  viewerId?: string,
): Promise<{ votes: number; voted: boolean }> {
  const [c] = await db.execute<Record<string, unknown>>(
    sql`select count(*)::int as n from tier_list_votes where tier_list_id = ${tierListId}`,
  );
  let voted = false;
  if (viewerId) {
    const [v] = await db.execute<Record<string, unknown>>(
      sql`select 1 from tier_list_votes where tier_list_id = ${tierListId} and user_id = ${viewerId} limit 1`,
    );
    voted = Boolean(v);
  }
  return { votes: Number(c?.n ?? 0), voted };
}
