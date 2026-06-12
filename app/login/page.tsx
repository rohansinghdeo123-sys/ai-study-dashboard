"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Manrope } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ThemeToggle";
import { AlertState, AppIcon, LoadingState, type AppIconName } from "@/components/ui/Polished";
import { ensureBackendReady, primeBackend } from "@/lib/apiClient";

const loginFont = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-login",
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

// ─── Page content data ──────────────────────────────────────────────────────
const missionSteps = [
  { step: "01", title: "Plan", detail: "Pick a chapter path", icon: "dashboard" as AppIconName },
  { step: "02", title: "Teach", detail: "Explain in simple words", icon: "study" as AppIconName },
  { step: "03", title: "Test", detail: "Practice exam questions", icon: "check" as AppIconName },
  { step: "04", title: "Revise", detail: "Fix weak points", icon: "book" as AppIconName },
];

const featureChips = [
  { label: "Ask doubts", icon: "study" as AppIconName },
  { label: "Practice tests", icon: "check" as AppIconName },
  { label: "Track progress", icon: "analytics" as AppIconName },
];

const RESEND_COOLDOWN_SECONDS = 30;

// ─── Main Login Page Component ──────────────────────────────────────────────
export default function LoginPage() {
  const { user, loginWithGoogle, sendPhoneOtp, verifyPhoneOtp, loading } = useAuth();
  const router = useRouter();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [shake, setShake] = useState(false);
  const [granted, setGranted] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const formattedPhone = useMemo(() => normalizePhoneNumber(phoneNumber), [phoneNumber]);

  useEffect(() => {
    primeBackend(backendURL);
  }, [backendURL]);

  useEffect(() => {
    if (!loading && user) {
      setGranted(true);
      let active = true;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const openDashboard = async () => {
        await ensureBackendReady(backendURL, { timeoutMs: 14000, pollMs: 1200 }).catch(() => null);
        if (!active) return;
        timeout = setTimeout(() => router.push("/dashboard"), 250);
      };

      void openDashboard();

      return () => {
        active = false;
        if (timeout) clearTimeout(timeout);
      };
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
  }, [otpSent]);

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      primeBackend(backendURL);
      await loginWithGoogle();
    } catch (error) {
      setAuthError(getErrorMessage(error));
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

  const handleVerifyOtp = async () => {
    setAuthError("");
    if (otp.trim().length < 4) {
      setAuthError("Enter the 6-digit code from the SMS.");
      return;
    }
    try {
      primeBackend(backendURL);
      setVerifyingOtp(true);
      await verifyPhoneOtp(otp.trim());
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

  const handleChangeNumber = () => {
    setOtpSent(false);
    setOtp("");
    setResendIn(0);
    setAuthError("");
  };

  if (loading) {
    return (
      <div className={loginFont.className}>
        <LoadingState title="Preparing secure sign in..." detail="Opening your private AgentifyAI study workspace." />
      </div>
    );
  }

  return (
    <div className={cn("login-shell relative min-h-[100dvh] overflow-hidden antialiased", loginFont.className)}>
      <div className="login-backdrop" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[88rem] flex-col px-4 pb-10 pt-4 sm:px-6 sm:pt-5 lg:px-10">
        <header className="login-topbar flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0E7490] text-sm font-black text-white">
              A
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--agentify-primary-text)]">AgentifyAI</div>
              <div className="text-xs text-[var(--agentify-muted-text)]">Private study workspace</div>
            </div>
          </div>
          <ThemeToggle compact />
        </header>

        <main className="grid flex-1 grid-cols-1 content-center gap-10 py-8 sm:py-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,27rem)] lg:items-center lg:gap-12 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,28.5rem)] xl:gap-16">
          {/* Sign-in card — first in the DOM so phones see it without scrolling */}
          <section aria-label="Sign in" className="order-1 flex justify-center lg:order-2 lg:justify-end">
            <div
              className={cn(
                "login-card login-auth-card w-full max-w-[28.5rem] rounded-3xl",
                shake && "animate-shake",
                granted && "login-card-granted",
              )}
            >
              <div className="p-6 sm:p-8">
                {granted ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center" role="status" aria-live="polite">
                    <span className="login-success-badge flex h-14 w-14 items-center justify-center rounded-full">
                      <AppIcon name="check" className="h-6 w-6" />
                    </span>
                    <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--agentify-primary-text)]">
                      Welcome back
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--agentify-muted-text)]">
                      Opening your study workspace…
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--agentify-muted-text)]">
                      The first load can take a moment while your study space wakes up.
                    </p>
                    <div className="mx-auto mt-6 w-full max-w-[15rem] space-y-2">
                      <span className="polished-skeleton block h-2.5 w-full rounded-full" />
                      <span className="polished-skeleton mx-auto block h-2.5 w-3/4 rounded-full" />
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--agentify-primary-text)] sm:text-[1.7rem]">
                      Sign in to AgentifyAI
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-[var(--agentify-muted-text)]">
                      Pick up where you left off — use Google, or get a one-time code by SMS.
                    </p>

                    <Button
                      variant="secondary"
                      size="lg"
                      className="login-google-button mt-6 w-full !justify-center !gap-3"
                      onClick={handleGoogleLogin}
                      type="button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path fill="#FFC107" d="M43.611 20.083h-1.611V20H24v8h11.303C33.646 32.657 29.202 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z" />
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.548 16.108 18.961 13 24 13c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.153 0 9.86-1.977 13.411-5.197l-6.19-5.238C29.219 35.091 26.715 36 24 36c-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083h-1.611V20H24v8h11.303c-1.15 3.388-4.292 6-8.303 6-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z" />
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="h-px bg-[var(--agentify-border)]" />
                      <span className="text-xs font-medium text-[var(--agentify-muted-text)]">
                        or continue with phone
                      </span>
                      <div className="h-px bg-[var(--agentify-border)]" />
                    </div>

                    <form className="space-y-3" onSubmit={handlePhoneSubmit} noValidate>
                      <label className="block" htmlFor="login-phone-number">
                        <span className="mb-1.5 block text-xs font-semibold text-[var(--agentify-muted-text)]">
                          Mobile number
                        </span>
                        <input
                          id="login-phone-number"
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phoneNumber}
                          onChange={(event) => setPhoneNumber(event.target.value)}
                          placeholder="+91 98765 43210"
                          disabled={otpSent}
                          aria-describedby={authError ? "login-auth-error" : undefined}
                          className="login-field w-full rounded-xl px-4 py-3 text-base font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>

                      {otpSent ? (
                        <label className="block" htmlFor="login-verification-code">
                          <span className="mb-1.5 block text-xs font-semibold text-[var(--agentify-muted-text)]">
                            Verification code
                            <span className="font-normal"> — sent to {formattedPhone}</span>
                          </span>
                          <input
                            ref={otpInputRef}
                            id="login-verification-code"
                            name="one-time-code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            autoComplete="one-time-code"
                            value={otp}
                            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="••••••"
                            aria-describedby={authError ? "login-auth-error" : undefined}
                            className="login-field w-full rounded-xl px-4 py-3 text-center text-lg font-semibold tracking-[0.4em] outline-none transition"
                          />
                        </label>
                      ) : null}

                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full !text-white"
                        disabled={sendingOtp || verifyingOtp}
                        type="submit"
                        aria-busy={sendingOtp || verifyingOtp}
                      >
                        {otpSent
                          ? verifyingOtp
                            ? "Verifying…"
                            : "Verify and continue"
                          : sendingOtp
                            ? "Sending code…"
                            : "Send code"}
                      </Button>

                      {otpSent ? (
                        <div className="flex items-center justify-between gap-2">
                          <Button variant="ghost" size="sm" type="button" onClick={handleChangeNumber}>
                            Change number
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleSendOtp}
                            disabled={resendIn > 0 || sendingOtp}
                          >
                            {resendIn > 0
                              ? `Resend code in ${resendIn}s`
                              : sendingOtp
                                ? "Sending…"
                                : "Resend code"}
                          </Button>
                        </div>
                      ) : null}
                    </form>

                    {authError ? (
                      <div id="login-auth-error" className={cn("mt-4", shake && "animate-shake")}>
                        <AlertState message={authError} />
                      </div>
                    ) : null}

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--agentify-muted-text)]">
                      <AppIcon name="check" className="h-3.5 w-3.5 text-[var(--agentify-accent)]" />
                      Protected by Firebase Authentication
                    </div>

                    <p className="mt-4 text-center text-xs leading-5 text-[var(--agentify-muted-text)]">
                      By continuing, you agree to our Terms and Privacy Policy.
                    </p>
                  </>
                )}

                <div id="recaptcha-container" />
              </div>
            </div>
          </section>

          {/* Hero column */}
          <section className="order-2 lg:order-1">
            <div className="login-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--agentify-muted-text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" aria-hidden="true" />
              Built for school students who want clear next steps
            </div>

            <h2 className="login-hero-title mt-5 max-w-[44rem] text-4xl font-semibold leading-[1.06] tracking-tight text-[var(--agentify-primary-text)] sm:text-5xl xl:text-[3.6rem]">
              Your AI study companion for school.
            </h2>

            <p className="mt-4 max-w-[38rem] text-base leading-7 text-[var(--agentify-muted-text)] sm:text-lg sm:leading-8">
              AgentifyAI helps every learner ask doubts, revise chapters, practice questions, and understand what to do next without feeling lost.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {featureChips.map((chip) => (
                <span
                  key={chip.label}
                  className="login-chip inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-[var(--agentify-primary-text)]"
                >
                  <AppIcon name={chip.icon} className="h-4 w-4 text-[var(--agentify-accent)]" />
                  {chip.label}
                </span>
              ))}
            </div>

            <div className="login-card login-mission-card mt-8 hidden rounded-3xl p-5 sm:block sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="login-gold-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Guided Study Lab
                </div>
                <span className="login-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-[var(--agentify-accent)]">
                  <AppIcon name="spark" className="h-3.5 w-3.5" />
                  Student flow
                </span>
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--agentify-primary-text)] sm:text-2xl">
                One chapter becomes a clear study path.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--agentify-muted-text)]">
                The app keeps the journey simple: choose a topic, learn it, test it, then revise the exact weak point.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {missionSteps.map((item) => (
                  <div key={item.title} className="login-step rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--agentify-muted-text)]">{item.step}</span>
                      <span className="login-step-icon flex h-8 w-8 items-center justify-center rounded-xl">
                        <AppIcon name={item.icon} />
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[var(--agentify-primary-text)]">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--agentify-muted-text)]">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-shake {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
