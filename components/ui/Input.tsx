import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "ghost";
}

export default function Input({ variant = "default", className, ...props }: InputProps) {
  const base =
    "w-full px-3 py-2.5 text-sm rounded-md outline-none transition-colors placeholder:text-text-disabled";

  const variants = {
    default:
      "bg-surface-2 border border-border-default text-text-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue",
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