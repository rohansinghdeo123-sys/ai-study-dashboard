import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  CSSProperties,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { AppIcon, type AppIconName } from "@/components/ui/Polished";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "ghost";

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-2 text-xs",
  md: "min-h-10 px-4 py-2.5 text-sm",
  lg: "min-h-12 px-5 py-3 text-base",
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "ds-button-primary",
  secondary: "ds-button-secondary",
  ghost: "ds-button-ghost",
  danger: "ds-button-danger",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("agentify-action ds-button", buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ds-skeleton h-3 w-3 rounded-full" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export interface InputProps extends ComponentPropsWithoutRef<"input"> {
  variant?: InputVariant;
}

export function IconButton({
  label,
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: AppIconName;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={children ? undefined : label}
      className={cn("agentify-action ds-icon-button", className)}
      {...props}
    >
      <AppIcon name={icon} />
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function Input({ variant = "default", className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "agentify-field ds-field",
        variant === "ghost" && "border-transparent bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("agentify-field ds-field min-h-28 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select className={cn("agentify-field ds-field appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  return <input className={cn("h-4 w-4 rounded border-[color:var(--ds-border)] accent-[var(--ds-accent-teal)]", className)} {...props} type="checkbox" />;
}

export function Radio({ className, ...props }: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  return <input className={cn("h-4 w-4 border-[color:var(--ds-border)] accent-[var(--ds-accent-teal)]", className)} {...props} type="radio" />;
}

export function Switch({
  checked,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full border border-[color:var(--ds-border)] transition-colors",
        checked ? "bg-[color:var(--ds-accent-teal)]" : "bg-[color:var(--ds-bg-subtle)]",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Tabs({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-[var(--ds-radius-md)] border border-[color:var(--ds-border)] bg-[color:var(--ds-bg-subtle)] p-1", className)} role="tablist" {...props}>
      {children}
    </div>
  );
}

export function TabButton({
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={Boolean(selected)}
      className={cn(
        "rounded-[var(--ds-radius-sm)] px-3 py-2 text-sm font-semibold transition-colors",
        selected
          ? "bg-[color:var(--ds-surface-elevated)] text-[color:var(--ds-text-primary)] shadow-[var(--ds-shadow-sm)]"
          : "text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Dialog({
  open,
  title,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--ds-z-overlay)] grid place-items-center bg-[color:var(--ds-surface-overlay)] p-4" role="presentation">
      <section className="ds-card-elevated w-full max-w-lg p-5" role="dialog" aria-modal="true" aria-labelledby="ds-dialog-title">
        <h2 id="ds-dialog-title" className="text-lg font-semibold text-[color:var(--ds-text-primary)]">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-[color:var(--ds-text-secondary)]">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </section>
    </div>
  );
}

export function Drawer({ open, children, side = "right" }: { open: boolean; children: ReactNode; side?: "left" | "right" }) {
  if (!open) return null;
  return (
    <aside
      className={cn(
        "fixed top-0 z-[var(--ds-z-overlay)] h-dvh w-full max-w-sm border-[color:var(--ds-border)] bg-[color:var(--ds-surface-elevated)] p-5 shadow-[var(--ds-shadow-lg)]",
        side === "left" ? "left-0 border-r" : "right-0 border-l",
      )}
    >
      {children}
    </aside>
  );
}

export function Dropdown({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("ds-card-elevated z-[var(--ds-z-popover)] min-w-48 p-1", className)} {...props}>{children}</div>;
}

export function Popover({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("ds-card-elevated z-[var(--ds-z-popover)] max-w-sm p-4", className)} {...props}>{children}</div>;
}

export function Tooltip({ children, className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span role="tooltip" className={cn("rounded-[var(--ds-radius-sm)] bg-slate-950 px-2 py-1 text-xs font-semibold text-white shadow-[var(--ds-shadow-md)]", className)} {...props}>{children}</span>;
}

export function Toast({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  return <div className={cn("ds-alert fixed bottom-4 right-4 z-[var(--ds-z-toast)] max-w-sm", toneClass(tone))} role="status">{children}</div>;
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  return <div className={cn("ds-alert", toneClass(tone))} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}

export function Card({ children, className, elevated = false, ...props }: ComponentPropsWithoutRef<"section"> & { elevated?: boolean }) {
  return <section className={cn(elevated ? "ds-card-elevated" : "ds-card", className)} {...props}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={cn("ds-badge", toneClass(tone))}>{children}</span>;
}

export function Table({ className, ...props }: ComponentPropsWithoutRef<"table">) {
  return <table className={cn("ds-table", className)} {...props} />;
}

export function Pagination({ children, className, ...props }: ComponentPropsWithoutRef<"nav">) {
  return <nav className={cn("flex items-center justify-between gap-2", className)} aria-label="Pagination" {...props}>{children}</nav>;
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("ds-skeleton block h-3 w-full", className)} aria-hidden="true" />;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <Card className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold text-[color:var(--ds-text-primary)]">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[color:var(--ds-text-muted)]">{detail}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function ErrorState({ title = "Something went wrong", detail, action }: { title?: string; detail: string; action?: ReactNode }) {
  return (
    <Card className="border-[color:var(--ds-danger)] bg-[color:var(--ds-danger-soft)] p-6 text-center" role="alert">
      <h2 className="text-xl font-semibold text-[color:var(--ds-text-primary)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--ds-text-secondary)]">{detail}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function LoadingState({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card className="p-5" aria-live="polite" role="status">
      <p className="font-semibold text-[color:var(--ds-text-primary)]">{title}</p>
      {detail ? <p className="mt-1 text-sm text-[color:var(--ds-text-muted)]">{detail}</p> : null}
      <div className="mt-4 space-y-2">
        <Skeleton />
        <Skeleton className="w-4/5" />
      </div>
    </Card>
  );
}

export function ProgressIndicator({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[color:var(--ds-text-muted)]">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--ds-bg-subtle)]">
        <span className="block h-full rounded-full bg-[color:var(--ds-accent-teal)]" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function SourceCard({ title, detail, href }: { title: string; detail?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{title}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[color:var(--ds-text-muted)]">{detail}</p> : null}
    </>
  );
  return href ? <a className="ds-card block p-4 transition hover:border-[color:var(--ds-border-strong)]" href={href}>{body}</a> : <Card className="p-4">{body}</Card>;
}

export function ChartContainer({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-[color:var(--ds-text-primary)]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--ds-text-muted)]">{summary}</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function FormField({ label, help, error, children }: { label: string; help?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="ds-label">{label}</span>
      {children}
      {error ? <span className="block text-xs font-semibold text-[color:var(--ds-danger)]">{error}</span> : help ? <span className="ds-help-text block">{help}</span> : null}
    </label>
  );
}

export function FileUpload({ label = "Upload file", ...props }: Omit<ComponentPropsWithoutRef<"input">, "type"> & { label?: string }) {
  return (
    <label className="ds-card flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-6 text-center">
      <span className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{label}</span>
      <span className="text-xs text-[color:var(--ds-text-muted)]">Choose a file from your device</span>
      <input className="sr-only" {...props} type="file" />
    </label>
  );
}

export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button type="button" variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      {detail}
    </Dialog>
  );
}

function toneClass(tone: "neutral" | "info" | "success" | "warning" | "danger") {
  if (tone === "success") return "border-[color:var(--ds-success)] bg-[color:var(--ds-success-soft)] text-[color:var(--ds-success)]";
  if (tone === "warning") return "border-[color:var(--ds-warning)] bg-[color:var(--ds-warning-soft)] text-[color:var(--ds-warning)]";
  if (tone === "danger") return "border-[color:var(--ds-danger)] bg-[color:var(--ds-danger-soft)] text-[color:var(--ds-danger)]";
  if (tone === "info") return "border-[color:var(--ds-info)] bg-[color:var(--ds-info-soft)] text-[color:var(--ds-info)]";
  return "";
}

export const primitiveNames = [
  "Button",
  "IconButton",
  "Input",
  "Textarea",
  "Select",
  "Checkbox",
  "Radio",
  "Switch",
  "Tabs",
  "Dialog",
  "Drawer",
  "Dropdown",
  "Popover",
  "Tooltip",
  "Toast",
  "Alert",
  "Card",
  "Badge",
  "Table",
  "Pagination",
  "Skeleton",
  "EmptyState",
  "ErrorState",
  "LoadingState",
  "ProgressIndicator",
  "SourceCard",
  "ChartContainer",
  "FormField",
  "FileUpload",
  "ConfirmDialog",
] as const;

export type PrimitiveName = (typeof primitiveNames)[number];

export const primitivePreviewStyle: CSSProperties = {
  background: "var(--ds-bg-app)",
  color: "var(--ds-text-primary)",
};
