"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { CheckCircle, BarChart, ClipboardCheck } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="scorecardReview" icons={[CheckCircle, BarChart, ClipboardCheck]} />;
}
