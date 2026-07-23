"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { Book, Code, Share2 } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="hpoOntology" icons={[Book, Code, Share2]} />;
}
