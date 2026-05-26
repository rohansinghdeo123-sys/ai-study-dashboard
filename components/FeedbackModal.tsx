"use client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-title">

      <div className="relative h-[min(650px,calc(100svh-2rem))] w-full max-w-[650px] rounded-2xl border border-white/10 bg-gray-900 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)]">

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="agentify-action absolute right-3 top-2 rounded-xl px-2 py-1 text-xl text-gray-400 hover:text-white"
          aria-label="Close feedback"
        >
          ×
        </button>

        <h2 id="feedback-title" className="mb-3 text-lg font-semibold text-white">
          Beta Feedback
        </h2>

        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSfMwyu0LdjFoQb0nnJQGH37TkAGmR0jYEk22EWXspOqSdtgBQ/viewform?usp=publish-editorERE"
          title="AgentifyAI beta feedback form"
          className="h-[calc(100%-48px)] w-full rounded-lg border border-gray-700"
        />

      </div>

    </div>
  );
}
