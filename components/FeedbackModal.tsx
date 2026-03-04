"use client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

      <div className="bg-gray-900 rounded-xl w-[95%] md:w-[650px] h-[650px] p-4 relative shadow-lg">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>

        <h2 className="text-lg font-semibold mb-3">
          Beta Feedback
        </h2>

        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSfMwyu0LdjFoQb0nnJQGH37TkAGmR0jYEk22EWXspOqSdtgBQ/viewform?usp=publish-editorERE"
          className="w-full h-[580px] rounded-lg border border-gray-700"
        />

      </div>

    </div>
  );
}