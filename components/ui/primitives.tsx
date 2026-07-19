"use client";

import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  ReactNode,
} from "react";
import { useId, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { AppIcon, type AppIconName } from "@/components/ui/Polished";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const openDialogStack: HTMLElement[] = [];
let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = "";

function toDomId(prefix: string, reactId: string) {
  return `${prefix}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (
      element.closest("[inert]") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function focusWithoutScrolling(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock;
  }
}

function getTabs(tabList: HTMLElement) {
  return Array.from(tabList.querySelectorAll<HTMLButtonElement>("[role='tab']")).filter(
    (tab) =>
      tab.closest("[role='tablist']") === tabList &&
      !tab.disabled &&
      tab.getAttribute("aria-disabled") !== "true",
  );
}

function setTabStop(tabs: HTMLButtonElement[], activeTab: HTMLButtonElement) {
  for (const tab of tabs) tab.tabIndex = tab === activeTab ? 0 : -1;
}

export function handleTabListKeyDown<T extends HTMLElement>(event: ReactKeyboardEvent<T>) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

  const tabList = event.currentTarget;
  const eventTarget = event.target instanceof Element ? event.target : null;
  const currentTab = eventTarget?.closest<HTMLButtonElement>("[role='tab']");
  if (!currentTab || currentTab.closest("[role='tablist']") !== tabList) return;

  const tabs = getTabs(tabList);
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0 || tabs.length === 0) return;

  const orientation = tabList.getAttribute("aria-orientation") ?? "horizontal";
  const isRtl = window.getComputedStyle(tabList).direction === "rtl";
  let nextIndex: number | null = null;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = tabs.length - 1;
  if (event.key === "ArrowRight") nextIndex = currentIndex + (isRtl ? -1 : 1);
  if (event.key === "ArrowLeft") nextIndex = currentIndex + (isRtl ? 1 : -1);
  if (orientation === "vertical" && event.key === "ArrowDown") nextIndex = currentIndex + 1;
  if (orientation === "vertical" && event.key === "ArrowUp") nextIndex = currentIndex - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  const nextTab = tabs[(nextIndex + tabs.length) % tabs.length];
  setTabStop(tabs, nextTab);
  focusWithoutScrolling(nextTab);
  nextTab.click();
}

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

export function Tabs({
  children,
  className,
  onFocusCapture,
  onKeyDown,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const orientation = props["aria-orientation"] ?? "horizontal";

  useLayoutEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;
    const tabs = getTabs(tabList);
    const selectedTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    const currentTabStop = tabs.find((tab) => tab.tabIndex === 0);
    const activeTab = selectedTab ?? currentTabStop ?? tabs[0];
    if (activeTab) setTabStop(tabs, activeTab);
  }, [children]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    handleTabListKeyDown(event);
  }

  return (
    <div
      {...props}
      ref={tabListRef}
      className={cn("flex flex-wrap gap-1 rounded-[var(--ds-radius-md)] border border-[color:var(--ds-border)] bg-[color:var(--ds-bg-subtle)] p-1", className)}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      onFocusCapture={(event) => {
        onFocusCapture?.(event);
        if (event.defaultPrevented) return;
        const tab = event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>("[role='tab']")
          : null;
        const tabList = tabListRef.current;
        if (tab && tabList && tab.closest("[role='tablist']") === tabList && !tab.disabled) {
          setTabStop(getTabs(tabList), tab);
        }
      }}
    >
      {children}
    </div>
  );
}

export interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  panelId?: string;
}

export function TabButton({
  selected,
  panelId,
  className,
  id,
  tabIndex,
  disabled,
  "aria-controls": ariaControls,
  "aria-disabled": ariaDisabled,
  "aria-selected": ariaSelected,
  ...props
}: TabButtonProps) {
  const generatedId = toDomId("ds-tab", useId());
  const isSelected = selected ?? (ariaSelected === true || ariaSelected === "true");
  const isDisabled = disabled || ariaDisabled === true || ariaDisabled === "true";

  return (
    <button
      {...props}
      id={id ?? generatedId}
      type="button"
      role="tab"
      disabled={disabled}
      aria-disabled={ariaDisabled}
      aria-selected={isSelected}
      aria-controls={ariaControls ?? panelId}
      tabIndex={isDisabled ? -1 : tabIndex ?? (isSelected ? 0 : -1)}
      className={cn(
        "rounded-[var(--ds-radius-sm)] px-3 py-2 text-sm font-semibold transition-colors",
        isSelected
          ? "bg-[color:var(--ds-surface-elevated)] text-[color:var(--ds-text-primary)] shadow-[var(--ds-shadow-sm)]"
          : "text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text-primary)]",
        className,
      )}
    />
  );
}

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Dialog({
  open,
  title,
  children,
  footer,
  onClose,
  initialFocusRef,
}: DialogProps) {
  const generatedId = toDomId("ds-dialog", useId());
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const backdropPointerDownRef = useRef(false);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (open) return;

    function rememberFocus(target: EventTarget | null) {
      if (!(target instanceof HTMLElement) || target === document.body) return;
      if (target.closest(`[data-dialog-id='${generatedId}']`)) return;
      restoreFocusRef.current = target;
    }

    rememberFocus(document.activeElement);
    const handleFocusIn = (event: FocusEvent) => rememberFocus(event.target);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      rememberFocus(document.activeElement);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [generatedId, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const preferredTarget = initialFocusRef?.current;
    const autoFocusTarget = dialog.querySelector<HTMLElement>("[autofocus], [data-dialog-autofocus]");
    const target = preferredTarget && dialog.contains(preferredTarget)
      ? preferredTarget
      : autoFocusTarget ?? getFocusableElements(dialog)[0] ?? dialog;
    focusWithoutScrolling(target);
  }, [initialFocusRef, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    openDialogStack.push(dialog);
    lockBodyScroll();

    const isTopDialog = () => openDialogStack[openDialogStack.length - 1] === dialog;
    const focusFirstAvailable = () => {
      const preferredTarget = initialFocusRef?.current;
      const target = preferredTarget && dialog.contains(preferredTarget)
        ? preferredTarget
        : getFocusableElements(dialog)[0] ?? dialog;
      focusWithoutScrolling(target);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) return;
      if (event.key === "Escape" && !event.defaultPrevented && onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (
        event.key !== "Tab" ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusWithoutScrolling(dialog);
        return;
      }

      const activeElement = document.activeElement;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!activeElement || !dialog.contains(activeElement) || activeElement === dialog) {
        event.preventDefault();
        focusWithoutScrolling(event.shiftKey ? lastElement : firstElement);
        return;
      }
      if (focusableElements.length === 1) {
        event.preventDefault();
        focusWithoutScrolling(firstElement);
        return;
      }
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        focusWithoutScrolling(lastElement);
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        focusWithoutScrolling(firstElement);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopDialog() || !(event.target instanceof Node) || dialog.contains(event.target)) return;
      focusFirstAvailable();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      const stackIndex = openDialogStack.lastIndexOf(dialog);
      if (stackIndex >= 0) openDialogStack.splice(stackIndex, 1);
      unlockBodyScroll();

      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget?.isConnected && !restoreTarget.hasAttribute("disabled")) {
        focusWithoutScrolling(restoreTarget);
      }
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  function requestClose() {
    const dialog = dialogRef.current;
    if (dialog && openDialogStack.length > 0 && openDialogStack[openDialogStack.length - 1] !== dialog) {
      return;
    }
    onCloseRef.current?.();
  }

  function handleBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    backdropPointerDownRef.current = event.target === event.currentTarget;
  }

  function handleBackdropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const shouldClose = backdropPointerDownRef.current && event.target === event.currentTarget;
    backdropPointerDownRef.current = false;
    if (shouldClose) requestClose();
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.detail === 0 && event.target === event.currentTarget) requestClose();
  }

  return (
    <div
      className="fixed inset-0 z-[var(--ds-z-overlay)] grid place-items-center bg-[color:var(--ds-surface-overlay)] p-4"
      role="presentation"
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={() => {
        backdropPointerDownRef.current = false;
      }}
      onClick={handleBackdropClick}
    >
      <section
        ref={dialogRef}
        className="ds-card-elevated w-full max-w-lg p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-dialog-id={generatedId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="text-lg font-semibold text-[color:var(--ds-text-primary)]">{title}</h2>
        <div id={descriptionId} className="mt-4 text-sm leading-6 text-[color:var(--ds-text-secondary)]">{children}</div>
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
      onClose={onCancel}
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
