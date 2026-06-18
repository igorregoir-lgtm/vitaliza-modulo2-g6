import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando a análise exploratória…</span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-32 w-full rounded-[var(--radius-lg)]" />

      <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-64 w-full rounded-[var(--radius-lg)]"
          />
        ))}
      </div>
    </div>
  );
}
