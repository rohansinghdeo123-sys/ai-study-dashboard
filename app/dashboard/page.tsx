"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Progress {
  user_id: string;
  total_tests: number;
  total_questions: number;
  total_correct: number;
  xp: number;
  streak: number;
}

interface LeaderboardUser {
  user_id: string;
  xp: number;
  streak: number;
}

export default function DashboardPage() {
  const backendURL =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://ai-educator-backend-production.up.railway.app";

  // ================= DYNAMIC USER ID =================
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

  const [progress, setProgress] = useState<Progress>({
    user_id: "",
    total_tests: 0,
    total_questions: 0,
    total_correct: 0,
    xp: 0,
    streak: 0,
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ================= FETCH FUNCTION =================
  const fetchData = async (id: string) => {
    try {
      setLoading(true);

      const progressRes = await fetch(
        `${backendURL}/get-progress/${id}`
      );

      if (progressRes.ok) {
        const progressData = await progressRes.json();
        setProgress(progressData);
      }

      const leaderboardRes = await fetch(
        `${backendURL}/leaderboard`
      );

      const leaderboardData = await leaderboardRes.json();

      if (Array.isArray(leaderboardData)) {
        setLeaderboard(leaderboardData);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch only when userId is ready
  useEffect(() => {
    if (userId) {
      fetchData(userId);
    }
  }, [userId]);

  // ================= CALCULATIONS =================
  const level = Math.floor(progress.xp / 100) + 1;
  const xpProgressPercent = progress.xp % 100;
  const xpToNextLevel = 100 - xpProgressPercent;

  const accuracy =
    progress.total_questions === 0
      ? 0
      : Math.round(
          (progress.total_correct / progress.total_questions) * 100
        );

  // ================= PERFORMANCE DATA =================
  const chartData = [
    { name: "Tests", value: progress.total_tests },
    { name: "Correct", value: progress.total_correct },
    { name: "XP", value: progress.xp },
  ];

  if (loading) {
    return (
      <div className="text-white text-lg p-10">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-10 p-6 text-white">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">
          Dashboard Overview
        </h1>
        <p className="text-gray-400 mt-2">
          Welcome back! Continue your learning journey 🚀
        </p>
      </div>

      {/* TOP CARDS */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* LEVEL CARD */}
        <div className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
          <div className="absolute inset-0 rounded-2xl bg-white/5 backdrop-blur-md"></div>

          <div className="relative z-10">
            <h2 className="text-xl font-bold">
              Level {level}
            </h2>

            <p className="mt-2 text-sm">
              XP: {progress.xp}
            </p>

            <p className="text-sm">
              XP to next level: {xpToNextLevel}
            </p>

            <div className="w-full bg-white/20 rounded-full h-3 mt-4">
              <div
                className="bg-yellow-300 h-3 rounded-full transition-all duration-700"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* ACCURACY CARD */}
        <div className="bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-gray-400">Accuracy</h2>
          <p className="text-3xl font-bold mt-2">
            {accuracy}%
          </p>
          <p className="text-gray-400 mt-2">
            Total Tests: {progress.total_tests}
          </p>
          <p className="text-gray-400">
            Correct Answers: {progress.total_correct}
          </p>
        </div>

        {/* STREAK CARD */}
        <div className="bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-gray-400">🔥 Streak</h2>
          <p className="text-3xl font-bold mt-2">
            {progress.streak} Days
          </p>
          <p className="text-gray-400 mt-2">
            Keep learning daily to grow your streak!
          </p>
        </div>
      </div>

      {/* PERFORMANCE OVERVIEW */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-6">
          Performance Overview
        </h2>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#a855f7"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* LEADERBOARD */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">
          🏆 Leaderboard (Top 10)
        </h2>
        
        <input
  type="text"
  placeholder="🔎 Search by User ID..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="w-full mb-4 p-3 rounded-lg bg-gray-900 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
/>

        {leaderboard.length === 0 ? (
          <p className="text-gray-400">
            No leaderboard data available.
          </p>
        ) : (
          leaderboard
  .filter(user =>
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  )
  .map((user, index) => (
            <div
              key={user.user_id}
              className={`flex justify-between p-4 rounded-lg transition-all duration-300 hover:scale-[1.01] ${
                user.user_id === userId
                  ? "bg-gradient-to-r from-purple-600 to-pink-600"
                  : "bg-gray-700"
              }`}
            >
              <div>
                #{index + 1} {user.user_id}
              </div>
              <div>
                XP: {user.xp} 🔥 {user.streak}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}