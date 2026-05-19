"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ------------------------------------------------------------------------------
// Types (unchanged)
// ------------------------------------------------------------------------------
interface MCQ {
  id?: string;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
  topic?: string;
  subtopic?: string;
}

interface CoachMessage {
  role: "user" | "coach";
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: CoachMessage[];
  lastUpdated: number;
}

interface ProgressState {
  totalTests: number;
  totalQuestions: number;
  totalCorrect: number;
  xp: number;
  streak: number;
}

interface CoachProfile {
  user_id?: string;
  coach_id?: string;
  coach_name?: string;
  coach_tone?: string;
  coach_style?: string;
  coach_status?: string;
  student_display_name?: string;
  target_exam?: string;
  daily_strategy?: string;
  next_best_action?: string;
  last_recommendation?: string;
  long_term_summary?: string;
  memory_count?: number;
}

interface CoachMemory {
  id?: number;
  memory_type?: string;
  title?: string;
  summary?: string;
  importance?: number;
  confidence?: number;
}

interface CoachDailySignal {
  signal_date?: string;
  total_sessions?: number;
  questions_answered?: number;
  accuracy?: number;
  xp_earned?: number;
  weakest_topic?: string;
  strongest_topic?: string;
  coach_focus?: string;
  recommended_action?: string;
}

interface CoachDashboard {
  profile?: CoachProfile;
  memories?: CoachMemory[];
  latest_signal?: CoachDailySignal | null;
}

interface AutonomousMissionResultData {
  questions?: unknown[];
  text?: string;
}

interface AutonomousMissionResult {
  answer?: string;
  data?: AutonomousMissionResultData | null;
  metadata?: Record<string, unknown>;
}

interface AutonomousMission {
  mission_id: string;
  status: string;
  subject: string;
  chapter?: string;
  target_topic: string;
  target_source: string;
  primary_agent: string;
  mode: string;
  difficulty: string;
  objective: string;
  why: string;
  steps: string[];
  next_actions: string[];
  result?: AutonomousMissionResult;
  analytics_summary?: Record<string, unknown>;
  latency_ms?: number;
}

type AgentStageId = "drafting" | "reviewing" | "delivering";
type AgentStageStatus = "pending" | "active" | "done";
type WorkspaceTab = "chat" | "revise" | "practice" | "history";

interface AgentStageState {
  id: AgentStageId;
  agent: string;
  title: string;
  detail: string;
  status: AgentStageStatus;
}

interface AgentStagePayload {
  type: "agent_stage";
  stage: AgentStageId;
  status: AgentStageStatus;
  agent?: string;
  title?: string;
  detail?: string;
}

const WORKSPACE_TABS: { id: WorkspaceTab; label: string; description: string }[] = [
  { id: "chat", label: "Coach", description: "Ask, learn, and clarify" },
  { id: "revise", label: "Revise", description: "Structured notes and recall" },
  { id: "practice", label: "Practice", description: "MCQs and probable questions" },
  { id: "history", label: "History", description: "Past study conversations" },
];

interface SpeechRecognitionResultEventLike {
  results: {
    [resultIndex: number]: {
      [alternativeIndex: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

// ------------------------------------------------------------------------------
// Chemistry rendering (unchanged)
// ------------------------------------------------------------------------------
function renderChemistryText(value: string) {
  const tokenRegex =
    /(sp\d+|[A-Z][a-z]?(?:\d+)?(?:[A-Z][a-z]?(?:\d+)?)*(?:\^[+-]?\d+|\^[+-])?)/g;
  const pieces = value.split(tokenRegex);

  return pieces.map((piece, pieceIndex) => {
    if (!piece) return null;

    const spMatch = piece.match(/^sp(\d+)$/);
    if (spMatch) {
      return (
        <span key={pieceIndex}>
          sp<sup>{spMatch[1]}</sup>
        </span>
      );
    }

    const chargeMatch = piece.match(/^(.+)\^([+-]?\d+|[+-])$/);
    const formula = chargeMatch ? chargeMatch[1] : piece;
    const charge = chargeMatch ? chargeMatch[2] : null;
    const atomMatches = [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)];
    const matchedFormula = atomMatches.map((match) => match[0]).join("");

    if (!atomMatches.length || matchedFormula !== formula) {
      return <span key={pieceIndex}>{piece}</span>;
    }

    return (
      <span key={pieceIndex}>
        {atomMatches.map((match, atomIndex) => (
          <span key={`${pieceIndex}-${atomIndex}`}>
            {match[1]}
            {match[2] ? <sub>{match[2]}</sub> : null}
          </span>
        ))}
        {charge ? <sup>{charge}</sup> : null}
      </span>
    );
  });
}

function ChemistryBlock({ value, className = "" }: { value: string; className?: string }) {
  return (
    <div className={className}>
      {value.split("\n").map((line, index, lines) => (
        <span key={index}>
          {renderChemistryText(line)}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </div>
  );
}

function looksLikeBase64Payload(value: string) {
  const compact = value.trim().replace(/\s/g, "");
  return compact.length > 40 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}

function decodeBase64Utf8(value: string) {
  if (typeof window === "undefined" || !window.atob) {
    throw new Error("Base64 decoding is only available in the browser.");
  }
  const compact = value.trim().replace(/\s/g, "");
  const binary = window.atob(compact);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function stripSseDataPrefix(value: string) {
  let output = value.trim();
  while (/^data:\s?/i.test(output)) {
    output = output.replace(/^data:\s?/i, "").trim();
  }
  return output;
}

function extractAgentStagePayloads(value: string): AgentStagePayload[] {
  const matches = value.match(/\{[^{}]*"type"\s*:\s*"agent_stage"[^{}]*\}/g) ?? [];
  return matches
    .map((match) => parseAgentStagePayload(match))
    .filter((payload): payload is AgentStagePayload => payload !== null);
}

function removeAgentStagePayloads(value: string) {
  return value.replace(/\{[^{}]*"type"\s*:\s*"agent_stage"[^{}]*\}/g, "").trim();
}

function normalizeCoachTransportText(value: string) {
  const withoutStageEvents = removeAgentStagePayloads(value);
  const trimmed = stripSseDataPrefix(withoutStageEvents);
  if (!trimmed) return "";

  if (looksLikeBase64Payload(trimmed)) {
    try {
      return decodeBase64Utf8(trimmed);
    } catch {
      return value;
    }
  }

  if (!trimmed.includes("data:") && !trimmed.includes("[DONE]")) {
    return value;
  }

  const payloads = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => stripSseDataPrefix(line))
    .map((line) => removeAgentStagePayloads(line))
    .filter((line) => line && line !== "[DONE]");

  if (!payloads.length) return "";

  const compactPayload = payloads.join("");
  if (looksLikeBase64Payload(compactPayload)) {
    try {
      return decodeBase64Utf8(compactPayload);
    } catch {
      return payloads.join("\n");
    }
  }

  return payloads.join("\n");
}

const AGENT_STAGE_ORDER: AgentStageId[] = ["drafting", "reviewing", "delivering"];

function createAgentStages(): AgentStageState[] {
  return [
    {
      id: "drafting",
      agent: "Draft Agent",
      title: "Drafting",
      detail: "Building the first subject-focused answer.",
      status: "pending",
    },
    {
      id: "reviewing",
      agent: "Subject Reviewer",
      title: "Reviewing",
      detail: "Checking clarity, accuracy, examples, and exam usefulness.",
      status: "pending",
    },
    {
      id: "delivering",
      agent: "Final Tutor",
      title: "Delivering",
      detail: "Preparing the final formatted response.",
      status: "pending",
    },
  ];
}

function parseAgentStagePayload(value: string): AgentStagePayload | null {
  const payload = stripSseDataPrefix(value);
  if (!payload.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(payload) as Partial<AgentStagePayload>;
    if (
      parsed.type === "agent_stage" &&
      parsed.stage &&
      parsed.status &&
      AGENT_STAGE_ORDER.includes(parsed.stage) &&
      ["pending", "active", "done"].includes(parsed.status)
    ) {
      return parsed as AgentStagePayload;
    }
  } catch {
    return null;
  }

  return null;
}

function applyAgentStageUpdate(stages: AgentStageState[], update: AgentStagePayload) {
  const activeIndex = AGENT_STAGE_ORDER.indexOf(update.stage);

  return stages.map((stage) => {
    const stageIndex = AGENT_STAGE_ORDER.indexOf(stage.id);
    let status = stage.status;

    if (update.status === "active") {
      if (stageIndex < activeIndex) status = "done";
      if (stageIndex === activeIndex) status = "active";
      if (stageIndex > activeIndex) status = "pending";
    } else if (stage.id === update.stage) {
      status = update.status;
    }

    return {
      ...stage,
      agent: stage.id === update.stage && update.agent ? update.agent : stage.agent,
      title: stage.id === update.stage && update.title ? update.title : stage.title,
      detail: stage.id === update.stage && update.detail ? update.detail : stage.detail,
      status,
    };
  });
}

function CoachAnswerBlock({ value }: { value: string }) {
  const normalized = normalizeCoachTransportText(value);
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (blocks.length <= 1) {
    return <ChemistryBlock value={normalized} className="break-words [overflow-wrap:anywhere]" />;
  }

  return (
    <div className="space-y-4 break-words [overflow-wrap:anywhere]">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const heading = lines[0]?.endsWith(":") && lines[0].length <= 70 ? lines[0] : null;
        const bodyLines = heading ? lines.slice(1) : lines;

        return (
          <section key={`${heading ?? "section"}-${blockIndex}`} className="space-y-2">
            {heading && (
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-orange-300">
                {renderChemistryText(heading.replace(/:$/, ""))}
              </h3>
            )}
            <div className="space-y-1.5 text-[14px] leading-6 text-gray-200">
              {bodyLines.map((line, lineIndex) => {
                const bullet = line.match(/^[-•]\s+(.*)$/);
                if (bullet) {
                  return (
                    <div key={lineIndex} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300/70" />
                      <span className="min-w-0">{renderChemistryText(bullet[1])}</span>
                    </div>
                  );
                }
                return <p key={lineIndex}>{renderChemistryText(line)}</p>;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AgentPipeline({
  stages,
  coachName,
}: {
  stages: AgentStageState[];
  coachName: string;
}) {
  const activeStage = stages.find((stage) => stage.status === "active") ?? stages[stages.length - 1];

  return (
    <div className="study-agent-pipeline w-full max-w-xl rounded-xl rounded-bl-md border border-white/10 bg-[#111116]/95 px-4 py-3 text-sm shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-300" />
            <p className="text-xs font-semibold text-gray-100">{coachName} is preparing an answer</p>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">{activeStage.detail}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {stages.map((stage, index) => {
          const isActive = stage.status === "active";
          const isDone = stage.status === "done";

          return (
            <div
              key={stage.id}
              className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                isActive ? "bg-white/[0.055]" : "bg-transparent"
              }`}
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
                  isDone
                    ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
                    : isActive
                    ? "border-orange-300/45 bg-orange-400/10 text-orange-200"
                    : "border-white/10 bg-black/20 text-gray-600"
                }`}
              >
                {isDone ? "✓" : isActive ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-300" /> : index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`text-xs font-medium ${isActive ? "text-gray-100" : isDone ? "text-gray-300" : "text-gray-500"}`}>
                    {stage.title}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-gray-700" />
                  <span className="truncate text-[11px] text-gray-500">{stage.agent}</span>
                </div>
              </div>

              <span className={`text-[10px] uppercase tracking-wider ${isDone ? "text-emerald-400/80" : isActive ? "text-orange-300/80" : "text-gray-600"}`}>
                {isDone ? "Done" : isActive ? "Running" : "Queued"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// UI Components
// ------------------------------------------------------------------------------
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />;
}

function XPFloat({ amount }: { amount: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <span className="absolute -top-6 right-0 animate-float-up text-xs font-bold text-green-400">
      +{amount} XP
    </span>
  );
}

function AchievementToast({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-yellow-500/30 bg-black/90 p-4 backdrop-blur-md animate-in slide-in-from-right">
      <p className="text-sm font-bold text-yellow-400">🏆 {title}</p>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

function CoachTyping() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: "0ms" }} />
      <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: "150ms" }} />
      <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

// ------------------------------------------------------------------------------
// History Sidebar Component (unchanged)
// ------------------------------------------------------------------------------
function HistorySidebar({
  open,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onClearAll,
}: {
  open: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onClearAll: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 flex flex-col w-80 max-w-[85%] h-full bg-[#0E0E13] border-r border-white/10 shadow-2xl animate-slide-in-left">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">History</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center text-xs text-gray-600 mt-8">No conversations yet.</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => { onSelectSession(session.id); onClose(); }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  session.id === currentSessionId
                    ? "bg-orange-500/20 border border-orange-400/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="text-sm font-medium truncate">{session.title}</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {new Date(session.lastUpdated).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-3 space-y-2">
          <Button variant="secondary" size="sm" className="w-full" onClick={() => { onNewChat(); onClose(); }}>
            + New Chat
          </Button>
          <Button variant="danger" size="sm" className="w-full" onClick={onClearAll}>
            Clear All History
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Main Study Page – Base64‑Aware
// ------------------------------------------------------------------------------
export default function StudyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = user?.uid ?? "";
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const coachEndRef = useRef<HTMLDivElement>(null);
  const coachInputRef = useRef<HTMLTextAreaElement>(null);
  const sessionStartTime = useRef<number>(Date.now());
  const streamControllerRef = useRef<AbortController | null>(null);

  // Coach & chat
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [coachSignal, setCoachSignal] = useState<CoachDailySignal | null>(null);
  const [coachMemories, setCoachMemories] = useState<CoachMemory[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachBooting, setCoachBooting] = useState(false);
  const [coachStatus, setCoachStatus] = useState("");
  const [agentStages, setAgentStages] = useState<AgentStageState[]>(() => createAgentStages());
  const [showAgentPipeline, setShowAgentPipeline] = useState(false);

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [shouldSpeak, setShouldSpeak] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Thinking state
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);

  // Revision workspace
  const [chapter, setChapter] = useState(searchParams.get("chapter") || "hydrocarbon");
  const [topic, setTopic] = useState(searchParams.get("topic") || "alkanes");
  const [revMode, setRevMode] = useState<"summary" | "explain" | "key">("summary");
  const [revisionOutput, setRevisionOutput] = useState("");
  const [loadingRevision, setLoadingRevision] = useState(false);

  const chapters = ["hydrocarbon", "basic-concepts-of-chemistry"];
  const topicsByChapter: Record<string, { label: string; value: string }[]> = {
    hydrocarbon: [
      { label: "Alkanes", value: "alkanes" },
      { label: "Alkenes", value: "alkenes" },
      { label: "Alkynes", value: "alkynes" },
      { label: "Aromatic Hydrocarbons", value: "aromatics" },
    ],
    "basic-concepts-of-chemistry": [
      { label: "Matter", value: "matter_definition" },
      { label: "States of Matter", value: "states_of_matter" },
      { label: "Solid State", value: "solid_state" },
      { label: "Liquid State", value: "liquid_state" },
      { label: "Gaseous State", value: "gaseous_state" },
      { label: "Interconversion of States", value: "interconversion_of_states" },
      { label: "Classification of Matter", value: "classification_of_matter" },
    ],
  };

  // Practice workspace
  const [examTopic, setExamTopic] = useState("");
  const [examType, setExamType] = useState<"mcq" | "probable">("mcq");
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [probableOutput, setProbableOutput] = useState("");
  const [examStatus, setExamStatus] = useState("");
  const [loadingExam, setLoadingExam] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [score, setScore] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [xpAnimation, setXpAnimation] = useState<{ amount: number; key: number } | null>(null);
  const [achievements, setAchievements] = useState<{ title: string; subtitle: string; key: number }[]>([]);
  const [dailyGoal] = useState(30);
  const [dailyQuestions, setDailyQuestions] = useState(0);
  const [autonomousMission, setAutonomousMission] = useState<AutonomousMission | null>(null);
  const [autonomousLoading, setAutonomousLoading] = useState(false);

  // History sidebar
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => "session_" + Date.now());
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>("chat");

  const [progress, setProgress] = useState<ProgressState>({
    totalTests: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    xp: 0,
    streak: 0,
  });

  const level = useMemo(() => Math.floor(progress.xp / 100) + 1, [progress.xp]);
  const xpProgressPercent = useMemo(() => progress.xp % 100, [progress.xp]);
  const accuracy = useMemo(
    () =>
      progress.totalQuestions === 0
        ? 0
        : Math.round((progress.totalCorrect / progress.totalQuestions) * 100),
    [progress.totalCorrect, progress.totalQuestions],
  );
  const answeredCount = Object.keys(selectedAnswers).length;
  const coachName = coachProfile?.coach_name || "AI Coach";
  const studentName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const currentChapterLabel = chapter.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const currentTopicLabel = topicsByChapter[chapter]?.find((item) => item.value === topic)?.label || topic.replace(/_/g, " ");
  const memoryPreview = useMemo(() => coachMemories.slice(0, 3), [coachMemories]);
  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);
  const nextAction = coachProfile?.next_best_action ||
    coachSignal?.recommended_action ||
    "Complete one focused question set, then review only incorrect answers.";

  // ── Persistence helpers ─────────────────────────────────────────────────
  const saveSessions = useCallback((updatedSessions: ChatSession[]) => {
    try {
      localStorage.setItem("agentify_chat_sessions", JSON.stringify(updatedSessions));
    } catch {}
  }, []);

  const loadSessions = useCallback((): ChatSession[] => {
    try {
      const raw = localStorage.getItem("agentify_chat_sessions");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatSession[];
      return parsed.map((session) => ({
        ...session,
        messages: session.messages.map((message) => ({
          ...message,
          content:
            message.role === "coach"
              ? normalizeCoachTransportText(message.content)
              : message.content,
        })),
      }));
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (coachMessages.length === 0) return;
    setSessions((prev) => {
      const title = coachMessages.find((m) => m.role === "user")?.content.slice(0, 60) || "New Chat";
      const existing = [...prev];
      const idx = existing.findIndex((s) => s.id === currentSessionId);
      const updated: ChatSession = {
        id: currentSessionId,
        title,
        messages: coachMessages,
        lastUpdated: Date.now(),
      };
      if (idx >= 0) {
        existing[idx] = updated;
      } else {
        existing.unshift(updated);
      }
      saveSessions(existing);
      return existing;
    });
  }, [coachMessages, currentSessionId, saveSessions]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const updateURL = useCallback(
    (nextChapter: string, nextTopic: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("chapter", nextChapter);
      params.set("topic", nextTopic);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleCopyRevision = async () => {
    if (revisionOutput) {
      await navigator.clipboard.writeText(revisionOutput);
      setToast("📋 Revision output copied to clipboard");
    }
  };

  const clearRevision = () => setRevisionOutput("");
  const clearExam = () => {
    setMcqs([]);
    setProbableOutput("");
    setExamStatus("");
    setSelectedAnswers({});
    setScore(0);
  };

  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachMessages, coachLoading]);

  useEffect(() => {
    return () => {
      streamControllerRef.current?.abort();
    };
  }, []);

  const authHeaders = async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const token = await user?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
    return headers;
  };

  // ── Data fetching (unchanged) ────────────────────────────────────────────
  const fetchProgress = async (id: string) => {
    try {
      const res = await fetch(`${backendURL}/get-progress/${id}`, {
        cache: "no-store",
        headers: await authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setProgress({
        totalTests: data.total_tests ?? 0,
        totalQuestions: data.total_questions ?? 0,
        totalCorrect: data.total_correct ?? 0,
        xp: data.xp ?? 0,
        streak: data.streak ?? 0,
      });
    } catch { console.log("Progress fetch error"); }
  };

  const loadCoachDashboard = async (id: string) => {
    try {
      const res = await fetch(`${backendURL}/coach/${id}`, { cache: "no-store", headers: await authHeaders() });
      if (!res.ok) { setCoachStatus(`COACH_SYNC_ERROR_${res.status}`); return; }
      const data: CoachDashboard = await res.json();
      setCoachProfile(data.profile ?? null);
      setCoachSignal(data.latest_signal ?? null);
      setCoachMemories(Array.isArray(data.memories) ? data.memories : []);
      setCoachStatus("COACH_ONLINE");
    } catch { setCoachStatus("COACH_CONNECTION_ERROR"); }
  };

  const bootstrapCoach = async (id: string) => {
    setCoachBooting(true);
    try {
      await fetch(`${backendURL}/coach/bootstrap`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          user_id: id,
          student_display_name: user?.displayName || user?.email || "Student",
          preferred_subjects: ["Chemistry"],
          study_preferences: { interface: "terminal", current_chapter: chapter, current_topic: topic },
        }),
      });
      await loadCoachDashboard(id);
    } catch { setCoachStatus("COACH_BOOTSTRAP_FAILED"); }
    setCoachBooting(false);
  };

  const runDailyCoachSignal = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${backendURL}/coach/daily-learning/${userId}`, {
        method: "POST", headers: await authHeaders(),
      });
      if (res.ok) setCoachSignal(await res.json());
    } catch { console.log("Coach daily learning failed"); }
  };

  const isMissionMcq = (value: unknown): value is MCQ => {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<MCQ>;
    return typeof item.question === "string" && Array.isArray(item.options) && typeof item.correct === "string";
  };

  const runAutonomousMission = async () => {
    if (!userId || authLoading || autonomousLoading) return;
    setAutonomousLoading(true);
    setToast("Autonomous agents are selecting your next mission...");

    try {
      const res = await fetch(`${backendURL}/coach/autonomous-study/${userId}`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          current_topic: topic,
          current_chapter: chapter,
          subject: "Chemistry",
        }),
      });

      if (!res.ok) throw new Error(`Mission failed: ${res.status}`);

      const mission: AutonomousMission = await res.json();
      const answer = mission.result?.answer || mission.result?.data?.text || "";
      const missionQuestions = (mission.result?.data?.questions || []).filter(isMissionMcq);

      setAutonomousMission(mission);
      setExamTopic(mission.target_topic);

      if (mission.primary_agent === "revision" && answer) {
        setRevisionOutput(answer);
        setActiveWorkspace("revise");
      } else if (mission.primary_agent === "exam" && missionQuestions.length) {
        setMcqs(missionQuestions);
        setProbableOutput(mission.mode === "probable" ? answer : "");
        setExamStatus("");
        setSelectedAnswers({});
        setScore(0);
        setActiveWorkspace("practice");
        sessionStartTime.current = Date.now();
      } else {
        setCoachMessages((prev) => [
          ...prev,
          {
            role: "coach",
            content: `Autonomous Mission:\n${mission.objective}\n\nWhy:\n${mission.why}\n\nNext:\n${mission.next_actions.join("\n")}${answer ? `\n\n${answer}` : ""}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setActiveWorkspace("chat");
      }

      await loadCoachDashboard(userId);
      setToast("Autonomous mission ready");
    } catch (error) {
      console.error("Autonomous mission failed", error);
      setToast("Autonomous mission failed. Try again.");
    } finally {
      setAutonomousLoading(false);
    }
  };

  useEffect(() => {
    if (!userId || authLoading) return;
    fetchProgress(userId);
    bootstrapCoach(userId);
  }, [authLoading, userId]);

  const showXpAnimation = useCallback((amount: number) => {
    setXpAnimation({ amount, key: Date.now() });
  }, []);

  const triggerAchievement = useCallback((title: string, subtitle: string) => {
    setAchievements((prev) => [...prev, { title, subtitle, key: Date.now() }]);
  }, []);

  // ── Core logic (unchanged) ───────────────────────────────────────────────
  const saveResults = async (
    finalScore: number,
    totalQuestions: number,
    answers: { [key: number]: string },
  ) => {
    if (!userId) return;
    const timeSpent = Math.floor((Date.now() - sessionStartTime.current) / 1000);
    const xpEarned = finalScore * 10;
    const timePerQuestion = totalQuestions > 0 ? timeSpent / totalQuestions : 0;
    let focusScore = 90;
    if (timePerQuestion < 5) focusScore = 40;
    else if (timePerQuestion > 60) focusScore = 60;

    const replayData = {
      topic: examTopic || topic,
      source: "ai_generated",
      questions: mcqs.map((q, idx) => ({
        id: q.id,
        text: q.question,
        topic: q.topic || examTopic || topic,
        subtopic: q.subtopic || "",
        options: q.options,
        correct_answer: q.correct,
        user_answer: answers[idx],
        is_correct: answers[idx] === q.correct,
        ai_explanation: q.explanation || "",
      })),
    };

    try {
      const res = await fetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: examTopic || topic,
          subject: "Chemistry",
          score: finalScore,
          total_questions: totalQuestions,
          xp_earned: xpEarned,
          time_spent_seconds: timeSpent,
          focus_score: focusScore,
          session_type: "exam",
          replay_data: replayData,
        }),
      });

      if (res.ok) {
        await fetchProgress(userId);
        await runDailyCoachSignal();
        await loadCoachDashboard(userId);

        setCoachMessages((prev) => [
          ...prev,
          {
            role: "coach",
            content: `Session captured. Score: ${finalScore}/${totalQuestions}. I updated your learning profile and will use this to guide your next revision block.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setToast("✅ Session logged successfully");
        setDailyQuestions((prev) => prev + totalQuestions);
        showXpAnimation(xpEarned);

        if (progress.streak >= 5) triggerAchievement("5‑Day Streak!", "You're on fire. Keep the momentum.");
        if (accuracy >= 80) triggerAchievement("High Accuracy", "80%+ correct answers — precision mode.");
        if (progress.totalQuestions + totalQuestions >= 100) triggerAchievement("Century Milestone", "You've answered 100+ questions. Serious dedication.");
      }
    } catch (e) { console.error("Failed to save results", e); }
  };

  const handleRevision = async (revTopicOverride?: string) => {
    const t = revTopicOverride || topic;
    if (!t || !userId || authLoading) return;
    setActiveWorkspace("revise");
    setLoadingRevision(true);
    const question =
      revMode === "summary"
        ? `Generate a smart summary of ${t}`
        : revMode === "explain"
        ? `Explain ${t} clearly with examples`
        : `Give key revision bullet points of ${t}`;
    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ question, section_id: t, session_id: `revision-${userId}-${t}`, mode: revMode, difficulty: "medium" }),
      });
      const data = await res.json();
      setRevisionOutput(data.answer || "No response from terminal.");
    } catch { setRevisionOutput("CONNECTION_ERROR: AI service unreachable."); }
    setLoadingRevision(false);
  };

  const generateMCQs = async () => {
    const t = examTopic || topic;
    if (!t || !userId || authLoading) return;
    setActiveWorkspace("practice");
    setLoadingExam(true);
    setExamStatus("");
    setProbableOutput("");
    setMcqs([]);
    setSelectedAnswers({});
    setScore(0);
    try {
      const res = await fetch(`${backendURL}/generate-mcqs`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ topic: t, section_id: t, session_id: `exam-${userId}-${t}`, difficulty: "medium", count: 10 }),
      });
      const data = await res.json();
      const questions = Array.isArray(data.questions) ? data.questions : [];
      setMcqs(questions);
      setExamStatus(questions.length ? "" : data.raw_answer || "NO_MCQ_PAYLOAD_RETURNED");
      sessionStartTime.current = Date.now();
    } catch { setMcqs([]); setExamStatus("CONNECTION_ERROR: Failed to generate MCQs."); }
    setLoadingExam(false);
  };

  const generateProbable = async () => {
    const t = examTopic || topic;
    if (!t || !userId || authLoading) return;
    setActiveWorkspace("practice");
    setLoadingExam(true);
    setExamStatus("");
    setMcqs([]);
    setSelectedAnswers({});
    setScore(0);
    try {
      const res = await fetch(`${backendURL}/generate-probable-questions`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ topic: t, section_id: t, session_id: `probable-${userId}-${t}`, difficulty: "medium" }),
      });
      const data = await res.json();
      setProbableOutput(data.text || data.raw_answer || "");
    } catch { setProbableOutput("CONNECTION_ERROR: Failed to generate questions."); }
    setLoadingExam(false);
  };

  const restartGeneratedMcqs = () => {
    setSelectedAnswers({});
    setScore(0);
    sessionStartTime.current = Date.now();
  };

  const handleAnswerSelect = (index: number, option: string, correct: string) => {
    if (selectedAnswers[index]) return;
    const updated = { ...selectedAnswers, [index]: option };
    const newScore = option === correct ? score + 1 : score;
    setSelectedAnswers(updated);
    setScore(newScore);
    if (Object.keys(updated).length === mcqs.length) {
      saveResults(newScore, mcqs.length, updated);
    }
  };

  // ── Voice: Speech Synthesis (Coach speaks) – only when shouldSpeak is true
  const speakCoachMessage = (text: string) => {
    if (!shouldSpeak) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const clean = normalizeCoachTransportText(text)
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^\d+[.)]\s+/gm, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/\.{2,}/g, ".")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices();

    const femaleNames = [
      "Google US English Female",
      "Microsoft Zira - English (United States)",
      "Microsoft Zira",
      "Samantha",
      "Fiona",
      "Karen",
      "Susan",
      "Moira",
      "Veena",
      "Hazel",
      "Microsoft Hazel - English (United Kingdom)",
    ];

    let chosen = null;
    for (const name of femaleNames) {
      chosen = voices.find((v) => v.name === name);
      if (chosen) break;
    }

    if (!chosen) {
      chosen = voices.find(
        (v) => v.lang.startsWith("en-US") && v.name.toLowerCase().includes("female")
      );
    }
    if (!chosen) {
      chosen = voices.find(
        (v) => v.lang.startsWith("en-GB") && v.name.toLowerCase().includes("female")
      );
    }
    if (!chosen) chosen = voices[0];

    if (chosen) utterance.voice = chosen;
    utterance.lang = "en-US";
    utterance.pitch = 1.05;
    utterance.rate = 0.95;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // ── Streaming Coach Chat (Base64‑Aware) ────────────────────────────────
  const handleAskCoach = async () => {
    const input = coachInput.trim();
    if (!input || !userId || authLoading || coachLoading) return;

    setActiveWorkspace("chat");
    streamControllerRef.current?.abort();
    const controller = new AbortController();
    streamControllerRef.current = controller;

    const userMsg: CoachMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setCoachMessages((prev) => [
      ...prev,
      userMsg,
      { role: "coach", content: "", timestamp: "" },
    ]);
    setCoachInput("");
    setCoachLoading(true);
    setThinkingMessage(null);
    setAgentStages(
      createAgentStages().map((stage) => ({
        ...stage,
        status: stage.id === "drafting" ? "active" : "pending",
      })),
    );
    setShowAgentPipeline(true);

    // Determine intent based on user message
    const lower = input.toLowerCase();
    const isPlanning = /plan|schedule|routine|study plan/i.test(lower);
    const intent = isPlanning ? "planning" : "study_advice";

    try {
      const headers = await authHeaders();
      await new Promise((r) => setTimeout(r, 800));
      setThinkingMessage(null);

      const res = await fetch(`${backendURL}/coach/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: userId,
          message: input,
          mode: "coach",
          intent: intent,
          subject: "Chemistry",
          topic: topic,
          session_id: `coach-${userId}`,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";
      let streamDone = false;

      const updateLastCoachMessage = (content: string) => {
        setCoachMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "coach") {
            last.content = content;
            last.timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          }
          return updated;
        });
      };

      const applyStreamPayload = (rawPayload: string) => {
        let payload = stripSseDataPrefix(rawPayload);
        if (!payload) return;

        if (payload === "[DONE]") {
          streamDone = true;
          return;
        }

        const stagePayloads = extractAgentStagePayloads(payload);
        if (stagePayloads.length) {
          setShowAgentPipeline(true);
          setThinkingMessage(null);
          setAgentStages((prev) =>
            stagePayloads.reduce((current, stagePayload) => applyAgentStageUpdate(current, stagePayload), prev),
          );
          payload = removeAgentStagePayloads(payload);
          if (!payload) return;
        }

        if (payload.startsWith("🧠") || payload.startsWith("📚") || payload.startsWith("✨")) {
          setThinkingMessage(payload);
          return;
        }

        if (looksLikeBase64Payload(payload)) {
          try {
            fullText = decodeBase64Utf8(payload);
          } catch {
            fullText = normalizeCoachTransportText(payload);
          }
        } else {
          fullText += normalizeCoachTransportText(payload);
        }

        setThinkingMessage(null);
        updateLastCoachMessage(fullText);
      };

      const processSseEvent = (eventBlock: string) => {
        const dataLines = eventBlock
          .split(/\r?\n/)
          .map((line) => line.trimEnd())
          .filter((line) => /^data:/i.test(line.trim()));

        if (!dataLines.length) {
          applyStreamPayload(eventBlock);
          return;
        }

        const payloadParts = dataLines.map((line) => stripSseDataPrefix(line));
        const compactPayload = payloadParts.join("").trim();
        const readablePayload = payloadParts.join("\n").trim();
        applyStreamPayload(looksLikeBase64Payload(compactPayload) ? compactPayload : readablePayload);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";

        for (const eventBlock of events) {
          processSseEvent(eventBlock);
        }

        if (streamDone) break;
      }

      if (buffer.trim() && !streamDone) {
        processSseEvent(buffer);
      }

      // Speak only if user used the microphone
      if (shouldSpeak) {
        speakCoachMessage(fullText);
        setShouldSpeak(false);
      }
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : "";
      if (errorName !== "AbortError") {
        setThinkingMessage(null);
        setCoachMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "coach") {
            last.content = "I'm having trouble responding right now. Please try again.";
            last.timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          }
          return updated;
        });
      }
    } finally {
      setCoachLoading(false);
      setThinkingMessage(null);
      setShowAgentPipeline(false);
      streamControllerRef.current = null;
    }
  };

  const handleCoachKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskCoach();
    }
  };

  // ── History management ──────────────────────────────────────────────────
  const startNewChat = () => {
    const newId = "session_" + Date.now();
    setCurrentSessionId(newId);
    setCoachMessages([]);
    setShowAgentPipeline(false);
    setAgentStages(createAgentStages());
  };

  const loadSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setCoachMessages(session.messages);
      setCurrentSessionId(session.id);
      setShowAgentPipeline(false);
      setAgentStages(createAgentStages());
    }
  };

  const clearAllHistory = () => {
    if (confirm("Delete all chat history? This cannot be undone.")) {
      setSessions([]);
      localStorage.removeItem("agentify_chat_sessions");
      startNewChat();
    }
  };

  const clearChat = () => {
    setCoachMessages([]);
    setShowAgentPipeline(false);
    setAgentStages(createAgentStages());
  };

  // ── Voice: Speech Recognition (Mic) ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
      const transcript = event.results[0][0].transcript;
      setCoachInput((prev) => prev + " " + transcript);
      setIsListening(false);
      setShouldSpeak(true);   // user used voice → AI should speak
      setTimeout(() => {
        coachInputRef.current?.focus();
        handleAskCoach();
      }, 500);
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

  // ── Dynamic Quick Actions ──────────────────────────────────────────────
  const quickActions = useMemo(() => {
    if (coachMessages.length === 0) {
      return [
        { label: "Study plan", prompt: "Create a study plan for me based on my progress." },
        { label: "Explain a topic", prompt: "Explain a chemistry topic of my choice." },
        { label: "Quiz me", prompt: "Generate 5 MCQs on a topic I should practice." },
        { label: "Revision help", prompt: "Give me key revision points for my weakest topic." },
      ];
    }
    const lastCoachMsg = [...coachMessages].reverse().find((m) => m.role === "coach");
    const actions = [];
    if (nextAction) actions.push({ label: "What to do next", prompt: nextAction });
    if (lastCoachMsg && (lastCoachMsg.content.includes("alkane") || lastCoachMsg.content.includes("matter") || lastCoachMsg.content.includes("state"))) {
      actions.push({ label: "Quiz on this topic", prompt: "Give me 5 MCQs on the last topic we discussed." });
    }
    actions.push({ label: "Revision summary", prompt: "Give me a quick revision summary of the last topic." });
    actions.push({ label: "I'm stuck", prompt: "I'm feeling stuck. Help me get unstuck." });
    return actions.slice(0, 4);
  }, [coachMessages, nextAction]);

  if (authLoading || coachBooting) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-cyan-200">
        {authLoading ? "VERIFYING..." : "WAKING YOUR COACH..."}
      </div>
    );
  }

  return (
    <div className="study-lab-shell flex h-[calc(100vh-180px)] min-h-[640px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0E1118]/90 text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <style jsx global>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-24px); }
        }
        .animate-float-up { animation: float-up 1.2s ease-out forwards; }
        @keyframes slide-in-from-right {
          0% { opacity: 0; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-in.slide-in-from-right { animation: slide-in-from-right 0.3s ease-out; }
        @keyframes slide-in-from-bottom {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-in.slide-in-from-bottom { animation: slide-in-from-bottom 0.3s ease-out; }
        @keyframes slide-in-from-left {
          0% { opacity: 0; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-left { animation: slide-in-from-left 0.25s ease-out; }
      `}</style>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-green-500/30 bg-black/80 px-5 py-2.5 text-sm text-green-400 backdrop-blur-md animate-in slide-in-from-bottom">
          {toast}
        </div>
      )}

      {achievements.map((a) => (
        <AchievementToast key={a.key} title={a.title} subtitle={a.subtitle} onClose={() => setAchievements((prev) => prev.filter((x) => x.key !== a.key))} />
      ))}

      {/* History Sidebar */}
      <HistorySidebar
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewChat={startNewChat}
        onClearAll={clearAllHistory}
      />

      <header className="study-lab-header shrink-0 border-b border-white/10 bg-white/[0.025] px-4 py-3">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Conversation history" className="!px-2.5">
              ☰
            </Button>
            <div className="study-coach-avatar flex h-10 w-10 items-center justify-center rounded-md border border-orange-400/20 bg-orange-400/10 text-sm font-bold text-orange-300">
              {coachName[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{coachName}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] uppercase tracking-wider text-emerald-300">{coachStatus || "Online"}</span>
              </div>
              <p className="truncate text-xs text-gray-500">Private AI tutor for {studentName}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="study-top-stat rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
              XP <span className="ml-1 font-semibold text-cyan-300">{progress.xp}</span>
            </div>
            <div className="study-top-stat rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
              LVL <span className="ml-1 font-semibold text-white">{level}</span>
            </div>
            <div className="study-top-stat rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
              STREAK <span className="ml-1 font-semibold text-yellow-300">{progress.streak}d</span>
            </div>
            {isSpeaking && (
              <button onClick={stopSpeaking} className="rounded-md border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">
                Stop voice
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={runAutonomousMission} disabled={autonomousLoading || !userId}>
              {autonomousLoading ? "Planning..." : "Auto Mission"}
            </Button>
            <Button variant="secondary" size="sm" onClick={startNewChat}>New Chat</Button>
            <Button variant="danger" size="sm" onClick={clearChat}>Clear</Button>
          </div>
        </div>
      </header>

      <section className="study-mission-strip shrink-0 border-b border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="mx-auto grid max-w-[1680px] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] lg:items-center">
          <div className="study-mission-card min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                Chemistry
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Today&apos;s learning mission</span>
            </div>
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-white md:text-xl">
              Master {currentTopicLabel}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-400">
              {nextAction}
            </p>
          </div>

          <div className="study-topic-card rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Selected syllabus</p>
                <p className="mt-0.5 truncate text-xs text-gray-400">{currentChapterLabel}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={runAutonomousMission} disabled={autonomousLoading || !userId}>
                {autonomousLoading ? "Planning..." : "Auto Mission"}
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={chapter}
                onChange={(e) => {
                  const c = e.target.value;
                  setChapter(c);
                  const t = topicsByChapter[c]?.[0]?.value || "alkanes";
                  setTopic(t);
                  updateURL(c, t);
                }}
                className="study-select rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                {chapters.map((c) => (
                  <option key={c} value={c}>{c.replace(/-/g, " ").toUpperCase()}</option>
                ))}
              </select>
              <select
                value={topic}
                onChange={(e) => { setTopic(e.target.value); updateURL(chapter, e.target.value); }}
                className="study-select rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                {topicsByChapter[chapter]?.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <main className="study-lab-main min-h-0 flex-1 overflow-hidden px-4 py-3">
        <div className="mx-auto grid h-full max-w-[1680px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="study-workspace-card flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0B0E14]/95">
            <div className="study-tabbar shrink-0 border-b border-white/10 px-3 py-2.5">
              <div className="flex flex-wrap gap-1">
                {WORKSPACE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveWorkspace(tab.id)}
                    className={`study-tab-button rounded-md px-3 py-2 text-left transition-colors ${
                      activeWorkspace === tab.id
                        ? "is-active bg-white/10 text-white"
                        : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
                    }`}
                  >
                    <span className="block text-xs font-semibold">{tab.label}</span>
                    <span className="hidden text-[10px] text-gray-500 sm:block">{tab.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {activeWorkspace === "chat" && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="study-chat-scroll flex-1 overflow-y-auto px-4 py-8 lg:px-10">
                  {coachMessages.length === 0 && !thinkingMessage ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <div className="study-empty-state w-full max-w-4xl space-y-6 px-6 py-12">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-orange-400/20 bg-orange-400/10 text-lg font-bold text-orange-300">
                          {coachName[0]}
                        </div>
                        <div>
                          <p className="text-2xl font-semibold text-white">Start a focused study session</p>
                          <p className="mt-2 text-sm leading-6 text-gray-400">
                            Ask {coachName} for a clear explanation, exam-ready answer, revision sheet, or practice test.
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            onClick={runAutonomousMission}
                            disabled={autonomousLoading || !userId}
                            className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {autonomousLoading ? "Agents planning..." : "Start autonomous mission"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {thinkingMessage && (
                        <div className="flex justify-start">
                          <div className="flex max-w-[92%] gap-3">
                            <div className="study-message-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-xs font-bold text-orange-300">
                              {coachName[0]}
                            </div>
                            <div className="study-thinking-bubble rounded-xl px-4 py-3 rounded-bl-md bg-white/[0.055] text-gray-400 flex items-center gap-2">
                              <span className="animate-pulse">{thinkingMessage}</span>
                              <CoachTyping />
                            </div>
                          </div>
                        </div>
                      )}
                      {showAgentPipeline && (
                        <div className="flex justify-start">
                          <div className="flex max-w-[92%] gap-3">
                            <div className="study-message-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-xs font-bold text-orange-300">
                              {coachName[0]}
                            </div>
                            <div>
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-xs font-semibold text-orange-300">{coachName}</span>
                                <span className="text-[10px] uppercase tracking-wider text-gray-600">multi-agent</span>
                              </div>
                              <AgentPipeline stages={agentStages} coachName={coachName} />
                            </div>
                          </div>
                        </div>
                      )}
                      {coachMessages.map((msg, idx) => {
                        const hidePendingCoachBubble = msg.role === "coach" && !msg.content && showAgentPipeline && coachLoading;
                        if (hidePendingCoachBubble) return null;

                        return (
                          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`flex max-w-[92%] gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                              <div className={`study-message-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                                msg.role === "user" ? "bg-cyan-500/15 text-cyan-300" : "bg-orange-500/15 text-orange-300"
                              }`}>
                                {msg.role === "user" ? "U" : coachName[0]}
                              </div>
                              <div className={msg.role === "user" ? "text-right" : ""}>
                                <div className={`mb-1 flex items-center gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                                  <span className={`text-xs font-semibold ${msg.role === "user" ? "text-cyan-300" : "text-orange-300"}`}>
                                    {msg.role === "user" ? "You" : coachName}
                                  </span>
                                  {msg.timestamp && <span className="text-[10px] text-gray-600">{msg.timestamp}</span>}
                                </div>
                                <div className={`study-message-bubble max-w-full rounded-xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                                  msg.role === "user"
                                    ? "is-user bg-cyan-500/15 text-cyan-50 rounded-br-md"
                                    : "is-coach bg-white/[0.055] text-gray-200 rounded-bl-md"
                                }`}>
                                  {msg.role === "coach" ? (
                                    <CoachAnswerBlock value={msg.content} />
                                  ) : (
                                    <ChemistryBlock value={msg.content} />
                                  )}
                                  {coachLoading && idx === coachMessages.length - 1 && msg.role === "coach" && !msg.content && <CoachTyping />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div ref={coachEndRef} />
                </div>

                <div className="study-composer shrink-0 border-t border-white/10 bg-[#090C12] px-4 py-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.prompt}
                        className="study-action-chip rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-cyan-400/30 hover:text-white"
                        onClick={() => { setActiveWorkspace("chat"); setCoachInput(action.prompt); coachInputRef.current?.focus(); }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 items-end">
                    <textarea
                      ref={coachInputRef}
                      value={coachInput}
                      onChange={(e) => setCoachInput(e.target.value)}
                      onKeyDown={handleCoachKeyDown}
                      placeholder={`Message ${coachName}...`}
                      rows={1}
                      className="study-textarea flex-1 resize-none rounded-lg border border-white/10 bg-black/35 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-400"
                    />
                    <Button
                      variant={isListening ? "danger" : "secondary"}
                      size="sm"
                      onClick={toggleListening}
                      disabled={!recognitionRef.current}
                      className={isListening ? "!border-red-400/40 !bg-red-400/10 !text-red-400" : "!border-cyan-400/20 !bg-cyan-400/10 !text-cyan-300"}
                    >
                      Voice
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="!bg-cyan-400 !text-black hover:!bg-cyan-300"
                      onClick={handleAskCoach}
                      disabled={coachLoading || !coachInput.trim()}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeWorkspace === "revise" && (
              <div className="study-workspace-pane min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Revision Desk</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">{currentTopicLabel}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={revMode}
                      onChange={(e) => setRevMode(e.target.value as "summary" | "explain" | "key")}
                      className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      <option value="summary">Summary</option>
                      <option value="explain">Explain</option>
                      <option value="key">Key Points</option>
                    </select>
                    <Button variant="primary" size="sm" className="!bg-cyan-400 !text-black hover:!bg-cyan-300" onClick={() => handleRevision()} disabled={loadingRevision}>
                      {loadingRevision ? "Generating..." : "Generate Notes"}
                    </Button>
                    {revisionOutput && <Button variant="ghost" size="sm" onClick={handleCopyRevision}>Copy</Button>}
                    {revisionOutput && <Button variant="ghost" size="sm" onClick={clearRevision}>Clear</Button>}
                  </div>
                </div>

                {loadingRevision && (
                  <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                )}

                {revisionOutput ? (
                  <div className="study-content-card rounded-lg border border-white/10 bg-black/20 p-5 text-sm leading-7 text-gray-200 whitespace-pre-wrap">
                    <ChemistryBlock value={revisionOutput} />
                  </div>
                ) : !loadingRevision && (
                  <div className="study-content-card rounded-lg border border-white/10 bg-white/[0.03] p-6">
                    <p className="text-sm font-semibold text-white">Create a revision asset</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                      Generate concise notes, a full explanation, or key recall points for the selected topic.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeWorkspace === "practice" && (
              <div className="study-workspace-pane min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Practice Lab</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">Exam training for {currentTopicLabel}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Topic override"
                      value={examTopic}
                      onChange={(e) => setExamTopic(e.target.value)}
                      className="min-w-[220px] !bg-black/40"
                    />
                    <Button variant={examType === "mcq" ? "primary" : "secondary"} size="sm" className={examType === "mcq" ? "!bg-cyan-400 !text-black" : ""} onClick={() => setExamType("mcq")}>
                      MCQs
                    </Button>
                    <Button variant={examType === "probable" ? "primary" : "secondary"} size="sm" className={examType === "probable" ? "!bg-cyan-400 !text-black" : ""} onClick={() => setExamType("probable")}>
                      Probable
                    </Button>
                    <Button variant="primary" size="sm" className="!bg-cyan-400 !text-black hover:!bg-cyan-300" onClick={examType === "mcq" ? generateMCQs : generateProbable} disabled={loadingExam}>
                      {loadingExam ? "Generating..." : "Generate"}
                    </Button>
                    {(mcqs.length > 0 || probableOutput) && <Button variant="danger" size="sm" onClick={clearExam}>Clear</Button>}
                  </div>
                </div>

                {loadingExam && <p className="text-sm text-gray-500">Generating exam content...</p>}
                {examStatus && <p className="text-sm text-gray-500">{examStatus}</p>}

                {mcqs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-xs font-bold text-gray-300">SCORE: {score}/{mcqs.length} ({answeredCount}/{mcqs.length} answered)</span>
                      <Button variant="secondary" size="sm" onClick={restartGeneratedMcqs}>Restart</Button>
                    </div>
                    {mcqs.map((q, index) => (
                      <div key={q.id ?? index} className="study-content-card rounded-lg border border-white/10 bg-black/20 p-4">
                        <p className="mb-3 text-sm font-semibold text-white">
                          <span className="mr-2 text-cyan-300">Q{index + 1}.</span>
                          {renderChemistryText(q.question)}
                        </p>
                        <div className="space-y-2">
                          {q.options.map((opt, i) => {
                            const letter = opt.charAt(0).toUpperCase();
                            const selected = selectedAnswers[index];
                            const isCorrect = letter === q.correct;
                            return (
                              <button
                                key={i}
                                onClick={() => handleAnswerSelect(index, letter, q.correct)}
                                disabled={!!selected}
                                className={`w-full rounded-md border px-4 py-2.5 text-left text-sm transition-all ${
                                  selected
                                    ? isCorrect
                                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                                      : selected === letter
                                      ? "border-red-500/50 bg-red-500/10 text-red-300"
                                      : "border-white/10 bg-black/30 text-gray-500"
                                    : "border-white/10 bg-black/30 text-gray-300 hover:border-cyan-400/30"
                                }`}
                              >
                                {renderChemistryText(opt)}
                              </button>
                            );
                          })}
                        </div>
                        {selectedAnswers[index] && (
                          <p className="mt-3 text-xs leading-5 text-gray-400">
                            {selectedAnswers[index] === q.correct ? "Correct" : `Incorrect. Answer: ${q.correct}`}
                            {q.explanation && ` - ${q.explanation}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {probableOutput && (
                  <div className="study-content-card rounded-lg border border-white/10 bg-black/20 p-5 text-sm leading-7 text-gray-200 whitespace-pre-wrap">
                    <ChemistryBlock value={probableOutput} />
                  </div>
                )}

                {!loadingExam && mcqs.length === 0 && !probableOutput && (
                  <div className="study-content-card rounded-lg border border-white/10 bg-white/[0.03] p-6">
                    <p className="text-sm font-semibold text-white">Generate exam practice</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                      Build MCQs or probable questions from your selected topic. Results are saved into your learning profile when completed.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeWorkspace === "history" && (
              <div className="study-workspace-pane min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Conversation Ledger</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">Study history</h2>
                  </div>
                  <Button variant="secondary" size="sm" onClick={startNewChat}>New Chat</Button>
                </div>
                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-500">No conversations yet.</p>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => { loadSession(session.id); setActiveWorkspace("chat"); }}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                          session.id === currentSessionId
                            ? "border-cyan-400/30 bg-cyan-400/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <div className="truncate text-sm font-medium text-white">{session.title}</div>
                        <div className="mt-1 text-[11px] text-gray-500">{new Date(session.lastUpdated).toLocaleString()}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="study-mentor-rail hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
            <div className="study-side-card rounded-lg border border-white/10 bg-[#0B0E14]/95 p-4">
              <div className="relative">
                {xpAnimation && <XPFloat amount={xpAnimation.amount} />}
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Agent Intelligence</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{coachName}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">{coachProfile?.coach_style || "exam_oriented"} / {coachProfile?.coach_tone || "focused_supportive"}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase text-gray-500">Accuracy</p>
                  <p className="mt-1 text-lg font-semibold text-white">{accuracy}%</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase text-gray-500">Level</p>
                  <p className="mt-1 text-lg font-semibold text-white">{level}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase text-gray-500">Streak</p>
                  <p className="mt-1 text-lg font-semibold text-white">{progress.streak}d</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[10px] uppercase text-gray-500">
                  <span>Level progress</span>
                  <span>{xpProgressPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-300" style={{ width: `${xpProgressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="study-side-card rounded-lg border border-white/10 bg-[#0B0E14]/95 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Next Best Action</p>
              <p className="mt-3 text-sm leading-6 text-gray-200">{nextAction}</p>
              <button
                onClick={() => { setActiveWorkspace("chat"); setCoachInput(nextAction); coachInputRef.current?.focus(); }}
                className="mt-4 w-full rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/15"
              >
                Ask {coachName} to guide this
              </button>
            </div>

            <div className="study-side-card study-mission-side-card rounded-lg border border-emerald-400/15 bg-[#0B0E14]/95 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Autonomous Mission</p>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    {autonomousMission ? autonomousMission.objective : "Let the agents pick your next move"}
                  </h3>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase text-emerald-200">
                  {autonomousMission?.primary_agent || "auto"}
                </span>
              </div>

              {autonomousMission ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex justify-between gap-3 text-[10px] uppercase tracking-wider text-gray-500">
                      <span>Target</span>
                      <span>{autonomousMission.mode}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-gray-100">
                      {autonomousMission.target_topic.replace(/_/g, " ")}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">{autonomousMission.why}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Execution Steps</p>
                    <div className="mt-2 space-y-2">
                      {autonomousMission.steps.slice(0, 3).map((step, index) => (
                        <div key={`${step}-${index}`} className="flex gap-2 text-xs leading-5 text-gray-400">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-[10px] text-emerald-200">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Next Action</p>
                    <p className="mt-2 text-xs leading-5 text-gray-300">{autonomousMission.next_actions[0]}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-gray-500">
                  The supervisor will inspect your weak areas, choose a specialist agent, and prepare the next study task.
                </p>
              )}

              <button
                onClick={runAutonomousMission}
                disabled={autonomousLoading || !userId}
                className="mt-4 w-full rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {autonomousLoading ? "Agents planning..." : autonomousMission ? "Refresh Mission" : "Start Mission"}
              </button>
            </div>

            <div className="study-side-card rounded-lg border border-white/10 bg-[#0B0E14]/95 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Daily Load</p>
                <span className="text-xs text-gray-400">{dailyQuestions}/{dailyGoal}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(100, Math.round((dailyQuestions / dailyGoal) * 100))}%` }} />
              </div>
              <div className="mt-4 space-y-2 text-xs text-gray-400">
                <div className="flex justify-between"><span>Chapter</span><span className="text-gray-200">{currentChapterLabel}</span></div>
                <div className="flex justify-between"><span>Topic</span><span className="text-gray-200">{currentTopicLabel}</span></div>
                <div className="flex justify-between"><span>Mode</span><span className="text-gray-200">{activeWorkspace}</span></div>
              </div>
            </div>

            <div className="study-side-card rounded-lg border border-white/10 bg-[#0B0E14]/95 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Agent Memory</p>
              <div className="mt-3 space-y-3">
                {memoryPreview.length ? (
                  memoryPreview.map((memory, index) => (
                    <div key={memory.id ?? index} className="border-l border-white/10 pl-3">
                      <p className="text-xs font-semibold text-gray-200">{memory.title || memory.memory_type || "Memory"}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-gray-500">{memory.summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs leading-5 text-gray-500">Aria will build memory as you ask questions and complete practice.</p>
                )}
              </div>
            </div>

            <div className="study-side-card rounded-lg border border-white/10 bg-[#0B0E14]/95 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Recent Sessions</p>
              <div className="mt-3 space-y-2">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => { loadSession(session.id); setActiveWorkspace("chat"); }}
                      className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-white/20"
                    >
                      <p className="truncate text-xs font-medium text-gray-200">{session.title}</p>
                      <p className="mt-1 text-[10px] text-gray-600">{new Date(session.lastUpdated).toLocaleDateString()}</p>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No saved sessions yet.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
