import type { Metadata } from "next";
import { LevelWorkspace } from "@/components/level/level-workspace";

export const metadata: Metadata = { title: "Level & limits" };

export default function LevelPage() {
  return <LevelWorkspace />;
}
