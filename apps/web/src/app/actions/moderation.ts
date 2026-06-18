"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner, requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  BOOK_LINK_SOURCES,
  type BookRequestPayload,
  LINK_SOURCES,
  sanitizeEdit,
  type SeriesEditPayload,
} from "@/lib/series-edit";

// Apply a sanitized edit to a series (series fields, tropes, links).
async function applySeriesEdit(seriesId: number, p: SeriesEditPayload): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`update series set
      title = ${p.title}, description = ${p.description},
      status = ${p.status}::series_status,
      pov = ${p.pov}::pov, mc_gender = ${p.mcGender}::mc_gender, romance = ${p.romance}::romance,
      has_web = ${p.formats.web}, has_ebook = ${p.formats.ebook},
      has_ku = ${p.formats.ku}, has_audio = ${p.formats.audio},
      updated_at = now() where id = ${seriesId}`);

    await tx.execute(sql`delete from series_tropes where series_id = ${seriesId}`);
    if (p.tropes.length) {
      const list = sql.join(
        p.tropes.map((s) => sql`${s}`),
        sql`, `,
      );
      await tx.execute(sql`insert into series_tropes (series_id, trope_id, source)
        select ${seriesId}, t.id, 'admin' from tropes t where t.slug in (${list})`);
    }

    for (const src of LINK_SOURCES) {
      const u = p.links[src];
      if (u) {
        await tx.execute(sql`insert into source_links (series_id, source, url)
          values (${seriesId}, ${src}::external_source, ${u})
          on conflict (series_id, source) do update set url = excluded.url`);
      } else {
        await tx.execute(
          sql`delete from source_links where series_id = ${seriesId} and source = ${src}::external_source`,
        );
      }
    }

    // Per-book edits (only books that belong to this series).
    for (const b of p.books) {
      await tx.execute(sql`update books set
        title = ${b.title}, position = ${b.position}, description = ${b.description}, updated_at = now()
        where id = ${b.id} and series_id = ${seriesId}`);
      for (const src of BOOK_LINK_SOURCES) {
        const u = b.links[src];
        if (u) {
          await tx.execute(sql`insert into book_links (book_id, source, url)
            values (${b.id}, ${src}::external_source, ${u})
            on conflict (book_id, source) do update set url = excluded.url`);
        } else {
          await tx.execute(
            sql`delete from book_links where book_id = ${b.id} and source = ${src}::external_source`,
          );
        }
      }
    }
  });
}

export type SubmitResult = { applied: boolean; error?: string };

/** Edit a series. Admins apply immediately; everyone else's lands as pending. */
export async function submitSeriesEdit(
  seriesId: number,
  raw: SeriesEditPayload,
  note: string,
): Promise<SubmitResult> {
  const { user, profile } = await requireProfile();
  const payload = sanitizeEdit(raw);

  try {
    if (profile.isAdmin) {
      await applySeriesEdit(seriesId, payload);
      revalidatePath("/series/[slug]", "page");
      return { applied: true };
    }

    await db.execute(sql`insert into change_requests (kind, series_id, proposer_id, payload, note)
      values ('edit', ${seriesId}, ${user.id}, ${JSON.stringify(payload)}::jsonb, ${note.trim().slice(0, 1000) || null})`);
    return { applied: false };
  } catch (err) {
    console.error("[submitSeriesEdit] failed for series", seriesId, err);
    return { applied: false, error: "Couldn't save your changes. Please try again." };
  }
}

/** Request a missing book → lands in the admin pending queue. */
export async function submitBookRequest(raw: BookRequestPayload, note: string): Promise<void> {
  const { user } = await requireProfile();
  const payload = {
    title: (raw.title ?? "").trim().slice(0, 300),
    author: (raw.author ?? "").trim().slice(0, 200),
    url: /^https?:\/\/.+/i.test((raw.url ?? "").trim()) ? raw.url.trim().slice(0, 600) : "",
  };
  if (!payload.title) return;
  await db.execute(sql`insert into change_requests (kind, proposer_id, payload, note)
    values ('new_series', ${user.id}, ${JSON.stringify(payload)}::jsonb, ${note.trim().slice(0, 1000) || null})`);
}

/** Approve (apply edits) or reject a pending change request. Admin only. */
export async function reviewChange(id: number, action: "approve" | "reject"): Promise<void> {
  const { user } = await requireAdmin();
  const [cr] = await db.execute<Record<string, unknown>>(
    sql`select kind, series_id, payload, status from change_requests where id = ${id}`,
  );
  if (!cr || cr.status !== "pending") return;

  if (action === "approve" && cr.kind === "edit" && cr.series_id != null) {
    await applySeriesEdit(Number(cr.series_id), sanitizeEdit(cr.payload as SeriesEditPayload));
  }
  await db.execute(sql`update change_requests
    set status = ${action === "approve" ? "approved" : "rejected"},
        reviewed_by = ${user.id}, reviewed_at = now()
    where id = ${id}`);
  revalidatePath("/admin/pending");
}

/** Clear an approved book request once the admin has added it to the catalog. */
export async function markBookAdded(id: number): Promise<void> {
  await requireAdmin();
  await db.execute(
    sql`update change_requests set status = 'added' where id = ${id} and kind = 'new_series'`,
  );
  revalidatePath("/admin/pending");
}

/**
 * Owner-only: grant or revoke a user's admin rights. Owners can't be demoted
 * here, and the owner can't change their own role through this control.
 */
export async function setUserAdmin(targetId: string, makeAdmin: boolean): Promise<void> {
  const { user } = await requireOwner();
  if (targetId === user.id) return;
  await db.execute(
    sql`update profiles set is_admin = ${makeAdmin} where id = ${targetId} and is_owner = false`,
  );
  revalidatePath("/admin/users");
}
