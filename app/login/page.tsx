"use client";

import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <button
        onClick={loginWithGoogle}
        className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Login with Google
      </button>
    </div>
  );
}