"use client";

import { useEffect } from "react";

/**
 * Keeps the home screen app on the latest deploy. iOS resumes a home screen app rather than relaunching it, so an open
 * page kept running the build it loaded with after a new one shipped. Coming back to the foreground asks the service
 * worker for an update; the new worker activates at once (skipWaiting, clientsClaim) and takes over the page, which
 * reloads once onto the new build. A first install takes control too, so that one is not a reason to reload.
 */
export function AppUpdate() {
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const hadController = !!sw.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    const check = () => {
      if (document.visibilityState !== "visible") return;
      sw.getRegistration().then((r) => r?.update()).catch(() => {});
    };
    sw.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
