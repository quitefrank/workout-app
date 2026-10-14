import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { AppScroller } from "@/components/app-scroller";
import { GlassContext } from "@/components/glass-context";
import { TabBar } from "@/components/tab-bar";
import { GlassDebug } from "@/glass/debug";
import { GlassStage } from "@/glass/glass-stage";
import { SetupNeeded } from "@/components/setup-needed";
import { THEME_COOKIE, themeFrom } from "@/lib/appearance";
import { getInProgress } from "@/lib/data/queries";
import { missingConfig } from "@/lib/supabase/server";
import "./globals.css";

const APP_NAME = "Workout";
const APP_DESCRIPTION = "Personal workout tracker. Log lifts, see progress.";

// Every screen reads live rows; nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

/** The browser chrome follows the Settings choice when there is one, the phone's appearance otherwise */
export async function generateViewport(): Promise<Viewport> {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return {
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: "#ffffff" },
            { media: "(prefers-color-scheme: dark)", color: "#000000" },
          ]
        : theme === "dark"
          ? "#000000"
          : "#ffffff",
    colorScheme: theme === "system" ? "light dark" : theme,
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The Settings choice of light or dark on this device, written onto <html> so the first paint is right
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  const forced = theme === "system" ? undefined : theme;
  // A deploy without its settings, or one Supabase refuses, explains itself instead of a bare 500
  const missing = missingConfig();
  let problem: string | null = null;
  let inProgress: Awaited<ReturnType<typeof getInProgress>> = null;
  if (missing.length === 0) {
    try {
      inProgress = await getInProgress();
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
  }
  if (missing.length > 0 || problem) {
    return (
      <html lang="en" data-theme={forced} className="h-full antialiased">
        <body className="flex min-h-full flex-col">
          <SetupNeeded missing={missing} problem={problem} />
        </body>
      </html>
    );
  }
  return (
    <html lang="en" data-theme={forced} className="h-full antialiased">
      <body className="h-full">
        <AppScroller>{children}</AppScroller>
        <TabBar
          inProgress={inProgress && { id: inProgress.id, name: inProgress.name, startedAt: inProgress.startedAt }}
        />
        <GlassContext />
        <GlassStage />
        <GlassDebug />
        <Toaster position="top-center" theme={theme} toastOptions={{ className: "!rounded-[20px]" }} />
      </body>
    </html>
  );
}
