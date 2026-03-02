"use client";

import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800">
      <h1 className="text-xl font-semibold">AI Study Dashboard</h1>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm text-gray-300">
              {user.displayName || "User"}
            </span>

            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}