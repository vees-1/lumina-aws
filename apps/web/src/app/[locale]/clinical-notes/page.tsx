"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { FileText, Mic, Zap } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="clinicalNotes" icons={[FileText, Mic, Zap]} />;
}
