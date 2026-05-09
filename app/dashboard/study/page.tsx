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

// Glass‑morphism panel – same as TerminalPanel but with backdrop blur
function GlassPanel({
  title,
  tag,
  children,
  className = "",
  headerRight,
}: {
  title: string;
  tag?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {title}
          </span>
          {tag ? (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-400">
              {tag}
            </span>
          ) : null}
        </div>
        {headerRight}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Shimmer skeleton loader
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />
  );
}

// Floating +XP animation
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

// Achievement toast
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

// Coach typing indicator (three bouncing dots)
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
// Main Study Page
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

  // ----- UI state (new additions) -----
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusChat, setFocusChat] = useState(false);
  const [xpAnimation, setXpAnimation] = useState<{ amount: number; key: number } | null>(null);
  const [achievements, setAchievements] = useState<{ title: string; subtitle: string; key: number }[]>([]);
  const [dailyGoal] = useState(30); // target questions per day
  const [dailyQuestions, setDailyQuestions] = useState(0); // track answered today

  // ----- Core state (unchanged) -----
  const urlChapter = searchParams.get("chapter") || "hydrocarbon";
  const urlTopic = searchParams.get("topic") || "alkanes";

  const [chapter, setChapter] = useState(urlChapter);
  const [topic, setTopic] = useState(urlTopic);

  const chapters = ["hydrocarbon"];
  const topicsByChapter: Record<string, { label: string; value: string }[]> = {
    hydrocarbon: [
      { label: "Alkanes", value: "alkanes" },
      { label: "Alkenes", value: "alkenes" },
      { label: "Alkynes", value: "alkynes" },
      { label: "Aromatic Hydrocarbons", value: "aromatics" },
    ],
  };

  const [mode, setMode] = useState<"revision" | "exam">("revision");
  const [activeRevisionTab, setActiveRevisionTab] = useState<"summary" | "explain" | "key">("summary");

  const [revisionOutput, setRevisionOutput] = useState("");
  const [probableOutput, setProbableOutput] = useState("");
  const [examStatus, setExamStatus] = useState("");

  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [coachSignal, setCoachSignal] = useState<CoachDailySignal | null>(null);
  const [coachMemories, setCoachMemories] = useState<CoachMemory[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachBooting, setCoachBooting] = useState(false);
  const [coachStatus, setCoachStatus] = useState("");

  const [loadingRevision, setLoadingRevision] = useState(false);
  const [loadingExam, setLoadingExam] = useState(false);

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [score, setScore] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [progress, setProgress] = useState<ProgressState>({
    totalTests: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    xp: 0,
    streak: 0,
  });

  // Derived stats
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

  const nextBestAction =
    coachProfile?.next_best_action ||
    coachSignal?.recommended_action ||
    "Complete one focused question set, then review only incorrect answers.";
  const dailyStrategy =
    coachProfile?.daily_strategy ||
    coachSignal?.coach_focus ||
    "Study in short blocks: attempt, check, revise, then retry weak concepts.";

  // ----- Helpers (unchanged) -----
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

  // Scroll chat to bottom
  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachMessages, coachLoading]);

  // Keyboard shortcuts (unchanged)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      switch (e.key) {
        case "1": e.preventDefault(); if (mode === "revision") handleRevision("summary"); break;
        case "2": e.preventDefault(); if (mode === "revision") handleRevision("explain"); break;
        case "3": e.preventDefault(); if (mode === "revision") handleRevision("key"); break;
        case "g": e.preventDefault(); if (mode === "exam") generateMCQs(); break;
        case "p": e.preventDefault(); if (mode === "exam") generateProbable(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chapter, topic, userId, authLoading]);

  const authHeaders = async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const token = await user?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
    return headers;
  };

  // ----- Data fetching (unchanged) -----
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
    } catch {
      console.log("Progress fetch error");
    }
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
    } catch {
      setCoachStatus("COACH_CONNECTION_ERROR");
    }
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
    } catch {
      setCoachStatus("COACH_BOOTSTRAP_FAILED");
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  useEffect(() => {
    setRevisionOutput("");
    setProbableOutput("");
    setExamStatus("");
    setSelectedAnswers({});
    setScore(0);
    setMcqs([]);
    sessionStartTime.current = Date.now();
  }, [chapter, topic]);

  // ----- Gamification helpers (NEW) -----
  const showXpAnimation = useCallback((amount: number) => {
    setXpAnimation({ amount, key: Date.now() });
  }, []);

  const triggerAchievement = useCallback((title: string, subtitle: string) => {
    setAchievements((prev) => [...prev, { title, subtitle, key: Date.now() }]);
  }, []);

  // ----- Core logic (unchanged except where noted) -----
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
      topic,
      source: "ai_generated",
      questions: mcqs.map((q, idx) => ({
        id: q.id,
        text: q.question,
        topic: q.topic || topic,
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
          topic,
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

        // Gamification: add to daily count, show XP animation
        setDailyQuestions((prev) => prev + totalQuestions);
        showXpAnimation(xpEarned);

        // Achievements
        if (progress.streak >= 5) {
          triggerAchievement("5‑Day Streak!", "You're on fire. Keep the momentum.");
        }
        if (accuracy >= 80) {
          triggerAchievement("High Accuracy", "80%+ correct answers — precision mode.");
        }
        if (progress.totalQuestions + totalQuestions >= 100) {
          triggerAchievement("Century Milestone", "You've answered 100+ questions. Serious dedication.");
        }
      }
    } catch (e) {
      console.error("Failed to save results", e);
    }
  };

  const handleRevision = async (type: "summary" | "explain" | "key") => {
    if (!userId || authLoading) return;
    setLoadingRevision(true);
    setActiveRevisionTab(type);
    const question =
      type === "summary"
        ? `Generate a smart summary of ${topic}`
        : type === "explain"
          ? `Explain ${topic} clearly with examples`
          : `Give key revision bullet points of ${topic}`;
    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, section_id: topic, session_id: `revision-${userId}-${topic}`, mode: type, difficulty: "medium" }),
      });
      const data = await res.json();
      setRevisionOutput(data.answer || "No response from terminal.");
    } catch {
      setRevisionOutput("CONNECTION_ERROR: AI service unreachable.");
    }
    setLoadingRevision(false);
  };

  const generateMCQs = async () => {
    if (!userId || authLoading) return;
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
        body: JSON.stringify({ topic, section_id: topic, session_id: `exam-${userId}-${topic}`, difficulty: "medium", count: 10 }),
      });
      const data = await res.json();
      const questions = Array.isArray(data.questions) ? data.questions : [];
      setMcqs(questions);
      setExamStatus(questions.length ? "" : data.raw_answer || "NO_MCQ_PAYLOAD_RETURNED");
      sessionStartTime.current = Date.now();
    } catch {
      setMcqs([]);
      setExamStatus("CONNECTION_ERROR: Failed to generate MCQs.");
    }
    setLoadingExam(false);
  };

  const generateProbable = async () => {
    if (!userId || authLoading) return;
    setLoadingExam(true);
    setExamStatus("");
    setMcqs([]);
    setSelectedAnswers({});
    setScore(0);
    try {
      const res = await fetch(`${backendURL}/generate-probable-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, section_id: topic, session_id: `probable-${userId}-${topic}`, difficulty: "medium" }),
      });
      const data = await res.json();
      setProbableOutput(data.text || data.raw_answer || "");
    } catch {
      setProbableOutput("CONNECTION_ERROR: Failed to generate questions.");
    }
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

  const handleAskCoach = async () => {
    if (!coachInput.trim() || !userId || authLoading || coachLoading) return;
    const query = coachInput.trim();
    const userMsg: CoachMessage = {
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setCoachMessages((prev) => [...prev, userMsg]);
    setCoachInput("");
    setCoachLoading(true);
    try {
      const res = await fetch(`${backendURL}/coach/chat`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          user_id: userId,
          message: query,
          mode: "coach",
          intent: "study_advice",
          subject: "Chemistry",
          topic,
          session_id: `coach-${userId}`,
        }),
      });
      const data = await res.json();
      setCoachMessages((prev) => [
        ...prev,
        {
          role: "coach",
          content: data.answer || "I am online, but I could not generate a complete coaching response.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setCoachProfile((prev) => ({
        ...(prev || {}),
        coach_id: data.coach_id || prev?.coach_id,
        coach_name: data.coach_name || prev?.coach_name,
        next_best_action: data.next_best_action || prev?.next_best_action,
        daily_strategy: data.daily_strategy || prev?.daily_strategy,
      }));
    } catch {
      setCoachMessages((prev) => [
        ...prev,
        { role: "coach", content: "COACH_CONNECTION_ERROR: I could not reach the coaching agent.", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
    }
    setCoachLoading(false);
  };

  const handleCoachKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskCoach();
    }
  };

  const applyNextBestAction = () => {
    setCoachInput(nextBestAction);
    coachInputRef.current?.focus();
  };

  // Focus chat mode toggle
  const toggleFocusChat = () => setFocusChat((prev) => !prev);

  // ------------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0A0A0F] text-gray-200">
      {/* Global styles for float animations */}
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
      `}</style>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-green-500/30 bg-black/80 px-5 py-2.5 text-sm text-green-400 backdrop-blur-md animate-in slide-in-from-bottom">
          {toast}
        </div>
      )}

      {/* Achievements stack */}
      {achievements.map((a) => (
        <AchievementToast
          key={a.key}
          title={a.title}
          subtitle={a.subtitle}
          onClose={() => setAchievements((prev) => prev.filter((x) => x.key !== a.key))}
        />
      ))}

      {/* Top navigation bar */}
      <header className="z-10 flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 text-gray-400 hover:border-white/40 hover:text-white"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="flex items-center gap-5 text-xs font-medium">
            <span className="text-gray-500">MODULE <span className="text-orange-400">{chapter.toUpperCase()}</span></span>
            <span className="text-gray-500">TOPIC <span className="text-orange-400">{topic.toUpperCase()}</span></span>
            <span className="text-gray-500">MODE <span className="text-blue-400">{mode.toUpperCase()}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs">
          {/* Daily goal ring */}
          <div className="relative flex items-center gap-1.5">
            <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
              <circle
                cx="12" cy="12" r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-green-500"
                strokeDasharray={`${(dailyQuestions / dailyGoal) * 63} 63`}
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            </svg>
            <span className="text-gray-400">{dailyQuestions}/{dailyGoal}</span>
          </div>
          <span className="text-gray-500">XP <span className="text-green-400">{progress.xp}</span></span>
          <span className="text-gray-500">LVL <span className="text-orange-400">{level}</span></span>
          <span className="text-gray-500">ACC <span className="text-green-400">{accuracy}%</span></span>
          <span className="text-gray-500">STREAK <span className="text-orange-400">{progress.streak}d</span></span>
          <span className="flex items-center gap-1 text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> LIVE
          </span>
        </div>
      </header>

      {/* Main layout */}
      <div className={`flex flex-1 overflow-hidden transition-all duration-300 ${focusChat ? "flex-col" : ""}`}>
        {/* ---- SIDEBAR (collapsible) ---- */}
        {!focusChat && (
          <aside
            className={`overflow-y-auto border-r border-white/10 bg-[#0A0A0F] transition-all duration-300 ${
              sidebarOpen ? "w-72 min-w-[18rem]" : "w-0 min-w-0 overflow-hidden border-0"
            }`}
          >
            {sidebarOpen && (
              <div className="flex flex-col gap-4 p-4">
                <GlassPanel title="Section_Select" tag="NAV">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase text-gray-600">Chapter</label>
                      <select
                        value={chapter}
                        onChange={(e) => {
                          const c = e.target.value;
                          setChapter(c);
                          const t = topicsByChapter[c]?.[0]?.value ?? "alkanes";
                          setTopic(t);
                          updateURL(c, t);
                        }}
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                      >
                        {chapters.map((c) => (
                          <option key={c} value={c}>{c.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase text-gray-600">Topic</label>
                      <div className="space-y-1.5">
                        {topicsByChapter[chapter]?.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => { setTopic(t.value); updateURL(chapter, t.value); }}
                            className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                              topic === t.value
                                ? "border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-[0_0_8px_rgba(255,165,0,0.15)]"
                                : "border-white/10 bg-black/30 text-gray-400 hover:border-white/30 hover:text-white"
                            }`}
                          >
                            {t.label.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassPanel>

                <GlassPanel title="Mode_Config" tag="CTL">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setMode("revision")}
                        className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                          mode === "revision"
                            ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.2)]"
                            : "border-white/10 bg-black/30 text-gray-500"
                        }`}
                      >
                        REVISION
                      </button>
                      <button
                        onClick={() => setMode("exam")}
                        className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                          mode === "exam"
                            ? "border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-[0_0_8px_rgba(255,165,0,0.2)]"
                            : "border-white/10 bg-black/30 text-gray-500"
                        }`}
                      >
                        EXAM LAB
                      </button>
                    </div>
                    {mode === "revision" && (
                      <div className="space-y-1.5 pt-1">
                        {(["summary", "explain", "key"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleRevision(type)}
                            disabled={loadingRevision || authLoading}
                            className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                              activeRevisionTab === type
                                ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.15)]"
                                : "border-white/10 bg-black/30 text-gray-400 hover:border-white/30 hover:text-white"
                            } disabled:opacity-50`}
                          >
                            {type === "summary" ? "SMART_SUMMARY" : type === "explain" ? "DEEP_EXPLAIN" : "KEY_POINTS"}
                          </button>
                        ))}
                      </div>
                    )}
                    {mode === "exam" && (
                      <div className="space-y-1.5 pt-1">
                        <button
                          onClick={generateMCQs}
                          disabled={loadingExam || authLoading}
                          className="w-full rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2.5 text-left text-xs font-bold text-orange-400 transition-all hover:bg-orange-500/20 disabled:opacity-50"
                        >
                          GENERATE_MCQ
                        </button>
                        <button
                          onClick={generateProbable}
                          disabled={loadingExam || authLoading}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-left text-xs text-gray-400 transition-all hover:border-orange-500/40 hover:text-orange-400 disabled:opacity-50"
                        >
                          PROBABLE_QUESTIONS
                        </button>
                      </div>
                    )}
                  </div>
                </GlassPanel>

                <GlassPanel title="Session_Stats" tag="SYS">
                  <div className="space-y-3">
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] uppercase text-gray-500">Level</span>
                      <span className="text-sm font-bold text-orange-400">LVL {level}</span>
                      {xpAnimation && (
                        <XPFloat key={xpAnimation.key} amount={xpAnimation.amount} />
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-700"
                        style={{ width: `${xpProgressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>{progress.xp} XP</span>
                      <span>{100 - xpProgressPercent} to LVL {level + 1}</span>
                    </div>
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">TESTS</span>
                        <span>{progress.totalTests}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">ACCURACY</span>
                        <span className={`font-bold ${accuracy >= 75 ? "text-green-400" : accuracy >= 50 ? "text-orange-400" : "text-red-400"}`}>
                          {accuracy}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">STREAK</span>
                        <span className="text-orange-400">{progress.streak} days</span>
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </div>
            )}
          </aside>
        )}

        {/* ---- MIDDLE (Main content) ---- */}
        {!focusChat && (
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#0A0A0F] p-4">
            {mode === "revision" ? (
              <GlassPanel
                title="Revision_Output"
                tag={activeRevisionTab.toUpperCase()}
                className="flex-1"
                headerRight={
                  <div className="flex items-center gap-2">
                    {revisionOutput && (
                      <button
                        onClick={handleCopyRevision}
                        className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-gray-400 hover:border-green-400/40 hover:text-green-400"
                      >
                        COPY
                      </button>
                    )}
                    {loadingRevision ? (
                      <span className="text-xs text-orange-400 animate-pulse">PROCESSING...</span>
                    ) : revisionOutput ? (
                      <span className="text-xs text-green-400">READY</span>
                    ) : null}
                  </div>
                }
              >
                {loadingRevision ? (
                  <div className="space-y-3 p-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : revisionOutput ? (
                  <div className="text-sm leading-relaxed text-gray-300">
                    <ChemistryBlock value={revisionOutput} />
                  </div>
                ) : (
                  <p className="p-4 text-sm text-gray-600">
                    Select a revision mode from the left panel to begin.
                  </p>
                )}
              </GlassPanel>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                {mcqs.length > 0 && (
                  <GlassPanel
                    title="MCQ_Engine"
                    tag={`${answeredCount}/${mcqs.length}`}
                    headerRight={
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${answeredCount === mcqs.length ? "text-green-400" : "text-gray-500"}`}>
                          SCORE: {score}/{mcqs.length}
                        </span>
                        <button
                          onClick={restartGeneratedMcqs}
                          className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-gray-400 hover:border-orange-400/40 hover:text-orange-400"
                        >
                          RESTART
                        </button>
                      </div>
                    }
                  >
                    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
                      {mcqs.map((q, index) => (
                        <div key={q.id ?? index} className="rounded-lg border border-white/10 bg-black/20 p-4">
                          <h3 className="mb-3 text-sm text-white">
                            <span className="mr-2 text-orange-400">Q{index + 1}.</span>
                            {renderChemistryText(q.question)}
                          </h3>
                          <div className="space-y-2">
                            {q.options.map((opt, i) => {
                              const letter = opt.charAt(0).toUpperCase();
                              const selected = selectedAnswers[index];
                              const isCorrect = letter === q.correct;
                              const isSelected = selected === letter;
                              return (
                                <button
                                  key={i}
                                  onClick={() => handleAnswerSelect(index, letter, q.correct)}
                                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                                    selected
                                      ? isCorrect
                                        ? "border-green-500/50 bg-green-500/10 text-green-400"
                                        : isSelected
                                          ? "border-red-500/50 bg-red-500/10 text-red-400"
                                          : "border-white/10 bg-black/30 text-gray-500"
                                      : "border-white/10 bg-black/30 text-gray-300 hover:border-white/30 hover:text-white"
                                  }`}
                                >
                                  {renderChemistryText(opt)}
                                </button>
                              );
                            })}
                          </div>
                          {selectedAnswers[index] && (
                            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                              {selectedAnswers[index] === q.correct ? (
                                <p className="text-xs font-bold text-green-400">CORRECT</p>
                              ) : (
                                <p className="text-xs font-bold text-red-400">INCORRECT - Answer: {q.correct}</p>
                              )}
                              {q.explanation && (
                                <div className="mt-1 text-xs text-gray-500">
                                  <ChemistryBlock value={q.explanation} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                )}
                {probableOutput && (
                  <GlassPanel title="Probable_Questions" tag="EXAM_PREP">
                    <div className="text-sm leading-relaxed text-gray-300">
                      <ChemistryBlock value={probableOutput} />
                    </div>
                  </GlassPanel>
                )}
                {loadingExam && !mcqs.length && !probableOutput && (
                  <GlassPanel title="Exam_Engine" tag="LOADING">
                    <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                      <div className="h-3 w-3 animate-spin rounded-full border border-orange-400 border-t-transparent" />
                      <span className="text-sm">Generating exam content...</span>
                    </div>
                  </GlassPanel>
                )}
                {!loadingExam && !mcqs.length && !probableOutput && (
                  <GlassPanel title="Exam_Engine" tag="STANDBY">
                    <p className="py-10 text-center text-sm text-gray-600">
                      {examStatus || "Select GENERATE_MCQ or PROBABLE_QUESTIONS from the left panel."}
                    </p>
                  </GlassPanel>
                )}
              </div>
            )}
          </main>
        )}

        {/* ---- RIGHT: AI COACH (always visible, expands in focus mode) ---- */}
        <aside
          className={`flex min-h-0 flex-col border-l border-white/10 bg-[#0A0A0F] ${
            focusChat ? "flex-1" : "w-96 min-w-[24rem]"
          }`}
        >
          <GlassPanel
            title="AI_Coach"
            tag={coachName.toUpperCase()}
            className="flex flex-1 flex-col"
            headerRight={
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFocusChat}
                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-gray-400 hover:border-blue-400/40 hover:text-blue-400"
                  title={focusChat ? "Exit focus mode" : "Focus chat"}
                >
                  {focusChat ? "⊠" : "⊡"}
                </button>
                <span className={`text-xs ${coachStatus === "COACH_ONLINE" ? "text-green-400" : "text-orange-400"}`}>
                  {coachStatus || "INIT"}
                </span>
                <button
                  onClick={() => userId && loadCoachDashboard(userId)}
                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-gray-400 hover:border-orange-400/40 hover:text-orange-400"
                >
                  SYNC
                </button>
                <button
                  onClick={() => setCoachMessages([])}
                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-red-400 hover:border-red-500/40"
                >
                  CLEAR
                </button>
              </div>
            }
          >
            <div className="flex flex-1 flex-col space-y-4">
              {/* Coach info cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] text-gray-600">Coach</p>
                  <p className="text-sm font-bold text-orange-400">{coachName}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3" title="Stored memories">
                  <p className="text-[10px] text-gray-600">Memory</p>
                  <p className="text-sm font-bold">{coachMemories.length}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] text-gray-600">Signal</p>
                  <p className="text-sm font-bold text-green-400">{coachSignal ? "ACTIVE" : "PENDING"}</p>
                </div>
              </div>

              {/* Next Best Action (clickable) */}
              <div
                onClick={applyNextBestAction}
                className="cursor-pointer rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 transition-all hover:border-orange-400/40 hover:bg-orange-500/10"
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-orange-400">Next Best Action</p>
                <ChemistryBlock value={nextBestAction} className="text-sm text-gray-300" />
                <p className="mt-2 text-right text-[10px] text-gray-600">Click to ask coach →</p>
              </div>

              {/* Chat area */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-white/5 bg-black/20">
                {/* Messages */}
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {coachMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-gray-600">
                      <p>
                        <span className="text-orange-400">{coachName}</span> is ready. Ask about your study plan, weak topics, or exam strategies.
                      </p>
                    </div>
                  ) : (
                    coachMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`flex max-w-[85%] gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            msg.role === "user" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                          }`}>
                            {msg.role === "user" ? "U" : coachName[0]}
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`text-xs font-semibold ${msg.role === "user" ? "text-blue-400" : "text-orange-400"}`}>
                                {msg.role === "user" ? "You" : coachName}
                              </span>
                              <span className="text-[10px] text-gray-600">{msg.timestamp}</span>
                            </div>
                            <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-blue-500/10 text-blue-100"
                                : "bg-white/5 text-gray-200"
                            }`}>
                              <ChemistryBlock value={msg.content} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {coachLoading && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">
                        {coachName[0]}
                      </div>
                      <div className="rounded-xl bg-white/5 px-4 py-3">
                        <CoachTyping />
                      </div>
                    </div>
                  )}
                  <div ref={coachEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-white/10 p-3">
                  <div className="mb-2 flex gap-2">
                    {["What should I study next?", "Find my weakest area.", "Make a 30 min revision plan."].map((p) => (
                      <button
                        key={p}
                        onClick={() => setCoachInput(p)}
                        className="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-gray-400 hover:border-orange-400/30 hover:text-orange-400"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      ref={coachInputRef}
                      value={coachInput}
                      onChange={(e) => setCoachInput(e.target.value)}
                      onKeyDown={handleCoachKeyDown}
                      placeholder={`Message ${coachName}...`}
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-400"
                    />
                    <button
                      onClick={handleAskCoach}
                      disabled={coachLoading || !coachInput.trim() || authLoading}
                      className="rounded-lg bg-orange-500 px-5 text-xs font-bold text-black transition-all hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      SEND
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}