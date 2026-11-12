import type { ReactNode } from "react";
import { Screen } from "@/components/page";

/** Home's frame. The Library moved to its own tab (Frank's call, 2026-11-11). */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return <Screen>{children}</Screen>;
}
