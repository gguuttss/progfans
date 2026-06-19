import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  const link = "text-muted transition-colors hover:text-ink";
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm sm:flex-row">
        <span className="text-muted">
          © {year}{" "}
          <span className="font-display font-bold text-ink">
            prog<span className="text-gold">fans</span>
          </span>
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/browse" className={link}>
            Browse
          </Link>
          <Link href="/tier" className={link}>
            Tier lists
          </Link>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
          <Link href="/terms" className={link}>
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
