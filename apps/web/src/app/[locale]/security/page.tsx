"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { Shield, Lock, UserCheck } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="securityPage" icons={[Shield, Lock, UserCheck]} />;
}
