// Saved projects in IndexedDB — images stored as Blobs, everything else as
// plain state. No backend: the internal tool runs entirely in the browser.

import { SquareParams } from "@/lib/warp";
import { MeasurementState, SignElement } from "@/lib/types";

export interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string; // small jpeg data URL for the project list
  originalBlob?: Blob;
  correctedBlob?: Blob;
  squareParams: SquareParams;
  measurement: MeasurementState | null;
  elements: SignElement[];
  backerPlates: number;
  step: string;
}

export type ProjectSummary = Pick<
  ProjectRecord,
  "id" | "name" | "updatedAt" | "thumbnail"
>;

const DB_NAME = "hsc-mockup";
const STORE = "projects";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function saveProject(p: ProjectRecord): Promise<unknown> {
  return tx("readwrite", (s) => s.put(p));
}

export function getProject(id: string): Promise<ProjectRecord | undefined> {
  return tx("readonly", (s) => s.get(id)) as Promise<ProjectRecord | undefined>;
}

export function deleteProject(id: string): Promise<unknown> {
  return tx("readwrite", (s) => s.delete(id));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const all = (await tx("readonly", (s) => s.getAll())) as ProjectRecord[];
  return all
    .map(({ id, name, updatedAt, thumbnail }) => ({
      id,
      name,
      updatedAt,
      thumbnail,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Small JPEG thumbnail of an image for the project list. */
export function makeThumbnail(img: HTMLImageElement, maxW = 240): string {
  const s = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}
