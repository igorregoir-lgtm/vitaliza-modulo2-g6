import type { Metadata } from "next";
import { TrilhaMap } from "@/components/trilha/trilha-map";

export const metadata: Metadata = { title: "Trilha de Aprendizado" };

export default function TrilhaPage() {
  return <TrilhaMap />;
}
