import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  "/:locale/dashboard(.*)",
  "/:locale/cases(.*)",
  "/:locale/new-case(.*)",
  "/:locale/results(.*)",
  "/:locale/intake(.*)",
  "/:locale/case(.*)",
  "/:locale/patient",
  "/:locale/patient/new(.*)",
  "/:locale/patient/reports(.*)",
  "/:locale/patient/submissions(.*)",
  "/:locale/settings(.*)",
  "/dashboard(.*)",
  "/cases(.*)",
  "/new-case(.*)",
  "/results(.*)",
  "/intake(.*)",
  "/case(.*)",
  "/patient",
  "/patient/new(.*)",
  "/patient/reports(.*)",
  "/patient/submissions(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedRoute(req)) await auth.protect();
  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
