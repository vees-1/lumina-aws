"use client";

import { useEffect, useState } from "react";
import { readStoredAuthSession, readStoredUserRole } from "@/lib/user-role";
import { getStoredCognitoClaims, getStoredCognitoToken } from "@/lib/cognito-auth";
import type { ApiActor } from "@/lib/api";

export function useApiActor(): ApiActor | null {
  const [actor, setActor] = useState<ApiActor | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!readStoredAuthSession(false)) {
        setActor(null);
        return;
      }
      const claims = getStoredCognitoClaims();
      const token = getStoredCognitoToken();
      const role = claims?.role ?? readStoredUserRole();
      setActor({
        userId: claims?.sub ?? `local-${role}`,
        role,
        token: token ?? undefined,
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return actor;
}
