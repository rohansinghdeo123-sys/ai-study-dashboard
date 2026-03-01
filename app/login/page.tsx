"use client";

import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 p-10 rounded-xl shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-6">Login to AI Study Dashboard</h1>

        <button
          onClick={loginWithGoogle}
          className="bg-blue-600 px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}