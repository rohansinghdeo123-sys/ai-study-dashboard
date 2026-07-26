import { redirect } from "next/navigation";

export default function ProgressRedirectPage() {
  redirect("/dashboard/analytics");
}
