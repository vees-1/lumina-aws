"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { FlaskConical, Table, Activity } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="labReports" icons={[FlaskConical, Table, Activity]} />;
}
