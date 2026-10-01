import { applyList, type DbPort, type ListOptions } from "@/services/db/port";
import type { AppState, DatabaseSchema, TableName } from "@/types/domain";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMemoryDb(initial: AppState, options?: { onCommit?: (state: AppState) => Promise<void> | void }): DbPort {
  let state = clone(initial);
  let chain: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function bound(snapshot: AppState): DbPort {
    const tx = {
      async list<T extends TableName>(table: T, listOptions?: ListOptions) {
        return applyList(snapshot[table] as never, listOptions) as DatabaseSchema[T];
      },
      async get<T extends TableName>(table: T, id: string) {
        return (snapshot[table] as { id: string }[]).find((row) => row.id === id) ?? null;
      },
      async insert<T extends TableName>(table: T, row: DatabaseSchema[T][number]) {
        (snapshot[table] as DatabaseSchema[T][number][]).push(row);
        return row;
      },
      async update<T extends TableName>(table: T, id: string, patch: Partial<DatabaseSchema[T][number]>) {
        const rows = snapshot[table] as ({ id: string } & DatabaseSchema[T][number])[];
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) throw new Error(`السجل غير موجود: ${table}/${id}`);
        rows[index] = { ...rows[index], ...patch };
        return rows[index];
      },
      async remove(table: TableName, id: string) {
        const rows = snapshot[table] as { id: string }[];
        const next = rows.filter((row) => row.id !== id);
        if (next.length === rows.length) throw new Error(`السجل غير موجود: ${table}/${id}`);
        (snapshot[table] as unknown) = next;
      },
      transaction<T>(fn: (inner: DbPort) => Promise<T>) {
        return fn(tx);
      },
      subscribe() {
        return () => undefined;
      },
      async dump() {
        return clone(snapshot);
      },
      async replace(next: AppState) {
        Object.keys(snapshot).forEach((key) => {
          (snapshot as unknown as Record<string, unknown>)[key] = clone((next as unknown as Record<string, unknown>)[key]);
        });
      },
    } as DbPort;
    return tx;
  }

  const api: DbPort = {
    list(table, listOptions) {
      return Promise.resolve(applyList(state[table] as never, listOptions) as never);
    },
    get(table, id) {
      return Promise.resolve(((state[table] as { id: string }[]).find((row) => row.id === id) ?? null) as never);
    },
    insert(table, row) {
      return api.transaction((tx) => tx.insert(table, row));
    },
    update(table, id, patch) {
      return api.transaction((tx) => tx.update(table, id, patch));
    },
    remove(table, id) {
      return api.transaction((tx) => tx.remove(table, id));
    },
    transaction(fn) {
      const run = chain.then(async () => {
        const snapshot = clone(state);
        const tx = bound(snapshot);
        const result = await fn(tx);
        state = snapshot;
        if (options?.onCommit) await options.onCommit(clone(state));
        notify();
        return result;
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async dump() {
      return clone(state);
    },
    replace(next) {
      return api.transaction(async (tx) => {
        await tx.replace(next);
      });
    },
  };
  return api;
}
