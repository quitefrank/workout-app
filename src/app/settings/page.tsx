import { BackButton } from "@/components/back-button";
import { LargeTitle, Screen } from "@/components/page";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeFrom } from "@/lib/appearance";
import { getSettings } from "@/lib/data/queries";
import { libraryLayoutFrom } from "@/lib/library-layout";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, jar] = await Promise.all([getSettings(), cookies()]);
  const theme = themeFrom(jar.get(THEME_COOKIE)?.value);
  const libraryLayout = libraryLayoutFrom((n) => jar.get(n)?.value);
  return (
    <Screen>
      {/* back to whichever page opened Settings (Home, or a workout's page while tuning its Start Workout edge) */}
      <LargeTitle title="Settings" leading={<BackButton />} />
      <SettingsForm settings={settings} theme={theme} libraryLayout={libraryLayout} />
    </Screen>
  );
}
