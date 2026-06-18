import { cookies } from "next/headers";
import Link from "next/link";
import { NavSearch } from "@/components/NavSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { getProfile, getUser } from "@/lib/auth";
import { pendingChangeCount } from "@/lib/queries";

export async function SiteHeader() {
  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;
  const dark = (await cookies()).get("theme")?.value === "dark";
  const pending = profile?.isAdmin ? await pendingChangeCount() : 0;

  return (
    <header className="sticky top-0 z-40 mb-8 flex items-center justify-between gap-4 border-b border-line bg-paper py-3">
      <Link
        href="/"
        className="shrink-0 font-display text-xl font-extrabold tracking-tight text-ink"
      >
        <span className="sm:hidden">
          p<span className="text-gold">f</span>
        </span>
        <span className="hidden sm:inline">
          prog<span className="text-gold">fans</span>
        </span>
      </Link>

      {/* Title search — typeahead dropdown + Enter for the full results page. */}
      <NavSearch />

      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-4 text-sm text-muted sm:gap-5">
          <Link href="/browse" className="transition-colors hover:text-ink">
            Browse
          </Link>
          <Link href="/tier" className="whitespace-nowrap transition-colors hover:text-ink">
            Tier lists
          </Link>
        </nav>

        {user ? (
          <UserMenu
            username={profile?.username ?? "account"}
            avatarUrl={profile?.avatarUrl ?? null}
            initialDark={dark}
            isAdmin={Boolean(profile?.isAdmin)}
            isOwner={Boolean(profile?.isOwner)}
            pendingCount={pending}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <ThemeToggle initialDark={dark} />
            <Link
              href="/login"
              className="rounded-md bg-gold px-3 py-1.5 font-medium text-paper transition-opacity hover:opacity-90"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
