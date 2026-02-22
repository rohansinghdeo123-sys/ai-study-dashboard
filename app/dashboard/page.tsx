"use client";

import { useState, useEffect } from "react";

export default function DashboardPage() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL!;

  const [mode, setMode] = useState<"revision" | "exam">("revision");
  const [section] = useState("alkanes");

  const [revisionOutput, setRevisionOutput] = useState("");
  const [examOutput, setExamOutput] = useState("");
  const [probableOutput, setProbableOutput] = useState("");

  const [askInput, setAskInput] = useState("");
  const [askOutput, setAskOutput] = useState("");

  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingRevision, setLoadingRevision] = useState(false);

  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [score, setScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const [progress, setProgress] = useState({
    totalTests: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    xp: 0,
  });

  // ================= LOAD PROGRESS =================

  useEffect(() => {
    const saved = localStorage.getItem("ai-progress");
    if (saved) setProgress(JSON.parse(saved));
  }, []);

  const saveProgress = (updated: any) => {
    setProgress(updated);
    localStorage.setItem("ai-progress", JSON.stringify(updated));
  };

  const resetProgress = () => {
    const empty = { totalTests: 0, totalQuestions: 0, totalCorrect: 0, xp: 0 };
    saveProgress(empty);
  };

  const getLevel = () => {
    if (progress.xp < 100) return 1;
    if (progress.xp < 300) return 2;
    if (progress.xp < 600) return 3;
    return 4;
  };

  const xpToNextLevel = 100 - (progress.xp % 100);

  const overallAccuracy =
    progress.totalQuestions === 0
      ? 0
      : Math.round((progress.totalCorrect / progress.totalQuestions) * 100);

  // ================= REVISION =================

  const handleRevision = async (type: "summary" | "explain" | "key") => {
    setLoadingRevision(true);

    let question = "";
    let requestMode = "revision";

    if (type === "summary") {
      question = `Generate a smart summary of ${section}`;
      requestMode = "summary";
    } else if (type === "explain") {
      question = `Explain ${section} clearly with examples`;
      requestMode = "explain";
    } else {
      question = `Give key revision bullet points of ${section}`;
      requestMode = "keypoints";
    }

    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        section_id: section,
        session_id: "revision-session",
        mode: requestMode,
        difficulty: "medium",
      }),
    });

    const data = await res.json();
    setRevisionOutput(data.answer || "");
    setLoadingRevision(false);
  };

  // ================= MCQs =================

  const generateMCQs = async () => {
    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `Generate exam level MCQs of ${section}`,
        section_id: section,
        session_id: "exam-mcq-session",
        mode: "exam",
        difficulty: "medium",
      }),
    });

    const data = await res.json();
    setExamOutput(data.answer || "");
    setProbableOutput("");
    setScore(0);
    setSelectedAnswers({});
  };

  // ================= PROBABLE =================

  const generateProbable = async () => {
    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `Generate 2 questions of 3 marks and 2 questions of 5 marks from ${section}`,
        section_id: section,
        session_id: "exam-theory-session",
        mode: "probable",
        difficulty: "medium",
      }),
    });

    const data = await res.json();
    setProbableOutput(data.answer || "");
  };

  // ================= ASK AI =================

  const handleAskAI = async () => {
    if (!askInput.trim()) return;

    setLoadingAI(true);

    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: askInput,
        section_id: section,
        session_id: "ask-session",
        mode: "revision",
        difficulty: "medium",
      }),
    });

    const data = await res.json();
    setAskOutput(data.answer || "");
    setLoadingAI(false);
  };

  const resetAsk = () => {
    setAskInput("");
    setAskOutput("");
  };

  // ================= MCQ PARSER =================

  const parseMCQs = () => {
    if (!examOutput) return [];

    const blocks = examOutput.split(/Q\d+\./).filter(Boolean);

    return blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

      const question = lines[0];
      const options = lines.filter(
        (l) =>
          l.startsWith("A.") ||
          l.startsWith("B.") ||
          l.startsWith("C.") ||
          l.startsWith("D.")
      );

      const answerLine = lines.find((l) => l.startsWith("Answer:"));
      const explanationLine = lines.find((l) => l.startsWith("Explanation:"));

      const correct = answerLine?.split(":")[1]?.trim();

      return {
        question,
        options,
        correct,
        explanation: explanationLine?.replace("Explanation:", "").trim(),
      };
    });
  };

  const mcqs = parseMCQs();

  const handleAnswerSelect = (index: number, option: string, correct?: string) => {
    if (selectedAnswers[index]) return;

    const updatedSelected = { ...selectedAnswers, [index]: option };
    setSelectedAnswers(updatedSelected);

    let updatedScore = score;
    if (option === correct) {
      updatedScore = score + 1;
      setScore(updatedScore);
    }

    if (Object.keys(updatedSelected).length === mcqs.length) {
      const accuracy = updatedScore / mcqs.length;
      let xpEarned = updatedScore * 10;
      if (accuracy >= 0.8) xpEarned += 20;

      if (accuracy >= 0.8) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      const updatedProgress = {
        totalTests: progress.totalTests + 1,
        totalQuestions: progress.totalQuestions + mcqs.length,
        totalCorrect: progress.totalCorrect + updatedScore,
        xp: progress.xp + xpEarned,
      };

      saveProgress(updatedProgress);
    }
  };

  // ================= UI =================

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-all">
      <div className="max-w-5xl mx-auto p-8 space-y-8">

        {showConfetti && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none text-6xl animate-bounce">
            🎉
          </div>
        )}

        {/* PROGRESS */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold">Level {getLevel()}</h2>
          <p>XP: {progress.xp}</p>
          <p>XP to next level: {xpToNextLevel}</p>
          <p>Total Tests: {progress.totalTests}</p>
          <p>Overall Accuracy: {overallAccuracy}%</p>

          <div className="w-full bg-white/30 rounded h-3 mt-2">
            <div
              className="bg-yellow-300 h-3 rounded transition-all duration-500"
              style={{ width: `${progress.xp % 100}%` }}
            ></div>
          </div>

          <button
            onClick={resetProgress}
            className="mt-3 bg-white text-black px-3 py-1 rounded text-sm"
          >
            Reset Progress
          </button>
        </div>

        {/* MODE SELECT */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow space-x-4">
          <button
            onClick={() => setMode("revision")}
            className={`px-4 py-2 rounded ${
              mode === "revision"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            Revision Mode
          </button>
          <button
            onClick={() => setMode("exam")}
            className={`px-4 py-2 rounded ${
              mode === "exam"
                ? "bg-orange-500 text-white"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            Exam Mode
          </button>
        </div>

        {/* REVISION */}
        {mode === "revision" && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow space-y-4">
            <div className="space-x-4">
              <button onClick={() => handleRevision("summary")} className="bg-purple-600 text-white px-4 py-2 rounded">
                Smart Summary
              </button>
              <button onClick={() => handleRevision("explain")} className="bg-blue-600 text-white px-4 py-2 rounded">
                Explain
              </button>
              <button onClick={() => handleRevision("key")} className="bg-green-600 text-white px-4 py-2 rounded">
                Key Points
              </button>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded whitespace-pre-wrap">
              {loadingRevision ? "AI is thinking..." : revisionOutput}
            </div>
          </div>
        )}

        {/* EXAM */}
        {mode === "exam" && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow space-y-6">

            <div className="space-x-4">
              <button onClick={generateMCQs} className="bg-green-600 text-white px-4 py-2 rounded">
                Generate MCQs
              </button>
              <button onClick={generateProbable} className="bg-orange-500 text-white px-4 py-2 rounded">
                Probable Questions
              </button>
            </div>

            {mcqs.map((q, index) => {
              const selected = selectedAnswers[index];

              return (
                <div key={index} className="border p-5 rounded-xl space-y-4 bg-gray-50 dark:bg-gray-800">
                  <h3 className="font-semibold text-lg">
                    {index + 1}. {q.question}
                  </h3>

                  {q.options.map((opt, i) => {
                    const letter = opt.charAt(0);
                    const isSelected = selected === letter;
                    const isCorrect = letter === q.correct;

                    let style =
                      "p-3 rounded-lg cursor-pointer border transition-all duration-200";

                    if (selected) {
                      if (isCorrect) {
                        style += " bg-green-200 dark:bg-green-700 border-green-500";
                      } else if (isSelected) {
                        style += " bg-red-200 dark:bg-red-700 border-red-500";
                      } else {
                        style += " bg-gray-100 dark:bg-gray-700";
                      }
                    } else {
                      style += " bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600";
                    }

                    return (
                      <div
                        key={i}
                        onClick={() =>
                          handleAnswerSelect(index, letter, q.correct)
                        }
                        className={style}
                      >
                        {opt}
                      </div>
                    );
                  })}

                  {selected && (
                    <div
                      className={`p-4 rounded-lg text-sm ${
                        selected === q.correct
                          ? "bg-green-100 dark:bg-green-800"
                          : "bg-red-100 dark:bg-red-800"
                      }`}
                    >
                      <div className="font-semibold mb-1">
                        {selected === q.correct
                          ? "✅ Correct Answer!"
                          : `❌ Incorrect. Correct Answer: ${q.correct}`}
                      </div>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {probableOutput && (
              <div className="bg-yellow-50 dark:bg-gray-700 p-4 rounded whitespace-pre-wrap">
                {probableOutput}
              </div>
            )}
          </div>
        )}

        {/* ASK AI */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow space-y-4">
          <h3 className="font-semibold">Ask AI (Concept Doubts)</h3>

          <textarea
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            placeholder="Type your doubt here..."
            className="w-full border p-3 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />

          <div className="space-x-4">
            <button onClick={handleAskAI} className="bg-blue-600 text-white px-4 py-2 rounded">
              Ask
            </button>
            <button onClick={resetAsk} className="bg-red-600 text-white px-4 py-2 rounded">
              Reset
            </button>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded whitespace-pre-wrap">
            {loadingAI ? "AI is typing..." : askOutput}
          </div>
        </div>

      </div>
    </div>
  );
}