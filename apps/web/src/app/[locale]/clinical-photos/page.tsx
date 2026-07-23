"use client";

import { InfoPage } from "@/components/lumina/info-page";
import { Camera, Scan, Eye } from "lucide-react";

export default function Page() {
  return <InfoPage namespace="clinicalPhotos" icons={[Camera, Scan, Eye]} />;
}
