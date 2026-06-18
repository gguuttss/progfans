export function TropeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded border border-line bg-paper px-1.5 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}
