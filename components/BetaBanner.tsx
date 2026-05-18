"use client";

import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function BetaBanner() {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      <div className="w-full border-b border-white/10 bg-[#0B0D12]/95 text-slate-300 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1760px] items-center justify-between gap-4 px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
              Beta
            </span>
            <span className="truncate text-slate-400">
              AgentifyAI is in active testing. Feedback helps improve the learning system.
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Feedback
            </button>
            <button
              onClick={() => setVisible(false)}
              className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
              aria-label="Dismiss beta banner"
            >
              x
            </button>
          </div>
        </div>
      </div>

      <FeedbackModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
