"use client";

import { useState, useEffect } from "react";

interface MCQ {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

export default function StudyPage() {
  const backendURL =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://ai-educator-backend-production.up.railway.app";

  // ================= USER ID =================
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      let storedId = localStorage.getItem("userId");
      if (!storedId) {
        storedId = crypto.randomUUID();
        localStorage.setItem("userId", storedId);
      }
      setUserId(storedId);
    }
  }, []);

  // Fetch backend progress when userId is ready
useEffect(() => {
  if (userId) {
    fetchProgress(userId);
  }
}, [userId]);

  // ================= CHAPTER + TOPIC =================
  const [chapter, setChapter] = useState("hydrocarbon");
  const [topic, setTopic] = useState("alkanes");

  const chapters = ["hydrocarbon"];

  const topicsByChapter: Record<string, string[]> = {
    hydrocarbon: [
      "alkanes",
      "alkenes",
      "alkynes",
      "aromatic hydrocarbons",
      "isomerism",
    ],
  };

  // ================= MODE =================
  const [mode, setMode] = useState<"revision" | "exam">("revision");

  const [revisionOutput, setRevisionOutput] = useState("");
  const [examOutput, setExamOutput] = useState("");
  const [probableOutput, setProbableOutput] = useState("");

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [askInput, setAskInput] = useState("");

  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingRevision, setLoadingRevision] = useState(false);

  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: string;
  }>({});
  const [score, setScore] = useState(0);

  const [progress, setProgress] = useState({
    totalTests: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    xp: 0,
    streak: 0,
    lastStudyDate: "",
  });

  // ================= FETCH PROGRESS FROM BACKEND =================
const fetchProgress = async (id: string) => {
  try {
    const res = await fetch(`${backendURL}/get-progress/${id}`);

    if (res.ok) {
      const data = await res.json();

      setProgress({
        totalTests: data.total_tests,
        totalQuestions: data.total_questions,
        totalCorrect: data.total_correct,
        xp: data.xp,
        streak: data.streak,
        lastStudyDate: "",
      });
    }
  } catch (err) {
    console.log("Failed to fetch progress");
  }
};


  // ================= RESET ON TOPIC CHANGE =================
  useEffect(() => {
    setRevisionOutput("");
    setExamOutput("");
    setProbableOutput("");
    setChatHistory([]);
    setSelectedAnswers({});
    setScore(0);
  }, [chapter, topic]);

  // ================= TYPES =================
type ProgressPayload = {
  totalTests: number;
  totalQuestions: number;
  totalCorrect: number;
  xp: number;
  streak: number;
};


  // ================= SAVE PROGRESS =================
const saveProgress = async (updated: ProgressPayload) => {
  if (!userId) return;

  const payload = {
    user_id: userId,
    total_tests: updated.totalTests,
    total_questions: updated.totalQuestions,
    total_correct: updated.totalCorrect,
    xp: updated.xp,
    streak: updated.streak,
  };

  try {
    const res = await fetch(`${backendURL}/update-progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Failed to update progress");
      return;
    }

    // 🔥 VERY IMPORTANT — sync again from backend
    await fetchProgress(userId);
  } catch (err) {
    console.error("Backend sync failed:", err);
  }
};

  // ================= LEVEL + ACCURACY =================
  const level = Math.floor(progress.xp / 100) + 1;
  const xpProgressPercent = progress.xp % 100;
  const xpToNextLevel = 100 - xpProgressPercent;

  const accuracy =
    progress.totalQuestions === 0
      ? 0
      : Math.round(
          (progress.totalCorrect / progress.totalQuestions) * 100
        );

  // ================= REVISION =================
  const handleRevision = async (
    type: "summary" | "explain" | "key"
  ) => {
    if (!userId) return;
    setLoadingRevision(true);

    let question = "";
    if (type === "summary")
      question = `Generate a smart summary of ${topic}`;
    else if (type === "explain")
      question = `Explain ${topic} clearly with examples`;
    else question = `Give key revision bullet points of ${topic}`;

    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          section_id: topic,
          session_id: "revision-session",
          mode: type,
          difficulty: "medium",
        }),
      });

      const data = await res.json();
      setRevisionOutput(data.answer || "No response.");
    } catch {
      setRevisionOutput("❌ AI connection failed.");
    }

    setLoadingRevision(false);
  };

  // ================= MCQ PARSER =================
  const parseMCQs = (): MCQ[] => {
    if (!examOutput) return [];

    const blocks = examOutput.split(/Q\d+\./).filter(Boolean);

    return blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

      const question = lines[0];
      const options = lines.filter((l) =>
        ["A.", "B.", "C.", "D."].some((o) => l.startsWith(o))
      );

      const answerLine = lines.find((l) =>
        l.toLowerCase().startsWith("answer:")
      );

      const explanationLine = lines.find((l) =>
        l.toLowerCase().startsWith("explanation:")
      );

      const correct = answerLine
        ? answerLine.split(":")[1].trim().charAt(0)
        : "";

      const explanation = explanationLine
        ? explanationLine.split(":")[1].trim()
        : "";

      return { question, options, correct, explanation };
    });
  };

  const mcqs = parseMCQs();

  const generateMCQs = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Generate exam level MCQs of ${topic}`,
          section_id: topic,
          session_id: "exam-session",
          mode: "exam",
          difficulty: "medium",
        }),
      });

      const data = await res.json();
      setExamOutput(data.answer || "");
      setSelectedAnswers({});
      setScore(0);
    } catch {
      setExamOutput("❌ Failed.");
    }
  };

  const generateProbable = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `
Generate exactly:
- 3 questions of 3 marks
- 2 questions of 5 marks
from the topic ${topic}.

IMPORTANT RULES:
- Do NOT provide answers.
- Do NOT provide explanations.
- Do NOT provide hints.
- Output only questions.
- Clearly label them as:
  Q1 (3 Marks)
  Q2 (3 Marks)
  Q3 (3 Marks)
  Q4 (5 Marks)
  Q5 (5 Marks)
`,
          section_id: topic,
          session_id: "probable-session",
          mode: "probable",
          difficulty: "medium",
        }),
      });

      const data = await res.json();
      setProbableOutput(data.answer || "");
    } catch {
      setProbableOutput("❌ Failed.");
    }
  };

  const handleAnswerSelect = (
    index: number,
    option: string,
    correct: string
  ) => {
    if (selectedAnswers[index]) return;

    const updated = {
      ...selectedAnswers,
      [index]: option,
    };

    setSelectedAnswers(updated);

    const newScore = option === correct ? score + 1 : score;
    setScore(newScore);

    if (Object.keys(updated).length === mcqs.length) {
      const today = new Date().toDateString();
      const newStreak =
        progress.lastStudyDate === today
          ? progress.streak
          : progress.streak + 1;

      const updatedProgress = {
        totalTests: progress.totalTests + 1,
        totalQuestions: progress.totalQuestions + mcqs.length,
        totalCorrect: progress.totalCorrect + newScore,
        xp: progress.xp + newScore * 10,
        streak: newStreak,
        lastStudyDate: today,
      };

      saveProgress(updatedProgress);
    }
  };

  const handleAskAI = async () => {
    if (!userId || !askInput.trim()) return;

    const userMessage = { role: "user" as const, content: askInput };

    setChatHistory((prev) => [...prev, userMessage]);
    setAskInput("");
    setLoadingAI(true);

    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          section_id: topic,
          session_id: "ask-session",
          mode: "revision",
          difficulty: "medium",
        }),
      });

      const data = await res.json();

      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: data.answer || "No response." },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "❌ AI connection failed." },
      ]);
    }

    setLoadingAI(false);
  };

  const handleResetAsk = async () => {
    setChatHistory([]);
    setAskInput("");

    await fetch(`${backendURL}/reset-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "ask-session" }),
    });
  };

  return (
    <div className="space-y-8 p-6 text-white">

      {/* PROGRESS CARD */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-xl shadow">
        <h2 className="text-xl font-bold">Level {level}</h2>
        <p>XP: {progress.xp}</p>
        <p>XP to next level: {xpToNextLevel}</p>

        <div className="w-full bg-white/30 rounded h-3 mt-3">
          <div
            className="bg-yellow-300 h-3 rounded transition-all duration-500"
            style={{ width: `${xpProgressPercent}%` }}
          />
        </div>

        <p className="mt-3">Total Tests: {progress.totalTests}</p>
        <p>Accuracy: {accuracy}%</p>
        <p>🔥 {progress.streak} Days</p>
        <p className="text-sm text-yellow-200">
          Keep learning daily to grow your streak!
        </p>
      </div>

      {/* CHAPTER + TOPIC SELECTOR */}
      <div className="bg-gray-800 p-4 rounded-lg space-y-4">

        <div>
          <h2 className="text-lg font-semibold mb-2">Select Chapter</h2>
          <select
            value={chapter}
            onChange={(e) => {
              const selected = e.target.value;
              setChapter(selected);
              setTopic(topicsByChapter[selected][0]);
            }}
            className="w-full p-3 rounded bg-gray-900"
          >
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Select Topic</h2>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full p-3 rounded bg-gray-900"
          >
            {topicsByChapter[chapter].map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MODE BUTTONS */}
      <div className="space-x-4">
        <button
          onClick={() => setMode("revision")}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Revision
        </button>
        <button
          onClick={() => setMode("exam")}
          className="bg-orange-500 px-4 py-2 rounded"
        >
          Exam
        </button>
      </div>

      {/* REVISION */}
      {mode === "revision" && (
        <div className="space-y-4">
          <div className="space-x-4">
            <button onClick={() => handleRevision("summary")} className="bg-purple-600 px-4 py-2 rounded">
              Smart Summary
            </button>
            <button onClick={() => handleRevision("explain")} className="bg-blue-600 px-4 py-2 rounded">
              Explain
            </button>
            <button onClick={() => handleRevision("key")} className="bg-green-600 px-4 py-2 rounded">
              Key Points
            </button>
          </div>

          <div className="bg-gray-800 p-4 rounded whitespace-pre-wrap">
            {loadingRevision ? "AI thinking..." : revisionOutput}
          </div>
        </div>
      )}

      {/* EXAM */}
      {mode === "exam" && (
        <div className="space-y-6">

          <div className="space-x-4">
            <button onClick={generateMCQs} className="bg-green-600 px-4 py-2 rounded">
              Generate MCQs
            </button>
            <button onClick={generateProbable} className="bg-orange-500 px-4 py-2 rounded">
              Probable Questions
            </button>
          </div>

          {mcqs.map((q, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded">
              <h3 className="mb-3 font-semibold">
                {index + 1}. {q.question}
              </h3>

              {q.options.map((opt, i) => {
                const letter = opt.charAt(0);
                const selected = selectedAnswers[index];
                const isCorrect = letter === q.correct;
                const isSelected = selected === letter;

                return (
                  <div
                    key={i}
                    onClick={() => handleAnswerSelect(index, letter, q.correct)}
                    className={`cursor-pointer p-3 rounded-lg mt-2 border transition ${
                      selected
                        ? isCorrect
                          ? "bg-green-600 border-green-400"
                          : isSelected
                          ? "bg-red-600 border-red-400"
                          : "bg-gray-700 border-gray-600"
                        : "bg-gray-700 hover:bg-gray-600 border-gray-600"
                    }`}
                  >
                    {opt}
                  </div>
                );
              })}

              {selectedAnswers[index] && (
                <div className="mt-3 bg-gray-900 p-3 rounded text-sm">
                  {selectedAnswers[index] === q.correct ? (
                    <p className="text-green-400 font-semibold">
                      ✅ Correct Answer
                    </p>
                  ) : (
                    <p className="text-red-400 font-semibold">
                      ❌ Wrong Answer
                    </p>
                  )}

                  {q.explanation && (
                    <p className="mt-2 text-gray-300">
                      <strong>Explanation:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {probableOutput && (
            <div className="bg-yellow-700 p-4 rounded whitespace-pre-wrap">
              {probableOutput}
            </div>
          )}
        </div>
      )}

      {/* ASK AI */}
      <div className="bg-gray-800 p-4 rounded space-y-4">
        <h2 className="text-lg font-bold">Ask AI</h2>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-700 text-gray-200 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loadingAI && (
  <div className="flex justify-start">
    <div className="bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-none shadow flex items-center gap-3">

      {/* Spinner */}
      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>

      {/* Typing Dots */}
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
      </div>

      <span className="text-sm text-gray-300">AI is typing...</span>

    </div>
  </div>
)}
        </div>

        <textarea
          value={askInput}
          onChange={(e) => setAskInput(e.target.value)}
          placeholder="Ask your doubt..."
          className="w-full p-3 rounded bg-gray-900"
        />

        <div className="space-x-4">
          <button onClick={handleAskAI} className="bg-blue-600 px-4 py-2 rounded">
            Ask AI
          </button>
          <button onClick={handleResetAsk} className="bg-red-600 px-4 py-2 rounded">
            Reset
          </button>
        </div>
      </div>

    </div>
  );
}