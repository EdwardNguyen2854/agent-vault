import type { VaultSource } from './vault';

const DB_NAME = 'agent-vault-registry';
const STORE_NAME = 'vaults';
const DB_VERSION = 1;

export type SavedVaultRole = 'personal' | 'shared' | 'agent';

export interface SavedVault {
  id: string;
  name: string;
  role: SavedVaultRole;
  defaultPersonal: boolean;
  updatedAt: number;
}

export interface SavedVaultRecord extends SavedVault {
  handle: FileSystemDirectoryHandle;
}

function openRegistry(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openRegistry();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = run(store);
    let result: T | undefined;
    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function toSource(record: SavedVaultRecord): VaultSource {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    readOnly: record.role === 'shared',
  };
}

export function savedVaultToSource(record: SavedVaultRecord): VaultSource {
  return toSource(record);
}

export async function listSavedVaults(): Promise<SavedVault[]> {
  const records = await withStore<SavedVaultRecord[]>('readonly', (store) => store.getAll());
  return (records ?? [])
    .map(({ id, name, role, defaultPersonal, updatedAt }) => ({
      id,
      name,
      role,
      defaultPersonal,
      updatedAt,
    }))
    .sort(
      (a, b) => Number(b.defaultPersonal) - Number(a.defaultPersonal) || b.updatedAt - a.updatedAt,
    );
}

export async function getSavedVault(id: string): Promise<SavedVaultRecord | null> {
  const record = await withStore<SavedVaultRecord>('readonly', (store) => store.get(id));
  return record ?? null;
}

export async function getDefaultPersonalVault(): Promise<SavedVaultRecord | null> {
  const records = await withStore<SavedVaultRecord[]>('readonly', (store) => store.getAll());
  return (
    (records ?? []).find((record) => record.role === 'personal' && record.defaultPersonal) ?? null
  );
}

export async function saveVaultHandle(
  handle: FileSystemDirectoryHandle,
  role: SavedVaultRole,
  options: { defaultPersonal?: boolean } = {},
): Promise<SavedVault> {
  const existing =
    (await withStore<SavedVaultRecord[]>('readonly', (store) => store.getAll())) ?? [];
  let id = `${role}:${handle.name}`;
  for (const record of existing) {
    if (record.handle.isSameEntry && (await record.handle.isSameEntry(handle))) {
      id = record.id;
      break;
    }
  }

  await withStore('readwrite', (store) => {
    if (role === 'personal' && options.defaultPersonal) {
      existing.forEach((record) => {
        if (record.role === 'personal' && record.id !== id) {
          store.put({ ...record, defaultPersonal: false });
        }
      });
    }
    store.put({
      id,
      name: handle.name,
      role,
      defaultPersonal: role === 'personal' ? Boolean(options.defaultPersonal) : false,
      updatedAt: Date.now(),
      handle,
    });
  });

  return {
    id,
    name: handle.name,
    role,
    defaultPersonal: role === 'personal' ? Boolean(options.defaultPersonal) : false,
    updatedAt: Date.now(),
  };
}

export async function setDefaultPersonalVault(id: string): Promise<void> {
  const records =
    (await withStore<SavedVaultRecord[]>('readonly', (store) => store.getAll())) ?? [];
  await withStore('readwrite', (store) => {
    records.forEach((record) => {
      if (record.role === 'personal') {
        store.put({
          ...record,
          defaultPersonal: record.id === id,
          updatedAt: record.id === id ? Date.now() : record.updatedAt,
        });
      }
    });
  });
}

export async function clearDefaultPersonalVault(): Promise<void> {
  const records =
    (await withStore<SavedVaultRecord[]>('readonly', (store) => store.getAll())) ?? [];
  await withStore('readwrite', (store) => {
    records.forEach((record) => {
      if (record.role === 'personal' && record.defaultPersonal) {
        store.put({ ...record, defaultPersonal: false });
      }
    });
  });
}

/**
 * Ensure the registry's default-personal flag points at a vault that is
 * currently mounted. If the current default is in `mountedIds`, this is a
 * no-op. Otherwise the first mounted personal is promoted to default; if no
 * personal vault is mounted, the default flag is cleared.
 */
export async function reconcileDefaultPersonalVault(
  mountedIds: string[],
): Promise<{ changed: boolean; newDefaultId: string | null }> {
  const records =
    (await withStore<SavedVaultRecord[]>('readonly', (store) => store.getAll())) ?? [];
  const mounted = new Set(mountedIds);
  const currentDefault =
    records.find((record) => record.role === 'personal' && record.defaultPersonal) ?? null;
  if (currentDefault && mounted.has(currentDefault.id)) {
    return { changed: false, newDefaultId: currentDefault.id };
  }
  const next =
    records.find((record) => record.role === 'personal' && mounted.has(record.id)) ?? null;
  if (next) {
    await setDefaultPersonalVault(next.id);
    return { changed: true, newDefaultId: next.id };
  }
  await clearDefaultPersonalVault();
  return { changed: currentDefault !== null, newDefaultId: null };
}

export async function removeSavedVault(id: string): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete(id);
  });
}

export async function clearSavedVaults(): Promise<void> {
  await withStore('readwrite', (store) => {
    store.clear();
  });
}
