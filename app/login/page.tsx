"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ThemeToggle";

// ─── Utility functions (unchanged) ────────────────────────────────────────
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
  const message = getErrorSignature(error);
  if (message.includes("auth/unauthorized-domain")) {
    return "FIREBASE_AUTH_DOMAIN_NOT_ALLOWED";
  }
  if (message.includes("auth/popup-blocked")) return "GOOGLE_POPUP_BLOCKED";
  if (message.includes("auth/popup-closed-by-user")) return "GOOGLE_LOGIN_CANCELLED";
  if (message.includes("auth/cancelled-popup-request")) return "GOOGLE_LOGIN_RETRY_REQUIRED";
  if (message.includes("auth/operation-not-supported-in-this-environment")) {
    return "GOOGLE_REDIRECT_REQUIRED";
  }
  if (message.includes("auth/network-request-failed")) return "NETWORK_REQUEST_FAILED";
  if (message.includes("auth/configuration-not-found")) return "FIREBASE_AUTH_NOT_CONFIGURED";
  if (message.includes("auth/invalid-phone-number")) return "INVALID_PHONE_NUMBER";
  if (message.includes("auth/too-many-requests")) return "TOO_MANY_REQUESTS";
  if (message.includes("auth/invalid-verification-code")) return "INVALID_OTP_CODE";
  if (message.includes("auth/code-expired")) return "OTP_CODE_EXPIRED";
  return "AUTH_REQUEST_FAILED";
}

// ─── Terminal sub‑components (unchanged) ──────────────────────────────────
function TerminalBadge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "orange" | "green" | "blue" | "red" | "neutral" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.22em]",
        "font-mono",
        tone === "orange" && "border-amber-600/30 bg-amber-600/10 text-amber-500",
        tone === "green" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        tone === "blue" && "border-[#0E7490]/30 bg-[#0E7490]/10 text-[#0E7490]",
        tone === "red" && "border-red-500/30 bg-red-500/10 text-red-400",
        tone === "neutral" && "border-[#1A1A1A] bg-black text-[#6B6B6B]",
        tone === "amber" && "border-amber-400/40 bg-amber-400/10 text-amber-400",
      )}
    >
      {children}
    </span>
  );
}

function MetricTile({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors duration-300",
        active && "border-cyan-300/25 bg-cyan-300/10",
      )}
    >
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-2 text-sm font-semibold",
          active ? "text-cyan-100" : "text-slate-200",
        )}
      >
        {value}
      </div>
    </div>
  );
}

const missionSteps = [
  ["01", "Plan", "Build the study path"],
  ["02", "Teach", "Explain the concept"],
  ["03", "Test", "Generate practice"],
  ["04", "Revise", "Fix weak points"],
];

const platformSignals = [
  ["6", "agents online"],
  ["24/7", "study memory"],
  ["1", "private learner profile"],
];

// ─── Particle background (unchanged) ───────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2 + 1,
    }));

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(0, 163, 255, 0.12)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx.fillStyle = "rgba(0, 163, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    draw();

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        animFrameRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="login-particles absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

// ─── Main Login Page Component ──────────────────────────────────────────────
export default function LoginPage() {
  const { user, loginWithGoogle, sendPhoneOtp, verifyPhoneOtp, loading } = useAuth();
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [shake, setShake] = useState(false);
  const [granted, setGranted] = useState(false);

  const formattedPhone = useMemo(() => normalizePhoneNumber(phoneNumber), [phoneNumber]);

  useEffect(() => {
    if (!loading && user) {
      setGranted(true);
      const timeout = setTimeout(() => router.push("/dashboard"), 800);
      return () => clearTimeout(timeout);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (authError) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      await loginWithGoogle();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    }
  };

  const handleSendOtp = async () => {
    setAuthError("");
    if (!formattedPhone.startsWith("+") || formattedPhone.length < 10) {
      setAuthError("ENTER_VALID_PHONE_WITH_COUNTRY_CODE");
      return;
    }
    try {
      setSendingOtp(true);
      await sendPhoneOtp(formattedPhone);
      setOtpSent(true);
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setAuthError("");
    if (otp.trim().length < 4) {
      setAuthError("ENTER_OTP_CODE");
      return;
    }
    try {
      setVerifyingOtp(true);
      await verifyPhoneOtp(otp.trim());
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080D] text-cyan-200">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm shadow-2xl shadow-black/20">
          Preparing secure sign in...
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell relative min-h-screen overflow-hidden bg-[#07080D] text-slate-100 antialiased">
      <ParticleCanvas />

      {/* Background overlays */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />
      </div>

      <div className="relative z-10">
        <main className="mx-auto flex min-h-screen max-w-[1480px] flex-col px-5 py-5 lg:px-10 xl:px-12">
          <header className="login-topbar flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-sm font-black text-white">
                A
              </div>
              <div>
                <div className="text-sm font-semibold text-white">AgentifyAI</div>
                <div className="text-xs text-slate-500">Autonomous study workspace</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <TerminalBadge tone="green">Ready</TerminalBadge>
            </div>
          </header>

          <div className="grid flex-1 grid-cols-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1.08fr)_500px] lg:py-12 xl:gap-12">
          {/* Left panel – Clean and bold */}
          <section className="flex flex-col justify-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-medium text-slate-400 shadow-[0_14px_34px_rgba(0,0,0,0.12)] backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
                AI tutoring, revision, testing, and progress in one place
              </div>

              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
                Your autonomous AI study command center.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 md:text-lg">
                AgentifyAI gives every learner a private AI coach that can plan a mission, explain a topic, test understanding, and guide the next best study action.
              </p>
            </div>

            <div className="mt-8 grid max-w-3xl grid-cols-3 gap-3">
              {platformSignals.map(([value, label]) => (
                <MetricTile key={label} label={label} value={value} active={value === "6"} />
              ))}
            </div>

            <div className="login-mission-card mt-8 max-w-4xl rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Autonomous Mission
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    One goal becomes a guided study workflow.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    The coach turns a student request into a plan, explanation, quiz, revision loop, and progress signal.
                  </p>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Live preview
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {missionSteps.map(([step, title, detail], index) => (
                  <div key={title} className="login-mission-step rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-500">{step}</span>
                      <span className={cn("h-2 w-2 rounded-full", index === 0 ? "bg-cyan-300" : index === 3 ? "bg-amber-300" : "bg-emerald-300")} />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-white">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="login-passport-card mt-4 max-w-4xl rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Learning Passport</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Dashboard, sessions, analytics, and Study Lab sync into one private profile.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Coach ready", "Memory sync", "Secure auth"].map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right panel – authentication card (unchanged structure, upgraded buttons) */}
          <section className="flex items-center justify-center">
            <div
              className={cn(
                "login-auth-card w-full rounded-3xl border border-white/10 bg-[#0E1118]/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-500",
                shake && "animate-shake",
                granted && "border-cyan-300/30 shadow-[0_0_40px_rgba(20,184,166,0.16)]",
              )}
            >
              <div className="p-6 md:p-8">
                {granted ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="text-4xl font-bold text-[#0E7490]">ACCESS GRANTED</div>
                    <div className="mt-2 text-sm text-gray-400">Redirecting to dashboard...</div>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">
                          Account access
                        </div>
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
                          Secure
                        </span>
                      </div>
                      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                        Sign in to AgentifyAI
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Continue to your private dashboard, Study Lab, sessions, and autonomous missions.
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {["Private", "Adaptive", "Mission ready"].map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* GOOGLE LOGIN BUTTON (primary variant) */}
                    <Button
                      variant="secondary"
                      size="lg"
                      className="login-google-button w-full"
                      onClick={handleGoogleLogin}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        className="h-5 w-5"
                      >
                        <path fill="#FFC107" d="M43.611 20.083h-1.611V20H24v8h11.303C33.646 32.657 29.202 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z" />
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.548 16.108 18.961 13 24 13c3.061 0 5.856 1.153 7.982 3.045l5.657-5.657C34.133 6.053 29.32 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.153 0 9.86-1.977 13.411-5.197l-6.19-5.238C29.219 35.091 26.715 36 24 36c-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083h-1.611V20H24v8h11.303c-1.15 3.388-4.292 6-8.303 6-5.18 0-9.614-3.317-11.231-7.946l-6.527 5.033C9.555 39.556 16.271 44 24 44c11.045 0 20-8.955 20-20 0-1.341-.138-2.651-.389-3.917z" />
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="h-px bg-white/10" />
                        <span className="text-[11px] font-medium text-slate-500">
                        Phone OTP
                      </span>
                      <div className="h-px bg-white/10" />
                    </div>

                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-2 block text-[9px] uppercase tracking-[0.22em] text-[#6B6B6B] font-mono">
                          Mobile Number
                        </span>
                        <div className="relative">
                          <input
                            value={phoneNumber}
                            onChange={(event) => setPhoneNumber(event.target.value)}
                            placeholder="+91 98765 43210"
                            disabled={otpSent}
                            className="login-input w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-[#E6E6E6] outline-none transition-colors placeholder:text-[#6B6B6B] focus:border-[#0E7490] disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          {!phoneNumber && !otpSent && (
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 animate-pulse text-[#0E7490]">
                              _
                            </span>
                          )}
                        </div>
                      </label>

                      {!otpSent ? (
                        <Button
                          variant="primary"
                          size="lg"
                          className="w-full"
                          onClick={handleSendOtp}
                          disabled={sendingOtp}
                        >
                          {sendingOtp ? "Sending OTP..." : "Send OTP"}
                        </Button>
                      ) : (
                        <>
                          <label className="block">
                            <span className="mb-2 block text-[9px] uppercase tracking-[0.22em] text-[#6B6B6B] font-mono">
                              Verification Code
                            </span>
                            <div className="relative">
                              <input
                                value={otp}
                                onChange={(event) => setOtp(event.target.value)}
                                placeholder="ENTER OTP"
                                className="login-input w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-[#E6E6E6] outline-none transition-colors placeholder:text-[#6B6B6B] focus:border-emerald-400"
                              />
                              {!otp && (
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 animate-pulse text-emerald-400">
                                  _
                                </span>
                              )}
                            </div>
                          </label>

                          <Button
                            variant="primary"
                            size="lg"
                            className="w-full !bg-emerald-500 !border-emerald-500 hover:!bg-emerald-600"
                            onClick={handleVerifyOtp}
                            disabled={verifyingOtp}
                          >
                            {verifyingOtp ? "Verifying..." : "Verify and continue"}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setOtpSent(false);
                              setOtp("");
                              setAuthError("");
                            }}
                          >
                            Change phone number
                          </Button>
                        </>
                      )}
                    </div>

                    {authError && (
                      <div
                        className={cn(
                          "mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-red-400",
                          shake && "animate-shake",
                        )}
                      >
                        {authError}
                      </div>
                    )}

                    <div className="login-provider-card mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                        <span className="text-[#6B6B6B] font-mono">Provider</span>
                        <span className="text-emerald-400 font-mono">Firebase Auth</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                        <span className="text-[#6B6B6B] font-mono">Status</span>
                        <span className="text-[#0E7490] font-mono">OTP Enabled</span>
                      </div>
                    </div>
                  </>
                )}

                <p className="mt-5 text-center text-[10px] uppercase tracking-[0.18em] text-[#6B6B6B] font-mono">
                  By continuing, you agree to our Terms and Privacy Policy
                </p>

                <div id="recaptcha-container" />
              </div>
            </div>
          </section>
          </div>
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
      `}</style>
    </div>
  );
}
