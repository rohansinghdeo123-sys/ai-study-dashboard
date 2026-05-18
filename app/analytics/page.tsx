"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";


const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ================================================================
   TYPES
   ================================================================ */
interface MCQQuestion {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
}

/* ================================================================
   SUB-COMPONENTS — Revision / Practice / Exam
   ================================================================ */

/* ---------- REVISION: structured study notes ---------- */
function RevisionView({ data }: { data: any }) {
  const lines = formatTextLines(data);

  return (
    <div className="mt-4 space-y-1">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-1 bg-indigo-500 rounded-full" />
        <h3 className="text-lg font-bold text-white">Revision Notes</h3>
      </div>

      <div className="bg-gray-900 border border-gray-700/60 rounded-2xl p-6 space-y-3">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Main heading: ### or ##
          if (/^#{2,3}\s/.test(trimmed)) {
            return (
              <h3
                key={idx}
                className="text-indigo-400 font-bold text-[17px] mt-4 mb-1 flex items-center gap-2"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                {trimmed.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "")}
              </h3>
            );
          }

          // Sub heading: #
          if (/^#\s/.test(trimmed)) {
            return (
              <h2
                key={idx}
                className="text-white font-bold text-xl mt-5 mb-2 border-b border-gray-700 pb-2"
              >
                {trimmed.replace(/^#\s*/, "").replace(/\*\*/g, "")}
              </h2>
            );
          }

          // Bold line: **text**
          if (/^\*\*(.+)\*\*$/.test(trimmed)) {
            return (
              <p key={idx} className="text-white font-semibold mt-3">
                {trimmed.replace(/\*\*/g, "")}
              </p>
            );
          }

          // Bullet points
          if (/^[-*•]\s/.test(trimmed)) {
            const content = trimmed.replace(/^[-*•]\s*/, "");
            // Check for bold prefix in bullet: **Key:** rest
            const boldMatch = content.match(/^\*\*(.+?)\*\*[:\s]*(.*)/);
            return (
              <div key={idx} className="flex items-start gap-3 ml-2">
                <span className="text-indigo-400 mt-1 text-xs">▸</span>
                <p className="text-gray-300 leading-relaxed">
                  {boldMatch ? (
                    <>
                      <span className="text-white font-medium">
                        {boldMatch[1]}:
                      </span>{" "}
                      {boldMatch[2]}
                    </>
                  ) : (
                    content.replace(/\*\*/g, "")
                  )}
                </p>
              </div>
            );
          }

          // Numbered list
          if (/^\d+[.)]\s/.test(trimmed)) {
            const num = trimmed.match(/^(\d+)/)?.[1];
            const content = trimmed.replace(/^\d+[.)]\s*/, "");
            return (
              <div key={idx} className="flex items-start gap-3 ml-2">
                <span className="text-indigo-400 font-bold text-sm min-w-[20px]">
                  {num}.
                </span>
                <p className="text-gray-300 leading-relaxed">
                  {content.replace(/\*\*/g, "")}
                </p>
              </div>
            );
          }

          // Regular paragraph
          if (trimmed.length > 0) {
            return (
              <p key={idx} className="text-gray-300 leading-relaxed">
                {trimmed.replace(/\*\*/g, "")}
              </p>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

/* ---------- PRACTICE: 5 MCQs with answers & explanations shown ---------- */
function PracticeView({ questions }: { questions: MCQQuestion[] }) {
  const limited = questions.slice(0, 5);

  return (
    <div className="mt-4 space-y-1">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-1 bg-green-500 rounded-full" />
        <h3 className="text-lg font-bold text-white">
          Practice — Review Questions
        </h3>
        <span className="text-xs text-gray-500 ml-auto">
          {limited.length} questions · answers revealed
        </span>
      </div>

      <div className="space-y-5">
        {limited.map((q, idx) => (
          <div
            key={idx}
            className="bg-gray-900 border border-gray-700/60 rounded-2xl p-5"
          >
            {/* Question */}
            <p className="text-white font-semibold mb-4 leading-snug">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-600/20 text-green-400 text-sm font-bold mr-2">
                {idx + 1}
              </span>
              {q.question}
            </p>

            {/* Options — correct one highlighted */}
            <div className="space-y-2 mb-4">
              {q.options.map((opt, i) => {
                const isCorrect = opt === q.correct;
                return (
                  <div
                    key={i}
                    className={`px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${
                      isCorrect
                        ? "bg-green-600/20 border border-green-500/40 text-green-300"
                        : "bg-gray-800/60 border border-gray-700/40 text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect
                          ? "bg-green-600 text-white"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className={isCorrect ? "text-green-200" : ""}>
                      {opt}
                    </span>
                    {isCorrect && (
                      <span className="ml-auto text-green-400 text-xs font-semibold">
                        ✓ Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation — always visible */}
            <div className="bg-green-900/10 border border-green-800/30 rounded-xl px-4 py-3">
              <p className="text-xs text-green-400 font-semibold mb-1">
                Explanation
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                {q.explanation}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- EXAM: 5 interactive MCQs with click-to-answer ---------- */
function ExamView({ questions }: { questions: MCQQuestion[] }) {
  const limited = questions.slice(0, 5);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    return limited.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.correct ? 1 : 0);
    }, 0);
  }, [answers, limited]);

  const allAnswered = Object.keys(answers).length === limited.length;

  const handleSelect = (qIdx: number, opt: string) => {
    if (revealed[qIdx]) return; // locked after selection
    setAnswers((prev) => ({ ...prev, [qIdx]: opt }));
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  };

  const handleSubmit = () => setSubmitted(true);

  return (
    <div className="mt-4 space-y-1">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-1 bg-red-500 rounded-full" />
        <h3 className="text-lg font-bold text-white">Exam Mode</h3>
        <span className="text-xs text-gray-500 ml-auto">
          {limited.length} questions · click to answer
        </span>
      </div>

      {/* Score card (after submit) */}
      {submitted && (
        <div
          className={`rounded-2xl p-5 text-center mb-5 border ${
            score === limited.length
              ? "bg-green-900/20 border-green-500/40"
              : score >= limited.length / 2
              ? "bg-yellow-900/20 border-yellow-500/40"
              : "bg-red-900/20 border-red-500/40"
          }`}
        >
          <p className="text-3xl font-bold text-white">
            {score}/{limited.length}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {score === limited.length
              ? "Perfect score! 🎯"
              : score >= limited.length / 2
              ? "Good effort — keep revising the ones you missed."
              : "Needs more work — try revising this topic first."}
          </p>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {limited.map((q, idx) => {
          const selected = answers[idx];
          const isRevealed = revealed[idx];
          const isCorrect = selected === q.correct;

          return (
            <div
              key={idx}
              className="bg-gray-900 border border-gray-700/60 rounded-2xl p-5"
            >
              {/* Question */}
              <p className="text-white font-semibold mb-4 leading-snug">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-600/20 text-red-400 text-sm font-bold mr-2">
                  {idx + 1}
                </span>
                {q.question}
              </p>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const isSelected = selected === opt;
                  const isThisCorrect = opt === q.correct;

                  let style =
                    "bg-gray-800/60 border border-gray-700/40 text-gray-300 hover:bg-gray-700/60 cursor-pointer";

                  if (isRevealed) {
                    if (isThisCorrect) {
                      style =
                        "bg-green-600/20 border border-green-500/40 text-green-200";
                    } else if (isSelected && !isThisCorrect) {
                      style =
                        "bg-red-600/20 border border-red-500/40 text-red-300";
                    } else {
                      style =
                        "bg-gray-800/30 border border-gray-700/30 text-gray-500";
                    }
                  }

                  return (
                    <div
                      key={i}
                      onClick={() => handleSelect(idx, opt)}
                      className={`px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all duration-200 ${style}`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          isRevealed && isThisCorrect
                            ? "bg-green-600 text-white"
                            : isRevealed && isSelected && !isThisCorrect
                            ? "bg-red-600 text-white"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {isRevealed && isThisCorrect
                          ? "✓"
                          : isRevealed && isSelected && !isThisCorrect
                          ? "✗"
                          : String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </div>
                  );
                })}
              </div>

              {/* Explanation — shown after answer */}
              {isRevealed && (
                <div
                  className={`mt-4 rounded-xl px-4 py-3 border ${
                    isCorrect
                      ? "bg-green-900/10 border-green-800/30"
                      : "bg-red-900/10 border-red-800/30"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold mb-1 ${
                      isCorrect ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isCorrect ? "✅ Correct!" : "❌ Incorrect"}
                  </p>
                  {!isCorrect && (
                    <p className="text-xs text-gray-400 mb-1">
                      Correct answer:{" "}
                      <span className="text-green-400 font-medium">
                        {q.correct}
                      </span>
                    </p>
                  )}
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!submitted && allAnswered && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-700 transition px-8 py-3 rounded-xl font-bold text-white"
          >
            Submit Exam — See Score
          </button>
        </div>
      )}

      {/* Progress hint */}
      {!submitted && !allAnswered && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Answer all {limited.length} questions to submit (
          {Object.keys(answers).length}/{limited.length} done)
        </p>
      )}
    </div>
  );
}

/* ---------- TEXT FALLBACK: plain text response ---------- */
function TextFallbackView({ data }: { data: any }) {
  const lines = formatTextLines(data);

  return (
    <div className="mt-4 bg-gray-900 border border-gray-700/60 rounded-2xl p-6 space-y-3">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (/^\d+[.)]\s/.test(trimmed)) {
          return (
            <p key={idx} className="text-yellow-300 font-semibold">
              {trimmed}
            </p>
          );
        }
        return (
          <p key={idx} className="text-gray-300 leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

/* ================================================================
   HELPER: shared text formatter
   ================================================================ */
function formatTextLines(text: any): string[] {
  if (!text) return [];
  const safeText =
    typeof text === "string" ? text : JSON.stringify(text, null, 2);
  return safeText
    .replace(/\\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function AnalyticsPage() {
  const { user, loading: authLoading, getAuthHeaders } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [analytics, setAnalytics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [agentResponse, setAgentResponse] = useState<any>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [currentMode, setCurrentMode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      if (authLoading) return;
      if (!user?.uid) {
        setAnalytics(null);
        return;
      }

      const res = await fetch(`${backendURL}/analytics/${user.uid}`, {
        cache: "no-store",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (active) setAnalytics(data);
    }

    loadAnalytics();
    return () => { active = false; };
  }, [authLoading, backendURL, getAuthHeaders, user?.uid]);

  if (!analytics) {
    return (
      <div className="p-10 text-white">Loading Analytics...</div>
    );
  }

  const filteredData = selectedTopic
    ? analytics.topic_accuracy.filter(
        (t: any) => t.topic === selectedTopic
      )
    : analytics.topic_accuracy;

  const runAgentAction = async (mode: string) => {
    try {
      setLoadingAgent(true);
      setAgentResponse(null);
      setCurrentMode(mode);

      const res = await fetch(`${backendURL}/agent`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          question: `${mode} ${selectedTopic}`,
          section_id: selectedTopic,
          session_id: `analytics-${user?.uid ?? "user"}`,
          mode: mode,
          difficulty: mode === "test" ? "hard" : "medium",
        }),
      });

      const data = await res.json();

      let raw =
        data?.response?.data ||
        data?.response?.plan ||
        data?.response ||
        data?.answer ||
        "";

      if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch {}
      }
      if (raw?.data && typeof raw.data === "string") {
        try { raw = JSON.parse(raw.data); } catch {}
      }

      setAgentResponse(raw);
    } catch (err) {
      console.error("Agent error:", err);
      setAgentResponse("Something went wrong. Please try again.");
    } finally {
      setLoadingAgent(false);
    }
  };

  /* ---- Determine which sub-component to render ---- */
  const renderAgentResponse = () => {
    if (!agentResponse) return null;

    const hasQuestions =
      typeof agentResponse === "object" &&
      Array.isArray(agentResponse?.questions) &&
      agentResponse.questions.length > 0;

    // PRACTICE — show MCQs with answers pre-revealed
    if (currentMode === "exam" && hasQuestions) {
      return <PracticeView questions={agentResponse.questions} />;
    }

    // EXAM (test) — interactive click-to-answer
    if (currentMode === "test" && hasQuestions) {
      return <ExamView questions={agentResponse.questions} />;
    }

    // REVISION — structured notes
    if (currentMode === "revision") {
      const textData =
        typeof agentResponse === "object"
          ? agentResponse.data || agentResponse
          : agentResponse;
      return <RevisionView data={textData} />;
    }

    // FALLBACK — if backend returns questions for an unexpected mode
    if (hasQuestions) {
      return <PracticeView questions={agentResponse.questions} />;
    }

    // FALLBACK — plain text
    const textData =
      typeof agentResponse === "object"
        ? agentResponse.data || agentResponse
        : agentResponse;
    return <TextFallbackView data={textData} />;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white space-y-10">

      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📊 Analytics</h1>
        <p className="text-gray-400 text-sm">
          Real-time performance intelligence
        </p>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-4 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-lg transition ${
            activeTab === "overview"
              ? "bg-indigo-600"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("advanced")}
          className={`px-4 py-2 rounded-lg transition ${
            activeTab === "advanced"
              ? "bg-indigo-600"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          Advanced Analytics
        </button>
      </div>

      {/* ================= OVERVIEW TAB ================= */}
      {activeTab === "overview" && (
        <>
          {/* KPI ROW */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Total Topics</p>
              <h2 className="text-2xl font-bold">
                {analytics.summary.total_topics}
              </h2>
            </div>
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Avg Accuracy</p>
              <h2 className="text-2xl font-bold">
                {Math.round(analytics.summary.avg_accuracy * 100)}%
              </h2>
            </div>
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Weak Topics</p>
              <h2 className="text-2xl font-bold">
                {analytics.weak_topics.length}
              </h2>
            </div>
          </div>

          {/* MAIN CHARTS GRID */}
          <div className="grid grid-cols-2 gap-6">
            {/* HEATMAP */}
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-2">
                Topic Strength Heatmap
              </h3>
              {typeof window !== "undefined" && (
                <Plot
                  data={[
                    {
                      z: filteredData.map((t: any) => [t.accuracy]),
                      x: ["Accuracy"],
                      y: filteredData.map((t: any) => t.topic),
                      type: "heatmap",
                      colorscale: "RdYlGn",
                    },
                  ]}
                  layout={{
                    paper_bgcolor: "#111827",
                    plot_bgcolor: "#111827",
                    font: { color: "white" },
                    margin: { t: 30, b: 30, l: 80, r: 10 },
                  }}
                  style={{ width: "100%", height: "280px" }}
                />
              )}
            </div>

            {/* ACCURACY TREND */}
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl h-[300px]">
              <h3 className="text-sm text-gray-400 mb-2">Accuracy Trend</h3>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart
                  data={filteredData.map((item: any) => ({
                    name: item.topic,
                    accuracy: item.accuracy,
                  }))}
                >
                  <XAxis dataKey="name" stroke="#aaa" />
                  <YAxis stroke="#aaa" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#22c55e"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TOPIC SELECTOR */}
          <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
            <h3 className="text-sm text-gray-400 mb-3">Select Topic</h3>
            <div className="flex gap-3 flex-wrap">
              {analytics.topic_accuracy.map((t: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTopic(t.topic)}
                  className={`px-3 py-1 rounded transition ${
                    selectedTopic === t.topic
                      ? "bg-indigo-600"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  {t.topic}
                </button>
              ))}
            </div>
          </div>

          {/* ===== FOCUS PANEL ===== */}
          {selectedTopic && (
            <div className="bg-indigo-600/10 border border-indigo-500/40 p-6 rounded-2xl space-y-5">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xl text-white">
                    📊 Focus: {selectedTopic}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Choose an action to study this topic
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedTopic(null);
                    setAgentResponse(null);
                    setCurrentMode(null);
                  }}
                  className="text-sm text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded-lg transition"
                >
                  Reset
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => runAgentAction("revision")}
                  disabled={loadingAgent}
                  className={`px-5 py-2 rounded-xl font-semibold transition flex items-center gap-2 ${
                    currentMode === "revision"
                      ? "bg-indigo-600 ring-2 ring-indigo-400"
                      : "bg-indigo-600/80 hover:bg-indigo-600"
                  } disabled:opacity-50`}
                >
                  📖 Revise
                </button>
                <button
                  onClick={() => runAgentAction("exam")}
                  disabled={loadingAgent}
                  className={`px-5 py-2 rounded-xl font-semibold transition flex items-center gap-2 ${
                    currentMode === "exam"
                      ? "bg-green-600 ring-2 ring-green-400"
                      : "bg-green-600/80 hover:bg-green-600"
                  } disabled:opacity-50`}
                >
                  📝 Practice
                </button>
                <button
                  onClick={() => runAgentAction("test")}
                  disabled={loadingAgent}
                  className={`px-5 py-2 rounded-xl font-semibold transition flex items-center gap-2 ${
                    currentMode === "test"
                      ? "bg-red-600 ring-2 ring-red-400"
                      : "bg-red-600/80 hover:bg-red-600"
                  } disabled:opacity-50`}
                >
                  🎯 Exam
                </button>
              </div>

              {/* Loading */}
              {loadingAgent && (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-300">
                    AI is preparing your{" "}
                    {currentMode === "revision"
                      ? "revision notes"
                      : currentMode === "exam"
                      ? "practice questions"
                      : "exam"}
                    ...
                  </p>
                </div>
              )}

              {/* Agent response — routed to correct sub-component */}
              {renderAgentResponse()}
            </div>
          )}

          {/* ===== INSIGHTS + WEAK TOPICS ===== */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-2">🧠 Insights</h3>
              {analytics.insights.map((i: string, idx: number) => (
                <p key={idx}>• {i}</p>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-2">Weak Topics</h3>
              {analytics.weak_topics.length === 0 ? (
                <p>No weak topics 🎯</p>
              ) : (
                analytics.weak_topics.map((t: string, idx: number) => (
                  <p key={idx}>• {t}</p>
                ))
              )}
            </div>
          </div>

          {/* ===== RECOMMENDATIONS ===== */}
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
            <h3 className="text-sm text-gray-400 mb-3">
              📌 Recommendations
            </h3>
            {analytics.recommendations.map((r: string, idx: number) => (
              <p key={idx}>• {r}</p>
            ))}
          </div>

          {/* ===== NEXT ACTION ===== */}
          <div className="bg-indigo-600 p-4 rounded-xl text-center font-bold">
            🚀 {analytics.next_action}
          </div>
        </>
      )}

      {/* ================= ADVANCED TAB ================= */}
      {activeTab === "advanced" && (
        <>
          <h2 className="text-xl font-semibold">Advanced Analytics</h2>

          <div className="grid grid-cols-2 gap-6">
            {/* SCATTER PLOT */}
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-2">Scatter Plot</h3>
              {typeof window !== "undefined" && filteredData?.length > 0 ? (
                <Plot
                  data={[
                    {
                      x: filteredData.map((_: any, i: number) => i),
                      y: filteredData.map((t: any) => t.accuracy),
                      mode: "markers",
                      type: "scatter",
                      marker: { color: "#3b82f6", size: 6 },
                      hovertemplate:
                        "Index: %{x}<br>Accuracy: %{y:.2%}<extra></extra>",
                    },
                  ]}
                  layout={{
                    paper_bgcolor: "#111827",
                    plot_bgcolor: "#111827",
                    font: { color: "white" },
                    xaxis: { title: "Index" },
                    yaxis: { title: "Accuracy", range: [0, 1] },
                    margin: { t: 20, b: 40, l: 40, r: 20 },
                  }}
                  style={{ width: "100%", height: "300px" }}
                  config={{ responsive: true }}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
                  No data available for scatter plot
                </div>
              )}
            </div>

            {/* DENSITY MAP */}
            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl">
              <h3 className="text-sm text-gray-400 mb-2">Density Map</h3>
              {typeof window !== "undefined" && filteredData?.length > 0 ? (
                <Plot
                  data={[
                    {
                      x: filteredData.map((_: any, i: number) => i),
                      y: filteredData.map((t: any) => t.accuracy),
                      type: "histogram2dcontour",
                      colorscale: "Viridis",
                      ncontours: 20,
                      contours: { coloring: "heatmap", showlines: false },
                      showscale: true,
                    },
                  ]}
                  layout={{
                    paper_bgcolor: "#111827",
                    plot_bgcolor: "#111827",
                    font: { color: "white" },
                    xaxis: { title: "Index" },
                    yaxis: { title: "Accuracy", range: [0, 1] },
                    margin: { t: 20, b: 40, l: 60, r: 40 },
                  }}
                  style={{ width: "100%", height: "300px" }}
                  config={{ responsive: true }}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
                  No data available for density map
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
