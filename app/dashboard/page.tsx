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
  const [progress, setProgress] = useState({
    totalTests: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    xp: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem("ai-progress");
    if (saved) {
      setProgress(JSON.parse(saved));
    }
  }, []);

  const level =
    progress.xp < 100
      ? 1
      : progress.xp < 300
      ? 2
      : progress.xp < 600
      ? 3
      : 4;

  const accuracy =
    progress.totalQuestions === 0
      ? 0
      : Math.round(
          (progress.totalCorrect / progress.totalQuestions) * 100
        );

  const chartData = [
    { name: "Start", accuracy: 0 },
    { name: "Now", accuracy: accuracy },
  ];

  return (
    <div className="space-y-10">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-400 mt-2">
          Welcome back! Continue building your mastery 🚀
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* LEVEL CARD */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-xl shadow text-white">
          <h2 className="text-lg font-semibold">Level</h2>
          <p className="text-4xl font-bold mt-2">{level}</p>
          <p className="mt-2 text-sm opacity-80">
            XP: {progress.xp}
          </p>
        </div>

        {/* TOTAL TESTS */}
        <div className="bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-gray-400 text-sm">Total Tests</h2>
          <p className="text-3xl font-bold mt-2 text-white">
            {progress.totalTests}
          </p>
        </div>

        {/* ACCURACY */}
        <div className="bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-gray-400 text-sm">Accuracy</h2>
          <p className="text-3xl font-bold mt-2 text-white">
            {accuracy}%
          </p>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4 text-white">
          XP Progress
        </h2>
        <div className="w-full bg-gray-700 rounded h-3">
          <div
            className="bg-yellow-400 h-3 rounded transition-all duration-700"
            style={{ width: `${progress.xp % 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {100 - (progress.xp % 100)} XP to next level
        </p>
      </div>

      {/* ACCURACY CHART */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Accuracy Growth
        </h2>

        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#ccc" />
            <YAxis stroke="#ccc" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#6366f1"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ACTIVITY PANEL */}
      <div className="bg-gray-800 p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Activity
        </h2>

        {progress.totalTests === 0 ? (
          <p className="text-gray-400">
            No tests taken yet. Start practicing!
          </p>
        ) : (
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>✅ Tests Taken: {progress.totalTests}</li>
            <li>🎯 Questions Solved: {progress.totalQuestions}</li>
            <li>🏆 Correct Answers: {progress.totalCorrect}</li>
          </ul>
        )}
      </div>

    </div>
  );
}