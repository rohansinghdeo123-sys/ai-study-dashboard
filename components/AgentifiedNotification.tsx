"use client";

import { useEffect, useState, useRef } from "react";

// ── Typing animation hook ─────────────────────────────────────────────────
function useTypingEffect(text: string, speed = 50) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

// ── Agent pool (subject‑agnostic, human‑like personal assistants) ──────────
const AGENT_POOL = [
  {
    name: "Arya",
    description:
      "A perceptive strategist who identifies your strengths and gaps across any subject, then crafts a learning path that adapts as you evolve.",
  },
  {
    name: "Nova",
    description:
      "An energetic, curiosity‑driven mentor who connects ideas across disciplines and keeps your motivation high, no matter what you're studying.",
  },
  {
    name: "Riven",
    description:
      "A calm, analytical mind that turns mistakes into deep understanding, helping you master not just topics but how you learn best.",
  },
  {
    name: "Kael",
    description:
      "A patient and insightful coach who empowers you with the tools to tackle any challenge — exams, projects, or personal growth.",
  },
  {
    name: "Sera",
    description:
      "A warm, encouraging presence that celebrates every milestone and ensures you never feel alone on your learning journey.",
  },
];

function pickAgent() {
  // If the user already has an agent assigned, keep it
  const stored = localStorage.getItem("agentify_agent");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through and assign a new one
    }
  }

  // Assign a random agent the first time
  const agent = AGENT_POOL[Math.floor(Math.random() * AGENT_POOL.length)];
  localStorage.setItem("agentify_agent", JSON.stringify(agent));
  return agent;
}

// ── Notification Component ────────────────────────────────────────────────
interface AgentNotificationProps {
  onDismiss: () => void;
}

export default function AgentifiedNotification({ onDismiss }: AgentNotificationProps) {
  const [agent, setAgent] = useState<{ name: string; description: string } | null>(null);
  const [show, setShow] = useState(true);
  const typedHeadline = useTypingEffect("You have been Agentified.", 60);

  useEffect(() => {
    setAgent(pickAgent());
  }, []);

  const handleClose = () => {
    localStorage.setItem("agentify_notification_seen", "true");
    setShow(false);
    onDismiss();
  };

  if (!show || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-xl border border-[#00A3FF]/20 bg-[#0A0A0F]/90 backdrop-blur-md shadow-[0_0_80px_rgba(0,163,255,0.15)]">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-black/30">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 font-mono">
            SYSTEM NOTIFICATION
          </span>
          <span className="text-[9px] text-[#00A3FF] font-mono">TERMINAL · AGENTIFY.AI</span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Headline with typing animation */}
          <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00A3FF] to-amber-400">
            {typedHeadline}
            <span className="ml-1 animate-pulse text-[#00A3FF]">|</span>
          </h2>

          {/* Agent details */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-mono">
                Personal AI Agent Assigned
              </span>
            </div>
            <div className="text-2xl font-bold text-white">{agent.name}</div>
            <p className="text-sm text-gray-400 leading-relaxed">{agent.description}</p>
          </div>

          {/* Status badges */}
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              ONLINE
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-[#00A3FF]/30 bg-[#00A3FF]/10 px-2 py-1 text-[10px] font-bold text-[#00A3FF] uppercase tracking-wider">
              ADAPTIVE COACH
            </span>
          </div>

          {/* CTA */}
          <button
            onClick={handleClose}
            className="w-full rounded-lg border border-[#00A3FF]/40 bg-[#00A3FF]/10 px-4 py-3 text-sm font-bold text-[#00A3FF] hover:bg-[#00A3FF]/20 transition-all uppercase tracking-wider font-mono"
          >
            MEET YOUR AGENT
          </button>
        </div>
      </div>
    </div>
  );
}