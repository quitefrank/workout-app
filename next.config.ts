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
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
