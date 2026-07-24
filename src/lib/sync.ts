import * as Y from "yjs";

const ENTITY_TYPES = [
  "notes",
  "habits",
  "habit_logs",
  "projects",
  "goals",
  "tasks",
  "chat_threads",
  "chat_messages",
  "visions",
  "audits",
  "focus_sessions",
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

interface YjsStore {
  doc: Y.Doc;
  map: Y.Map<Y.Map<any>>;
}

const stores = new Map<EntityType, YjsStore>();

function getKey(entityType: EntityType): string {
  return `raiva_ydoc_${entityType}`;
}

function getOldKey(entityType: EntityType): string {
  return `raiva_${entityType}`;
}

let _initialized = false;

export function isSyncInitialized(): boolean {
  return _initialized;
}

function persistDoc(entityType: EntityType, doc: Y.Doc): void {
  try {
    const update = Y.encodeStateAsUpdate(doc);
    const binary = new Uint8Array(update);
    const chars: string[] = [];
    for (let i = 0; i < binary.length; i++) {
      chars.push(String.fromCharCode(binary[i]));
    }
    localStorage.setItem(getKey(entityType), btoa(chars.join("")));
  } catch (e) {
    console.warn(`sync: persist failed for ${entityType}`, e);
  }
}

function loadDocFromStorage(entityType: EntityType): Y.Doc {
  const doc = new Y.Doc();
  const encoded = localStorage.getItem(getKey(entityType));
  if (encoded) {
    try {
      const binaryStr = atob(encoded);
      const binary = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        binary[i] = binaryStr.charCodeAt(i);
      }
      Y.applyUpdate(doc, binary);
    } catch (e) {
      console.warn(
        `sync: failed to decode Yjs doc for ${entityType}, starting fresh`,
        e
      );
    }
  }
  return doc;
}

function migrateIfNeeded(entityType: EntityType, doc: Y.Doc): void {
  const map = doc.getMap(entityType) as Y.Map<Y.Map<any>>;
  if (map.size > 0) return;

  const oldData = localStorage.getItem(getOldKey(entityType));
  if (!oldData) return;

  try {
    const items = JSON.parse(oldData);
    if (!Array.isArray(items)) return;

    for (const item of items) {
      if (!item.id) continue;
      const innerMap = new Y.Map();
      for (const [key, value] of Object.entries(item)) {
        if (key === "id") continue;
        if (entityType === "notes" && key === "content" && typeof value === "string") {
          innerMap.set(key, new Y.Text(value));
        } else {
          innerMap.set(key, value);
        }
      }
      map.set(item.id, innerMap);
    }

    persistDoc(entityType, doc);
  } catch (e) {
    console.warn(`sync: migration failed for ${entityType}`, e);
  }
}

export function initSync(): void {
  if (_initialized) return;

  for (const entityType of ENTITY_TYPES) {
    const doc = loadDocFromStorage(entityType);
    migrateIfNeeded(entityType, doc);
    const map = doc.getMap(entityType) as Y.Map<Y.Map<any>>;

    doc.on("update", () => {
      persistDoc(entityType, doc);
    });

    stores.set(entityType, { doc, map });
  }

  _initialized = true;
}

function ensureInit(): void {
  if (!_initialized) initSync();
}

export function loadTable<T>(entityType: string): T[] {
  ensureInit();
  const store = stores.get(entityType as EntityType);
  if (!store) return [];

  const result: T[] = [];
  store.map.forEach((innerMap, id) => {
    const obj: Record<string, any> = { id };
    innerMap.forEach((value, key) => {
      if (value instanceof Y.Text) {
        obj[key] = value.toString();
      } else {
        obj[key] = value;
      }
    });
    result.push(obj as T);
  });
  return result;
}

export function saveTable<T>(entityType: string, data: T[]): void {
  ensureInit();
  const store = stores.get(entityType as EntityType);
  if (!store) return;

  const idsInData = new Set<string>();

  for (const item of data as any[]) {
    if (!item.id) continue;
    idsInData.add(item.id);

    let innerMap = store.map.get(item.id);
    if (!innerMap) {
      innerMap = new Y.Map();
      store.map.set(item.id, innerMap);
    }

    for (const [key, value] of Object.entries(item)) {
      if (key === "id") continue;

      if (entityType === "notes" && key === "content") {
        const existing = innerMap.get(key);
        if (existing instanceof Y.Text) {
          if (existing.toString() !== value) {
            existing.delete(0, existing.length);
            existing.insert(0, value as string);
          }
        } else {
          innerMap.set(key, new Y.Text(value as string));
        }
      } else {
        innerMap.set(key, value);
      }
    }
  }

  const toDelete: string[] = [];
  store.map.forEach((_, id) => {
    if (!idsInData.has(id)) toDelete.push(id);
  });
  for (const id of toDelete) {
    store.map.delete(id);
  }
}

export function getRawDoc(entityType: string): Y.Doc | undefined {
  ensureInit();
  return stores.get(entityType as EntityType)?.doc;
}

export function exportSnapshot(): string {
  ensureInit();
  const data: Record<string, string> = {};

  for (const entityType of ENTITY_TYPES) {
    const encoded = localStorage.getItem(getKey(entityType));
    if (encoded) {
      data[entityType] = encoded;
    }
  }

  const settings = localStorage.getItem("raiva_settings");
  if (settings) {
    data["__settings__"] = settings;
  }

  return JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  });
}

export function importSnapshot(jsonStr: string): { ok: boolean; message: string } {
  try {
    const pkg = JSON.parse(jsonStr);
    if (!pkg.data || typeof pkg.data !== "object") {
      return { ok: false, message: "Invalid snapshot format" };
    }

    for (const [key, encoded] of Object.entries(pkg.data)) {
      if (typeof encoded !== "string") continue;

      if (key === "__settings__") {
        localStorage.setItem("raiva_settings", encoded);
        continue;
      }

      if (ENTITY_TYPES.includes(key as EntityType)) {
        localStorage.setItem(getKey(key as EntityType), encoded);
      }
    }

    // Reinitialize from imported data
    _initialized = false;
    stores.clear();
    initSync();

    return { ok: true, message: "Snapshot imported successfully" };
  } catch (e) {
    return { ok: false, message: `Import failed: ${e}` };
  }
}
