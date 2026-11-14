import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // No reload when iOS reports the connection back, and no page copies kept on navigation: in a home screen app on
  // iOS 26 the page reloaded every second or two (the readout's frame count fell between screenshots) and came back
  // on an old build. Pages still load network first, with the last copy as the offline fallback.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
  // The exercise illustrations (about 9 MB at 1024px) are cached as they are first shown, not all at install
  publicExcludes: ["!noprecache/**/*", "!exercises/**/*"],
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // A page visited in the last 30 seconds comes back from the client's cache (Back, a tab switch) instead of a fresh
    // server render (2026-11-14). Every server action that changes data revalidates the layout, which clears it.
    staleTimes: { dynamic: 30 },
  },
};

export default withPWA(nextConfig);
