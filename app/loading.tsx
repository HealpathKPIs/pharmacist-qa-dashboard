export default function RootLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-foreground"
        />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </main>
  );
}
