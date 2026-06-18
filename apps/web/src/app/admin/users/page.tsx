import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AdminToggle } from "@/components/AdminToggle";
import { SiteHeader } from "@/components/SiteHeader";
import { requireOwner } from "@/lib/auth";
import { listManagedUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage users — ProgFans" };

export default async function ManageUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireOwner();
  const q = (await searchParams).q ?? "";
  const users = await listManagedUsers(q);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      <SiteHeader />
      <h1 className="mb-1 font-display text-2xl font-extrabold">
        Manage users{" "}
        <span className="font-mono text-base font-normal text-muted">· {users.length}</span>
      </h1>
      <p className="mb-6 text-sm text-muted">
        Grant or revoke admin rights. Admins can review and apply catalog edits.
      </p>

      <form className="mb-6" action="/admin/users">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by username…"
          aria-label="Search users by username"
          className="w-full max-w-xs rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </form>

      {users.length === 0 ? (
        <div className="rounded-lg border border-line bg-card/60 p-8 text-center text-muted">
          No users found{q ? ` for “${q}”.` : "."}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card p-3"
            >
              <Link href={`/user/${u.username}`} className="flex min-w-0 items-center gap-3">
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-line bg-line">
                  {u.avatarUrl ? (
                    <Image
                      src={u.avatarUrl}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-xs font-bold text-muted">
                      {u.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">@{u.username}</span>
                  {(u.isOwner || u.isAdmin) && (
                    <span className="font-mono text-[11px] tracking-wider text-gold uppercase">
                      {u.isOwner ? "Owner" : "Admin"}
                    </span>
                  )}
                </span>
              </Link>

              {u.isOwner ? (
                <span className="rounded-md border border-gold bg-gold/10 px-3 py-1.5 font-mono text-[11px] font-medium tracking-wider text-gold uppercase">
                  Owner
                </span>
              ) : (
                <AdminToggle userId={u.id} isAdmin={u.isAdmin} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
