"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readStoredUserRole } from "@/lib/user-role";

export function RoleGuard({ allowed, redirectTo, children }: { allowed: string[], redirectTo: string, children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      let role = user?.publicMetadata?.role as string;
      if (!role && typeof window !== "undefined") {
        role = readStoredUserRole();
      }
      
      if (!role || !allowed.includes(role)) {
        router.push(redirectTo);
      }
    }
  }, [user, isLoaded, allowed, redirectTo, router]);

  if (!isLoaded) {
    return null;
  }

  let role = user?.publicMetadata?.role as string;
  if (!role && typeof window !== "undefined") {
    role = readStoredUserRole();
  }

  if (!role || !allowed.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
