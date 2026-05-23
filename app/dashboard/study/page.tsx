"use client";

import { useAuth } from "@/context/AuthContext";
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

interface CoachMessage {
  role: CoachRole;
  content: string;
  timestamp: string;
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
    <div className="space-y-5">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const heading = lines[0]?.endsWith(":") && lines[0].length <= 72 ? lines[0].replace(/:$/, "") : null;
        const body = heading ? lines.slice(1) : lines;

        return (
          <section key={`${heading || "answer"}-${blockIndex}`} className="space-y-2">
            {heading ? (
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#0E7490]">
                {renderInlineChemistry(heading)}
              </h3>
            ) : null}
            <div className="space-y-2 text-[15px] leading-7 text-slate-700">
              {body.map((line, lineIndex) => {
                const bullet = line.match(/^[-*]\s+(.*)$/);
                if (bullet) {
                  return (
                    <div key={lineIndex} className="flex gap-2">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#14B8A6]" />
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
    <div className="w-full max-w-2xl rounded-3xl border border-white/60 bg-white/78 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
      <div className="grid gap-2 sm:grid-cols-3">
        {stages.map((stage) => {
          const active = stage.status === "active";
          const done = stage.status === "done";
          return (
            <div
              key={stage.id}
              className={`rounded-2xl border p-3 transition ${
                active
                  ? "border-[#0E7490]/25 bg-[#0E7490]/10"
                  : done
                  ? "border-emerald-400/25 bg-emerald-400/10"
                  : "border-slate-200/80 bg-white/55"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{stage.title}</p>
                <span className={`h-2 w-2 rounded-full ${done ? "bg-emerald-400" : active ? "animate-pulse bg-[#0E7490]" : "bg-slate-300"}`} />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{stage.agent}</p>
            </div>
          );
        })}
      </div>
    </div>
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
  const [coachName, setCoachName] = useState("Aria");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [stages, setStages] = useState(createStages);
  const [showPipeline, setShowPipeline] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const authBusy = loading || authLoading;
  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];
  const selectedTopic = selectedChapter.topics.find((item) => item.value === topic) || selectedChapter.topics[0];
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const hasCoachResponse = messages.some((message) => message.role === "coach" && message.content.trim().length > 0);

  const quickActions = useMemo(
    () => [
      {
        label: "Need simpler explanation?",
        prompt: `Explain ${selectedTopic.label} in a simpler way with a very easy real-life example.`,
      },
      {
        label: "Show live example",
        prompt: `Show a live example of ${selectedTopic.label} and connect every step to the concept.`,
      },
      {
        label: "Practice this concept",
        prompt: `Give me one practice question on ${selectedTopic.label}, wait for my answer, then check it.`,
      },
      {
        label: "Common mistake",
        prompt: `What common mistake do students make in ${selectedTopic.label}, and how can I avoid it?`,
      },
    ],
    [selectedTopic.label],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, showPipeline]);

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
      return;
    }

    const payload = stripDataPrefix(raw);
    if (payload === "[DONE]") {
      setShowPipeline(false);
      return;
    }

    const answer = normalizeAnswerPayload(raw);
    if (answer) {
      updateLastCoachMessage(answer);
      setShowPipeline(false);
    }
  };

  const sendMessage = async (override?: string) => {
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
        events.forEach(processSseEvent);
      }

      if (buffer.trim()) processSseEvent(buffer);
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("The tutor could not connect. Please try again.");
        updateLastCoachMessage("I could not connect to the tutor service. Please try again in a moment.");
      }
    } finally {
      setLoadingAnswer(false);
      setShowPipeline(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  if (authBusy) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center text-sm text-[#0E7490]">
        Opening your study room...
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-105px)] w-full flex-col">
      <section className="mb-4 overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">Study Lab</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Ask {coachName} anything
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              A calm AI tutor chat for explanations, examples, exam answers, and follow-up doubts.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={chapter}
              onChange={(event) => {
                const next = event.target.value;
                setChapter(next);
                setTopic(CHAPTERS.find((item) => item.value === next)?.topics[0]?.value || "alkanes");
              }}
              className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
            >
              {CHAPTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
            >
              {selectedChapter.topics.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="flex min-h-[calc(100svh-285px)] flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/76 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-xl font-bold text-white shadow-[0_20px_55px_rgba(14,116,144,0.24)]">
                {coachName[0]}
              </div>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
                What do you want to understand today, {displayName.split(" ")[0]}?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Start with a doubt, a short phrase, or even an incomplete follow-up. Assistance options will appear after your tutor understands the intent.
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl space-y-6">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-[1.5rem] px-5 py-4 ${
                      message.role === "user"
                        ? "bg-[#0E7490] text-white shadow-[0_16px_40px_rgba(14,116,144,0.20)]"
                        : "border border-slate-200 bg-white/78 text-slate-800 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      <span>{message.role === "user" ? "You" : coachName}</span>
                      {message.timestamp ? <span>{message.timestamp}</span> : null}
                    </div>
                    {message.role === "coach" ? (
                      message.content ? <CoachAnswer value={message.content} /> : <p className="text-sm text-slate-500">Preparing...</p>
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {showPipeline ? (
                <div className="flex justify-start">
                  <AgentPipeline stages={stages} />
                </div>
              ) : null}

              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200/70 bg-white/86 p-4 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-5xl">
            {hasCoachResponse ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => setInput(action.prompt)}
                    className="shrink-0 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-[#0E7490]/35 hover:text-[#0E7490]"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={`Message ${coachName}...`}
                className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={loadingAnswer || !input.trim()}
                className="rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loadingAnswer ? "Thinking" : "Send"}
              </button>
            </div>
            {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
