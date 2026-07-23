"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { Briefcase, Layout, Users } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="doctorWorkspace" icons={[Briefcase, Layout, Users]} />;
}
