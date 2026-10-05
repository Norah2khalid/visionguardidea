import { useContext } from "react";
import { PlatformContext } from "@/app/platform";

export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error("منصة VISIONGUARD غير مهيأة");
  return value;
}
