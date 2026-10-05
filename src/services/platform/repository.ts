import { SEED_STAMP, buildSeed } from "@/data/seed";
import type { AppData, DemoRole, PersistedState } from "@/types/domain";

export const STORAGE_KEY = "visionguard.platform.v1";

export function emptyState(): PersistedState {
  return { version: 1, seed_stamp: SEED_STAMP, role: "manager", data: buildSeed(), read_notification_ids: [] };
}

export function loadState(): { state: PersistedState; recovered: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: emptyState(), recovered: false };
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1 || parsed.seed_stamp !== SEED_STAMP || !parsed.data?.facilities) {
      return { state: emptyState(), recovered: true };
    }
    return { state: parsed, recovered: false };
  } catch {
    return { state: emptyState(), recovered: true };
  }
}

export function saveState(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function stateWith(data: AppData, role: DemoRole, readIds: string[]): PersistedState {
  return { version: 1, seed_stamp: SEED_STAMP, role, data, read_notification_ids: readIds };
}
