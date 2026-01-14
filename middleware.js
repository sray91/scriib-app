import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// This middleware enforces authentication across your app
// Public routes are accessible without authentication
// Ignored routes are completely bypassed by Clerk (e.g., LinkedIn/Twitter OAuth for posting)

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/signup(.*)",
  "/reset-password(.*)",
  "/approver-signup(.*)",
  "/invite-complete(.*)",
  "/shared/(.*)",
  "/api/webhooks/clerk",
]);

// Define routes that should be ignored by Clerk middleware
// LinkedIn/Twitter OAuth are for POSTING content, not authentication
const isIgnoredRoute = createRouteMatcher([
  "/api/auth/linkedin/(.*)",
  "/api/auth/twitter/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Skip Clerk middleware for ignored routes
  if (isIgnoredRoute(req)) {
    return;
  }

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};