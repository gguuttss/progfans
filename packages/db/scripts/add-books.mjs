import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const sql = postgres(url, { prepare: false });

await sql`
  create table if not exists books (
    id bigserial primary key,
    series_id bigint not null references series(id) on delete cascade,
    title text not null,
    position smallint,
    description text,
    cover_url text,
    first_published_at date,
    goodreads_id text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
await sql`create index if not exists books_series_idx on books (series_id)`;
await sql`create index if not exists books_title_trgm_idx on books using gin (title gin_trgm_ops)`;

await sql`
  create table if not exists book_links (
    id bigserial primary key,
    book_id bigint not null references books(id) on delete cascade,
    source external_source not null,
    url text not null,
    external_id text,
    is_affiliate boolean not null default false,
    constraint book_links_book_source_uq unique (book_id, source)
  )`;

await sql`
  create table if not exists book_ratings (
    book_id bigint not null references books(id) on delete cascade,
    source rating_source not null,
    value numeric(4,2),
    votes integer not null default 0,
    fetched_at timestamptz not null default now(),
    primary key (book_id, source)
  )`;
await sql`create index if not exists book_ratings_source_value_idx on book_ratings (source, value)`;

console.log("books / book_links / book_ratings ready");
await sql.end();
