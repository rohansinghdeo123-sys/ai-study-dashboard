"use client";

export default function Navbar() {
  return (
    <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 text-white">
      
      <div className="text-lg font-semibold">
        AI Study Dashboard
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-300">
          Welcome, Student
        </div>

        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center font-bold">
          R
        </div>
      </div>
    </div>
  );
}