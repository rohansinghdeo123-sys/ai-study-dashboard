"use client";

import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function BetaBanner() {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      <div className="w-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-black shadow-md z-50">

        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2 text-sm md:text-base font-medium">

          {/* Left Section */}
          <div className="flex items-center gap-3">

            <span className="bg-black text-white text-xs px-2 py-1 rounded-md font-bold">
              BETA
            </span>

            <span>
              AI Study Dashboard is currently in testing. Your feedback helps us improve.
            </span>

          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">

            <button
              onClick={() => setOpen(true)}
              className="bg-black text-white text-xs px-3 py-1 rounded-md hover:bg-gray-800 transition"
            >
              Give Feedback
            </button>

            <button
              onClick={() => setVisible(false)}
              className="text-black font-bold text-lg hover:opacity-70"
            >
              ×
            </button>

          </div>

        </div>

      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}