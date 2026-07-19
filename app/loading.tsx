import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";

export default function AppLoading() {
  return (
    <main id="main-content" className="flex min-h-[100dvh] items-center justify-center bg-[var(--ds-bg-app)] px-5 text-[var(--ds-text-primary)]">
      <div className="ds-card w-full max-w-sm p-6" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <ChatThinkingLogo state="thinking" size={36} label="AgentifyAI is loading" />
          <div>
            <p className="text-sm font-semibold">Preparing your workspace</p>
            <p className="mt-1 text-xs text-[var(--ds-text-muted)]">This should only take a moment.</p>
          </div>
        </div>
        <div className="mt-6 space-y-2" aria-hidden="true">
          <span className="ds-skeleton block h-2.5 w-full" />
          <span className="ds-skeleton block h-2.5 w-4/5" />
          <span className="ds-skeleton block h-2.5 w-2/3" />
        </div>
      </div>
    </main>
  );
}
