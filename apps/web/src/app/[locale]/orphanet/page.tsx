"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { Globe, Search, Database } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="orphanet" icons={[Globe, Search, Database]} />;
}
