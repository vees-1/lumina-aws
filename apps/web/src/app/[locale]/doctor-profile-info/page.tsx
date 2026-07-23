"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { User, Settings, Key } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="doctorProfileInfo" icons={[User, Settings, Key]} />;
}
