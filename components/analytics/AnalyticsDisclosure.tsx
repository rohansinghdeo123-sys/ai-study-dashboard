import type { ReactNode } from "react";

export function AnalyticsDisclosure({
  id,
  title,
  detail,
  badge,
  children,
}: {
  id: string;
  title: string;
  detail: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="group scroll-mt-28 overflow-hidden rounded-[1.25rem] border border-cyan-100/10 bg-[rgba(8,18,31,0.72)]"
    >
      <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/40 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-semibold text-white">
            {title}
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {detail}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:inline">
            {badge}
          </span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] text-lg text-cyan-200 transition-transform group-open:rotate-45"
          >
            +
          </span>
        </span>
      </summary>

      <div className="border-t border-cyan-100/10 p-4 sm:p-5">
        {children}
      </div>
    </details>
  );
}
