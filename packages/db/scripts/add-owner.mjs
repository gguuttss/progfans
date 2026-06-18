import postgres from "postgres";

// One-off migration: add the owner role and bootstrap the first owner.
// Run with OWNER_EMAIL set to the owner's account email, e.g.
//   OWNER_EMAIL=you@example.com node packages/db/scripts/add-owner.mjs

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const sql = postgres(url, { prepare: false });

await sql`alter table profiles add column if not exists is_owner boolean not null default false`;

// Bootstrap the owner, identified by email (profiles.id = auth uid). Owner implies admin.
const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
if (!ownerEmail) throw new Error("OWNER_EMAIL not set");
const res = await sql`
  update profiles set is_owner = true, is_admin = true
  where id in (select id from auth.users where lower(email) = ${ownerEmail})
  returning username`;
console.log(
  "owner role ready; owners set:",
  res.map((r) => r.username),
);

await sql.end();
