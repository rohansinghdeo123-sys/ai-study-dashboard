import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MUTED, TEXT } from "./format";

// Section wrapper with an eyebrow, title, one-line description, and optional action.
export function AdminSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--agentify-accent)]">{eyebrow}</p>
          ) : null}
          <h2 className={cn("mt-1 text-lg font-semibold tracking-tight sm:text-xl", TEXT)}>{title}</h2>
          {description ? <p className={cn("mt-1 max-w-2xl text-sm leading-6", MUTED)}>{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
