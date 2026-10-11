// ── Simulation-layer UI primitives (SPEC §0.1) ────────────────────────────────
// Shared building blocks for the revamped simulation screens. Everything here
// renders inside .sim-ui. Never use these inside frozen platform screens.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scope wrapper + readable max width. Put it on the content column, next to BlinkitSidebar. */
export function SimPage({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main className={cn("sim-ui relative min-h-full flex-1", className)}>
      <div className={cn("mx-auto w-full px-6 py-8 md:px-10", wide ? "max-w-[1400px]" : "max-w-[1180px]")}>{children}</div>
    </main>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-[68ch]">
        {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold leading-tight text-foreground md:text-[2.15rem]">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

import { scoreTone, type Tone } from "@/components/sim/tone";

export type { Tone };

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-sim-good",
  warn: "text-sim-warn",
  bad: "text-sim-bad",
};

export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl bg-card px-5 py-4 shadow-[0_1px_0_hsl(var(--border)),0_8px_24px_-16px_hsl(24_30%_20%/0.25)]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("sim-num mt-1 text-2xl font-semibold tracking-tight", TONE_TEXT[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({ title, description, actions, children, className }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-card p-6 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]", className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[70ch]">
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-foreground/60",
  good: "bg-sim-good",
  warn: "bg-sim-warn",
  bad: "bg-sim-bad",
};

export function ScoreBar({ earned, max, className, label }: { earned: number; max: number; className?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (earned / max) * 100)) : 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={earned}
        aria-label={label ?? "Score"}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", TONE_BG[scoreTone(earned, max)])} style={{ width: `${pct}%` }} />
      </div>
      <span className="sim-num w-14 text-right text-sm font-medium text-foreground">{earned}/{max}</span>
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const styles: Record<Tone, string> = {
    neutral: "bg-secondary text-secondary-foreground",
    good: "bg-sim-good/10 text-sim-good",
    warn: "bg-sim-warn/10 text-sim-warn",
    bad: "bg-sim-bad/10 text-sim-bad",
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", styles[tone])}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10">
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="max-w-[60ch] text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
