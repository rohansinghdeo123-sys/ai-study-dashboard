"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
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

function CollapsiblePanel({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-white/10">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
      >
        <span>{title}</span>
        <span className="text-base">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
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
// Main Study Page – Base64‑decoding for complete answers
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

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [shouldSpeak, setShouldSpeak] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Thinking state (shown before streaming starts)
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);

  // Revision panel (collapsible)
  const [revisionOpen, setRevisionOpen] = useState(false);
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

  // Exam panel (collapsible)
  const [examOpen, setExamOpen] = useState(false);
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

  // History sidebar
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => "session_" + Date.now());

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
      return raw ? JSON.parse(raw) : [];
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
      const res = await fetch(`${backendURL}/get-progress/${id}`, { cache: "no-store" });
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
    setLoadingExam(true);
    setExamStatus("");
    setProbableOutput("");
    setMcqs([]);
    setSelectedAnswers({});
    setScore(0);
    try {
      const res = await fetch(`${backendURL}/generate-mcqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    setLoadingExam(true);
    setExamStatus("");
    setMcqs([]);
    setSelectedAnswers({});
    setScore(0);
    try {
      const res = await fetch(`${backendURL}/generate-probable-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

    let clean = text
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

  // ── Streaming Coach Chat (base64‑aware) ────────────────────────────────
  const handleAskCoach = async () => {
    const input = coachInput.trim();
    if (!input || !userId || authLoading || coachLoading) return;

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
    setThinkingMessage("🧠 Thinking...");

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
  const payload = line.slice(6);
  if (payload === "[DONE]") continue;

  // If the payload is very long (> 50 chars) and has no spaces, it's base64.
  if (payload.length > 50 && !payload.includes(" ")) {
    try {
      const decoded = atob(payload);
      fullText = decoded;
      setThinkingMessage(null);
      setCoachMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "coach") {
          last.content = fullText;
          last.timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        return updated;
      });
      break; // no more processing needed
    } catch {
      // fallback to normal token handling
      fullText += payload;
    }
  } else {
    fullText += payload;
    setThinkingMessage(null);
    setCoachMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last.role === "coach") {
        last.content = fullText;
        last.timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return updated;
    });
  }
}

      // Speak only if user used the microphone
      if (shouldSpeak) {
        speakCoachMessage(fullText);
        setShouldSpeak(false);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
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
  };

  const loadSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setCoachMessages(session.messages);
      setCurrentSessionId(session.id);
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
  };

  // ── Voice: Speech Recognition (Mic) ─────────────────────────────────────
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
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-[#00A3FF] animate-pulse text-sm uppercase tracking-widest">
        {authLoading ? "VERIFYING..." : "WAKING YOUR COACH..."}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0F] text-gray-200">
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

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Conversation history">
            ☰
          </Button>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-base font-bold text-white">{coachName}</span>
          <span className="text-xs text-gray-500">{coachStatus}</span>
          {isSpeaking && (
            <button onClick={stopSpeaking} className="ml-2 text-xs text-red-400 hover:text-red-300">🔇 Stop</button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">XP {progress.xp}</span>
          <span className="text-xs text-gray-500">LVL {level}</span>
          <span className="text-xs text-gray-500">STREAK {progress.streak}d</span>
          <Button variant="secondary" size="sm" onClick={startNewChat}>New Chat</Button>
          <Button variant="danger" size="sm" onClick={clearChat}>Clear Chat</Button>
        </div>
      </header>

      {/* Collapsible Tool Panels */}
      <div className="shrink-0 bg-black/10">
        {/* Revision Panel */}
        <CollapsiblePanel title="Revision Tools" isOpen={revisionOpen} onToggle={() => setRevisionOpen(!revisionOpen)}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] uppercase text-gray-600 mb-1">Chapter</label>
                <select
                  value={chapter}
                  onChange={(e) => {
                    const c = e.target.value;
                    setChapter(c);
                    const t = topicsByChapter[c]?.[0]?.value || "alkanes";
                    setTopic(t);
                    updateURL(c, t);
                  }}
                  className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                >
                  {chapters.map((c) => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] uppercase text-gray-600 mb-1">Topic</label>
                <select
                  value={topic}
                  onChange={(e) => { setTopic(e.target.value); updateURL(chapter, e.target.value); }}
                  className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                >
                  {topicsByChapter[chapter]?.map((t) => (
                    <option key={t.value} value={t.value}>{t.label.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-gray-600 mb-1">Mode</label>
                <select
                  value={revMode}
                  onChange={(e) => setRevMode(e.target.value as any)}
                  className="rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                >
                  <option value="summary">Summary</option>
                  <option value="explain">Explain</option>
                  <option value="key">Key Points</option>
                </select>
              </div>
              <Button variant="primary" size="sm" onClick={() => handleRevision()} disabled={loadingRevision}>
                {loadingRevision ? "Loading..." : "Generate"}
              </Button>
              {revisionOutput && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleCopyRevision}>Copy</Button>
                  <Button variant="ghost" size="sm" onClick={clearRevision}>Clear</Button>
                </>
              )}
            </div>
            {revisionOutput && (
              <div className="bg-black/20 border border-white/10 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                <ChemistryBlock value={revisionOutput} />
              </div>
            )}
            {loadingRevision && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            )}
          </div>
        </CollapsiblePanel>

        {/* Exam Panel */}
        <CollapsiblePanel title="Exam Lab" isOpen={examOpen} onToggle={() => setExamOpen(!examOpen)}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                placeholder="Topic (e.g., matter_definition)"
                value={examTopic}
                onChange={(e) => setExamTopic(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button variant={examType === "mcq" ? "primary" : "secondary"} size="sm" onClick={() => setExamType("mcq")}>
                MCQs
              </Button>
              <Button variant={examType === "probable" ? "primary" : "secondary"} size="sm" onClick={() => setExamType("probable")}>
                Probable
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={examType === "mcq" ? generateMCQs : generateProbable}
                disabled={loadingExam}
              >
                {loadingExam ? "Generating..." : "Generate"}
              </Button>
              {(mcqs.length > 0 || probableOutput) && (
                <Button variant="danger" size="sm" onClick={clearExam}>Clear</Button>
              )}
            </div>
            {loadingExam && <p className="text-sm text-gray-500">Generating exam content...</p>}
            {examStatus && <p className="text-sm text-gray-500">{examStatus}</p>}

            {mcqs.length > 0 && (
              <div className="max-h-80 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">SCORE: {score}/{mcqs.length} ({answeredCount}/{mcqs.length} answered)</span>
                  <Button variant="secondary" size="sm" onClick={restartGeneratedMcqs}>Restart</Button>
                </div>
                {mcqs.map((q, index) => (
                  <div key={q.id ?? index} className="bg-black/20 border border-white/10 rounded-lg p-4">
                    <p className="text-sm text-white font-semibold mb-3">
                      <span className="text-orange-400 mr-2">Q{index + 1}.</span>
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
                            className={`w-full text-left rounded-md border px-4 py-2.5 text-sm transition-all ${
                              selected
                                ? isCorrect
                                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                                  : selected === letter
                                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                                  : "border-white/10 bg-black/30 text-gray-500"
                                : "border-white/10 bg-black/30 text-gray-300 hover:border-white/30"
                            }`}
                          >
                            {renderChemistryText(opt)}
                          </button>
                        );
                      })}
                    </div>
                    {selectedAnswers[index] && (
                      <p className="mt-2 text-xs text-gray-400">
                        {selectedAnswers[index] === q.correct ? "✅ Correct" : `❌ Incorrect — Answer: ${q.correct}`}
                        {q.explanation && ` — ${q.explanation}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {probableOutput && (
              <div className="bg-black/20 border border-white/10 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                <ChemistryBlock value={probableOutput} />
              </div>
            )}
          </div>
        </CollapsiblePanel>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {coachMessages.length === 0 && !thinkingMessage ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="max-w-md space-y-3">
                <p className="text-2xl font-bold text-white">{coachName}</p>
                <p className="text-sm text-gray-400">Your personal AI coach is ready. Ask me anything.</p>
              </div>
            </div>
          ) : (
            <>
              {thinkingMessage && (
                <div className="flex justify-start">
                  <div className="flex max-w-[85%] gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">
                      {coachName[0]}
                    </div>
                    <div className="rounded-2xl px-5 py-3 rounded-bl-md bg-white/5 text-gray-400 flex items-center gap-2">
                      <span className="animate-pulse">{thinkingMessage}</span>
                      <CoachTyping />
                    </div>
                  </div>
                </div>
              )}
              {coachMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="flex max-w-[85%] gap-3">
                    {msg.role === "coach" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">
                        {coachName[0]}
                      </div>
                    )}
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`text-xs font-semibold ${msg.role === "user" ? "text-blue-400 ml-auto" : "text-orange-400"}`}>
                          {msg.role === "user" ? "You" : coachName}
                        </span>
                        {msg.timestamp && <span className="text-[10px] text-gray-600">{msg.timestamp}</span>}
                      </div>
                      <div className={`rounded-2xl px-5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-blue-500/20 text-blue-100 rounded-br-md"
                          : "bg-white/5 text-gray-200 rounded-bl-md"
                      }`}>
                        <ChemistryBlock value={msg.content} />
                        {coachLoading && idx === coachMessages.length - 1 && msg.role === "coach" && !msg.content && <CoachTyping />}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                        U
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={coachEndRef} />
        </div>

        {/* Dynamic Quick-Action Buttons */}
        <div className="px-4 pb-1 flex flex-wrap gap-2 justify-center">
          {quickActions.map((action) => (
            <Button
              key={action.prompt}
              variant="ghost"
              size="sm"
              className="text-xs !text-gray-400 hover:!text-white !border !border-white/10 hover:!border-white/30"
              onClick={() => { setCoachInput(action.prompt); coachInputRef.current?.focus(); }}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Input with Voice */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex gap-3 items-end">
            <textarea
              ref={coachInputRef}
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              onKeyDown={handleCoachKeyDown}
              placeholder={`Message ${coachName}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-400"
            />
            <Button
              variant={isListening ? "danger" : "secondary"}
              size="sm"
              onClick={toggleListening}
              disabled={!recognitionRef.current}
              className={isListening ? "!border-red-400/40 !bg-red-400/10 !text-red-400" : "!border-blue-400/20 !bg-blue-400/10 !text-blue-400"}
            >
              🎤
            </Button>
            <Button
              variant="primary"
              size="md"
              className="!bg-orange-500 !text-black hover:!bg-orange-400"
              onClick={handleAskCoach}
              disabled={coachLoading || !coachInput.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}