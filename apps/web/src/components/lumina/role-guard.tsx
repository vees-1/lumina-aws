"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readStoredAuthSession, readStoredUserRole } from "@/lib/user-role";

export function RoleGuard({ allowed, redirectTo, children }: { allowed: string[], redirectTo: string, children: React.ReactNode }) {
  const router = useRouter();
  const role = readStoredUserRole();
  const isSignedIn = readStoredAuthSession(true);

  useEffect(() => {
    if (!isSignedIn || !allowed.includes(role)) {
      router.push(redirectTo);
    }
  }, [allowed, isSignedIn, redirectTo, role, router]);

  if (!isSignedIn || !allowed.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
