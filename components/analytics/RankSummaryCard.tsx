import Link from "next/link";

export function RankSummaryCard({
  rank,
  totalLearners,
  classRank,
  xp,
  xpToAdvance,
  percentile,
}: {
  rank: number;
  totalLearners: number;
  classRank?: number | null;
  xp: number;
  xpToAdvance: number;
  percentile: number;
}) {
  const isFirst = rank === 1;

  return (
    <section
      aria-labelledby="analytics-rank-summary"
      className="overflow-hidden rounded-[1.25rem] border border-cyan-200/15 bg-[#08121f]/90"
    >
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
          Your ranking
        </p>
        <h2
          id="analytics-rank-summary"
          className="mt-2 text-xl font-semibold text-white"
        >
          #{rank} of {Math.max(1, totalLearners)} learners
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {isFirst
            ? "You are leading the board. Keep your study rhythm steady."
            : `${xpToAdvance} more XP moves you toward the next place.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/10">
        <div className="bg-[#08121f] px-4 py-4">
          <span className="block text-[10px] text-slate-500">Total XP</span>
          <strong className="mt-1 block text-lg text-cyan-300">{xp}</strong>
        </div>
        <div className="bg-[#08121f] px-4 py-4">
          <span className="block text-[10px] text-slate-500">Class rank</span>
          <strong className="mt-1 block text-lg text-white">
            {classRank ? `#${classRank}` : "--"}
          </strong>
        </div>
        <div className="bg-[#08121f] px-4 py-4">
          <span className="block text-[10px] text-slate-500">Top group</span>
          <strong className="mt-1 block text-lg text-[#67E8F9]">
            {percentile}%
          </strong>
        </div>
      </div>

      <div className="p-4">
        <Link
          href="/dashboard/rankings"
          className="agentify-action flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200 transition hover:-translate-y-0.5 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/50"
        >
          Open full rankings
        </Link>
      </div>
    </section>
  );
}
