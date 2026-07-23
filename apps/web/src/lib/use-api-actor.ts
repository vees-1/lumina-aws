"use client";

import { useMemo } from "react";
import { readStoredUserRole } from "@/lib/user-role";
import type { ApiActor } from "@/lib/api";

export function useApiActor(): ApiActor | null {
  const role = readStoredUserRole();
  const userId = `local-${role}`;
  const actor = useMemo(() => ({ userId, role }), [role, userId]);
  return actor;
}
