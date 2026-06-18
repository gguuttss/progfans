import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const sql = postgres(url, { prepare: false });

await sql`
  create table if not exists tier_list_votes (
    tier_list_id bigint not null references tier_lists(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (tier_list_id, user_id)
  )
`;
await sql`create index if not exists tier_list_votes_list_idx on tier_list_votes (tier_list_id)`;

console.log("tier_list_votes ready");
await sql.end();
