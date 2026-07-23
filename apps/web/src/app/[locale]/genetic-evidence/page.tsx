"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { Dna, Layers, Lock } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="geneticEvidence" icons={[Dna, Layers, Lock]} />;
}
