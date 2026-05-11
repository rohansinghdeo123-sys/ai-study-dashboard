"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

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

// ── Fallback agent descriptions (used only if backend hasn't assigned one) ─
const FALLBACK_DESCRIPTION =
  "Your personal AI coach – ready to guide you through every subject and every challenge.";

// ── Notification Component ────────────────────────────────────────────────
interface AgentNotificationProps {
  onDismiss: () => void;
}

export default function AgentifiedNotification({ onDismiss }: AgentNotificationProps) {
  const { user, getAuthHeaders } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const [agent, setAgent] = useState<{ name: string; description: string } | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);
  const [show, setShow] = useState(true);
  const typedHeadline = useTypingEffect("You have been Agentified.", 60);

  // Fetch the real coach data from the backend
  useEffect(() => {
    if (!user) return;

    const fetchCoach = async () => {
      try {
        const headers = await getAuthHeaders();
        // Try the coach dashboard endpoint (which returns profile + memories)
        const response = await fetch(`${backendURL}/coach/${user.uid}`, {
          headers,
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();
          const profile = data.profile;
          if (profile && profile.coach_name) {
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
        }

        // Fallback: call the bootstrap endpoint to ensure a coach exists
        const bootstrapRes = await fetch(`${backendURL}/coach/bootstrap`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: user.uid,
            student_display_name: user.displayName || "Student",
          }),
        });

        if (bootstrapRes.ok) {
          const bootstrapData = await bootstrapRes.json();
          if (bootstrapData.coach_name) {
            setAgent({
              name: bootstrapData.coach_name,
              description: bootstrapData.coach_tone
                ? `A coach with a ${bootstrapData.coach_tone} approach, dedicated to your growth.`
                : FALLBACK_DESCRIPTION,
            });
          } else {
            // Absolute fallback – use a generic name
            setAgent({
              name: "Ari",
              description: FALLBACK_DESCRIPTION,
            });
          }
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
            {loadingCoach ? (
              <div className="text-sm text-gray-400 animate-pulse">Establishing neural link…</div>
            ) : agent ? (
              <>
                <div className="text-2xl font-bold text-white">{agent.name}</div>
                <p className="text-sm text-gray-400 leading-relaxed">{agent.description}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Your personal AI coach is synchronised.</p>
            )}
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
            disabled={loadingCoach}
            className="w-full rounded-lg border border-[#00A3FF]/40 bg-[#00A3FF]/10 px-4 py-3 text-sm font-bold text-[#00A3FF] hover:bg-[#00A3FF]/20 transition-all uppercase tracking-wider font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loadingCoach ? "SYNCHRONISING…" : "MEET YOUR AGENT"}
          </button>
        </div>
      </div>
    </div>
  );
}