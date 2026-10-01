import type { AppState, DatabaseSchema, TableName } from "@/types/domain";

export interface ListOptions {
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: string;
  descending?: boolean;
  limit?: number;
}

export interface DbPort {
  list<T extends TableName>(table: T, options?: ListOptions): Promise<DatabaseSchema[T]>;
  get<T extends TableName>(table: T, id: string): Promise<DatabaseSchema[T][number] | null>;
  insert<T extends TableName>(table: T, row: DatabaseSchema[T][number]): Promise<DatabaseSchema[T][number]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<DatabaseSchema[T][number]>): Promise<DatabaseSchema[T][number]>;
  remove(table: TableName, id: string): Promise<void>;
  transaction<T>(fn: (tx: DbPort) => Promise<T>): Promise<T>;
  subscribe(listener: () => void): () => void;
  dump(): Promise<AppState>;
  replace(state: AppState): Promise<void>;
}

export function applyList<T extends { id: string }>(rows: T[], options?: ListOptions): T[] {
  let next = rows.slice();
  if (options?.filters) {
    const entries = Object.entries(options.filters);
    next = next.filter((row) => entries.every(([key, value]) => (row as Record<string, unknown>)[key] === value));
  }
  if (options?.orderBy) {
    const key = options.orderBy;
    const direction = options.descending ? -1 : 1;
    next.sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  }
  if (options?.limit != null) next = next.slice(0, options.limit);
  return next;
}
