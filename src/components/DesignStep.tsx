"use client";

import Konva from "konva";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Group,
  Image as KImage,
  Label,
  Rect,
  Tag,
  Text as KText,
  Transformer,
} from "react-konva";
import {
  capHeightRatio,
  fontSizeForLetterHeight,
  invalidateCapHeight,
  Lighting,
  LogoElement,
  measureTextWidth,
  SignElement,
  SIGN_FONT,
  TextElement,
  textLetterHeightInches,
  textWidthInches,
} from "@/lib/types";
import {
  calculatePricing,
  formatFeetInches,
  PricingConfig,
} from "@/lib/pricing";
import { racewayCount } from "@/lib/types";
import { removeUniformBackground } from "@/lib/removeBg";
import { loadGoogleFont } from "@/lib/fonts";
import { writeProposal } from "@/lib/proposal";
import FontPicker from "@/components/FontPicker";
import { elementsToPieces } from "@/components/PricePanel";

interface Props {
  image: HTMLImageElement;
  ipp: number; // inches per corrected-image pixel
  elements: SignElement[];
  setElements: (updater: (els: SignElement[]) => SignElement[]) => void;
  beginAction: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  projectName: string;
  backerPlates: number;
  pricingCfg: PricingConfig;
  onBack: () => void;
  sidebar: ReactNode;
}

const MAX_W = 920;
const MAX_H = 560;
const RETURN_DEPTH_IN = 3.5; // visual return depth for the extrusion
const DEPTH_FORESHORTEN = 0.28; // returns are seen nearly head-on
const EXTRUDE_STEPS = 6;
const MIN_VISIBLE = 40; // stage px of an element that must stay on canvas

const LIGHTING_OPTIONS: { value: Lighting; label: string }[] = [
  { value: "front", label: "Front-lit" },
  { value: "halo", label: "Halo-lit" },
  { value: "none", label: "Non-illuminated" },
];

/** Darken/lighten a #rrggbb color. */
function shade(hex: string, factor: number): string {
  const v = hex.replace("#", "");
  if (v.length !== 6) return hex;
  const c = (i: number) => {
    const n = parseInt(v.slice(i, i + 2), 16);
    const out = Math.round(
      factor < 0 ? n * (1 + factor) : n + (255 - n) * factor
    );
    return Math.min(255, Math.max(0, out)).toString(16).padStart(2, "0");
  };
  return `#${c(0)}${c(2)}${c(4)}`;
}

const rectHitFunc = (ctx: Konva.Context, shape: Konva.Shape) => {
  ctx.beginPath();
  ctx.rect(0, 0, shape.width(), shape.height());
  ctx.closePath();
  ctx.fillStrokeShape(shape);
};

/** Channel letters: trim-capped face over an extruded return with a shadow.
 *  At night the lighting type drives the look: front-lit faces glow, halo-lit
 *  letters go dark with an LED wash behind them, non-illuminated just dims. */
function TextSign({
  el,
  scale,
  ipp,
  night,
  draggableProps,
}: {
  el: TextElement;
  scale: number;
  ipp: number;
  night: boolean;
  draggableProps: Konva.NodeConfig & { id: string };
}) {
  const family = el.fontFamily ?? SIGN_FONT;
  const trim = el.trimColor ?? "#26221f";
  const lighting: Lighting = el.lighting ?? "front";
  const returnCol = shade(trim, 0.12);
  const depthPx = Math.max(
    1.5,
    ((RETURN_DEPTH_IN * DEPTH_FORESHORTEN) / ipp) * scale
  );
  const trimW = Math.max(1, ((0.5 / ipp) * scale) / 2); // ~0.5" trim cap
  const fs = el.fontSize * scale;
  const common = {
    text: el.text,
    fontSize: fs,
    fontFamily: family,
    fontStyle: "bold",
    listening: false,
  } as const;

  const dimmed = night && lighting === "none";
  const haloNight = night && lighting === "halo";
  const frontNight = night && lighting === "front";
  const faceFill = dimmed || haloNight ? shade(el.fill, -0.55) : el.fill;
  const returnShade = night ? -0.55 : 0;

  return (
    <Group
      x={el.x * scale}
      y={el.y * scale}
      rotation={el.rotation}
      {...draggableProps}
    >
      {/* halo LED wash behind the letters */}
      {haloNight && (
        <KText
          {...common}
          fill="#fff3d6"
          opacity={0.9}
          shadowColor="#ffe9b3"
          shadowBlur={fs * 0.9}
          shadowOpacity={0.95}
        />
      )}
      {/* shadow caster, deepest copy (day only — night has no sun) */}
      {!night && (
        <KText
          {...common}
          x={depthPx}
          y={depthPx}
          fill={shade(trim, -0.35)}
          shadowColor="black"
          shadowBlur={10 * scale + depthPx}
          shadowOffsetX={depthPx * 0.8}
          shadowOffsetY={depthPx * 1.4}
          shadowOpacity={0.55}
        />
      )}
      {/* extruded return */}
      {Array.from({ length: EXTRUDE_STEPS }, (_, i) => {
        const t = 1 - (i + 1) / EXTRUDE_STEPS;
        return (
          <KText
            key={i}
            {...common}
            x={depthPx * t}
            y={depthPx * t}
            fill={shade(shade(returnCol, -0.1 * (1 - t)), returnShade)}
          />
        );
      })}
      {/* front-lit glow underlay */}
      {frontNight && (
        <KText
          {...common}
          fill={el.fill}
          opacity={0.4}
          shadowColor={el.fill}
          shadowBlur={fs * 1.1}
          shadowOpacity={0.9}
        />
      )}
      {/* face with trim cap; this copy is the hit target for drag/select */}
      <KText
        text={el.text}
        fontSize={fs}
        fontFamily={family}
        fontStyle="bold"
        fill={faceFill}
        stroke={night ? shade(trim, -0.4) : trim}
        strokeWidth={trimW}
        fillAfterStrokeEnabled
        shadowColor={frontNight ? el.fill : undefined}
        shadowBlur={frontNight ? fs * 0.45 : 0}
        shadowOpacity={frontNight ? 0.95 : 0}
        listening
      />
    </Group>
  );
}

function LogoNode({
  el,
  scale,
  night,
  draggableProps,
}: {
  el: LogoElement;
  scale: number;
  night: boolean;
  draggableProps: Konva.NodeConfig & { id: string };
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = el.src;
  }, [el.src]);
  if (!img) return null;
  const lit = night && (el.lighting ?? "front") !== "none";
  return (
    <KImage
      image={img}
      x={el.x * scale}
      y={el.y * scale}
      width={el.width * scale}
      height={el.height * scale}
      rotation={el.rotation}
      hitFunc={rectHitFunc}
      opacity={night && !lit ? 0.55 : 1}
      shadowColor={lit ? "#fff3d6" : "black"}
      shadowBlur={lit ? el.height * scale * 0.6 : 8 * scale}
      shadowOffsetY={lit ? 0 : 5 * scale}
      shadowOpacity={lit ? 0.9 : night ? 0 : 0.45}
      {...draggableProps}
    />
  );
}

interface View {
  z: number;
  x: number;
  y: number;
}

export default function DesignStep({
  image,
  ipp,
  elements,
  setElements,
  beginAction,
  undo,
  redo,
  canUndo,
  canRedo,
  projectName,
  backerPlates,
  pricingCfg,
  onBack,
  sidebar,
}: Props) {
  const scale = Math.min(
    MAX_W / image.naturalWidth,
    MAX_H / image.naturalHeight,
    1
  );
  const stageW = image.naturalWidth * scale;
  const stageH = image.naturalHeight * scale;

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [liveDims, setLiveDims] = useState<{ w: number; h: number } | null>(null);
  const [showDims, setShowDims] = useState(true);
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });
  const [night, setNight] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId ? stage.findOne(`#${CSS.escape(selectedId)}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        setSelectedId(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        setSelectedId(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        beginAction();
        setElements((els) => els.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, setElements, beginAction, undo, redo]);

  const update = (id: string, patch: Partial<SignElement>) =>
    setElements((els) =>
      els.map((el) => (el.id === id ? ({ ...el, ...patch } as SignElement) : el))
    );

  /** update() that records an undo step first — for discrete edits. */
  const commit = (id: string, patch: Partial<SignElement>) => {
    beginAction();
    update(id, patch);
  };

  const addText = () => {
    const text = newText.trim();
    if (!text) return;
    beginAction();
    const el: TextElement = {
      id: `t${Date.now()}`,
      kind: "text",
      text,
      x: image.naturalWidth * 0.2,
      y: image.naturalHeight * 0.15,
      fontSize: image.naturalHeight * 0.07,
      fill: "#f5f5f5",
      rotation: 0,
    };
    setElements((els) => [...els, el]);
    setSelectedId(el.id);
    setNewText("");
  };

  const addLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const probe = new Image();
      probe.onload = () => {
        const processed = removeUniformBackground(probe);
        beginAction();
        const w = image.naturalWidth * 0.28;
        const el: LogoElement = {
          id: `l${Date.now()}`,
          kind: "logo",
          src: processed ?? src,
          originalSrc: src,
          processedSrc: processed ?? undefined,
          bgRemoved: processed !== null,
          x: image.naturalWidth * 0.36,
          y: image.naturalHeight * 0.1,
          width: w,
          height: (w * probe.naturalHeight) / probe.naturalWidth,
          rotation: 0,
        };
        setElements((els) => [...els, el]);
        setSelectedId(el.id);
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  };

  /** Average the photo's pixels behind the raceway area — "painted to match". */
  const sampleWallColor = (el: TextElement): string => {
    const textW = measureTextWidth(el.text, el.fontSize, el.fontFamily);
    const padPx = 2 / ipp;
    const hPx = 8 / ipp;
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 4;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#3f3c38";
    try {
      ctx.drawImage(
        image,
        el.x - padPx,
        el.y + el.fontSize / 2 - hPx / 2,
        Math.max(8, textW + padPx * 2),
        Math.max(4, hPx),
        0,
        0,
        16,
        4
      );
      const d = ctx.getImageData(0, 0, 16, 4).data;
      let r = 0, g = 0, b = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const hex = (v: number) =>
        Math.round(v / n).toString(16).padStart(2, "0");
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    } catch {
      return "#3f3c38";
    }
  };

  const nodeDims = (node: Konva.Node, el: SignElement) =>
    el.kind === "text"
      ? {
          w: textWidthInches(el, ipp) * Math.abs(node.scaleX()),
          h: textLetterHeightInches(el, ipp) * Math.abs(node.scaleY()),
        }
      : {
          w: el.width * ipp * Math.abs(node.scaleX()),
          h: el.height * ipp * Math.abs(node.scaleY()),
        };

  const elementStageSize = (el: SignElement) =>
    el.kind === "text"
      ? {
          w: measureTextWidth(el.text, el.fontSize, el.fontFamily) * scale,
          h: el.fontSize * scale,
        }
      : { w: el.width * scale, h: el.height * scale };

  const commonProps = (el: SignElement): Konva.NodeConfig & { id: string } => {
    const size = elementStageSize(el);
    return {
      id: el.id,
      draggable: true,
      // keep at least part of the element on the canvas
      dragBoundFunc(this: Konva.Node, pos: Konva.Vector2d) {
        const st = this.getStage();
        const z = st?.scaleX() ?? 1;
        const ox = st?.x() ?? 0;
        const oy = st?.y() ?? 0;
        const clamp = (v: number, lo: number, hi: number) =>
          Math.min(hi, Math.max(lo, v));
        return {
          x: clamp(
            pos.x,
            (MIN_VISIBLE - size.w) * z + ox,
            (stageW - MIN_VISIBLE) * z + ox
          ),
          y: clamp(
            pos.y,
            (MIN_VISIBLE - size.h) * z + oy,
            (stageH - MIN_VISIBLE) * z + oy
          ),
        };
      },
      onClick: () => setSelectedId(el.id),
      onTap: () => setSelectedId(el.id),
      onDragStart: () => {
        beginAction();
        setSelectedId(el.id);
      },
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) =>
        update(el.id, { x: e.target.x() / scale, y: e.target.y() / scale }),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
        update(el.id, { x: e.target.x() / scale, y: e.target.y() / scale }),
      onTransformStart: () => beginAction(),
      onTransform: (e: Konva.KonvaEventObject<Event>) =>
        setLiveDims(nodeDims(e.target, el)),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        // abs() guards against mirrored scales; flipping is disabled too —
        // sign letters never mirror
        const sx = Math.abs(node.scaleX());
        const sy = Math.abs(node.scaleY());
        node.scaleX(1);
        node.scaleY(1);
        if (el.kind === "text") {
          // snap the resulting letter height to a whole inch
          const fam = (el as TextElement).fontFamily;
          const raw = (el as TextElement).fontSize * sy;
          const inches = Math.max(1, Math.round(raw * capHeightRatio(fam) * ipp));
          update(el.id, {
            x: node.x() / scale,
            y: node.y() / scale,
            fontSize: fontSizeForLetterHeight(inches, ipp, fam),
            rotation: node.rotation(),
          });
        } else {
          const rawH = (el as LogoElement).height * sy;
          const inches = Math.max(1, Math.round(rawH * ipp));
          const h = inches / ipp;
          update(el.id, {
            x: node.x() / scale,
            y: node.y() / scale,
            width: ((el as LogoElement).width * sx * h) / rawH,
            height: h,
            rotation: node.rotation(),
          });
        }
        setLiveDims(null);
      },
    };
  };

  const zoomTo = (z: number, center: { x: number; y: number }) => {
    const clamped = Math.min(8, Math.max(0.8, z));
    const pt = {
      x: (center.x - view.x) / view.z,
      y: (center.y - view.y) / view.z,
    };
    setView({
      z: clamped,
      x: center.x - pt.x * clamped,
      y: center.y - pt.y * clamped,
    });
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    zoomTo(view.z * (e.evt.deltaY > 0 ? 1 / 1.15 : 1.15), pointer);
  };

  /** Full-resolution capture with clean view (no selection, badges, zoom). */
  const capture = (): Promise<string> =>
    new Promise((resolve) => {
      const stage = stageRef.current;
      if (!stage) return resolve("");
      const prevView = view;
      setSelectedId(null);
      setShowDims(false);
      setView({ z: 1, x: 0, y: 0 });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const url = stage.toDataURL({
            pixelRatio: 1 / scale,
            mimeType: "image/png",
          });
          setShowDims(true);
          setView(prevView);
          resolve(url);
        });
      });
    });

  const exportPng = async () => {
    const url = await capture();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "hsc-mockup.png";
    a.click();
  };

  const makeProposal = async () => {
    // open synchronously so the popup isn't blocked, fill in async
    const win = window.open("about:blank", "_blank");
    if (!win) {
      alert("Allow pop-ups for this site to open the proposal.");
      return;
    }
    win.document.write("<title>Preparing proposal…</title>");
    const wasNight = night;
    setNight(false);
    await new Promise((r) => setTimeout(r, 60));
    const dayPng = await capture();
    setNight(true);
    await new Promise((r) => setTimeout(r, 60));
    const nightPng = await capture();
    setNight(wasNight);
    const pieces = elementsToPieces(elements, ipp);
    const wireways = racewayCount(elements);
    const pricing = calculatePricing(pieces, backerPlates, wireways, pricingCfg);
    writeProposal(win, {
      projectName,
      dayPng,
      nightPng,
      pieces,
      pricing,
      wireways,
      backerPlates,
    });
  };

  const selectedDims =
    liveDims ??
    (selected
      ? selected.kind === "text"
        ? {
            w: textWidthInches(selected, ipp),
            h: textLetterHeightInches(selected, ipp),
          }
        : { w: selected.width * ipp, h: selected.height * ipp }
      : null);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              undo();
              setSelectedId(null);
            }}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            className="rounded-lg border border-zinc-600 px-2.5 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
          >
            ↺
          </button>
          <button
            onClick={() => {
              redo();
              setSelectedId(null);
            }}
            disabled={!canRedo}
            title="Redo (⇧⌘Z)"
            className="rounded-lg border border-zinc-600 px-2.5 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
          >
            ↻
          </button>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addText()}
            placeholder="Sign text…"
            className="w-40 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <button
            onClick={addText}
            className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
          >
            Add text
          </button>
          <button
            onClick={() => logoInputRef.current?.click()}
            className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
          >
            Upload logo
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => addLogo(e.target.files?.[0])}
          />
          {selected && (
            <select
              value={selected.lighting ?? "front"}
              onChange={(e) =>
                commit(selected.id, { lighting: e.target.value as Lighting })
              }
              title="Lighting"
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
            >
              {LIGHTING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {selected?.kind === "text" && (
            <>
              <FontPicker
                value={selected.fontFamily ?? SIGN_FONT}
                onPick={async (family, googleName) => {
                  // wait for a webfont before measuring, so cap-height (and
                  // therefore pricing) is computed on the real glyphs
                  if (googleName) {
                    await loadGoogleFont(googleName);
                    invalidateCapHeight(family);
                  }
                  const inches = textLetterHeightInches(selected, ipp);
                  commit(selected.id, {
                    fontFamily: family,
                    fontSize: fontSizeForLetterHeight(inches, ipp, family),
                  });
                }}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Face
                <input
                  type="color"
                  value={selected.fill}
                  onChange={(e) => commit(selected.id, { fill: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-900"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Trim
                <input
                  type="color"
                  title="Trim cap and return color"
                  value={selected.trimColor ?? "#26221f"}
                  onChange={(e) =>
                    commit(selected.id, { trimColor: e.target.value })
                  }
                  className="h-8 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-900"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!selected.raceway}
                  onChange={(e) =>
                    commit(selected.id, {
                      raceway: e.target.checked,
                      racewayColor: e.target.checked
                        ? selected.racewayColor ?? sampleWallColor(selected)
                        : selected.racewayColor,
                    })
                  }
                  className="h-4 w-4 accent-amber-400"
                />
                Raceway
              </label>
              {selected.raceway && (
                <>
                  <input
                    type="color"
                    title="Raceway color"
                    value={selected.racewayColor ?? "#3f3c38"}
                    onChange={(e) =>
                      commit(selected.id, { racewayColor: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-900"
                  />
                  <button
                    onClick={() =>
                      commit(selected.id, {
                        racewayColor: sampleWallColor(selected),
                      })
                    }
                    className="rounded-lg border border-zinc-600 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    title="Re-sample the wall color behind the letters"
                  >
                    Match wall
                  </button>
                </>
              )}
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Letter height (in)
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={Number(textLetterHeightInches(selected, ipp).toFixed(1))}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    if (inches > 0)
                      commit(selected.id, {
                        fontSize: fontSizeForLetterHeight(
                          inches,
                          ipp,
                          selected.fontFamily
                        ),
                      });
                  }}
                  className="w-20 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-right tabular-nums text-zinc-100"
                />
              </label>
            </>
          )}
          {selected?.kind === "logo" && (
            <>
              {selected.processedSrc && (
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={!!selected.bgRemoved}
                    onChange={(e) =>
                      commit(selected.id, {
                        bgRemoved: e.target.checked,
                        src: e.target.checked
                          ? selected.processedSrc!
                          : selected.originalSrc ?? selected.src,
                      })
                    }
                    className="h-4 w-4 accent-amber-400"
                  />
                  Clear background
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Height (in)
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={Number((selected.height * ipp).toFixed(1))}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    if (inches > 0) {
                      const h = inches / ipp;
                      commit(selected.id, {
                        height: h,
                        width: (h * selected.width) / selected.height,
                      });
                    }
                  }}
                  className="w-20 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-right tabular-nums text-zinc-100"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!selected.priceAsLetters}
                  onChange={(e) =>
                    commit(selected.id, {
                      priceAsLetters: e.target.checked,
                      letterCount: selected.letterCount ?? 10,
                      letterHeightRatio: selected.letterHeightRatio ?? 0.6,
                    })
                  }
                  className="h-4 w-4 accent-amber-400"
                />
                Built as channel letters
              </label>
              {selected.priceAsLetters && (
                <>
                  <label className="flex items-center gap-1 text-sm text-zinc-300">
                    Letters
                    <input
                      type="number"
                      min={1}
                      value={selected.letterCount ?? 10}
                      onChange={(e) =>
                        commit(selected.id, {
                          letterCount: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-16 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-right tabular-nums text-zinc-100"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-sm text-zinc-300">
                    Letter ht (in)
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      value={Number(
                        (
                          (selected.letterHeightRatio ?? 0.6) *
                          selected.height *
                          ipp
                        ).toFixed(1)
                      )}
                      onChange={(e) => {
                        const inches = Number(e.target.value);
                        if (inches > 0)
                          commit(selected.id, {
                            letterHeightRatio:
                              inches / (selected.height * ipp),
                          });
                      }}
                      className="w-16 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-right tabular-nums text-zinc-100"
                    />
                  </label>
                </>
              )}
            </>
          )}
          {selected && (
            <button
              onClick={() => {
                beginAction();
                setElements((els) => els.filter((el) => el.id !== selected.id));
                setSelectedId(null);
              }}
              className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
          <div className="grow" />
          <div className="flex overflow-hidden rounded-lg border border-zinc-600 text-sm">
            <button
              onClick={() => setNight(false)}
              className={`px-3 py-2 ${!night ? "bg-amber-400 font-semibold text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`}
            >
              ☀ Day
            </button>
            <button
              onClick={() => setNight(true)}
              className={`px-3 py-2 ${night ? "bg-indigo-400 font-semibold text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`}
            >
              ☾ Night
            </button>
          </div>
          <button
            onClick={exportPng}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Export PNG
          </button>
          <button
            onClick={makeProposal}
            disabled={elements.length === 0}
            className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          >
            Proposal
          </button>
        </div>

        <div className="relative inline-block">
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={view.z}
            scaleY={view.z}
            x={view.x}
            y={view.y}
            draggable
            onDragEnd={(e) => {
              if (e.target === e.target.getStage())
                setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
            }}
            onWheel={onWheel}
            className="overflow-hidden rounded-xl bg-zinc-950"
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <Layer>
              <KImage
                image={image}
                width={stageW}
                height={stageH}
                onMouseDown={() => setSelectedId(null)}
              />
              {night && (
                <Rect
                  x={0}
                  y={0}
                  width={stageW}
                  height={stageH}
                  fill="#0b1120"
                  opacity={0.72}
                  listening={false}
                />
              )}
              {elements.map((el) => {
                // raceway box drawn behind its letters
                if (el.kind !== "text" || !el.raceway) return null;
                const padPx = 2 / ipp; // 2" side margins
                const hPx = 8 / ipp; // standard ~8" raceway
                const wPx =
                  measureTextWidth(el.text, el.fontSize, el.fontFamily) +
                  padPx * 2;
                return (
                  <Rect
                    key={`rw-${el.id}`}
                    x={(el.x - padPx) * scale}
                    y={(el.y + el.fontSize / 2 - hPx / 2) * scale}
                    width={wPx * scale}
                    height={hPx * scale}
                    rotation={el.rotation}
                    fill={el.racewayColor ?? "#3f3c38"}
                    cornerRadius={2 * scale}
                    shadowColor="black"
                    shadowBlur={6 * scale}
                    shadowOffsetY={4 * scale}
                    shadowOpacity={0.4}
                    listening={false}
                  />
                );
              })}
              {elements.map((el) =>
                el.kind === "text" ? (
                  <TextSign
                    key={el.id}
                    el={el}
                    scale={scale}
                    ipp={ipp}
                    night={night}
                    draggableProps={commonProps(el)}
                  />
                ) : (
                  <LogoNode
                    key={el.id}
                    el={el}
                    scale={scale}
                    night={night}
                    draggableProps={commonProps(el)}
                  />
                )
              )}
              {/* dimension badge only on the selected element, beside it — all
                  sizes are always listed in the estimate panel */}
              {showDims && selected && (() => {
                const el = selected;
                const h =
                  liveDims?.h ??
                  (el.kind === "text"
                    ? textLetterHeightInches(el, ipp)
                    : el.height * ipp);
                const size = elementStageSize(el);
                const inv = 1 / view.z;
                return (
                  <Label
                    key={`dim-${el.id}`}
                    x={el.x * scale + size.w + 10 * inv}
                    y={el.y * scale + size.h / 2 - 11 * inv}
                    listening={false}
                    opacity={0.95}
                    scaleX={inv}
                    scaleY={inv}
                  >
                    <Tag fill="#fbbf24" cornerRadius={3} />
                    <KText
                      text={formatFeetInches(h)}
                      fontSize={12}
                      fontStyle="bold"
                      fill="#18181b"
                      padding={4}
                    />
                  </Label>
                );
              })()}
              <Transformer
                ref={trRef}
                keepRatio
                flipEnabled={false}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
                }
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                ]}
                anchorFill="#fbbf24"
                anchorStroke="#18181b"
                borderStroke="#fbbf24"
                rotateEnabled
              />
            </Layer>
          </Stage>
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-zinc-900/90 p-1 text-sm shadow">
            <button
              onClick={() =>
                zoomTo(view.z / 1.4, { x: stageW / 2, y: stageH / 2 })
              }
              className="h-8 w-8 rounded text-zinc-200 hover:bg-zinc-700"
              title="Zoom out"
            >
              −
            </button>
            <span className="w-12 text-center tabular-nums text-zinc-300">
              {view.z.toFixed(1)}×
            </span>
            <button
              onClick={() =>
                zoomTo(view.z * 1.4, { x: stageW / 2, y: stageH / 2 })
              }
              className="h-8 w-8 rounded text-zinc-200 hover:bg-zinc-700"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => setView({ z: 1, x: 0, y: 0 })}
              className="h-8 rounded px-2 text-zinc-200 hover:bg-zinc-700"
              title="Fit photo"
            >
              Fit
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
          <button onClick={onBack} className="underline hover:text-zinc-200">
            ← Back to measurement
          </button>
          {selectedDims && (
            <span className="tabular-nums">
              {selected?.kind === "text"
                ? `Letters: ${formatFeetInches(selectedDims.h)} tall · ${formatFeetInches(selectedDims.w)} wide`
                : `Logo: ${formatFeetInches(selectedDims.w)} × ${formatFeetInches(selectedDims.h)}`}
            </span>
          )}
        </div>
      </div>

      {sidebar}
    </div>
  );
}
