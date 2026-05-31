"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, apiJson } from "@/lib/apiClient";

function useTypingEffect(text: string, speed = 48) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    const interval = window.setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current += 1;
      } else {
        window.clearInterval(interval);
      }
    }, speed);
    return () => window.clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

const FALLBACK_DESCRIPTION =
  "Your personal AI coach is ready to guide you through every subject and every challenge.";

interface AgentNotificationProps {
  onDismiss: () => void;
}

export default function AgentifiedNotification({ onDismiss }: AgentNotificationProps) {
  const { user, getAuthHeaders } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const [agent, setAgent] = useState<{ name: string; description: string } | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);
  const [show, setShow] = useState(true);
  const [phase, setPhase] = useState(0);
  const typedHeadline = useTypingEffect("You have been Agentified", 48);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase(1), 420),
      window.setTimeout(() => setPhase(2), 980),
      window.setTimeout(() => setPhase(3), 1480),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchCoach = async () => {
      try {
        const headers = await getAuthHeaders();
        const data: { profile?: Record<string, string> } = await apiJson<{ profile?: Record<string, string> }>(`${backendURL}/coach/${user.uid}`, {
          headers,
          cacheKey: `coach:${user.uid}`,
          cacheTtlMs: 30000,
          retries: 1,
          timeoutMs: 7000,
        }).catch(() => ({ profile: {} }));

        const profile = data.profile;
        if (profile?.coach_name) {
          setAgent({
            name: profile.coach_name,
            description:
              profile.long_term_summary ||
              profile.daily_strategy ||
              FALLBACK_DESCRIPTION,
          });
          setLoadingCoach(false);
          return;
        }

        const bootstrapRes = await apiFetch(`${backendURL}/coach/bootstrap`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: user.uid,
            student_display_name: user.displayName || "Student",
          }),
          retries: 1,
          timeoutMs: 12000,
        });

        if (bootstrapRes.ok) {
          const bootstrapData = await bootstrapRes.json();
          setAgent({
            name: bootstrapData.coach_name || "Ari",
            description: bootstrapData.coach_tone
              ? `A coach with a ${bootstrapData.coach_tone} approach, dedicated to your growth.`
              : FALLBACK_DESCRIPTION,
          });
        } else {
          setAgent({ name: "Ari", description: FALLBACK_DESCRIPTION });
        }
      } catch {
        setAgent({ name: "Ari", description: FALLBACK_DESCRIPTION });
      } finally {
        setLoadingCoach(false);
      }
    };

    fetchCoach();
  }, [user, backendURL, getAuthHeaders]);

  const handleClose = () => {
    localStorage.setItem("agentify_notification_seen", "true");
    setShow(false);
    onDismiss();
  };

  if (!show) return null;

  return (
    <div className="agentified-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#03050A]/82 p-4 backdrop-blur-xl">
      <div className="agentified-card relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#090D14]/92 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="agentified-orbit agentified-orbit-one" />
        <div className="agentified-orbit agentified-orbit-two" />
        <div className="agentified-scanline" />

        <div className="relative z-10 grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="agentified-core-panel flex min-h-[420px] flex-col items-center justify-center border-b border-white/10 p-8 text-center lg:border-b-0 lg:border-r">
            <div className="agentified-core relative flex h-44 w-44 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/5">
              <div className="agentified-ring agentified-ring-a" />
              <div className="agentified-ring agentified-ring-b" />
              <div className="agentified-pulse" />
              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-4xl font-black text-cyan-200 shadow-[0_0_50px_rgba(20,184,166,0.16)]">
                A
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {["Identity linked", "Coach assigned", "Memory online"].map((item, index) => (
                <span
                  key={item}
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-700 ${
                    phase >= index + 1
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200 opacity-100"
                      : "border-white/10 bg-white/[0.03] text-slate-600 opacity-50"
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                  AgentifyAI Onboarding
                </div>
                <div className="mt-1 text-xs text-slate-500">Personal coach activation</div>
              </div>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                Live
              </span>
            </div>

            <div className="py-8">
              <h2 className="min-h-[92px] text-4xl font-black tracking-tight text-white md:text-5xl">
                <span className="bg-gradient-to-r from-cyan-100 via-white to-amber-200 bg-clip-text text-transparent">
                  {typedHeadline}
                </span>
                <span className="ml-1 animate-pulse text-cyan-300">|</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                Your learning workspace is now connected to a private AI coach that can explain, revise, test, and guide your next best study action.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_20px_rgba(110,231,183,0.8)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Personal AI Agent Assigned
                </span>
              </div>
              {loadingCoach ? (
                <div className="mt-5 space-y-3">
                  <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/10" />
                </div>
              ) : agent ? (
                <>
                  <div className="mt-4 text-3xl font-semibold text-white">{agent.name}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{agent.description}</p>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Your personal AI coach is synchronised.</p>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Explain", "Clear answers"],
                ["Revise", "Weak topics"],
                ["Test", "Smart MCQs"],
              ].map(([label, detail]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
                </div>
              ))}
            </div>

            <button
              onClick={handleClose}
              disabled={loadingCoach}
              className="mt-6 w-full rounded-xl border border-cyan-300/30 bg-cyan-300/12 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-cyan-100 transition-all hover:border-cyan-200/50 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loadingCoach ? "Synchronising" : "Enter Dashboard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
