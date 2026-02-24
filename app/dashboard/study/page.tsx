"use client";

import { useState, useEffect } from "react";

export default function DashboardPage() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const userId = "student1";

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
    streak: 0,
  });

  // ================= LOAD LOCAL PROGRESS =================
  useEffect(() => {
    const saved = localStorage.getItem("ai-progress");
    if (saved) setProgress(JSON.parse(saved));
  }, []);

  const saveProgress = async (updated: any) => {
    setProgress(updated);
    localStorage.setItem("ai-progress", JSON.stringify(updated));

    // 🔥 Update backend database
    try {
      await fetch(`${backendURL}/update-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          total_tests: updated.totalTests,
          total_questions: updated.totalQuestions,
          total_correct: updated.totalCorrect,
          xp: updated.xp,
          streak: updated.streak || 0,
        }),
      });
    } catch (err) {
      console.error("Progress update failed");
    }
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

    try {
      const res = await fetch(`${backendURL}/section-ai`, {
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
    } catch {
      setRevisionOutput("❌ Failed to connect to AI.");
    }

    setLoadingRevision(false);
  };

  // ================= MCQs =================
  const generateMCQs = async () => {
    try {
      const res = await fetch(`${backendURL}/section-ai`, {
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
    } catch {
      setExamOutput("❌ Failed to generate MCQs.");
    }
  };

  // ================= PROBABLE =================
  const generateProbable = async () => {
    try {
      const res = await fetch(`${backendURL}/section-ai`, {
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
    } catch {
      setProbableOutput("❌ Failed to generate questions.");
    }
  };

  // ================= ASK AI =================
  const handleAskAI = async () => {
    if (!askInput.trim()) return;
    setLoadingAI(true);

    try {
      const res = await fetch(`${backendURL}/section-ai`, {
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
    } catch {
      setAskOutput("❌ Failed to connect to AI.");
    }

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
      const options = lines.filter((l) =>
        ["A.", "B.", "C.", "D."].some((o) => l.startsWith(o))
      );
      const answerLine = lines.find((l) => l.startsWith("Answer:"));
      const correct = answerLine?.split(":")[1]?.trim();

      return { question, options, correct };
    });
  };

  const mcqs = parseMCQs();

  const handleAnswerSelect = (index: number, option: string, correct?: string) => {
    if (selectedAnswers[index]) return;

    const updatedSelected = { ...selectedAnswers, [index]: option };
    setSelectedAnswers(updatedSelected);

    let updatedScore = score;
    if (option === correct) updatedScore += 1;

    if (Object.keys(updatedSelected).length === mcqs.length) {
      const xpEarned = updatedScore * 10;
      const updatedProgress = {
        totalTests: progress.totalTests + 1,
        totalQuestions: progress.totalQuestions + mcqs.length,
        totalCorrect: progress.totalCorrect + updatedScore,
        xp: progress.xp + xpEarned,
        streak: progress.streak + 1,
      };
      saveProgress(updatedProgress);
    }

    setScore(updatedScore);
  };

  // ================= UI =================
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-all">
      <div className="max-w-5xl mx-auto p-8 space-y-8">

        {/* Progress */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold">Level {getLevel()}</h2>
          <p>XP: {progress.xp}</p>
          <p>XP to next level: {xpToNextLevel}</p>
          <p>Total Tests: {progress.totalTests}</p>
          <p>Overall Accuracy: {overallAccuracy}%</p>
        </div>

        {/* Mode Buttons */}
        <div className="space-x-4">
          <button onClick={() => setMode("revision")} className="bg-blue-600 text-white px-4 py-2 rounded">
            Revision
          </button>
          <button onClick={() => setMode("exam")} className="bg-orange-500 text-white px-4 py-2 rounded">
            Exam
          </button>
        </div>

      </div>
    </div>
  );
}