/**
 * Light or dark: the Settings choice when there is one, otherwise the phone's. The choice lives in the `theme` cookie
 * (per device, as iOS's own appearance setting is) and the server writes it onto `<html data-theme>`, so the first
 * paint is already right. CSS reads the attribute (globals.css); script reads it here.
 */
export type Theme = "system" | "light" | "dark";
export type Appearance = "light" | "dark";

export const THEME_COOKIE = "theme";

export function themeFrom(value: string | undefined | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

export function appearance(): Appearance {
  if (typeof document === "undefined") return "light";
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Call `fn` whenever the appearance may have changed: the phone's setting or the Settings choice. Returns a stop. */
export function onAppearanceChange(fn: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", fn);
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", fn);
    observer.disconnect();
  };
}

/** Save the choice on this device and apply it now */
export function setTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === "system") {
    delete html.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    html.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}
