"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onImage: (img: HTMLImageElement) => void;
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

export default function UploadStep({ onImage }: Props) {
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
      <div
        className={`flex h-72 w-full max-w-2xl cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-amber-400 bg-amber-400/10"
            : "border-zinc-600 bg-zinc-900 hover:border-zinc-400"
        }`}
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
        <div className="text-5xl">📷</div>
        <div className="text-lg font-medium text-zinc-100">
          Drop a storefront photo here
        </div>
        <div className="text-sm text-zinc-400">
          or click to browse — JPEG or PNG, straight-on shot works best
        </div>
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
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
