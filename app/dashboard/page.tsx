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

export default function DashboardOverview() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const userId = "student1"; // Replace with auth user later

  const [progress, setProgress] = useState<Progress>({
    total_tests: 0,
    total_questions: 0,
    total_correct: 0,
    xp: 0,
    streak: 0,
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  // =============================
  // FETCH DATA
  // =============================
  const fetchData = async () => {
    try {
      const progressRes = await fetch(
        `${backendURL}/get-progress/${userId}`
      );
      const progressData = await progressRes.json();
      if (progressData) setProgress(progressData);

      const leaderboardRes = await fetch(
        `${backendURL}/leaderboard`
      );
      const leaderboardData = await leaderboardRes.json();
      if (leaderboardData) setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 🔥 Auto refresh leaderboard every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // =============================
  // LEVEL SYSTEM
  // =============================
  const level =
    progress.xp < 100
      ? 1
      : progress.xp < 300
      ? 2
      : progress.xp < 600
      ? 3
      : 4;

  const xpProgressPercent = progress.xp % 100;
  const xpToNextLevel = 100 - xpProgressPercent;

  const accuracy =
    progress.total_questions === 0
      ? 0
      : Math.round(
          (progress.total_correct / progress.total_questions) * 100
        );

  // =============================
  // BADGES SYSTEM
  // =============================
  const badges: string[] = [];

  if (progress.xp >= 100) badges.push("🥉 Bronze Learner");
  if (progress.xp >= 300) badges.push("🥈 Silver Scholar");
  if (progress.xp >= 600) badges.push("🥇 Gold Master");
  if (progress.streak >= 7) badges.push("🔥 Consistency King");
  if (progress.streak >= 30) badges.push("💎 Discipline Legend");

  // =============================
  // CHART DATA
  // =============================
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
    <div className="space-y-10">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-400 mt-2">
          Welcome back! Continue your learning journey 🚀
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* LEVEL CARD */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold text-white">Level</h2>
          <p className="text-3xl font-bold text-white mt-2">
            {level}
          </p>
          <p className="text-white mt-2">XP: {progress.xp}</p>
          <p className="text-white">
            XP to next level: {xpToNextLevel}
          </p>

          <div className="w-full bg-white/30 rounded h-3 mt-3">
            <div
              className="bg-yellow-300 h-3 rounded transition-all duration-500"
              style={{ width: `${xpProgressPercent}%` }}
            />
          </div>
        </div>

        {/* PERFORMANCE */}
        <div className="bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-gray-400">Accuracy</h2>
          <p className="text-3xl font-bold text-white mt-2">
            {accuracy}%
          </p>
          <p className="text-gray-400 mt-2">
            Total Tests: {progress.total_tests}
          </p>
          <p className="text-gray-400">
            Correct Answers: {progress.total_correct}
          </p>
        </div>

        {/* STREAK */}
        <div className="bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-gray-400">🔥 Streak</h2>
          <p className="text-3xl font-bold text-white mt-2">
            {progress.streak} Days
          </p>
          <p className="text-gray-400 mt-2">
            Keep learning daily to grow streak!
          </p>
        </div>
      </div>

      {/* BADGES */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">Your Badges</h2>
        {badges.length === 0 ? (
          <p className="text-gray-400">
            No badges earned yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {badges.map((badge, index) => (
              <div
                key={index}
                className="bg-yellow-500 text-black px-4 py-2 rounded-full font-semibold"
              >
                {badge}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PERFORMANCE CHART */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">
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
              stroke="#8884d8"
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

        <div className="space-y-3">
          {leaderboard.map((user, index) => (
            <div
              key={user.user_id}
              className={`flex justify-between p-4 rounded-lg ${
                user.user_id === userId
                  ? "bg-purple-600"
                  : "bg-gray-700"
              }`}
            >
              <div>
                <span className="font-bold mr-2">
                  #{index + 1}
                </span>
                {user.user_id}
              </div>

              <div className="flex gap-6">
                <span>XP: {user.xp}</span>
                <span>🔥 {user.streak}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}