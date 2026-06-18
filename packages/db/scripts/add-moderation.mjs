import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const sql = postgres(url, { prepare: false });

await sql`alter table profiles add column if not exists is_admin boolean not null default false`;

await sql`
  create table if not exists change_requests (
    id bigserial primary key,
    kind text not null,
    series_id bigint references series(id) on delete cascade,
    proposer_id uuid references profiles(id) on delete set null,
    status text not null default 'pending',
    payload jsonb not null,
    note text,
    reviewed_by uuid references profiles(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
  )`;
await sql`create index if not exists change_requests_status_idx on change_requests (status)`;

// Promote the bootstrap admin, identified by email (profiles.id = auth uid).
// Set ADMIN_EMAIL in the environment when running this one-off migration.
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!adminEmail) throw new Error("ADMIN_EMAIL not set");
const res = await sql`
  update profiles set is_admin = true
  where id in (select id from auth.users where lower(email) = ${adminEmail})
  returning username`;
console.log(
  "moderation schema ready; admins set:",
  res.map((r) => r.username),
);

await sql.end();
