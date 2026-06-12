"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { AlertState, AppIcon, LoadingState } from "@/components/ui/Polished";
import { primeBackend } from "@/lib/apiClient";

const uiFont = Manrope({
  subsets: ["latin"],
  display: "swap",
});

const displayFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

// ─── Utility functions ─────────────────────────────────────────────────────
function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return trimmed;
}

function getErrorSignature(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }

  return error instanceof Error ? error.message : String(error);
}

function getErrorMessage(error: unknown) {
  const signature = getErrorSignature(error);
  if (signature.includes("auth/unauthorized-domain")) {
    return "This website isn't authorized for sign-in yet. Please contact support.";
  }
  if (signature.includes("auth/popup-blocked")) {
    return "Your browser blocked the Google sign-in window. Allow popups for this site and try again.";
  }
  if (signature.includes("auth/popup-closed-by-user")) {
    return "The Google sign-in window was closed before finishing. Try again whenever you're ready.";
  }
  if (signature.includes("auth/cancelled-popup-request")) {
    return "Another sign-in window is already open. Close it and try once more.";
  }
  if (signature.includes("auth/operation-not-supported-in-this-environment")) {
    return "Google sign-in needs a regular browser window. Open this page in Chrome or Safari and try again.";
  }
  if (signature.includes("auth/network-request-failed")) {
    return "We couldn't reach the sign-in service. Check your internet connection and try again.";
  }
  if (signature.includes("auth/configuration-not-found")) {
    return "Sign-in isn't fully set up yet. Please try again in a little while.";
  }
  if (signature.includes("auth/invalid-phone-number")) {
    return "That phone number doesn't look right. Use the full format, like +91 98765 43210.";
  }
  if (signature.includes("auth/too-many-requests")) {
    return "Too many attempts for now. Wait a few minutes, then try again.";
  }
  if (signature.includes("auth/invalid-verification-code")) {
    return "That code didn't match. Check the SMS and try again.";
  }
  if (signature.includes("auth/code-expired")) {
    return "That code has expired. Send a new one and try again.";
  }
  return "Sign-in didn't go through. Please try again.";
}

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  if (hour >= 17 && hour < 22) return "Good evening.";
  return "Still studying?";
}

const RESEND_COOLDOWN_SECONDS = 30;

const DEMO_STEPS = ["Plan", "Quiz", "Explain", "Revise"] as const;
const DEMO_SCENARIOS = [
  "Alkenes — question 4 of 10. You're at 78% accuracy, so the next step adapts to your last two mistakes.",
  "States of matter — explaining the exact idea you missed before the next quick check.",
  "Hydrocarbons revision — 3 key formulas and 2 common traps pulled straight from your chapter.",
];

// ─── Segmented one-time-code input ──────────────────────────────────────────
function OtpBoxes({
  value,
  disabled,
  onChange,
  onComplete,
  firstInputRef,
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  firstInputRef?: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const LENGTH = 6;
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length: LENGTH }, (_, index) => value[index] ?? "");

  const emit = (nextChars: string[]) => {
    const joined = nextChars.join("").replace(/\D/g, "").slice(0, LENGTH);
    onChange(joined);
    if (joined.length === LENGTH) onComplete(joined);
    return joined;
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const next = chars.slice();
    if (!digits) {
      next[index] = "";
      emit(next);
      return;
    }
    let cursor = index;
    for (const digit of digits.split("")) {
      if (cursor >= LENGTH) break;
      next[cursor] = digit;
      cursor += 1;
    }
    emit(next);
    refs.current[Math.min(cursor, LENGTH - 1)]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !chars[index] && index > 0) {
      event.preventDefault();
      const next = chars.slice();
      next[index - 1] = "";
      emit(next);
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const joined = emit(Array.from({ length: LENGTH }, (_, index) => pasted[index] ?? ""));
    refs.current[Math.min(joined.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="auth-otp-group" role="group" aria-label="6-digit verification code">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
            if (index === 0 && firstInputRef) firstInputRef.current = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={char}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className="auth-otp-box"
        />
      ))}
    </div>
  );
}

// ─── Main Login Page Component ──────────────────────────────────────────────
export default function LoginPage() {
  const { user, loginWithGoogle, sendPhoneOtp, verifyPhoneOtp, loading } = useAuth();
  const router = useRouter();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [usePhone, setUsePhone] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [shake, setShake] = useState(false);
  const [granted, setGranted] = useState(false);
  const [greeting, setGreeting] = useState("Welcome back.");
  const [demoTick, setDemoTick] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const formattedPhone = useMemo(() => normalizePhoneNumber(phoneNumber), [phoneNumber]);
  const demoStep = reduceMotion ? 1 : demoTick % DEMO_STEPS.length;
  const demoXp = (demoStep + 1) * 10;
  const demoScenario = reduceMotion
    ? DEMO_SCENARIOS[0]
    : DEMO_SCENARIOS[Math.floor(demoTick / DEMO_STEPS.length) % DEMO_SCENARIOS.length];

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (media?.matches) {
      setReduceMotion(true);
      return;
    }
    const timer = window.setInterval(() => setDemoTick((tick) => tick + 1), 2400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    router.prefetch("/dashboard");
    primeBackend(backendURL);
  }, [backendURL, router]);

  useEffect(() => {
    if (!loading && user) {
      setGranted(true);
      primeBackend(backendURL);
      router.replace("/dashboard");
    }
  }, [backendURL, user, loading, router]);

  useEffect(() => {
    if (authError) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  useEffect(() => {
    if (!otpSent || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [otpSent, resendIn]);

  useEffect(() => {
    if (otpSent) otpInputRef.current?.focus();
    else if (usePhone) phoneInputRef.current?.focus();
  }, [otpSent, usePhone]);

  const handleGoogleLogin = async () => {
    setAuthError("");
    setGoogleBusy(true);
    try {
      primeBackend(backendURL);
      await loginWithGoogle();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSendOtp = async () => {
    setAuthError("");
    if (!formattedPhone.startsWith("+") || formattedPhone.length < 10) {
      setAuthError("Enter your mobile number with the country code, like +91 98765 43210.");
      return;
    }
    try {
      primeBackend(backendURL);
      setSendingOtp(true);
      await sendPhoneOtp(formattedPhone);
      setOtpSent(true);
      setOtp("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    setAuthError("");
    const code = (codeOverride ?? otp).trim();
    if (code.length < 6) {
      setAuthError("Enter the 6-digit code from the SMS.");
      return;
    }
    try {
      primeBackend(backendURL);
      setVerifyingOtp(true);
      await verifyPhoneOtp(code);
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePhoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otpSent) {
      void handleVerifyOtp();
    } else {
      void handleSendOtp();
    }
  };

  const handleBack = () => {
    setOtpSent(false);
    setOtp("");
    setResendIn(0);
    setAuthError("");
    if (!otpSent) setUsePhone(false);
  };

  if (loading) {
    return (
      <div className={uiFont.className}>
        <LoadingState title="Preparing secure sign in..." detail="Opening your private AgentifyAI study workspace." />
      </div>
    );
  }

  return (
    <div className={cn("auth-scene flex min-h-[100dvh] flex-col overflow-x-hidden antialiased", uiFont.className)}>
      <div className="auth-blob auth-blob-teal" aria-hidden="true" />
      <div className="auth-blob auth-blob-gold" aria-hidden="true" />
      <div className="auth-blob auth-blob-mint" aria-hidden="true" />
      <div className="auth-halo" aria-hidden="true" />

      {/* Floating top bar */}
      <header className="auth-header flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
        <Link href="/" aria-label="AgentifyAI home" className="auth-brand group flex items-center gap-3">
          <span className="auth-brand-mark relative flex h-10 w-10 items-center justify-center rounded-[0.85rem] bg-[linear-gradient(135deg,#0F172A_0%,#0E7490_52%,#14B8A6_100%)] text-[15px] font-black text-white shadow-[0_10px_26px_rgba(14,116,144,0.32),inset_0_1px_0_rgba(255,255,255,0.26)]">
            A
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[0.85rem] border border-white/20" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-[var(--agentify-primary-text)]">
              Agentify<span className="text-[#0E7490]">AI</span>
            </span>
            <span className="block text-[11px] font-medium text-[var(--agentify-muted-text)]">
              Your AI study workspace
            </span>
          </span>
        </Link>
        <ThemeToggle compact />
      </header>

      {/* Auth + brand showcase */}
      <main className="auth-main mx-auto grid w-full max-w-[76rem] flex-1 grid-cols-1 content-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(23rem,0.96fr)] lg:items-center lg:gap-16">
        {/* Auth column (first on mobile) */}
        <section aria-label="Sign in" className="auth-column order-1 flex flex-col items-center lg:order-2">
        {!granted ? (
          <p className="auth-signin-eyebrow text-[11px] font-bold uppercase tracking-[0.2em]">
            Student sign in
          </p>
        ) : null}
        <h1
          className={cn(
            "auth-greeting max-w-[24ch] text-center text-[2.4rem] font-medium leading-[1.08] text-[var(--agentify-primary-text)] sm:text-5xl",
            !granted && "mt-3",
            displayFont.className,
          )}
        >
          {granted ? (
            <>Welcome <em>back</em>.</>
          ) : (
            <>
              {greeting.replace(/\.$|\?$/, "")}
              {greeting.endsWith("?") ? "?" : "."} <em>Let&apos;s learn.</em>
            </>
          )}
        </h1>
        <p className="auth-subtitle mt-4 max-w-md text-center text-sm leading-6 text-[var(--agentify-muted-text)] sm:text-base">
          {granted
            ? "Opening your private study workspace…"
            : "Continue where you left off with Google or your phone. No new password to remember."}
        </p>

        {!granted ? (
          <p className="mt-5 max-w-xs text-center text-[13px] leading-5 text-[var(--agentify-muted-text)] lg:hidden">
            Your AI study companion for clear explanations, practice, and next steps.
          </p>
        ) : null}

        <div
          className={cn(
            "auth-card auth-glass mt-8 w-full max-w-[24.5rem] rounded-[1.75rem] p-6 sm:p-7",
            shake && "animate-shake",
          )}
        >
          {granted ? (
            <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
              <span className="auth-success-badge flex h-14 w-14 items-center justify-center rounded-full">
                <AppIcon name="check" className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-[var(--agentify-primary-text)]">You&apos;re in.</p>
              <p className="mt-1 text-xs leading-5 text-[var(--agentify-muted-text)]">
                Opening your dashboard now.
              </p>
              <div className="mx-auto mt-5 w-full max-w-[13rem] space-y-2">
                <span className="polished-skeleton block h-2.5 w-full rounded-full" />
                <span className="polished-skeleton mx-auto block h-2.5 w-3/4 rounded-full" />
              </div>
            </div>
          ) : !usePhone ? (
            <div className="space-y-3.5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleBusy}
                aria-busy={googleBusy}
                className="auth-google flex min-h-[3.25rem] w-full items-center justify-center gap-3 rounded-2xl px-5 text-[0.95rem] font-semibold"
              >
                {googleBusy ? (
                  <span className="auth-spinner" aria-hidden="true" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                    <path fill="#FFC107" d="M43.611 20.083h-1.611V20H24v8h11.303C33.646 32.657 29.202 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z" />
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.548 16.108 18.961 13 24 13c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                    <path fill="#4CAF50" d="M24 44c5.153 0 9.86-1.977 13.411-5.197l-6.19-5.238C29.219 35.091 26.715 36 24 36c-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44z" />
                    <path fill="#1976D2" d="M43.611 20.083h-1.611V20H24v8h11.303c-1.15 3.388-4.292 6-8.303 6-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z" />
                  </svg>
                )}
                {googleBusy ? "Opening Google sign-in…" : "Continue with Google"}
              </button>

              <div className="auth-divider" aria-hidden="true">or</div>

              <button
                type="button"
                onClick={() => setUsePhone(true)}
                disabled={googleBusy}
                className="auth-secondary flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
              >
                <AppIcon name="send" className="h-4 w-4" />
                Use phone number instead
              </button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handlePhoneSubmit} noValidate>
              {!otpSent ? (
                <label className="block" htmlFor="login-phone-number">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--agentify-muted-text)]">
                    Mobile number
                  </span>
                  <input
                    ref={phoneInputRef}
                    id="login-phone-number"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+91 98765 43210"
                    aria-describedby={authError ? "login-auth-error" : undefined}
                    className="auth-field w-full rounded-2xl px-4 py-3.5 text-base font-medium outline-none transition"
                  />
                </label>
              ) : (
                <div className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[var(--agentify-muted-text)]">
                    Code sent to {formattedPhone}
                  </span>
                  <OtpBoxes
                    value={otp}
                    disabled={verifyingOtp}
                    onChange={(next) => setOtp(next)}
                    onComplete={(code) => void handleVerifyOtp(code)}
                    firstInputRef={otpInputRef}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={sendingOtp || verifyingOtp}
                aria-busy={sendingOtp || verifyingOtp}
                className="auth-primary flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[0.95rem] font-semibold"
              >
                {otpSent
                  ? verifyingOtp
                    ? "Verifying…"
                    : "Verify and continue"
                  : sendingOtp
                    ? "Sending code…"
                    : "Send code"}
                {!sendingOtp && !verifyingOtp ? <AppIcon name="arrowRight" className="h-4 w-4" /> : null}
              </button>

              <div className="flex items-center justify-between">
                <button type="button" onClick={handleBack} className="auth-ghost px-3 py-2 text-xs font-semibold">
                  {otpSent ? "Change number" : "Back"}
                </button>
                {otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={resendIn > 0 || sendingOtp}
                    className="auth-ghost px-3 py-2 text-xs font-semibold"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : sendingOtp ? "Sending…" : "Resend code"}
                  </button>
                ) : null}
              </div>
            </form>
          )}

          {authError && !granted ? (
            <div id="login-auth-error" className="mt-4">
              <AlertState message={authError} />
            </div>
          ) : null}

          <div id="recaptcha-container" />
        </div>

        {!granted ? (
          <ul className="auth-trust mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--agentify-muted-text)]">
            {["No password to remember", "Private progress", "Secure sign-in"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <AppIcon name="check" className="h-3.5 w-3.5 text-[var(--agentify-accent)]" />
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {!granted ? (
          <Link href="/" className="auth-home-link mt-5 inline-flex items-center gap-2 text-xs font-semibold">
            <AppIcon name="home" className="h-3.5 w-3.5" />
            New here? See how AgentifyAI works
          </Link>
        ) : null}
        </section>

        {/* Brand / USP showcase */}
        <section aria-label="Why AgentifyAI" className="order-2 hidden lg:order-1 lg:block">
          <div className="auth-brand-panel rounded-[2rem] p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#F2B84B]">Why AgentifyAI</p>
            <h2
              className={cn(
                "auth-brand-title mt-3 text-3xl font-medium leading-[1.12] tracking-tight text-white sm:text-4xl",
                displayFont.className,
              )}
            >
              Meet your personal <em className="italic text-[#5EEAD4]">AI agent</em> for school.
            </h2>
            <p className="auth-brand-copy mt-3 max-w-md text-sm leading-6 text-[#9FB8BC]">
              It plans, teaches, tests, and revises with you, adapting to your progress as you study.
            </p>

            <ul className="auth-usp-list mt-6 space-y-4">
              {[
                {
                  icon: "mission" as const,
                  gold: false,
                  title: "Autonomous Mission",
                  detail: "Your agent plans the chapter, quizzes you, explains mistakes, and decides the next step.",
                },
                {
                  icon: "spark" as const,
                  gold: true,
                  title: "An agent that learns you",
                  detail: "It remembers weak topics and adapts every answer to your pace and level.",
                },
                {
                  icon: "book" as const,
                  gold: false,
                  title: "Grounded in course material",
                  detail: "When approved material is available, explanations stay close to the chapter instead of open-web guesswork.",
                },
              ].map((usp) => (
                <li key={usp.title} className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      "auth-usp-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      usp.gold && "auth-usp-icon--gold",
                    )}
                  >
                    <AppIcon name={usp.icon} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{usp.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-[#9FB8BC]">{usp.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="auth-demo mt-7 rounded-2xl p-4" aria-label="Autonomous Mission preview">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FB8BC]">
                  <span className="auth-demo-indicator" aria-hidden="true" />
                  Autonomous Mission · Interactive preview
                </p>
                <span className="rounded-full bg-[#F2B84B]/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#F2B84B]">
                  +{demoXp} XP
                </span>
              </div>
              <ol className="mt-4 grid grid-cols-4 gap-2">
                {DEMO_STEPS.map((label, index) => {
                  const state = index < demoStep ? "is-done" : index === demoStep ? "is-active" : "";
                  return (
                    <li key={label} className={cn("auth-demo-step", state)}>
                      <span className="auth-demo-dot block h-2 w-2 rounded-full" />
                      <span className={cn("mt-2 block text-xs font-semibold", state ? "text-white" : "text-[#7E979C]")}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 min-h-[2.5rem] text-[13px] leading-5 text-[#9FB8BC]" aria-live="polite">
                {demoScenario}
              </p>

              <div className="mt-3 flex flex-wrap gap-2" aria-label="Mission capabilities">
                {["Adaptive next step", "Mistake-aware explanations", "Progress remembered"].map((item) => (
                  <span key={item} className="auth-proof-chip">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="auth-footer px-5 pb-6 text-center text-xs text-[var(--agentify-muted-text)]">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="font-semibold text-[var(--agentify-accent)] underline-offset-2 hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-[var(--agentify-accent)] underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        .
      </footer>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .auth-demo-indicator {
          height: 0.4rem;
          width: 0.4rem;
          border-radius: 999px;
          background: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.18);
          animation: auth-demo-live-pulse 1.6s ease-in-out infinite;
        }
        @keyframes auth-demo-live-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-shake {
            animation: none;
          }
          .auth-demo-indicator {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
