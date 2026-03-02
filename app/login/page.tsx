"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, loginWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="animate-pulse text-lg tracking-wide">
          Preparing your dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">

      {/* LEFT SIDE - Branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center px-16">
        <div className="max-w-lg">
          <h1 className="text-5xl font-bold leading-tight">
            Master Your Subjects <br />
            <span className="text-blue-500">with AI</span>
          </h1>

          <p className="mt-6 text-gray-400 text-lg">
            Personalized quizzes, smart revision, streak tracking,
            and adaptive AI guidance — all in one intelligent dashboard.
          </p>

          <div className="mt-10 space-y-4 text-gray-300">
            <div>🔥 Daily Challenges & XP System</div>
            <div>📈 Performance Analytics</div>
            <div>🧠 AI Doubt Solver</div>
            <div>🏆 Competitive Leaderboard</div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Login Card */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6">
        <div className="w-full max-w-md p-10 bg-gray-900/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-800 transition-all duration-300 hover:shadow-blue-500/10">

          {/* Logo / Title */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-semibold tracking-tight">
              AI Study Dashboard
            </h2>
            <p className="text-gray-400 mt-3">
              Sign in to continue your learning journey
            </p>
          </div>

          {/* Google Button */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-900 font-medium rounded-xl hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5"
            >
              <path
                fill="#FFC107"
                d="M43.611 20.083h-1.611V20H24v8h11.303C33.646 32.657 29.202 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.817C14.548 16.108 18.961 13 24 13c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.153 0 9.86-1.977 13.411-5.197l-6.19-5.238C29.219 35.091 26.715 36 24 36c-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083h-1.611V20H24v8h11.303c-1.15 3.388-4.292 6-8.303 6-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Trust Note */}
          <p className="text-center text-gray-500 text-sm mt-6">
            🔒 Secure authentication powered by Google
          </p>

          {/* Terms */}
          <p className="text-center text-gray-600 text-xs mt-4">
            By continuing, you agree to our Terms & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}