"use client";

import { AppIcon } from "@/components/ui/Polished";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./planning.module.css";

export function PlanningScreen({
  eyebrow,
  title,
  intro,
  backHref,
  backLabel = "Planning Home",
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <section className={styles.screen}>
      <div className={styles.ambient} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.scroll}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.headerCopy}>
              {backHref ? (
                <Link href={backHref} className={styles.backLink}>
                  <span aria-hidden="true">←</span>
                  {backLabel}
                </Link>
              ) : null}
              <p className={styles.eyebrow}>{eyebrow}</p>
              <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
              <p className={styles.intro}>{intro}</p>
            </div>
            {actions ? <div className={styles.headerActions}>{actions}</div> : null}
          </header>
          {children}
          <footer className={styles.footerNote}>
            <AppIcon name="history" />
            <span>Plan snapshots are kept on this device. Verified learning activity is recorded only after the learning service confirms it.</span>
          </footer>
        </div>
      </div>
    </section>
  );
}

export function PlanningLoading({ label = "Preparing Planning..." }: { label?: string }) {
  return (
    <section className={styles.screen}>
      <div className={styles.loadingState} role="status" aria-live="polite">
        <span className={styles.loadingMark} aria-hidden="true" />
        <strong>{label}</strong>
        <small>Restoring your learning context on this device.</small>
      </div>
    </section>
  );
}

export { styles as planningStyles };
