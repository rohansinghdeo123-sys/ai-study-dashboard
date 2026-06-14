"use client";

import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";
import ThemeToggle from "@/components/ThemeToggle";
import type { ReactNode } from "react";

export default function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  footer,
  fontClassName,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  fontClassName?: string;
}) {
  return (
    <main className={`onboarding-page ${fontClassName || ""}`}>
      <div className="onboarding-ambient" aria-hidden="true">
        <span className="onboarding-glow onboarding-glow-teal" />
        <span className="onboarding-glow onboarding-glow-gold" />
        <span className="onboarding-grid" />
      </div>

      <div className="onboarding-theme">
        <ThemeToggle compact />
      </div>

      <header className="onboarding-brand" aria-label="AgentifyAI">
        <ChatThinkingLogo state="thinking" size={52} label="" />
        <span className="onboarding-brand-name">
          Agentify<span>AI</span>
        </span>
      </header>

      <section className="onboarding-stage">
        <div className="onboarding-copy">
          <div className="onboarding-step-dots" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className={item <= step ? "is-active" : ""}
                aria-hidden="true"
              />
            ))}
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="onboarding-content">{children}</div>
      </section>

      {footer ? <footer className="onboarding-footer">{footer}</footer> : null}
    </main>
  );
}
