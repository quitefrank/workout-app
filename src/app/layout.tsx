import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { GlassContext } from "@/components/glass-context";
import { TabBar } from "@/components/tab-bar";
import { SetupNeeded } from "@/components/setup-needed";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      <html lang="en" className="h-full antialiased">
        <body className="flex min-h-full flex-col">
          <SetupNeeded missing={missing} problem={problem} />
        </body>
      </html>
    );
  }
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <TabBar
          inProgress={inProgress && { id: inProgress.id, name: inProgress.name, startedAt: inProgress.startedAt }}
        />
        <GlassContext />
        <Toaster position="top-center" theme="system" toastOptions={{ className: "!rounded-[20px]" }} />
      </body>
    </html>
  );
}
