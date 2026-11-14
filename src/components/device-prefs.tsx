"use client";

import { useEffect } from "react";
import { applyEdgeStyle } from "@/lib/soft-edge-style";
import { applyThumbZoom } from "@/lib/thumb-zoom";

/** Applies the per-device test settings kept in localStorage (soft edge style, thumbnail zoom) once the app mounts. */
export function DevicePrefs() {
  useEffect(() => {
    applyEdgeStyle();
    applyThumbZoom();
  }, []);
  return null;
}
