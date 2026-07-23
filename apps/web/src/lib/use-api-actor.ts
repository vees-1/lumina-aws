"use client";

import { useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import { readStoredUserRole } from "@/lib/user-role";
import type { ApiActor } from "@/lib/api";

export function useApiActor(): ApiActor | null {
  const { user, isLoaded } = useUser();
  const role = isLoaded
    ? user?.publicMetadata?.role === "patient"
      ? "patient"
      : user?.publicMetadata?.role === "doctor"
      ? "doctor"
      : readStoredUserRole()
    : "doctor";
  const userId = user?.id ?? `local-${role}`;
  const actor = useMemo(() => ({ userId, role }), [role, userId]);
  return isLoaded ? actor : null;
}
