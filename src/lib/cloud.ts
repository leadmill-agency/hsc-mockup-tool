// Cloud project storage client: JSON state in Postgres, photos in Vercel
// Blob (uploaded once, referenced by same-origin /api/assets URLs). IndexedDB
// remains the offline fallback — page.tsx tries cloud first.

import { SquareParams } from "@/lib/warp";
import { Measurement, SignElement } from "@/lib/types";
import { ProjectSummary } from "@/lib/store";

export interface CloudState {
  squareParams: SquareParams;
  measurement: Measurement | null;
  elements: SignElement[];
  backerPlates: number;
  step: string;
  originalUrl?: string;
  correctedUrl?: string;
}

export interface CloudRecord {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
  state: CloudState;
}

export interface SavePayload {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
  originalSrc: string;
  correctedSrc?: string;
  squareParams: SquareParams;
  measurement: Measurement | null;
  elements: SignElement[];
  backerPlates: number;
  step: string;
}

const isRemote = (src?: string): boolean =>
  !!src && src.includes("/api/assets/");

/** Normalize an absolute same-origin asset URL back to its stored path. */
function toPath(src: string): string {
  try {
    const u = new URL(src, window.location.origin);
    return u.pathname + u.search;
  } catch {
    return src;
  }
}

// avoid re-uploading unchanged images within a session
const uploadCache = new Map<string, string>();

/** Upload a data-URL (or blob-URL) image to blob storage under `key`,
 *  returning the same-origin proxy URL. */
export async function uploadAsset(key: string, src: string): Promise<string> {
  const cacheKey = `${key}:${src.length}`;
  const hit = uploadCache.get(cacheKey);
  if (hit) return hit;
  const blob = await (await fetch(src)).blob();
  const res = await fetch(
    `/api/assets/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(
      blob.type || "image/png"
    )}`,
    { method: "POST", body: blob }
  );
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  const { path } = (await res.json()) as { path: string };
  const url = `${path}?v=${Date.now()}`;
  uploadCache.set(cacheKey, url);
  return url;
}

export async function saveProjectCloud(p: SavePayload): Promise<void> {
  const originalUrl = isRemote(p.originalSrc)
    ? toPath(p.originalSrc)
    : await uploadAsset(`projects/${p.id}/original.png`, p.originalSrc);
  const correctedUrl = !p.correctedSrc
    ? undefined
    : isRemote(p.correctedSrc)
      ? toPath(p.correctedSrc)
      : await uploadAsset(`projects/${p.id}/corrected.png`, p.correctedSrc);

  const elements = await Promise.all(
    p.elements.map(async (el) => {
      if (el.kind !== "logo") return el;
      const out = { ...el };
      for (const field of ["src", "originalSrc", "processedSrc"] as const) {
        const v = out[field];
        if (v && v.startsWith("data:")) {
          out[field] = await uploadAsset(`projects/${p.id}/${field}-${el.id}.png`, v);
        } else if (v && isRemote(v)) {
          out[field] = toPath(v);
        }
      }
      return out;
    })
  );

  const state: CloudState = {
    squareParams: p.squareParams,
    measurement: p.measurement,
    elements,
    backerPlates: p.backerPlates,
    step: p.step,
    originalUrl,
    correctedUrl,
  };
  const res = await fetch(`/api/projects/${p.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: p.name,
      updatedAt: p.updatedAt,
      thumbnail: p.thumbnail,
      state,
    }),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
}

export async function listProjectsCloud(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return (await res.json()) as ProjectSummary[];
}

export async function getProjectCloud(id: string): Promise<CloudRecord | null> {
  const res = await fetch(`/api/projects/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  return (await res.json()) as CloudRecord;
}

export async function deleteProjectCloud(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: "DELETE" });
}

export function urlToImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
