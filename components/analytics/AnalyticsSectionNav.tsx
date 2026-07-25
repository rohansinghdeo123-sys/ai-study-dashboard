type AnalyticsSection = {
  href: string;
  label: string;
  detail: string;
};

export function AnalyticsSectionNav({
  sections,
}: {
  sections: AnalyticsSection[];
}) {
  return (
    <nav
      aria-label="Analytics sections"
      className="grid gap-2 rounded-[1.25rem] border border-cyan-100/10 bg-black/20 p-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      {sections.map((section, index) => (
        <a
          key={section.href}
          href={section.href}
          className="group rounded-2xl border border-transparent px-4 py-3 transition hover:border-cyan-100/10 hover:bg-white/[0.045] focus-visible:border-cyan-300/40 focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-white">
            <span className="font-mono text-[10px] text-[#14B8A6]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {section.label}
          </span>
          <span className="mt-1 block text-[11px] leading-5 text-slate-500">
            {section.detail}
          </span>
        </a>
      ))}
    </nav>
  );
}
