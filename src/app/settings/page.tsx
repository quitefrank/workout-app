import { GlassCircleLink } from "@/components/glass";
import { ChevronLeft } from "@/components/icons";
import { LargeTitle, Screen } from "@/components/page";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeFrom } from "@/lib/appearance";
import { getSettings } from "@/lib/data/queries";
import { workoutViewFrom } from "@/lib/workout-layout";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, jar] = await Promise.all([getSettings(), cookies()]);
  const theme = themeFrom(jar.get(THEME_COOKIE)?.value);
  const view = workoutViewFrom((name) => jar.get(name)?.value);
  return (
    <Screen>
      <LargeTitle
        title="Settings"
        leading={
          <GlassCircleLink href="/" label="Back to calendar">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />
      <SettingsForm settings={settings} theme={theme} view={view} />
    </Screen>
  );
}
