import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "agentify-action inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl font-semibold transition-all focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary:
      "agentify-action-primary border border-transparent bg-[linear-gradient(135deg,#0F172A_0%,#0E7490_46%,#14B8A6_100%)] text-white shadow-[0_14px_30px_rgba(14,116,144,0.18)] hover:brightness-110 active:brightness-95",
    secondary:
      "agentify-action-secondary border border-[var(--color-border-default)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]",
    ghost:
      "agentify-action-ghost bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]",
    danger:
      "agentify-action-danger border border-transparent bg-[var(--color-accent-red)] text-white hover:brightness-110 active:brightness-95",
  };

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
