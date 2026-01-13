import { authMiddleware } from "@clerk/nextjs";

// This middleware enforces authentication across your app
// Public routes are accessible without authentication
// Ignored routes are completely bypassed by Clerk (e.g., LinkedIn/Twitter OAuth for posting)
export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    "/login",
    "/signup",
    "/reset-password",
    "/approver-signup",
    "/invite-complete",
    "/shared/(.*)",
    "/api/webhooks/clerk",
  ],
  // Routes that should be ignored by Clerk middleware
  // LinkedIn/Twitter OAuth are for POSTING content, not authentication
  ignoredRoutes: [
    "/api/auth/linkedin/(.*)",
    "/api/auth/twitter/(.*)",
  ],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};