"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { LineChart, Activity, Bell } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="doctorDashboardInfo" icons={[LineChart, Activity, Bell]} />;
}
