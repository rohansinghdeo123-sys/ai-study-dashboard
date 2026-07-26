import { redirect } from "next/navigation";

export default function MissionRedirectPage() {
  redirect("/dashboard/planning");
}
