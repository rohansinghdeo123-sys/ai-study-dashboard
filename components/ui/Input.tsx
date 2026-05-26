import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "ghost";
}

export default function Input({ variant = "default", className, ...props }: InputProps) {
  const base =
    "agentify-field w-full min-h-11 rounded-2xl px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-text-disabled disabled:cursor-not-allowed disabled:opacity-55";

  const variants = {
    default:
      "border border-border-default bg-surface-2 text-text-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue",
    ghost:
      "bg-transparent border-none text-text-primary focus:bg-surface-2",
  };

  return (
    <input
      className={cn(base, variants[variant], className)}
      {...props}
    />
  );
}
