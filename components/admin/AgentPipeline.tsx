import { cn } from "@/lib/utils";
import { HealthBadge, HealthDot } from "./HealthBadge";
import { MUTED, PANEL, TEXT, classifyHealth, formatCompact, formatPercent, relativeTime } from "./format";
import type { AgentStatus } from "./types";

// Canonical pipeline + "what it does" per agent, so each agent is shown uniquely
// as its real processing flow rather than a generic card.
interface PipelineSpec {
  accent: string;
  what: string;
  stages: string[];
}

const PIPELINES: Record<string, PipelineSpec> = {
  orchestrator: { accent: "#7C3AED", what: "Routes each request to the right specialist and audits the multi-agent flow.", stages: ["Intake", "Classify", "Route", "Audit", "Handoff"] },
  tutor: { accent: "#0E7490", what: "Answers student doubts, grounded strictly in retrieved study material.", stages: ["Query", "Retrieve", "Ground", "Generate", "Validate"] },
  revision: { accent: "#14B8A6", what: "Produces notes, summaries, and recall-ready key points.", stages: ["Topic", "Retrieve", "Summarize", "Key points", "Format"] },
  exam: { accent: "#B7791F", what: "Generates MCQs and probable questions, with distractors and scoring.", stages: ["Topic", "Retrieve", "Generate", "Distractors", "Score"] },
  planner: { accent: "#BE185D", what: "Builds learning paths and decides the next best action from signals.", stages: ["Signals", "Analyze", "Plan", "Next action"] },
  coach: { accent: "#0F8F82", what: "Holds memory, motivation, and continuity across student sessions.", stages: ["Recall", "Context", "Coach", "Persist"] },
  content: { accent: "#2563EB", what: "Turns source PDFs into validated, embedded knowledge.", stages: ["Extract", "Chunk", "Concepts", "Validate", "Embed"] },
};
const DEFAULT_PIPELINE: PipelineSpec = { accent: "#0E7490", what: "Observed agent in the runtime.", stages: ["Input", "Process", "Output"] };

function pipelineFor(agentId: string): PipelineSpec {
  const id = (agentId || "").toLowerCase();
  const key = Object.keys(PIPELINES).find((k) => id.includes(k));
  return key ? PIPELINES[key] : DEFAULT_PIPELINE;
}

export function AgentPipeline({ agent }: { agent: AgentStatus }) {
  const state = classifyHealth(`${agent.status} ${agent.health} ${agent.evolution?.learning_signal || ""}`);
  const spec = pipelineFor(agent.agent_id);
  const errRate = agent.total_requests ? agent.total_errors / agent.total_requests : 0;
  const flow = state === "error" ? "#D94A57" : state === "warning" ? "#B7791F" : spec.accent;
  const idle = state === "unknown" || agent.total_requests === 0;

  return (
    <article className={cn(PANEL, "p-4")} style={{ borderTop: `2px solid ${spec.accent}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: spec.accent }} />
            <p className={cn("truncate text-sm font-semibold", TEXT)}>{agent.display_name || agent.agent_id}</p>
          </div>
          <p className={cn("mt-1 line-clamp-2 text-[11px] leading-4", MUTED)}>{agent.role || spec.what}</p>
        </div>
        <HealthBadge state={state} label={agent.health || (idle ? "idle" : "active")} pulse={state === "healthy"} />
      </div>

      {/* Pipeline flow */}
      <div className="mt-4 flex flex-wrap items-center gap-y-2">
        {spec.stages.map((stage, index) => (
          <div key={stage} className="flex items-center">
            <span
              className="rounded-md border px-2 py-1 text-[10px] font-semibold"
              style={
                idle
                  ? { borderColor: "var(--agentify-border)", color: "var(--agentify-muted-text)" }
                  : { borderColor: `${flow}55`, background: `${flow}14`, color: flow }
              }
            >
              {stage}
            </span>
            {index < spec.stages.length - 1 ? (
              <span className="mx-1 text-[10px]" style={{ color: idle ? "var(--agentify-muted-text)" : flow }}>›</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Live stats */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Stat label="Runs" value={formatCompact(agent.total_requests)} />
        <Stat label="Errors" value={`${formatCompact(agent.total_errors)}`} tone={agent.total_errors ? "text-[#D94A57]" : undefined} sub={formatPercent(errRate)} />
        <Stat label="Success" value={formatPercent(agent.success_rate)} tone="text-[#0F8F82]" />
        <Stat label="Latency" value={agent.avg_latency_ms ? `${Math.round(agent.avg_latency_ms)}ms` : "--"} />
      </div>
      <p className={cn("mt-3 flex items-center gap-1.5 text-[10px]", MUTED)}>
        <HealthDot state={state} /> Last active {relativeTime(agent.last_activity)}
        {agent.evolution?.learning_signal ? <span className="opacity-70"> · {agent.evolution.learning_signal}</span> : null}
      </p>
    </article>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div>
      <p className={cn("text-[9px] font-bold uppercase tracking-[0.1em]", MUTED)}>{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", tone || TEXT)}>{value}</p>
      {sub ? <p className={cn("text-[9px]", MUTED)}>{sub}</p> : null}
    </div>
  );
}
