import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { TabBar } from "@/components/tab-bar";
import { getInProgress } from "@/lib/data/queries";
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
  const inProgress = await getInProgress();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <TabBar
          inProgress={inProgress && { id: inProgress.id, name: inProgress.name, startedAt: inProgress.startedAt }}
        />
        <Toaster position="top-center" theme="system" toastOptions={{ className: "!rounded-[20px]" }} />
      </body>
    </html>
  );
}
