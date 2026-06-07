import { redirect } from "next/navigation";

export default function InternalOpsRedirectPage() {
  redirect("/dashboard/internal/admin");
}
