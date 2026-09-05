"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onImage: (img: HTMLImageElement) => void;
  /** Bright-showroom styling for the customer surface. */
  customerMode?: boolean;
}

export function loadImageFromFile(
  file: File,
  cb: (img: HTMLImageElement) => void,
  onError?: (msg: string) => void
) {
  if (!/^image\/(jpeg|png|webp)/.test(file.type)) {
    onError?.("Please upload a JPEG or PNG photo.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => cb(img);
    img.onerror = () => onError?.("Could not read that image file.");
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 1.7.9L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />
      <circle cx="12" cy="12.5" r="3.25" />
    </svg>
  );
}

export default function UploadStep({ onImage, customerMode }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setError(null);
      loadImageFromFile(file, onImage, setError);
    },
    [onImage]
  );

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      {customerMode && (
        <div className="rise max-w-xl text-center" style={{ animationDelay: "0ms" }}>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            First, a photo of your storefront
          </h2>
          <p className="mt-2 text-base leading-7 text-zinc-600">
            Stand across the street and shoot it straight on — a phone photo is
            perfect.
          </p>
        </div>
      )}
      <div
        className={
          customerMode
            ? `rise flex h-72 w-full max-w-2xl cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-white transition-colors ${
                dragOver
                  ? "border-blue-600 bg-blue-50"
                  : "border-zinc-300 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_-16px_rgba(24,24,27,0.15)] hover:border-blue-500"
              }`
            : `flex h-72 w-full max-w-2xl cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white transition-colors ${
                dragOver
                  ? "border-blue-600 bg-blue-50"
                  : "border-zinc-300 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_-16px_rgba(24,24,27,0.15)] hover:border-blue-500"
              }`
        }
        style={customerMode ? { animationDelay: "120ms" } : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        {customerMode ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <CameraIcon className="h-7 w-7 text-blue-600" />
            </span>
            <div className="text-lg font-semibold text-zinc-900">
              Drop your photo here
            </div>
            <div className="text-sm text-zinc-500">
              or tap to browse — JPEG or PNG
            </div>
          </>
        ) : (
          <>
            <CameraIcon className="h-12 w-12 text-zinc-500" />
            <div className="text-lg font-semibold text-zinc-900">
              Drop a storefront photo here
            </div>
            <div className="text-sm text-zinc-500">
              or click to browse — JPEG or PNG, straight-on shot works best
            </div>
          </>
        )}
      </div>
      {error && (
        <div
          className={
            "rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05)]"
          }
        >
          {error}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
