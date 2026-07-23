"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { ShieldCheck, Activity, FlaskConical } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="clinvarPage" icons={[ShieldCheck, Activity, FlaskConical]} />;
}
