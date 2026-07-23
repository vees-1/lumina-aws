"use client";

import { useMemo } from "react";
import { readStoredUserRole } from "@/lib/user-role";
import { getStoredCognitoClaims, getStoredCognitoToken } from "@/lib/cognito-auth";
import type { ApiActor } from "@/lib/api";

export function useApiActor(): ApiActor | null {
  const claims = getStoredCognitoClaims();
  const token = getStoredCognitoToken();
  const fallbackRole = readStoredUserRole();

  const role = claims?.role ?? fallbackRole;
  const userId = claims?.sub ?? `local-${role}`;

  const actor = useMemo(
    () => ({ userId, role, token: token ?? undefined }),
    [userId, role, token]
  );

  return actor;
}
