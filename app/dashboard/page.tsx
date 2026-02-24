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

export default function DashboardOverview() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const userId = "student1"; // Later replace with auth user id

  const [progress, setProgress] = useState({
    totalTests: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    xp: 0,
    streak: 0,
  });

  const [loading, setLoading] = useState(true);

  // =============================
  // FETCH PROGRESS FROM BACKEND
  // =============================
  useEffect(() => {
    fetch(`${backendURL}/get-progress/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setProgress(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const xpToNextLevel = 100 - (progress.xp % 100);

  const accuracy =
    progress.totalQuestions === 0
      ? 0
      : Math.round(
          (progress.totalCorrect / progress.totalQuestions) * 100
        );

  // =============================
  // CHART DATA
  // =============================
  const chartData = [
    { name: "Tests", value: progress.totalTests },
    { name: "Correct", value: progress.totalCorrect },
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
          <p className="text-white mt-2">
            XP: {progress.xp}
          </p>
          <p className="text-white">
            XP to next level: {xpToNextLevel}
          </p>

          <div className="w-full bg-white/30 rounded h-3 mt-3">
            <div
              className="bg-yellow-300 h-3 rounded transition-all duration-500"
              style={{ width: `${progress.xp % 100}%` }}
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
            Total Tests: {progress.totalTests}
          </p>
          <p className="text-gray-400">
            Correct Answers: {progress.totalCorrect}
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
    </div>
  );
}