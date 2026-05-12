"use client";

import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types (unchanged) ─────────────────────────────────────────────────────
interface AgentStatus {
  agent_id: string;
  display_name: string;
  status: string;
  health: string;
  current_task: string;
  last_activity: string;
  total_requests: number;
  total_errors: number;
  total_success: number;
  avg_latency_ms: number;
  last_quality_score: number;
  success_rate: number;
}

interface AgentEvent {
  version: number;
  timestamp: string;
  agent_id: string;
  event_type: string;
  data: Record<string, any>;
  session_id: string;
  severity: string;
}

interface SystemStats {
  total_agents: number;
  active_agents: number;
  total_requests: number;
  total_success: number;
  total_errors: number;
  success_rate: number;
  total_events_buffered: number;
  event_version: number;
  uptime_status: string;
}

interface ChatMessage {
  role: "admin" | "agent";
  agent_id: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL_MS = 1500;

// ─── Agent hierarchy & dynamic voice configuration ─────────────────────────
const AGENT_ROLES: Record<string, { role: string; reportsTo: string | null; voice: { name?: string; lang: string; basePitch: number; baseRate: number } }> = {
  orchestrator: {
    role: "Lead Agent",
    reportsTo: null,
    voice: { name: "Google UK English Male", lang: "en-GB", basePitch: 1.1, baseRate: 0.95 },
  },
  tutor: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: { name: "Google US English Female", lang: "en-US", basePitch: 1.0, baseRate: 1.0 },
  },
  revision: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: { name: "Google UK English Female", lang: "en-GB", basePitch: 1.05, baseRate: 0.95 },
  },
  exam: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: { name: "Google US English Male", lang: "en-US", basePitch: 0.9, baseRate: 1.1 },
  },
  planner: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: { name: "Google UK English Male", lang: "en-GB", basePitch: 1.0, baseRate: 1.0 },
  },
  coach: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: { name: "Google US English Female", lang: "en-US", basePitch: 1.1, baseRate: 0.9 },
  },
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#10B981",
  warning: "#F59E0B",
  critical: "#EF4444",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#6B7280",
  running: "#10B981",
  failed: "#EF4444",
  paused: "#F59E0B",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "#6B7280",
  warning: "#F59E0B",
  error: "#EF4444",
  critical: "#EF4444",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  task_start: "START",
  task_complete: "DONE",
  step: "STEP",
  tool_call: "TOOL",
  error: "ERR",
  state_change: "STATE",
  metric: "METRIC",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

function timeSince(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  } catch {
    return "N/A";
  }
}

function getAgentColor(agentId: string) {
  if (agentId === "orchestrator") return "#F59E0B";
  if (agentId === "tutor") return "#3B82F6";
  if (agentId === "revision") return "#10B981";
  if (agentId === "exam") return "#EF4444";
  if (agentId === "planner") return "#A78BFA";
  if (agentId === "coach") return "#EC4899";
  return "#9CA3AF";
}

// ─── Glass UI Components (same as earlier) ─────────────────────────────────
function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function GlassCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "amber" | "red" | "blue" | "neutral";
}) {
  const colorMap = {
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
    blue: "text-[#00A3FF]",
    neutral: "text-gray-300",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 transition-all hover:border-white/20">
      <div className="text-[9px] uppercase tracking-[0.22em] text-gray-500 font-mono">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold", colorMap[tone])}>{value}</div>
      {sub ? <div className="mt-1 text-[10px] text-gray-600">{sub}</div> : null}
    </div>
  );
}

function GlassPanel({
  title,
  tag,
  right,
  className,
  children,
}: {
  title: string;
  tag?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden flex flex-col",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
            {title}
          </span>
          {tag && (
            <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase font-mono">
              {tag}
            </span>
          )}
        </div>
        {right}
      </div>
      <div className="flex-1 overflow-hidden p-4">{children}</div>
    </section>
  );
}

// ─── Voice synthesis helper ─────────────────────────────────────────────────
// Dynamically adjusts pitch/rate based on agent's current status
function speakAgentMessage(agentId: string, text: string, status?: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const config = AGENT_ROLES[agentId]?.voice;
  if (!config) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = config.lang;
  // Slight dynamic variation based on status for versatility
  let pitchMod = 0;
  let rateMod = 0;
  if (status === "running") { pitchMod = 0.02; rateMod = 0.03; }
  else if (status === "failed") { pitchMod = -0.05; rateMod = -0.05; }
  else if (status === "paused") { pitchMod = -0.03; rateMod = -0.02; }
  utterance.pitch = Math.min(2, Math.max(0, config.basePitch + pitchMod));
  utterance.rate = Math.min(2, Math.max(0.5, config.baseRate + rateMod));
  // Try to pick a matching voice
  const voices = window.speechSynthesis.getVoices();
  if (config.name) {
    const match = voices.find((v) => v.name === config.name);
    if (match) utterance.voice = match;
  }
  window.speechSynthesis.speak(utterance);
}

// ─── Main Ops Page ─────────────────────────────────────────────────────────
export default function InternalOpsPage() {
  const { isAdmin, loading, claimsLoading, getAuthHeaders, profile } = useAuth();

  // Data states
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [authError, setAuthError] = useState("");

  // UI states
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "chat" | "pipeline" | "meeting">("logs");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  // Meeting states
  const [meetingAgentIds, setMeetingAgentIds] = useState<string[]>([]);
  const [meetingInput, setMeetingInput] = useState("");
  const [meetingLoading, setMeetingLoading] = useState<Record<string, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState(false); // Global speaking state for stop button

  // Voice states (for individual chat)
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const versionRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const meetingEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminReady = !loading && !claimsLoading && isAdmin;

  // Admin fetch helper (unchanged)
  const adminFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw new Error("ADMIN_AUTH_REJECTED");
      }
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response.json();
    },
    [getAuthHeaders],
  );

  // Polling (unchanged)
  const poll = useCallback(async () => {
    if (!adminReady) return;
    try {
      const data = await adminFetch(`/admin/poll?since=${versionRef.current}`);
      setConnected(true);
      setAuthError("");
      setAgents(data.agents || []);
      setStats(data.system || null);
      if (data.version > versionRef.current) versionRef.current = data.version;
      const newEvents: AgentEvent[] = data.events || [];
      if (newEvents.length > 0) {
        setEvents((prev) => {
          const merged = [[...newEvents].reverse(), prev].flat();
          const seen = new Set<number>();
          return merged
            .filter((event) => {
              if (seen.has(event.version)) return false;
              seen.add(event.version);
              return true;
            })
            .slice(0, 300);
        });
      }
    } catch (error) {
      setConnected(false);
      setAuthError(error instanceof Error ? error.message : "ADMIN_POLL_FAILED");
    }
  }, [adminFetch, adminReady]);

  useEffect(() => {
    if (!adminReady) return;
    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [adminReady, poll]);

  // Auto-scroll
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [events]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { meetingEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, meetingLoading]);

  // Voice recognition setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      setChatInput((prev) => prev + " " + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Stop all ongoing speech
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Command sender
  const sendCommand = async (agentId: string, command: string) => {
    try {
      const data = await adminFetch("/admin/command", { method: "POST", body: JSON.stringify({ agent_id: agentId, command }) });
      if (!data.success) console.error("Command failed:", data.error);
      poll();
    } catch (error) { console.error("Command error:", error); }
  };

  // Single-agent chat (enhanced with voice output)
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedAgent || chatLoading) return;

    const userText = chatInput.trim();

    const userMsg: ChatMessage = {
      role: "admin",
      agent_id: selectedAgent,
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const data = await adminFetch("/admin/message", {
        method: "POST",
        body: JSON.stringify({
          agent_id: selectedAgent,
          message: userText,
          mode: "casual",
          system_message: "You are an AI agent working in a company. The CEO will chat with you casually. Answer in a friendly, professional tone as if you are a team member giving an update. Do not provide study advice, chemistry tutoring, or any exam-related content unless explicitly asked. Keep replies concise and natural.",
          session_id: `casual-${Date.now()}`,
        }),
      });

      const agentAnswer = data.answer || JSON.stringify(data);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "agent",
          agent_id: selectedAgent,
          content: agentAnswer,
          timestamp: new Date().toISOString(),
          metadata: data.metadata,
        },
      ]);
      // Speak the agent's response
      const agent = agents.find((a) => a.agent_id === selectedAgent);
      speakAgentMessage(selectedAgent, agentAnswer, agent?.status);
      setIsSpeaking(true);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "agent",
          agent_id: selectedAgent,
          content: "Sorry, I'm having trouble connecting right now.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
      poll();
    }
  };

  // Report request: opens chat with selected agent and sends a report prompt
  const requestReport = (agentId: string) => {
    setSelectedAgent(agentId);
    setActiveTab("chat");
    setChatInput("Provide a concise status report of your current tasks, performance metrics, and any issues that need attention.");
  };

  // Meeting broadcast message (now with voice output for each agent)
  const sendMeetingMessage = async () => {
    if (!meetingInput.trim() || meetingAgentIds.length === 0) return;

    const userText = meetingInput.trim();

    const adminMsg: ChatMessage = {
      role: "admin",
      agent_id: "meeting",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, adminMsg]);
    setMeetingInput("");
    setIsSpeaking(true); // We'll set to false when all finish

    const loadingState: Record<string, boolean> = {};
    meetingAgentIds.forEach((id) => (loadingState[id] = true));
    setMeetingLoading(loadingState);

    const promises = meetingAgentIds.map(async (agentId) => {
      try {
        const data = await adminFetch("/admin/message", {
          method: "POST",
          body: JSON.stringify({
            agent_id: agentId,
            message: userText,
            mode: "casual",
            system_message: "You are an AI agent working in a company. The CEO is addressing the team. Respond as a helpful colleague, providing a brief, professional update. Do not offer study tips, chemistry help, or exam advice.",
            session_id: `team-${Date.now()}`,
          }),
        });

        const agentAnswer = data.answer || JSON.stringify(data);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "agent",
            agent_id: agentId,
            content: agentAnswer,
            timestamp: new Date().toISOString(),
            metadata: data.metadata,
          },
        ]);
        // Speak the agent's response in meeting with dynamic variation
        const agent = agents.find((a) => a.agent_id === agentId);
        speakAgentMessage(agentId, agentAnswer, agent?.status);
      } catch {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "agent",
            agent_id: agentId,
            content: "Sorry, I'm unable to respond right now.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setMeetingLoading((prev) => ({ ...prev, [agentId]: false }));
      }
    });

    await Promise.allSettled(promises);
    poll();
    setIsSpeaking(false); // All voices are queued; actual speech may still be ongoing, but we can't easily track end. The stop button will clear.
  };

  // Helpers for toggling meeting agents
  const toggleMeetingAgent = (agentId: string) => {
    setMeetingAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };
  const selectAllMeetingAgents = () => setMeetingAgentIds(agents.map((a) => a.agent_id));
  const clearMeetingAgents = () => setMeetingAgentIds([]);

  // Filtered events/logs
  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (logFilter !== "all" && event.agent_id !== logFilter) return false;
        if (severityFilter !== "all" && event.severity !== severityFilter) return false;
        return true;
      }),
    [events, logFilter, severityFilter],
  );

  const pipelineEvents = selectedAgent
    ? events.filter((event) => event.agent_id === selectedAgent).slice(0, 30)
    : [];

  // Meeting messages filter
  const meetingMessages = useMemo(
    () => chatMessages.filter((msg) => meetingAgentIds.includes(msg.agent_id) || msg.agent_id === "meeting"),
    [chatMessages, meetingAgentIds],
  );

  // Hierarchy tree (simple inline)
  const hierarchyTree = (
    <div className="text-[10px] font-mono text-gray-500 space-y-1">
      {["orchestrator", "tutor", "revision", "exam", "planner", "coach"].map((id, idx) => {
        const agent = agents.find((a) => a.agent_id === id);
        const roleInfo = AGENT_ROLES[id] || { role: "Unknown", reportsTo: null };
        const color = getAgentColor(id);
        if (idx === 0) {
          return (
            <div key={id} className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">├─ CEO</span>
              <span className="text-gray-600">│</span>
              <span style={{ color }}>└─ {agent?.display_name || id} <span className="text-gray-500">({roleInfo.role})</span></span>
            </div>
          );
        }
        return (
          <div key={id} className="flex items-center gap-2 ml-4">
            <span className="text-gray-600">│</span>
            <span style={{ color }}>├─ {agent?.display_name || id} <span className="text-gray-500">({roleInfo.role})</span></span>
            {agent && (
              <span
                className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
                style={{ color: STATUS_COLORS[agent.status] || "#6B7280", backgroundColor: `${STATUS_COLORS[agent.status]}20` }}
              >
                {agent.status}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (loading || claimsLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#0A0A0F] text-sm uppercase tracking-wider text-[#00A3FF] animate-pulse">
        VERIFYING ADMIN SESSION...
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col h-full space-y-4 text-white font-sans">
      {/* Top system stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <GlassCard label="Agents" value={`${agents.length}`} sub={`${agents.filter((a) => a.status === "running").length} active`} tone="blue" />
        <GlassCard label="Requests" value={`${stats?.total_requests ?? 0}`} tone="neutral" />
        <GlassCard label="Success" value={`${stats?.total_success ?? 0}`} tone="green" />
        <GlassCard label="Errors" value={`${stats?.total_errors ?? 0}`} tone="red" />
        <GlassCard label="Success Rate" value={`${stats?.success_rate ?? 100}%`} tone={stats && stats.success_rate >= 90 ? "green" : "amber"} />
        <GlassCard label="Buffered Events" value={`${stats?.total_events_buffered ?? 0}`} tone="neutral" />
        <GlassCard label="Uptime" value={stats?.uptime_status ?? "—"} tone="blue" />
        <GlassCard label="Status" value={connected ? "LIVE" : "DISCONNECTED"} sub={authError || undefined} tone={connected ? "green" : "red"} />
      </div>

      {/* Main grid */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[380px_1fr]">
        {/* Left: Agent Registry + Hierarchy */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <GlassPanel title="Agent Registry" tag="LIVE" right={<span className="text-xs text-gray-500 font-mono">{agents.length} AGENTS</span>}>
            <div className="space-y-2 h-full overflow-y-auto pr-1">
              {agents.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-600">NO AGENTS REGISTERED</div>
              ) : (
                agents.map((agent) => (
                  <div key={agent.agent_id} className="space-y-2">
                    <button
                      onClick={() => setSelectedAgent(agent.agent_id)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-all",
                        selectedAgent === agent.agent_id
                          ? "border-[#00A3FF] bg-[#0F1A24] shadow-[0_0_10px_rgba(0,163,255,0.15)]"
                          : "border-white/10 bg-white/5 hover:border-white/20",
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: HEALTH_COLORS[agent.health] || "#6B7280" }} />
                          <span className="text-xs font-bold text-white uppercase font-mono">{agent.display_name}</span>
                          <span className="text-[8px] text-gray-500 font-mono">({AGENT_ROLES[agent.agent_id]?.role || "Specialist"})</span>
                        </div>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase font-mono"
                          style={{ color: STATUS_COLORS[agent.status] || "#6B7280", backgroundColor: `${STATUS_COLORS[agent.status]}20` }}
                        >
                          {agent.status}
                        </span>
                      </div>
                      {agent.current_task && <div className="text-[10px] text-emerald-400 truncate mb-1">{agent.current_task}</div>}
                      <div className="grid grid-cols-5 gap-1 text-[10px]">
                        <div><span className="text-gray-500">REQ</span><div className="text-gray-200">{agent.total_requests}</div></div>
                        <div><span className="text-gray-500">OK</span><div className="text-emerald-400">{agent.total_success}</div></div>
                        <div><span className="text-gray-500">ERR</span><div className="text-red-400">{agent.total_errors}</div></div>
                        <div><span className="text-gray-500">LAT</span><div className="text-amber-400">{agent.avg_latency_ms}ms</div></div>
                        <div><span className="text-gray-500">Q</span>
                          <div style={{ color: agent.last_quality_score >= 0.7 ? "#10B981" : agent.last_quality_score > 0 ? "#F59E0B" : "#6B7280" }}>
                            {agent.last_quality_score > 0 ? agent.last_quality_score.toFixed(2) : "--"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between text-[10px]">
                        <span className="text-gray-500">Success rate: {agent.success_rate}%</span>
                        <span className="text-gray-600">{timeSince(agent.last_activity)}</span>
                      </div>
                    </button>
                    {/* Report button per agent */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => requestReport(agent.agent_id)}
                        className="w-full rounded border border-[#00A3FF]/20 bg-[#00A3FF]/10 px-2 py-1 text-[9px] font-bold text-[#00A3FF] hover:bg-[#00A3FF]/20 transition-colors"
                      >
                        Request Report
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassPanel>
          {/* Hierarchy panel */}
          <GlassPanel title="Team Hierarchy" tag="ORG">
            {hierarchyTree}
          </GlassPanel>
        </div>

        {/* Right: Inspector with Tabs including MEETING */}
        <GlassPanel
          title="Agent Inspector"
          right={
            <div className="flex items-center gap-3">
              {(["logs", "chat", "pipeline", "meeting"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider transition-colors font-mono",
                    activeTab === tab ? "text-[#00A3FF]" : "text-gray-600 hover:text-gray-300",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          }
          className="min-h-0"
        >
          <div className="flex flex-col h-full overflow-hidden">
            {/* LOGS */}
            {activeTab === "logs" && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-3 mb-3 text-[10px]">
                  <span className="text-gray-500">FILTER:</span>
                  <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-300 font-mono outline-none focus:border-[#00A3FF]">
                    <option value="all">ALL AGENTS</option>
                    {agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.agent_id.toUpperCase()}</option>)}
                  </select>
                  <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-300 font-mono outline-none focus:border-[#00A3FF]">
                    <option value="all">ALL</option>
                    <option value="info">INFO</option>
                    <option value="warning">WARNING</option>
                    <option value="error">ERROR</option>
                    <option value="critical">CRITICAL</option>
                  </select>
                  <span className="ml-auto text-gray-600">{filteredEvents.length} EVENTS</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 text-xs">
                  {filteredEvents.length === 0 ? (
                    <div className="py-12 text-center text-gray-600">NO EVENTS</div>
                  ) : (
                    [...filteredEvents].reverse().map((event, idx) => (
                      <div key={event.version || idx} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-white/5">
                        <span className="w-16 shrink-0 text-gray-600">{formatTime(event.timestamp)}</span>
                        <span className="w-20 shrink-0 font-bold uppercase" style={{ color: getAgentColor(event.agent_id) }}>{event.agent_id}</span>
                        <span className="w-12 shrink-0 text-center font-bold" style={{ color: SEVERITY_COLORS[event.severity] || "#6B7280" }}>{EVENT_TYPE_LABELS[event.event_type] || event.event_type.toUpperCase()}</span>
                        <span className="truncate text-gray-400">{event.data.message || event.data.step || JSON.stringify(event.data)}</span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* CHAT – individual agent conversation with voice */}
            {activeTab === "chat" && (
              <div className="flex flex-col h-full overflow-hidden">
                {!selectedAgent ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-600">SELECT AN AGENT FROM THE REGISTRY</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-bold text-[#00A3FF] uppercase">COMM_CHANNEL: {selectedAgent}</span>
                      <div className="flex gap-1">
                        {["restart", "pause", "resume", "clear_memory"].map((cmd) => (
                          <button
                            key={cmd}
                            onClick={() => sendCommand(selectedAgent, cmd)}
                            className="rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:border-[#00A3FF] hover:text-[#00A3FF] transition-colors"
                          >
                            {cmd.toUpperCase()}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            if (!selectedAgent) return;
                            setChatMessages((prev) => prev.filter((msg) => msg.agent_id !== selectedAgent));
                          }}
                          className="rounded border border-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:border-red-500/40 hover:text-red-300 transition-colors"
                        >
                          CLEAR CHAT
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {chatMessages.filter((m) => m.agent_id === selectedAgent).map((msg, i) => (
                        <div key={i} className={cn("flex", msg.role === "admin" ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[80%] rounded-xl px-4 py-3 text-sm", msg.role === "admin" ? "bg-[#00A3FF]/10 border border-[#00A3FF]/20 text-[#00A3FF]" : "bg-white/5 border border-white/10 text-gray-200")}>
                            <div className="text-[10px] text-gray-500 mb-1">{msg.role === "admin" ? "ADMIN" : msg.agent_id.toUpperCase()} · {formatTime(msg.timestamp)}</div>
                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                            <span className="h-2 w-2 bg-[#00A3FF] rounded-full animate-pulse" />
                            {selectedAgent} is thinking...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <span className="text-xs text-[#00A3FF] font-mono">ADMIN &gt;</span>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                        placeholder={`Message ${selectedAgent}...`}
                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
                      />
                      {/* Microphone button */}
                      <button
                        onClick={toggleListening}
                        disabled={!recognitionRef.current}
                        className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                          isListening ? "border-red-400/40 bg-red-400/10 text-red-400" : "border-[#00A3FF]/20 bg-[#00A3FF]/10 text-[#00A3FF]"
                        }`}
                        title="Voice input"
                      >
                        🎤
                      </button>
                      <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()} className="rounded-lg bg-[#00A3FF]/20 border border-[#00A3FF]/30 px-4 py-2 text-xs font-bold text-[#00A3FF] hover:bg-[#00A3FF]/30 disabled:opacity-40 transition-colors">
                        SEND
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PIPELINE */}
            {activeTab === "pipeline" && (
              <div className="flex flex-col h-full overflow-hidden">
                {!selectedAgent ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-600">SELECT AN AGENT TO VIEW PIPELINE</div>
                ) : pipelineEvents.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-600">NO PIPELINE DATA</div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                    {pipelineEvents.map((event, idx) => {
                      const isStart = event.event_type === "task_start";
                      const isComplete = event.event_type === "task_complete";
                      const isError = event.event_type === "error";
                      const isTool = event.event_type === "tool_call";
                      return (
                        <div key={event.version || idx} className={cn("flex items-start gap-2 border-l-4 pl-3 py-2 rounded-r-lg", isStart && "border-l-[#F59E0B] bg-[#F59E0B]/5", isComplete && "border-l-emerald-400 bg-emerald-400/5", isError && "border-l-red-400 bg-red-400/5", isTool && "border-l-[#3B82F6] bg-[#3B82F6]/5")}>
                          <div className="flex items-center gap-2 shrink-0 mt-0.5">
                            {isStart && <span className="text-[#F59E0B]">▶</span>}
                            {isComplete && <span className="text-emerald-400">✓</span>}
                            {isError && <span className="text-red-400">✗</span>}
                            {isTool && <span className="text-[#3B82F6]">⚙</span>}
                            {!isStart && !isComplete && !isError && !isTool && <span className="text-gray-600">→</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* MEETING (broadcast chat with dynamic voice) */}
            {activeTab === "meeting" && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-[#00A3FF] uppercase">TEAM MEETING</span>
                  <div className="flex gap-2">
                    <button onClick={selectAllMeetingAgents} className="rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:text-white">ALL</button>
                    <button onClick={clearMeetingAgents} className="rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:text-white">CLEAR</button>
                    {isSpeaking && (
                      <button onClick={stopSpeaking} className="rounded border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] text-red-400 hover:bg-red-400/20">
                        STOP VOICE
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {agents.map((agent) => (
                    <label key={agent.agent_id} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={meetingAgentIds.includes(agent.agent_id)}
                        onChange={() => toggleMeetingAgent(agent.agent_id)}
                        className="rounded border-white/20 bg-black/30 accent-[#00A3FF]"
                      />
                      <span style={{ color: getAgentColor(agent.agent_id) }}>{agent.display_name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {meetingMessages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-gray-600">SELECT AGENTS AND START THE MEETING</div>
                  ) : (
                    meetingMessages.map((msg, i) => {
                      const isAdmin = msg.role === "admin";
                      return (
                        <div key={i} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[80%] rounded-xl px-4 py-3 text-sm", isAdmin ? "bg-[#00A3FF]/10 border border-[#00A3FF]/20 text-[#00A3FF]" : "bg-white/5 border border-white/10 text-gray-200")}>
                            <div className="text-[10px] text-gray-500 mb-1">
                              {isAdmin ? "ADMIN" : msg.agent_id.toUpperCase()} · {formatTime(msg.timestamp)}
                            </div>
                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {Object.keys(meetingLoading).some((id) => meetingLoading[id]) && (
                    <div className="flex justify-start">
                      <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                        <span className="h-2 w-2 bg-[#00A3FF] rounded-full animate-pulse" />
                        Agents responding...
                      </div>
                    </div>
                  )}
                  <div ref={meetingEndRef} />
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  <span className="text-xs text-[#00A3FF] font-mono">ADMIN &gt;</span>
                  <input
                    type="text"
                    value={meetingInput}
                    onChange={(e) => setMeetingInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMeetingMessage()}
                    placeholder="Broadcast to selected agents..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
                  />
                  <button
                    onClick={sendMeetingMessage}
                    disabled={meetingAgentIds.length === 0 || !meetingInput.trim() || Object.values(meetingLoading).some(Boolean)}
                    className="rounded-lg bg-[#00A3FF]/20 border border-[#00A3FF]/30 px-4 py-2 text-xs font-bold text-[#00A3FF] hover:bg-[#00A3FF]/30 disabled:opacity-40 transition-colors"
                  >
                    BROADCAST
                  </button>
                </div>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2 text-[10px] font-mono text-gray-500 rounded-b-xl">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {connected ? "CONNECTED" : "OFFLINE"}
          </span>
          <span>{profile?.email || profile?.uid || "ADMIN"}</span>
        </div>
        <div>EVENT VERSION: {versionRef.current}</div>
      </div>
    </div>
  );
}