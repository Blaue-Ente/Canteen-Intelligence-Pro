import { useApp } from "@/contexts/AppContext";
import type { AppMode } from "@/types";

export function useAppMode(): {
  mode: AppMode;
  isFull: boolean;
  isLite: boolean;
  setMode: (m: AppMode) => void;
} {
  const { state, dispatch } = useApp();
  return {
    mode: state.appMode,
    isFull: state.appMode === "full",
    isLite: state.appMode === "lite",
    setMode: (m) => dispatch({ type: "setAppMode", mode: m }),
  };
}
