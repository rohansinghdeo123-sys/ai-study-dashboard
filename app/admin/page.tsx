"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminShortcutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/internal/admin");
  }, [router]);

  return null;
}
