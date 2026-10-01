import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/nav";

export default function Home() {
  redirect(ROUTES.scouting);
}
