"use client";

import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";

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
  data: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

type SpeechRecognitionResultLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL_MS = 1500;

// ─── Agent hierarchy & ROBUST voice configuration ──────────────────────────
const AGENT_ROLES: Record<string, {
  role: string;
  reportsTo: string | null;
  voice: {
    preferredNames: string[];
    lang: string;
    basePitch: number;
    baseRate: number;
  };
}> = {
  orchestrator: {
    role: "Lead Agent",
    reportsTo: null,
    voice: {
      preferredNames: ["Google UK English Male", "Microsoft George - English (United Kingdom)", "Daniel"],
      lang: "en-GB",
      basePitch: 1.1,
      baseRate: 0.95,
    },
  },
  tutor: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: {
      preferredNames: ["Google US English Female", "Microsoft Zira - English (United States)", "Samantha", "Fiona"],
      lang: "en-US",
      basePitch: 1.0,
      baseRate: 1.0,
    },
  },
  revision: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: {
      preferredNames: ["Google UK English Female", "Microsoft Hazel - English (United Kingdom)", "Moira", "Veena"],
      lang: "en-GB",
      basePitch: 1.05,
      baseRate: 0.95,
    },
  },
  exam: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: {
      preferredNames: ["Google US English Male", "Microsoft David - English (United States)", "Alex", "Tom"],
      lang: "en-US",
      basePitch: 0.92,
      baseRate: 1.08,
    },
  },
  planner: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: {
      preferredNames: ["Google UK English Male", "Microsoft George - English (United Kingdom)", "Oliver", "Arthur"],
      lang: "en-GB",
      basePitch: 1.0,
      baseRate: 1.0,
    },
  },
  coach: {
    role: "Specialist",
    reportsTo: "orchestrator",
    voice: {
      preferredNames: ["Google US English Female", "Microsoft Zira - English (United States)", "Karen", "Susan"],
      lang: "en-US",
      basePitch: 1.08,
      baseRate: 0.92,
    },
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

function formatCompactNumber(value: number | undefined) {
  const num = Number(value ?? 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num}`;
}

function formatLatency(value: number | undefined) {
  const num = Number(value ?? 0);
  if (!num) return "--";
  if (num >= 1000) return `${(num / 1000).toFixed(1)}s`;
  return `${Math.round(num)}ms`;
}

function clampPercent(value: number | undefined) {
  const num = Number(value ?? 0);
  return Math.max(0, Math.min(100, num));
}

function getEventSummary(data: Record<string, unknown>) {
  const value = data.message ?? data.step ?? data.task ?? data.detail ?? data.status;
  if (typeof value === "string") return value;
  if (value !== undefined && value !== null) return String(value);
  return JSON.stringify(data);
}

function StatusBadge({ value, tone = "neutral" }: { value: string; tone?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  const tones = {
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    red: "border-red-400/25 bg-red-400/10 text-red-300",
    blue: "border-[#00A3FF]/25 bg-[#00A3FF]/10 text-[#00A3FF]",
    neutral: "border-white/10 bg-white/[0.04] text-slate-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", tones[tone])}>
      {value}
    </span>
  );
}

function MetricRail({ value, tone = "blue" }: { value: number; tone?: "green" | "amber" | "red" | "blue" }) {
  const colors = {
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
    blue: "bg-[#00A3FF]",
  };
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
      <div className={cn("h-full rounded-full transition-all duration-500", colors[tone])} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
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
    <div className="rounded-xl border border-white/10 bg-[#0E1118]/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#111520]/90">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight", colorMap[tone])}>{value}</div>
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
        "flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0E1118]/86 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.025] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">
            {title.replace(/_/g, " ")}
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

// ─── ROBUST Voice synthesis helper ─────────────────────────────────────────
function resolveAgentVoice(agentId: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const config = AGENT_ROLES[agentId]?.voice;
  if (!config) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  for (const preferred of config.preferredNames) {
    const match = voices.find((v) => v.name === preferred);
    if (match) return match;
  }

  for (const preferred of config.preferredNames) {
    const match = voices.find((v) => v.name.includes(preferred) || preferred.includes(v.name));
    if (match) return match;
  }

  const langMatch = voices.find((v) => v.lang.startsWith(config.lang));
  if (langMatch) return langMatch;

  return voices[0] || null;
}

function speakAgentMessage(agentId: string, text: string, status?: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const config = AGENT_ROLES[agentId]?.voice;
  if (!config) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = config.lang;

  let pitchMod = 0;
  let rateMod = 0;
  if (status === "running") { pitchMod = 0.03; rateMod = 0.04; }
  else if (status === "failed") { pitchMod = -0.06; rateMod = -0.06; }
  else if (status === "paused") { pitchMod = -0.03; rateMod = -0.03; }

  utterance.pitch = Math.min(2, Math.max(0.1, config.basePitch + pitchMod));
  utterance.rate = Math.min(2.5, Math.max(0.3, config.baseRate + rateMod));
  utterance.volume = 1.0;

  const voice = resolveAgentVoice(agentId);
  if (voice) utterance.voice = voice;

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
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [shouldSpeak, setShouldSpeak] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const versionRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const meetingEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminReady = !loading && !claimsLoading && isAdmin;

  // Pre‑load voices on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => { window.speechSynthesis.getVoices(); };
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
  }, []);

  // Admin fetch helper
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

  // Polling
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

  // Voice recognition setup – sets shouldSpeak when used
  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as Window & typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      // Decide which input to fill based on active tab
      if (activeTab === "meeting") {
        setMeetingInput((prev) => prev + " " + transcript);
        // Auto-send after a short pause
      } else {
        setChatInput((prev) => prev + " " + transcript);
        // Auto-send for chat too
      }
      setIsListening(false);
      setShouldSpeak(true);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [activeTab]); // depend on activeTab so it fills the right input

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

  // Single-agent chat – voice only if shouldSpeak
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedAgent || chatLoading) return;

    const userText = chatInput.trim();
    const useVoice = shouldSpeak;   // capture before resetting

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

      if (useVoice) {
        const agent = agents.find((a) => a.agent_id === selectedAgent);
        speakAgentMessage(selectedAgent, agentAnswer, agent?.status);
        setIsSpeaking(true);
        setShouldSpeak(false);  // reset after speaking
      }
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

  const requestReport = (agentId: string) => {
    setSelectedAgent(agentId);
    setActiveTab("chat");
    setChatInput("Provide a concise status report of your current tasks, performance metrics, and any issues that need attention.");
  };

  // Meeting broadcast – voice only if shouldSpeak
  const sendMeetingMessage = async () => {
    if (!meetingInput.trim() || meetingAgentIds.length === 0) return;

    const userText = meetingInput.trim();
    const useVoice = shouldSpeak;

    const adminMsg: ChatMessage = {
      role: "admin",
      agent_id: "meeting",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, adminMsg]);
    setMeetingInput("");
    setIsSpeaking(useVoice);

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
            system_message: "You are an AI agent working in a company. The CEO is addressing the team. Respond as a helpful colleague, providing a brief, professional update. Do not offer study tips, chemistry help, or exam advice. Keep it under 20 words.",
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

        if (useVoice) {
          const agent = agents.find((a) => a.agent_id === agentId);
          speakAgentMessage(agentId, agentAnswer, agent?.status);
        }
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
    setShouldSpeak(false);
  };

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

  const meetingMessages = useMemo(
    () => chatMessages.filter((msg) => meetingAgentIds.includes(msg.agent_id) || msg.agent_id === "meeting"),
    [chatMessages, meetingAgentIds],
  );

  const activeAgents = useMemo(() => agents.filter((agent) => agent.status === "running"), [agents]);
  const healthyAgents = useMemo(() => agents.filter((agent) => agent.health === "healthy"), [agents]);
  const selectedAgentRecord = useMemo(
    () => agents.find((agent) => agent.agent_id === selectedAgent) ?? null,
    [agents, selectedAgent],
  );
  const avgLatency = useMemo(() => {
    if (!agents.length) return 0;
    return Math.round(agents.reduce((total, agent) => total + (agent.avg_latency_ms || 0), 0) / agents.length);
  }, [agents]);
  const criticalEvents = useMemo(
    () => events.filter((event) => event.severity === "critical" || event.severity === "error").length,
    [events],
  );
  const fleetHealthScore = agents.length ? Math.round((healthyAgents.length / agents.length) * 100) : 0;
  const successRate = stats?.success_rate ?? 100;
  const systemTone = connected && criticalEvents === 0 ? "green" : connected ? "amber" : "red";

  // Hierarchy tree
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

  const premiumHierarchyTree = (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Executive Orchestration</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{agents.find((a) => a.agent_id === "orchestrator")?.display_name || "Orchestrator"}</div>
            <div className="mt-0.5 text-xs text-slate-500">Routes work, audits agent output, and coordinates specialists.</div>
          </div>
          <StatusBadge value={agents.find((a) => a.agent_id === "orchestrator")?.status || "standby"} tone="amber" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {["tutor", "revision", "exam", "planner", "coach"].map((id) => {
          const agent = agents.find((a) => a.agent_id === id);
          const roleInfo = AGENT_ROLES[id] || { role: "Specialist", reportsTo: "orchestrator" };
          return (
            <div key={id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">{agent?.display_name || id}</div>
                  <div className="text-[10px] text-slate-500">{roleInfo.role}</div>
                </div>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[agent?.status || "idle"] || "#6B7280" }} />
              </div>
            </div>
          );
        })}
      </div>
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
    <div className="flex min-h-0 flex-col space-y-5 text-slate-200 md:h-full">
      <div className="hidden rounded-lg border border-white/10 bg-[#0E1118]/90 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">Agent Operations</div>
            <h1 className="mt-2 text-2xl font-semibold text-white">Autonomous agent control plane</h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor health, quality, latency, logs, and multi-agent communication.
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
            {connected ? "Connected" : "Offline"}
          </div>
        </div>
      </div>
      {/* Top system stats bar */}
      <div className="hidden grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <GlassCard label="Agents" value={`${agents.length}`} sub={`${agents.filter((a) => a.status === "running").length} active`} tone="blue" />
        <GlassCard label="Requests" value={`${stats?.total_requests ?? 0}`} tone="neutral" />
        <GlassCard label="Success" value={`${stats?.total_success ?? 0}`} tone="green" />
        <GlassCard label="Errors" value={`${stats?.total_errors ?? 0}`} tone="red" />
        <GlassCard label="Success Rate" value={`${stats?.success_rate ?? 100}%`} tone={stats && stats.success_rate >= 90 ? "green" : "amber"} />
        <GlassCard label="Buffered Events" value={`${stats?.total_events_buffered ?? 0}`} tone="neutral" />
        <GlassCard label="Uptime" value={stats?.uptime_status ?? "—"} tone="blue" />
        <GlassCard label="Status" value={connected ? "LIVE" : "DISCONNECTED"} sub={authError || undefined} tone={connected ? "green" : "red"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0E1118]/88 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value="Admin Control Plane" tone="blue" />
              <StatusBadge value={connected ? "Live Sync" : "Offline"} tone={systemTone} />
              <span className="text-[11px] text-slate-500">Polling every {(POLL_INTERVAL_MS / 1000).toFixed(1)}s</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Agent operations, beautifully controlled.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              A secure command surface for monitoring autonomous agents, reviewing system signals, and speaking to the fleet without leaving the dashboard.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Fleet Health</div>
                <div className="mt-2 text-3xl font-semibold text-white">{fleetHealthScore}%</div>
              </div>
              <StatusBadge value={criticalEvents ? `${criticalEvents} alerts` : "Clear"} tone={criticalEvents ? "amber" : "green"} />
            </div>
            <div className="mt-4">
              <MetricRail value={fleetHealthScore} tone={systemTone === "red" ? "red" : systemTone === "amber" ? "amber" : "green"} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-[10px] text-slate-500">Agents</div>
                <div className="mt-1 text-sm font-semibold text-white">{agents.length}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-[10px] text-slate-500">Active</div>
                <div className="mt-1 text-sm font-semibold text-emerald-300">{activeAgents.length}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-[10px] text-slate-500">Version</div>
                <div className="mt-1 text-sm font-semibold text-amber-300">{versionRef.current}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <GlassCard label="Agent Fleet" value={`${agents.length}`} sub={`${activeAgents.length} active, ${healthyAgents.length} healthy`} tone="blue" />
        <GlassCard label="Requests" value={formatCompactNumber(stats?.total_requests)} sub={`${formatCompactNumber(stats?.total_events_buffered)} buffered events`} tone="neutral" />
        <GlassCard label="Success" value={formatCompactNumber(stats?.total_success)} sub={`${successRate}% success rate`} tone={successRate >= 90 ? "green" : "amber"} />
        <GlassCard label="Errors" value={formatCompactNumber(stats?.total_errors)} sub={`${criticalEvents} recent alerts`} tone={(stats?.total_errors ?? 0) || criticalEvents ? "red" : "green"} />
        <GlassCard label="Avg Latency" value={formatLatency(avgLatency)} sub="Across active registry" tone={avgLatency && avgLatency > 2500 ? "amber" : "blue"} />
        <GlassCard label="System" value={connected ? "Online" : "Offline"} sub={authError || stats?.uptime_status || "Admin session verified"} tone={connected ? "green" : "red"} />
      </div>

      {/* Main grid */}
      <div className="grid flex-1 grid-cols-1 gap-5 overflow-visible md:overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Left: Agent Registry + Hierarchy */}
        <div className="flex flex-col gap-4 overflow-visible md:overflow-hidden">
          <GlassPanel title="Agent Fleet" tag="LIVE" right={<StatusBadge value={`${agents.length} agents`} tone="blue" />}>
            <div className="space-y-2 h-full overflow-y-auto pr-1">
              {agents.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-600">No agents registered</div>
              ) : (
                agents.map((agent) => (
                  <div key={agent.agent_id} className="space-y-2">
                    <button
                      onClick={() => setSelectedAgent(agent.agent_id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all",
                        selectedAgent === agent.agent_id
                          ? "border-[#00A3FF]/40 bg-[#00A3FF]/10 shadow-[0_14px_36px_rgba(0,163,255,0.12)]"
                          : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]",
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white/[0.05] text-sm font-semibold"
                            style={{ color: getAgentColor(agent.agent_id), borderColor: HEALTH_COLORS[agent.health] || "rgba(255,255,255,0.10)" }}
                          >
                            {agent.display_name?.slice(0, 1) || agent.agent_id.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{agent.display_name}</div>
                            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">{AGENT_ROLES[agent.agent_id]?.role || "Specialist"}</div>
                          </div>
                        </div>
                        <span
                          className="rounded-full px-2 py-1 text-[9px] font-bold uppercase"
                          style={{ color: STATUS_COLORS[agent.status] || "#6B7280", backgroundColor: `${STATUS_COLORS[agent.status]}20` }}
                        >
                          {agent.status}
                        </span>
                      </div>
                      {agent.current_task && <div className="mb-3 truncate rounded-md border border-emerald-400/10 bg-emerald-400/5 px-2 py-1.5 text-[10px] text-emerald-300">{agent.current_task}</div>}
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        <div><span className="text-gray-500">Requests</span><div className="text-gray-200">{formatCompactNumber(agent.total_requests)}</div></div>
                        <div><span className="text-gray-500">Errors</span><div className="text-red-400">{agent.total_errors}</div></div>
                        <div><span className="text-gray-500">Latency</span><div className="text-amber-400">{formatLatency(agent.avg_latency_ms)}</div></div>
                        <div><span className="text-gray-500">Quality</span>
                          <div style={{ color: agent.last_quality_score >= 0.7 ? "#10B981" : agent.last_quality_score > 0 ? "#F59E0B" : "#6B7280" }}>
                            {agent.last_quality_score > 0 ? agent.last_quality_score.toFixed(2) : "--"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <MetricRail value={agent.success_rate} tone={agent.success_rate >= 90 ? "green" : agent.success_rate >= 70 ? "amber" : "red"} />
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500">Success {agent.success_rate}%</span>
                        <span className="text-gray-600">{timeSince(agent.last_activity)}</span>
                        </div>
                      </div>
                    </button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full !border-[#00A3FF]/20 !bg-[#00A3FF]/10 !text-[#00A3FF] hover:!bg-[#00A3FF]/20"
                      onClick={() => requestReport(agent.agent_id)}
                    >
                      Request Report
                    </Button>
                  </div>
                ))
              )}
            </div>
          </GlassPanel>
          <GlassPanel title="Team Hierarchy" tag="ORG">
            <div className="hidden">{hierarchyTree}</div>
            {premiumHierarchyTree}
          </GlassPanel>
        </div>

        {/* Right: Inspector with Tabs */}
        <GlassPanel
          title="Command Workspace"
          right={
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
              {(["logs", "chat", "pipeline", "meeting"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "!rounded-md !px-3 !text-[10px] !font-bold !uppercase !tracking-wider",
                    activeTab === tab ? "!bg-white/10 !text-white" : "!text-gray-500 hover:!text-gray-300",
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </Button>
              ))}
            </div>
          }
          className="min-h-0"
        >
          <div className="flex min-h-[520px] flex-col overflow-hidden md:h-full">
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Selected Agent</div>
                    <div className="mt-2 truncate text-xl font-semibold text-white">
                      {selectedAgentRecord?.display_name || "No agent selected"}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedAgentRecord?.current_task || "Choose an agent to inspect logs, chat, pipeline events, and commands."}
                    </p>
                  </div>
                  {selectedAgentRecord ? (
                    <StatusBadge value={selectedAgentRecord.status} tone={selectedAgentRecord.status === "running" ? "green" : selectedAgentRecord.status === "failed" ? "red" : "neutral"} />
                  ) : (
                    <StatusBadge value="Standby" />
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Success</span>
                  <span className="font-semibold text-emerald-300">{selectedAgentRecord?.success_rate ?? successRate}%</span>
                </div>
                <div className="mt-2"><MetricRail value={selectedAgentRecord?.success_rate ?? successRate} tone="green" /></div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Latency</span>
                  <span className="font-semibold text-amber-300">{formatLatency(selectedAgentRecord?.avg_latency_ms ?? avgLatency)}</span>
                </div>
              </div>
            </div>
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
                        <span className="truncate text-gray-400">{getEventSummary(event.data)}</span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* CHAT */}
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
                          <Button key={cmd} variant="ghost" size="sm" onClick={() => sendCommand(selectedAgent, cmd)}>
                            {cmd.toUpperCase()}
                          </Button>
                        ))}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (!selectedAgent) return;
                            setChatMessages((prev) => prev.filter((msg) => msg.agent_id !== selectedAgent));
                          }}
                        >
                          CLEAR CHAT
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {chatMessages.filter((m) => m.agent_id === selectedAgent).map((msg, i) => (
                        <div key={i} className={cn("flex", msg.role === "admin" ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[80%] rounded-xl px-4 py-3 text-sm", msg.role === "admin" ? "bg-[#00A3FF]/10 border border-[#00A3FF]/20 text-[#00A3FF]" : "bg-white/5 border border-white/10 text-gray-200")}>
                            <div className="text-[10px] text-gray-500 mb-1">{msg.role === "admin" ? "ADMIN" : msg.agent_id.toUpperCase()} - {formatTime(msg.timestamp)}</div>
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
                      <Button
                        variant={isListening ? "danger" : "secondary"}
                        size="sm"
                        onClick={toggleListening}
                        disabled={!recognitionRef.current}
                        className={isListening ? "!border-red-400/40 !bg-red-400/10 !text-red-400" : "!border-[#00A3FF]/20 !bg-[#00A3FF]/10 !text-[#00A3FF]"}
                      >
                        Mic
                      </Button>
                      <Button variant="primary" size="sm" onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                        SEND
                      </Button>
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
                          <div className="hidden items-center gap-2 shrink-0 mt-0.5">
                            {isStart && <span className="text-[#F59E0B]">▶</span>}
                            {isComplete && <span className="text-emerald-400">✓</span>}
                            {isError && <span className="text-red-400">✗</span>}
                            {isTool && <span className="text-[#3B82F6]">⚙</span>}
                            {!isStart && !isComplete && !isError && !isTool && <span className="text-gray-600">→</span>}
                          </div>
                          <span className={cn(
                            "mt-0.5 w-12 shrink-0 text-[10px] font-bold",
                            isStart && "text-[#F59E0B]",
                            isComplete && "text-emerald-400",
                            isError && "text-red-400",
                            isTool && "text-[#3B82F6]",
                            !isStart && !isComplete && !isError && !isTool && "text-gray-600",
                          )}>
                            {isStart ? "START" : isComplete ? "DONE" : isError ? "ERR" : isTool ? "TOOL" : "STEP"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-slate-300">{getEventSummary(event.data)}</div>
                            <div className="mt-0.5 text-[10px] text-slate-600">{formatTime(event.timestamp)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* MEETING (now with microphone) */}
            {activeTab === "meeting" && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-[#00A3FF] uppercase">TEAM MEETING</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={selectAllMeetingAgents}>ALL</Button>
                    <Button variant="secondary" size="sm" onClick={clearMeetingAgents}>CLEAR</Button>
                    {isSpeaking && (
                      <Button variant="danger" size="sm" onClick={stopSpeaking}>STOP VOICE</Button>
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
                              {isAdmin ? "ADMIN" : msg.agent_id.toUpperCase()} - {formatTime(msg.timestamp)}
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
                  {/* Microphone button for meeting */}
                  <Button
                    variant={isListening ? "danger" : "secondary"}
                    size="sm"
                    onClick={toggleListening}
                    disabled={!recognitionRef.current}
                    className={isListening ? "!border-red-400/40 !bg-red-400/10 !text-red-400" : "!border-[#00A3FF]/20 !bg-[#00A3FF]/10 !text-[#00A3FF]"}
                  >
                    Mic
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={sendMeetingMessage}
                    disabled={meetingAgentIds.length === 0 || !meetingInput.trim() || Object.values(meetingLoading).some(Boolean)}
                  >
                    BROADCAST
                  </Button>
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
