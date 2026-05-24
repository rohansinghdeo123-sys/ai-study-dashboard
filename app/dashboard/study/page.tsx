"use client";

import { useAuth } from "@/context/AuthContext";
import {
  AlertState,
  AppIcon,
  EmptyState,
  IconButton,
  LoadingState,
  type AppIconName,
} from "@/components/ui/Polished";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

type CoachRole = "user" | "coach";
type AgentStageId = "drafting" | "reviewing" | "delivering";
type AgentStageStatus = "pending" | "active" | "done";
type StudyMode = "coach" | "revision" | "exam" | "history";
type RevisionType = "summary" | "explain" | "keypoints";

interface CoachMessage {
  role: CoachRole;
  content: string;
  timestamp: string;
}

interface StudyConversation {
  id: string;
  title: string;
  updatedAt: string;
  chapter: string;
  topic: string;
  messages: CoachMessage[];
}

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

interface RevisionTool {
  id: RevisionType;
  title: string;
  detail: string;
  mode: "summary" | "explain" | "keypoints";
  prompt: (topic: string) => string;
}

interface ExamQuestion {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
}

interface ProbableQuestion {
  id: string;
  marks: number;
  question: string;
}

type SpeechRecognitionEventLike = {
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
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const CHAPTERS = [
  {
    label: "Hydrocarbon",
    value: "hydrocarbon",
    topics: [
      { label: "Alkanes", value: "alkanes" },
      { label: "Alkenes", value: "alkenes" },
      { label: "Alkynes", value: "alkynes" },
      { label: "Aromatic Hydrocarbons", value: "aromatics" },
    ],
  },
  {
    label: "Matter",
    value: "matter",
    topics: [
      { label: "Matter Definition", value: "matter_definition" },
      { label: "States of Matter", value: "states_of_matter" },
      { label: "Properties of Matter", value: "properties_of_matter" },
    ],
  },
];

const STAGE_ORDER: AgentStageId[] = ["drafting", "reviewing", "delivering"];

const STUDY_MODES: Array<{ id: StudyMode; label: string; detail: string; icon: AppIconName }> = [
  { id: "coach", label: "Coach", detail: "Ask and continue doubts", icon: "study" },
  { id: "revision", label: "Revision", detail: "Summary, explain, key points", icon: "book" },
  { id: "exam", label: "Exam", detail: "MCQs and probable questions", icon: "check" },
  { id: "history", label: "History", detail: "Resume previous chats", icon: "history" },
];

const REVISION_TOOLS: RevisionTool[] = [
  {
    id: "summary",
    title: "Revision Summary",
    detail: "High-yield notes for quick recall.",
    mode: "summary",
    prompt: (topic) => `Create a concise exam-focused revision summary for ${topic}.`,
  },
  {
    id: "explain",
    title: "Deep Explain",
    detail: "Simple explanation with examples and mistakes.",
    mode: "explain",
    prompt: (topic) => `Explain ${topic} deeply but simply, with examples and common mistakes.`,
  },
  {
    id: "keypoints",
    title: "Key Points",
    detail: "Flashcard-style important points.",
    mode: "keypoints",
    prompt: (topic) => `Extract the most important exam-relevant key points for ${topic}.`,
  },
];

function getHistoryStorageKey(userId?: string) {
  return `agentify-study-history-${userId || "guest"}`;
}

function createConversationId() {
  return `study-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function titleFromMessages(messages: CoachMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "New study conversation";
  return firstUserMessage.length > 54 ? `${firstUserMessage.slice(0, 54)}...` : firstUserMessage;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function cleanSpeechText(value: string) {
  return value
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 900)
    .trim();
}

function resolveTutorVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Google UK English Female",
    "Google US English",
    "Microsoft Zira",
    "Microsoft Hazel",
    "Samantha",
  ];
  for (const name of preferred) {
    const match = voices.find((voice) => voice.name.includes(name));
    if (match) return match;
  }
  return voices.find((voice) => voice.lang.startsWith("en")) || voices[0] || null;
}

function speakTutorResponse(value: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const speechText = cleanSpeechText(value);
  if (!speechText) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speechText);
  const voice = resolveTutorVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-IN";
  utterance.rate = 0.94;
  utterance.pitch = 1.02;
  utterance.volume = 0.92;
  window.speechSynthesis.speak(utterance);
}

function createStages(): AgentStageState[] {
  return [
    {
      id: "drafting",
      agent: "Draft Agent",
      title: "Drafting",
      detail: "Understanding your question and lesson context.",
      status: "pending",
    },
    {
      id: "reviewing",
      agent: "Subject Reviewer",
      title: "Reviewing",
      detail: "Checking clarity, accuracy, and examples.",
      status: "pending",
    },
    {
      id: "delivering",
      agent: "Final Tutor",
      title: "Delivering",
      detail: "Preparing the final answer for you.",
      status: "pending",
    },
  ];
}

function applyStageUpdate(stages: AgentStageState[], update: AgentStagePayload) {
  const activeIndex = STAGE_ORDER.indexOf(update.stage);

  return stages.map((stage) => {
    const stageIndex = STAGE_ORDER.indexOf(stage.id);
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
      status,
      agent: stage.id === update.stage && update.agent ? update.agent : stage.agent,
      title: stage.id === update.stage && update.title ? update.title : stage.title,
      detail: stage.id === update.stage && update.detail ? update.detail : stage.detail,
    };
  });
}

function stripDataPrefix(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^data:\s?/i, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function looksLikeBase64(value: string) {
  const compact = value.trim().replace(/\s/g, "");
  return compact.length > 40 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}

function decodeBase64Utf8(value: string) {
  const binary = window.atob(value.trim().replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseStagePayload(value: string): AgentStagePayload | null {
  const payload = stripDataPrefix(value);
  if (!payload.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(payload) as Partial<AgentStagePayload>;
    if (
      parsed.type === "agent_stage" &&
      parsed.stage &&
      parsed.status &&
      STAGE_ORDER.includes(parsed.stage) &&
      ["pending", "active", "done"].includes(parsed.status)
    ) {
      return parsed as AgentStagePayload;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeAnswerPayload(value: string) {
  const payload = stripDataPrefix(value);
  if (!payload || payload === "[DONE]" || payload.startsWith("{")) return "";

  if (looksLikeBase64(payload)) {
    try {
      return decodeBase64Utf8(payload);
    } catch {
      return payload;
    }
  }

  return payload;
}

function renderInlineChemistry(value: string) {
  const tokenRegex =
    /(sp\d+|[A-Z][a-z]?(?:\d+)?(?:[A-Z][a-z]?(?:\d+)?)*(?:\^[+-]?\d+|\^[+-])?)/g;
  const pieces = value.split(tokenRegex);

  return pieces.map((piece, index) => {
    if (!piece) return null;
    const sp = piece.match(/^sp(\d+)$/);
    if (sp) {
      return (
        <span key={index}>
          sp<sup>{sp[1]}</sup>
        </span>
      );
    }

    const chargeMatch = piece.match(/^(.+)\^([+-]?\d+|[+-])$/);
    const formula = chargeMatch ? chargeMatch[1] : piece;
    const charge = chargeMatch ? chargeMatch[2] : null;
    const atomMatches = [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)];
    const matchedFormula = atomMatches.map((match) => match[0]).join("");

    if (!atomMatches.length || matchedFormula !== formula) {
      return <span key={index}>{piece}</span>;
    }

    return (
      <span key={index}>
        {atomMatches.map((match, atomIndex) => (
          <span key={`${index}-${atomIndex}`}>
            {match[1]}
            {match[2] ? <sub>{match[2]}</sub> : null}
          </span>
        ))}
        {charge ? <sup>{charge}</sup> : null}
      </span>
    );
  });
}

function CoachAnswer({ value }: { value: string }) {
  const blocks = value.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (!blocks.length) return null;

  return (
    <div className="space-y-6">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const heading = lines[0]?.endsWith(":") && lines[0].length <= 72 ? lines[0].replace(/:$/, "") : null;
        const body = heading ? lines.slice(1) : lines;

        return (
          <section key={`${heading || "answer"}-${blockIndex}`} className="space-y-3">
            {heading ? (
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#0E7490]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" />
                {heading}
              </h3>
            ) : null}
            <div className="space-y-3 text-[15.5px] leading-8 text-slate-700">
              {body.map((line, lineIndex) => {
                const bullet = line.match(/^[-*]\s+(.*)$/);
                if (bullet) {
                  return (
                    <div key={lineIndex} className="flex gap-3">
                      <span className="mt-3.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#14B8A6] shadow-[0_0_0_4px_rgba(20,184,166,0.10)]" />
                      <p className="min-w-0">{renderInlineChemistry(bullet[1])}</p>
                    </div>
                  );
                }
                return <p key={lineIndex}>{renderInlineChemistry(line)}</p>;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AgentPipeline({ stages }: { stages: AgentStageState[] }) {
  return (
    <div className="w-full rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,254,255,0.76))] p-4 shadow-[0_22px_70px_rgba(15,23,42,0.09)] backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0E7490]">Agent workflow</p>
          <p className="mt-1 text-sm text-slate-500">Drafting, reviewing, and preparing your final tutor response.</p>
        </div>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
          Live
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {stages.map((stage) => {
          const active = stage.status === "active";
          const done = stage.status === "done";
          return (
            <div
              key={stage.id}
              className={`relative overflow-hidden rounded-3xl border p-4 transition ${
                active
                  ? "scale-[1.015] border-[#0E7490]/30 bg-[#0E7490]/10 shadow-[0_18px_45px_rgba(14,116,144,0.14)]"
                  : done
                  ? "border-emerald-400/30 bg-emerald-400/10"
                  : "border-slate-200/90 bg-white/70"
              }`}
            >
              {active ? <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent" /> : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-950">{stage.title}</p>
                <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-400" : active ? "animate-pulse bg-[#0E7490]" : "bg-slate-300"}`} />
              </div>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{stage.agent}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">{stage.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StarterPromptCard({
  label,
  title,
  detail,
  onClick,
}: {
  label: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[1.7rem] border border-slate-200/80 bg-white/76 p-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#0E7490]/28 hover:bg-white hover:shadow-[0_24px_70px_rgba(14,116,144,0.13)]"
    >
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0E7490]">{label}</span>
      <span className="mt-3 block text-base font-black tracking-tight text-slate-950">{title}</span>
      <span className="mt-2 block text-xs leading-5 text-slate-500">{detail}</span>
    </button>
  );
}

function StudentPromptCard({ content, timestamp }: { content: string; timestamp: string }) {
  return (
    <div className="flex justify-end">
      <article className="max-w-[780px] rounded-[1.7rem] rounded-tr-md bg-[linear-gradient(135deg,#0E7490,#0F8F9F)] px-5 py-4 text-white shadow-[0_24px_65px_rgba(14,116,144,0.22)]">
        <div className="mb-2 flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
          <span>You</span>
          {timestamp ? <span>{timestamp}</span> : null}
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-7">{content}</p>
      </article>
    </div>
  );
}

function TutorActionDock({
  answer,
  topicLabel,
  onPrompt,
}: {
  answer: string;
  topicLabel: string;
  onPrompt: (prompt: string) => void;
}) {
  const actions = [
    {
      label: "Simplify",
      prompt: `Explain ${topicLabel} more simply, like I am learning it for the first time.`,
    },
    {
      label: "Example",
      prompt: `Give me one real-life example for ${topicLabel} and connect it step by step.`,
    },
    {
      label: "Practice",
      prompt: `Ask me one practice question on ${topicLabel}, wait for my answer, then evaluate it.`,
    },
    {
      label: "Exam answer",
      prompt: `Write an exam-ready answer for ${topicLabel} with marks-style structure.`,
    },
    {
      label: "Mistake check",
      prompt: `What mistake might I make in ${topicLabel}, and how do I avoid it?`,
    },
  ];

  return (
    <div className="mt-6 border-t border-slate-200/80 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onPrompt(action.prompt)}
            className="rounded-full border border-slate-200 bg-white/78 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:-translate-y-0.5 hover:border-[#0E7490]/30 hover:text-[#0E7490] hover:shadow-[0_12px_32px_rgba(14,116,144,0.10)]"
          >
            {action.label}
          </button>
        ))}
        <CopyButton value={answer} />
      </div>
    </div>
  );
}

function TutorResponseCard({
  coachName,
  content,
  timestamp,
  topicLabel,
  stages,
  onPrompt,
}: {
  coachName: string;
  content: string;
  timestamp: string;
  topicLabel: string;
  stages: AgentStageState[];
  onPrompt: (prompt: string) => void;
}) {
  const pending = !content.trim();

  return (
    <div className="flex justify-start">
      <article className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/92 shadow-[0_26px_85px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <header className="flex flex-col gap-4 border-b border-slate-200/75 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(236,254,255,0.72))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-sm font-black text-white shadow-[0_18px_45px_rgba(14,116,144,0.20)]">
              {coachName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black tracking-tight text-slate-950">{coachName}</p>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">
                  Tutor
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {pending ? "Preparing a reviewed response" : "Reviewed subject answer"} {timestamp ? `at ${timestamp}` : ""}
              </p>
            </div>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-[11px] font-bold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-[#14B8A6]" />
            {topicLabel}
          </div>
        </header>

        <div className="px-5 py-5 sm:px-7 sm:py-7">
          {pending ? <AgentPipeline stages={stages} /> : <CoachAnswer value={content} />}
          {!pending ? <TutorActionDock answer={content} topicLabel={topicLabel} onPrompt={onPrompt} /> : null}
        </div>
      </article>
    </div>
  );
}

function ModeButton({
  active,
  label,
  detail,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  icon: AppIconName;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={detail}
      className={`study-mode-button flex min-h-[92px] items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? "border-[#0E7490]/30 bg-[#0E7490]/10 text-[#0E7490] shadow-[0_14px_36px_rgba(14,116,144,0.10)]"
          : "border-slate-200 bg-white/64 text-slate-500 hover:border-[#0E7490]/25 hover:text-slate-900"
      }`}
    >
      <span className={`study-mode-icon mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-[#0E7490] text-white" : "bg-slate-100 text-slate-500"}`}>
        <AppIcon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-[11px] leading-4 opacity-75">{detail}</span>
      </span>
    </button>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      title={copied ? "Copied" : "Copy to clipboard"}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <AppIcon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StudyPage() {
  const { user, userId, authLoading, loading, getAuthHeaders } = useAuth() as ReturnType<typeof useAuth> & { authLoading?: boolean };
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const initialTopic = searchParams.get("topic") || "alkanes";

  const [chapter, setChapter] = useState(searchParams.get("chapter") || "hydrocarbon");
  const [topic, setTopic] = useState(initialTopic);
  const [mode, setMode] = useState<StudyMode>("coach");
  const [coachName, setCoachName] = useState("Aria");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [conversations, setConversations] = useState<StudyConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState(createConversationId);
  const [input, setInput] = useState("");
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [stages, setStages] = useState(createStages);
  const [showPipeline, setShowPipeline] = useState(false);
  const [error, setError] = useState("");
  const [revisionContent, setRevisionContent] = useState<Record<RevisionType, string>>({ summary: "", explain: "", keypoints: "" });
  const [revisionLoading, setRevisionLoading] = useState<Record<RevisionType, boolean>>({ summary: false, explain: false, keypoints: false });
  const [revisionError, setRevisionError] = useState("");
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [probableQuestions, setProbableQuestions] = useState<ProbableQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const authBusy = loading || authLoading;
  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];
  const selectedTopic = selectedChapter.topics.find((item) => item.value === topic) || selectedChapter.topics[0];
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const hasPendingCoachMessage = messages.some((message) => message.role === "coach" && !message.content.trim());
  const examScore = examQuestions.reduce((score, question) => score + (examAnswers[question.id] === question.correct ? 1 : 0), 0);
  const answeredExamCount = examQuestions.filter((question) => examAnswers[question.id]).length;

  const starterPrompts = useMemo(
    () => [
      {
        label: "Explain",
        title: `Teach me ${selectedTopic.label}`,
        detail: "Start with a simple concept explanation and example.",
        prompt: `Teach me ${selectedTopic.label} from the basics with one simple example.`,
      },
      {
        label: "Exam",
        title: "Write answer format",
        detail: "Get a clean, marks-ready answer for school exams.",
        prompt: `Write an exam-ready answer on ${selectedTopic.label} with definition, points, example, and common mistake.`,
      },
      {
        label: "Practice",
        title: "Ask one question",
        detail: "Let the tutor test you and review your answer.",
        prompt: `Ask me one intelligent practice question on ${selectedTopic.label}, wait for my answer, then evaluate it.`,
      },
      {
        label: "Plan",
        title: "Create mini plan",
        detail: "Turn this topic into a short study path.",
        prompt: `Create a simple 20-minute study plan for ${selectedTopic.label}.`,
      },
    ],
    [selectedTopic.label],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, showPipeline]);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionCtor()) && typeof window !== "undefined" && Boolean(window.speechSynthesis));
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(getHistoryStorageKey(userId));
      const parsed = stored ? JSON.parse(stored) : [];
      setConversations(Array.isArray(parsed) ? parsed.slice(0, 40) : []);
    } catch {
      setConversations([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !messages.length) return;
    const conversation: StudyConversation = {
      id: currentConversationId,
      title: titleFromMessages(messages),
      updatedAt: new Date().toISOString(),
      chapter,
      topic,
      messages,
    };

    setConversations((current) => {
      const next = [
        conversation,
        ...current.filter((item) => item.id !== currentConversationId),
      ].slice(0, 40);
      localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [chapter, currentConversationId, messages, topic, userId]);

  useEffect(() => {
    if (!userId || authBusy) return;
    let active = true;

    async function loadCoach() {
      try {
        const res = await fetch(`${backendURL}/coach/${userId}`, {
          cache: "no-store",
          headers: await getAuthHeaders(),
        });
        if (!res.ok || !active) return;
        const data = await res.json();
        setCoachName(data?.profile?.coach_name || "Aria");
      } catch {
        if (active) setCoachName("Aria");
      }
    }

    void loadCoach();
    return () => {
      active = false;
    };
  }, [authBusy, backendURL, getAuthHeaders, userId]);

  const handleStagePayload = (payload: AgentStagePayload) => {
    setStages((current) => applyStageUpdate(current, payload));
    setShowPipeline(payload.status !== "done" || payload.stage !== "delivering");
  };

  const updateLastCoachMessage = (content: string) => {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "coach") {
        next[next.length - 1] = { ...last, content, timestamp: getTime() };
      }
      return next;
    });
  };

  const processSseEvent = (raw: string) => {
    const stagePayload = parseStagePayload(raw);
    if (stagePayload) {
      handleStagePayload(stagePayload);
      return "";
    }

    const payload = stripDataPrefix(raw);
    if (payload === "[DONE]") {
      setShowPipeline(false);
      return "";
    }

    const answer = normalizeAnswerPayload(raw);
    if (answer) {
      updateLastCoachMessage(answer);
      setShowPipeline(false);
      return answer;
    }

    return "";
  };

  const sendMessage = async (override?: string, options?: { fromVoice?: boolean }) => {
    const prompt = (override ?? input).trim();
    if (!prompt || !userId || authBusy || loadingAnswer) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    setError("");
    setLoadingAnswer(true);
    setShowPipeline(true);
    setStages(createStages().map((stage) => (stage.id === "drafting" ? { ...stage, status: "active" } : stage)));
    let finalAnswer = "";

    setMessages((current) => [
      ...current,
      { role: "user", content: prompt, timestamp: getTime() },
      { role: "coach", content: "", timestamp: "" },
    ]);

    try {
      const res = await fetch(`${backendURL}/coach/chat/stream`, {
        method: "POST",
        headers: await getAuthHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          user_id: userId,
          message: prompt,
          mode: "coach",
          intent: "study_advice",
          subject: "Chemistry",
          topic,
          session_id: `coach-${userId}`,
        }),
      });

      if (!res.ok) throw new Error(`Coach failed: ${res.status}`);
      if (!res.body) {
        const text = normalizeAnswerPayload(await res.text());
        finalAnswer = text || "I could not read the tutor response. Please try again.";
        updateLastCoachMessage(text || "I could not read the tutor response. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        events.forEach((event) => {
          const answer = processSseEvent(event);
          if (answer) finalAnswer = answer;
        });
      }

      if (buffer.trim()) {
        const answer = processSseEvent(buffer);
        if (answer) finalAnswer = answer;
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("The tutor could not connect. Please try again.");
        finalAnswer = "I could not connect to the tutor service. Please try again in a moment.";
        updateLastCoachMessage(finalAnswer);
      }
    } finally {
      setLoadingAnswer(false);
      setShowPipeline(false);
      if (options?.fromVoice && finalAnswer) speakTutorResponse(finalAnswer);
    }
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setCurrentConversationId(createConversationId());
    setMessages([]);
    setInput("");
    setError("");
    setShowPipeline(false);
    setStages(createStages);
    setMode("coach");
  };

  const clearChat = () => {
    abortRef.current?.abort();
    if (userId) {
      setConversations((current) => {
        const next = current.filter((item) => item.id !== currentConversationId);
        localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(next));
        return next;
      });
    }
    setCurrentConversationId(createConversationId());
    setMessages([]);
    setInput("");
    setError("");
    setShowPipeline(false);
    setStages(createStages);
  };

  const resumeConversation = (conversation: StudyConversation) => {
    setCurrentConversationId(conversation.id);
    setChapter(conversation.chapter || "hydrocarbon");
    setTopic(conversation.topic || "alkanes");
    setMessages(conversation.messages || []);
    setMode("coach");
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
  };

  const startVoiceInput = () => {
    if (!speechSupported || loadingAnswer) return;
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) return;
    recognitionRef.current?.stop();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      setListening(false);
      if (transcript) void sendMessage(transcript, { fromVoice: true });
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const runRevision = async (tool: RevisionTool) => {
    if (!userId || authBusy) return;
    setMode("revision");
    setRevisionError("");
    setRevisionLoading((current) => ({ ...current, [tool.id]: true }));
    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          question: tool.prompt(selectedTopic.label),
          section_id: topic,
          session_id: `revision-${userId}-${topic}-${tool.id}`,
          mode: tool.mode,
          difficulty: "medium",
        }),
      });
      if (!res.ok) throw new Error(`Revision failed: ${res.status}`);
      const data = await res.json();
      setRevisionContent((current) => ({ ...current, [tool.id]: data?.answer || "No revision generated." }));
    } catch {
      setRevisionError("Revision could not be generated. Please try again.");
    } finally {
      setRevisionLoading((current) => ({ ...current, [tool.id]: false }));
    }
  };

  const generateExamPack = async () => {
    if (!userId || authBusy || examLoading) return;
    setMode("exam");
    setExamLoading(true);
    setExamError("");
    setExamSubmitted(false);
    setExamAnswers({});
    try {
      const headers = await getAuthHeaders();
      const [mcqRes, probableRes] = await Promise.all([
        fetch(`${backendURL}/generate-mcqs`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            topic: selectedTopic.label,
            section_id: topic,
            session_id: `exam-${userId}-${topic}-${Date.now()}`,
            difficulty: "medium",
            count: 5,
          }),
        }),
        fetch(`${backendURL}/generate-probable-questions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            topic: selectedTopic.label,
            section_id: topic,
            session_id: `probable-${userId}-${topic}-${Date.now()}`,
            difficulty: "medium",
          }),
        }),
      ]);
      if (!mcqRes.ok || !probableRes.ok) throw new Error("Exam generation failed");
      const mcqData = await mcqRes.json();
      const probableData = await probableRes.json();
      setExamQuestions(Array.isArray(mcqData?.questions) ? mcqData.questions : []);
      setProbableQuestions(Array.isArray(probableData?.questions) ? probableData.questions : []);
    } catch {
      setExamError("Exam pack could not be generated. Please try again.");
    } finally {
      setExamLoading(false);
    }
  };

  const submitExam = async () => {
    if (!examQuestions.length || examSubmitted) return;
    setExamSubmitted(true);
    if (!userId) return;
    setExamSaving(true);
    try {
      await fetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: selectedTopic.label,
          subject: "Chemistry",
          score: examScore,
          total_questions: examQuestions.length,
          xp_earned: examScore * 10,
          time_spent_seconds: 300,
          focus_score: Math.round((examScore / Math.max(1, examQuestions.length)) * 100),
          session_type: "study_exam",
          replay_data: {
            topic: selectedTopic.label,
            source: "study_page_exam",
            questions: examQuestions.map((question) => ({
              id: question.id,
              text: question.question,
              topic: selectedTopic.label,
              options: question.options,
              correct_answer: question.correct,
              user_answer: examAnswers[question.id] || "",
              is_correct: examAnswers[question.id] === question.correct,
              ai_explanation: question.explanation || "",
            })),
            probable_questions: probableQuestions,
          },
        }),
      });
    } catch {
      setExamError("Feedback is ready, but the session could not be saved.");
    } finally {
      setExamSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const wrongExamQuestions = examSubmitted
    ? examQuestions.filter((question) => examAnswers[question.id] !== question.correct)
    : [];
  const threeMarkQuestions = probableQuestions.filter((question) => question.marks !== 5);
  const fiveMarkQuestions = probableQuestions.filter((question) => question.marks === 5);

  if (authBusy) {
    return (
      <LoadingState title="Opening your study room..." detail="Preparing tutor, chapter, topic, and voice tools." />
    );
  }

  return (
    <div className="study-lab-shell flex min-h-[calc(100svh-6.5rem)] w-full flex-col overflow-hidden rounded-[2.2rem] border border-white/50 bg-white/70 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
      <section className="study-lab-header border-b border-white/45 bg-white/64 px-4 py-4 backdrop-blur-2xl sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">Study Lab</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Ask {coachName} anything
              </h1>
              <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">
                {speechSupported ? "Voice ready" : "Text mode"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              One focused place for doubts, revision sheets, exam practice, history, and spoken tutoring.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[620px]">
            <div className="grid gap-2 sm:grid-cols-4">
              {STUDY_MODES.map((item) => (
                <ModeButton
                  key={item.id}
                  active={mode === item.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.icon}
                  onClick={() => setMode(item.id)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 rounded-3xl border border-slate-200/70 bg-white/58 p-2 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Chapter
                </label>
                <select
                  value={chapter}
                  onChange={(event) => {
                    const next = event.target.value;
                    setChapter(next);
                    setTopic(CHAPTERS.find((item) => item.value === next)?.topics[0]?.value || "alkanes");
                  }}
                  className="study-select w-full rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0E7490]"
                >
                  {CHAPTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Topic
                </label>
                <select
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="study-select w-full rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0E7490]"
                >
                  {selectedChapter.topics.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <IconButton
                label="Start a new chat"
                icon="plus"
                onClick={startNewChat}
                className="min-h-[48px] bg-white/78 px-4 py-3 text-slate-700"
              >
                New chat
              </IconButton>
              <IconButton
                label="Clear current chat"
                icon="trash"
                onClick={clearChat}
                disabled={!messages.length}
                className="min-h-[48px] border-rose-200 bg-rose-50 px-4 py-3 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
              >
                Clear
              </IconButton>
            </div>
          </div>
        </div>
      </section>

      <section className="study-lab-main flex min-h-0 flex-1 flex-col">
        {mode === "coach" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="study-chat-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.length === 0 ? (
                <div className="study-empty-state mx-auto flex min-h-[52svh] max-w-4xl flex-col items-center justify-center text-center">
                  <div className="study-coach-avatar flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-xl font-black text-white shadow-[0_20px_55px_rgba(14,116,144,0.24)]">
                    {coachName[0]}
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-[#0E7490]">
                    Private AI tutor
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                    Ask one doubt. Learn it clearly.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
                    Hi {displayName.split(" ")[0]}, start naturally with a question, phrase, or follow-up. {coachName} will answer like a subject expert and keep the conversation connected.
                  </p>
                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                    {starterPrompts.map((starter) => (
                      <StarterPromptCard
                        key={starter.label}
                        label={starter.label}
                        title={starter.title}
                        detail={starter.detail}
                        onClick={() => setInput(starter.prompt)}
                      />
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <IconButton
                      label="Open revision tools"
                      icon="book"
                      onClick={() => setMode("revision")}
                      className="min-h-9 rounded-full bg-white/70 px-4 py-2 text-xs"
                    >
                      Revision tools
                    </IconButton>
                    <IconButton
                      label="Open exam practice"
                      icon="check"
                      onClick={() => setMode("exam")}
                      className="min-h-9 rounded-full bg-white/70 px-4 py-2 text-xs"
                    >
                      Exam practice
                    </IconButton>
                    <IconButton
                      label="Open study history"
                      icon="history"
                      onClick={() => setMode("history")}
                      className="min-h-9 rounded-full bg-white/70 px-4 py-2 text-xs"
                    >
                      History ({conversations.length})
                    </IconButton>
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-5xl space-y-6">
                  {messages.map((message, index) => (
                    message.role === "user" ? (
                      <StudentPromptCard
                        key={`${message.role}-${index}`}
                        content={message.content}
                        timestamp={message.timestamp}
                      />
                    ) : (
                      <TutorResponseCard
                        key={`${message.role}-${index}`}
                        coachName={coachName}
                        content={message.content}
                        timestamp={message.timestamp}
                        topicLabel={selectedTopic.label}
                        stages={stages}
                        onPrompt={setInput}
                      />
                    )
                  ))}

                  {showPipeline && !hasPendingCoachMessage ? (
                    <div className="flex justify-start">
                      <AgentPipeline stages={stages} />
                    </div>
                  ) : null}

                  <div ref={endRef} />
                </div>
              )}
            </div>

            <div className="study-composer border-t border-slate-200/70 bg-white/86 p-4 backdrop-blur-xl">
              <div className="mx-auto w-full max-w-5xl">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white/72 px-3 py-1.5 text-[11px] font-bold text-slate-500">
                      Chapter: <span className="text-slate-800">{selectedChapter.label}</span>
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/72 px-3 py-1.5 text-[11px] font-bold text-slate-500">
                      Topic: <span className="text-slate-800">{selectedTopic.label}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">
                      {speechSupported ? "Voice ready" : "Text ready"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/72 px-3 py-1.5 text-[11px] font-bold text-slate-500">
                      {conversations.length} saved
                    </span>
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-slate-200 bg-white p-2 shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
                  <div className="flex items-end gap-2 sm:gap-3">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={listening ? "Listening..." : `Message ${coachName}...`}
                    className="study-textarea max-h-40 min-h-12 flex-1 resize-none rounded-2xl bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={listening ? stopVoiceInput : startVoiceInput}
                    disabled={!speechSupported || loadingAnswer}
                    title={listening ? "Stop voice input" : "Start voice input"}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      listening
                        ? "bg-emerald-500 text-white"
                        : "border border-slate-200 bg-white/80 text-slate-700 hover:border-[#0E7490]/30 hover:text-[#0E7490]"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    <AppIcon name={listening ? "x" : "mic"} />
                    <span>{listening ? "Stop" : "Voice"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={loadingAnswer || !input.trim()}
                    title="Send message"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <AppIcon name="send" />
                    <span>{loadingAnswer ? "Thinking" : "Send"}</span>
                  </button>
                  </div>
                </div>
                {!speechSupported ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Voice is available in browsers that support speech recognition and speech synthesis.
                  </p>
                ) : null}
                {error ? <div className="mt-2"><AlertState message={error} /></div> : null}
              </div>
            </div>
          </div>
        ) : null}

        {mode === "revision" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
              {REVISION_TOOLS.map((tool) => (
                <article
                  key={tool.id}
                  className="study-content-card flex min-h-[520px] flex-col rounded-[2rem] border border-white/60 bg-white/82 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.09)] backdrop-blur-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">{tool.id}</p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-950">{tool.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{tool.detail}</p>
                    </div>
                    <CopyButton value={revisionContent[tool.id]} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void runRevision(tool)}
                    disabled={revisionLoading[tool.id]}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0E7490] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-wait disabled:opacity-55"
                  >
                    <AppIcon name="spark" />
                    <span>{revisionLoading[tool.id] ? "Generating..." : `Generate ${tool.title}`}</span>
                  </button>

                  <div className="mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-white/70 p-4">
                    {revisionContent[tool.id] ? (
                      <CoachAnswer value={revisionContent[tool.id]} />
                    ) : (
                      <EmptyState
                        icon="book"
                        title={`No ${tool.title.toLowerCase()} yet`}
                        detail={`Generate it for ${selectedTopic.label}. Students can copy it directly into notes.`}
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
            {revisionError ? <div className="mx-auto mt-4 max-w-7xl"><AlertState message={revisionError} /></div> : null}
          </div>
        ) : null}

        {mode === "exam" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[1.45fr_0.55fr]">
              <section className="study-content-card rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0E7490]">Exam Lab</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">5-question check for {selectedTopic.label}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Generate one focused MCQ set, answer it once, then review feedback, common mistakes, and probable theory questions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateExamPack()}
                    disabled={examLoading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-wait disabled:opacity-55"
                  >
                    <AppIcon name="spark" />
                    <span>{examLoading ? "Generating..." : "Generate exam pack"}</span>
                  </button>
                </div>

                {examQuestions.length ? (
                  <div className="mt-6 space-y-4">
                    {examQuestions.map((question, index) => {
                      const selected = examAnswers[question.id];
                      const correct = examSubmitted && selected === question.correct;
                      return (
                        <article key={question.id} className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0E7490]/10 text-sm font-bold text-[#0E7490]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-semibold leading-7 text-slate-900">{question.question}</p>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                {question.options.map((option) => {
                                  const optionKey = option.trim().slice(0, 1).toUpperCase();
                                  const isSelected = selected === optionKey;
                                  const isCorrectOption = examSubmitted && question.correct === optionKey;
                                  return (
                                    <button
                                      key={`${question.id}-${optionKey}`}
                                      type="button"
                                      onClick={() => {
                                        if (!examSubmitted) {
                                          setExamAnswers((current) => ({ ...current, [question.id]: optionKey }));
                                        }
                                      }}
                                      disabled={examSubmitted}
                                      className={`rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition ${
                                        isCorrectOption
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                          : isSelected
                                          ? "border-[#0E7490]/40 bg-[#0E7490]/10 text-[#0E7490]"
                                          : "border-slate-200 bg-white/75 text-slate-700 hover:border-[#0E7490]/30"
                                      }`}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                              {examSubmitted ? (
                                <div className={`mt-4 rounded-2xl border p-4 ${correct ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                                  <p className={`text-sm font-bold ${correct ? "text-emerald-700" : "text-amber-800"}`}>
                                    {correct ? "Correct understanding" : `Review needed. Correct answer: ${question.correct}`}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-700">
                                    {question.explanation || "Revisit the core definition, compare the options, and notice the exact concept tested in this question."}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-8">
                    <EmptyState
                      icon="check"
                      title="Your exam pack is not generated yet"
                      detail="Create 5 MCQs from the selected topic, then submit once to unlock feedback and likely theory questions."
                    />
                  </div>
                )}

                {examQuestions.length ? (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Answered {answeredExamCount}/{examQuestions.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => void submitExam()}
                      disabled={examSubmitted || answeredExamCount !== examQuestions.length}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <AppIcon name={examSubmitted ? "check" : "send"} />
                      <span>{examSaving ? "Saving..." : examSubmitted ? "Submitted" : "Submit and review"}</span>
                    </button>
                  </div>
                ) : null}
                {examError ? <div className="mt-3"><AlertState message={examError} /></div> : null}
              </section>

              <aside className="space-y-5">
                <section className="study-side-card rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.09)] backdrop-blur-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Score</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-5xl font-semibold text-slate-950">{examSubmitted ? examScore : "-"}</span>
                    <span className="pb-2 text-sm text-slate-500">/ {examQuestions.length || 5}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {examSubmitted
                      ? examScore >= 4
                        ? "Strong. Move to probable theory answers next."
                        : "Good diagnostic. Revise the weak points and try one more set."
                      : "Submit all 5 answers to get complete feedback."}
                  </p>
                </section>

                {examSubmitted ? (
                  <section className="study-side-card rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.09)] backdrop-blur-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Common mistakes</p>
                    {wrongExamQuestions.length ? (
                      <div className="mt-4 space-y-3">
                        {wrongExamQuestions.map((question) => (
                          <div key={`mistake-${question.id}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">{question.id}: option {examAnswers[question.id] || "not answered"}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              Correct is {question.correct}. Check the exact keyword in the question before choosing.
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-slate-500">No common mistake detected in this attempt.</p>
                    )}
                  </section>
                ) : null}

                <section className="study-side-card rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.09)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">Probable questions</p>
                    <CopyButton
                      value={probableQuestions.map((question) => `${question.id} (${question.marks} marks): ${question.question}`).join("\n")}
                    />
                  </div>
                  {probableQuestions.length ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">3 marks</p>
                        <div className="mt-2 space-y-2">
                          {threeMarkQuestions.map((question) => (
                            <p key={question.id} className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm leading-6 text-slate-700">
                              {question.question}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">5 marks</p>
                        <div className="mt-2 space-y-2">
                          {fiveMarkQuestions.map((question) => (
                            <p key={question.id} className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm leading-6 text-slate-700">
                              {question.question}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-500">
                      Probable 3-mark and 5-mark questions will appear after generating the exam pack.
                    </p>
                  )}
                </section>
              </aside>
            </div>
          </div>
        ) : null}

        {mode === "history" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-6xl">
              <div className="study-content-card rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0E7490]">Conversation history</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Continue any previous doubt</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {conversations.length} saved conversations are stored on this device for quick continuation.
                    </p>
                  </div>
                  <IconButton
                    label="Start fresh study chat"
                    icon="plus"
                    onClick={startNewChat}
                    className="border-[#0E7490] bg-[#0E7490] px-5 py-3 text-white hover:border-[#0B5F76] hover:bg-[#0B5F76] hover:text-white"
                  >
                    Start fresh chat
                  </IconButton>
                </div>

                <div className="mt-6 grid gap-3">
                  {conversations.length ? (
                    conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => resumeConversation(conversation)}
                        className="rounded-3xl border border-slate-200 bg-white/74 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#0E7490]/25 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900">{conversation.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                              {conversation.chapter} / {conversation.topic}
                            </p>
                          </div>
                          <div className="flex gap-2 text-xs text-slate-500">
                            <span>{conversation.messages.length} messages</span>
                            <span>
                              {new Date(conversation.updatedAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      icon="history"
                      title="No study history yet"
                      detail="Ask your first question in Coach mode. It will be saved here automatically."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
