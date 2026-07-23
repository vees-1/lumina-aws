"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { UserPlus, ClipboardList, Shield } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="patientPreIntake" icons={[UserPlus, ClipboardList, Shield]} />;
}
