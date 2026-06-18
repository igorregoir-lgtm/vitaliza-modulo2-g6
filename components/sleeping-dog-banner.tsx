import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function SleepingDogBanner({ reason }: { reason?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning-text)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--warning-text)]">
            Não acorde o cão que dorme — sem ação proativa
          </p>
          <p className="mt-1 text-sm text-[var(--warning-text-soft)]">{reason}</p>
          <Link
            href="/principios-de-personalizacao"
            className="mt-2 inline-block text-xs font-medium text-[var(--accent-deep)] underline-offset-2 hover:underline"
          >
            Ver política de não-intrusão
          </Link>
        </div>
      </div>
    </div>
  );
}
