"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { readStoredAuthSession, readStoredUserRole } from "@/lib/user-role";

export function RoleGuard({ allowed, redirectTo, children }: { allowed: string[], redirectTo: string, children: React.ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [authState, setAuthState] = useState<{ isSignedIn: boolean; role: string } | null>(null);
  const localizedRedirect = redirectTo.startsWith(`/${locale}/`)
    ? redirectTo
    : `/${locale}${redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`}`;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAuthState({
        isSignedIn: readStoredAuthSession(false),
        role: readStoredUserRole(),
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!authState) return;
    if (!authState.isSignedIn || !allowed.includes(authState.role)) {
      const destination = authState.isSignedIn ? localizedRedirect : `/${locale}/sign-in`;
      router.replace(destination);
    }
  }, [allowed, authState, locale, localizedRedirect, router]);

  if (!authState?.isSignedIn || !allowed.includes(authState.role)) {
    return null;
  }

  return <>{children}</>;
}
