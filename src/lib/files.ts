"use client";

/**
 * Uploaded files, kept in this browser's IndexedDB. Nothing is uploaded to a server:
 * only review text is sent for analysis. Each file keeps its raw text (for preview),
 * the column roles chosen, and the analyzed reviews (so switching back is instant).
 */
import type { DatasetMeta, Review } from "./types";
import type { Role } from "./csv";

export type StoredFile = {
  id: string;
  name: string;
  size: number;
  rows: number;
  importedAt: string;
  raw: string;
  roles: Record<string, Role>;
  meta: DatasetMeta;
  reviews: Review[];
};
export type FileSummary = Omit<StoredFile, "raw" | "reviews">;

const P = "file:";

// A tiny IndexedDB key-value store, so no extra package is needed.
function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("insightflow", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("kv", mode);
      const req = run(tx.objectStore("kv"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    };
  });
}
const get = <T>(k: string) => store<T | undefined>("readonly", (s) => s.get(k) as IDBRequest<T | undefined>);
const set = (k: string, v: unknown) => store("readwrite", (s) => s.put(v, k));
const del = (k: string) => store("readwrite", (s) => s.delete(k));
const keys = () => store<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

export async function saveFile(f: StoredFile) {
  await set(P + f.id, f);
}

export async function getFile(id: string) {
  return (await get<StoredFile>(P + id)) ?? null;
}

export async function deleteFile(id: string) {
  await del(P + id);
}

export async function listFiles(): Promise<FileSummary[]> {
  const ks = (await keys()).filter((k) => typeof k === "string" && k.startsWith(P)) as string[];
  const all = await Promise.all(ks.map((k) => get<StoredFile>(k)));
  return all
    .filter((f): f is StoredFile => !!f)
    .map(({ raw: _r, reviews: _v, ...rest }) => rest)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
