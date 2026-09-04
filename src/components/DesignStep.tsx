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
  backerCount,
  CABINET_PAD_IN,
  cabinetHeightInches,
  capHeightRatio,
  fontSizeForLetterHeight,
  invalidateCapHeight,
  Lighting,
  LogoElement,
  measureTextWidth,
  PanelElement,
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
import { buildProposalHtml } from "@/lib/proposal";
import FontPicker from "@/components/FontPicker";
import { elementsToPieces } from "@/components/PricePanel";
import { uploadAsset } from "@/lib/cloud";
import { lookPatch, SIGN_LOOKS, SignLook } from "@/lib/looks";

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
  pricingCfg: PricingConfig;
  customerMode?: boolean;
  customerEmail?: string;
  /** Customer mode: auto-place a finished sign with this name on first visit. */
  businessName?: string;
  /** Y (image px) of the storefront width line — the auto-placed sign sits
   *  just above it, on the building instead of in the sky. */
  signAnchorY?: number;
  onProposalSent?: (to: string) => void;
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
  // halo wash defaults to warm white; front-lit glow defaults to face color
  const haloLed = el.ledColor ?? "#fff3d6";
  const frontLed = el.ledColor ?? el.fill;

  if (el.signStyle === "cabinet") {
    // illuminated box: the face lights up as a whole at night
    const padX = (CABINET_PAD_IN.x / ipp) * scale;
    const padY = (CABINET_PAD_IN.y / ipp) * scale;
    const boxW = measureTextWidth(el.text, el.fontSize, family) * scale + padX * 2;
    const boxH = fs + padY * 2;
    const face = el.backerColor ?? "#f7f5f0";
    const lit = night && lighting !== "none";
    return (
      <Group
        x={el.x * scale}
        y={el.y * scale}
        rotation={el.rotation}
        {...draggableProps}
      >
        <Rect
          x={-padX}
          y={-padY}
          width={boxW}
          height={boxH}
          fill={night && !lit ? shade(face, -0.55) : face}
          stroke={shade(face, -0.45)}
          strokeWidth={Math.max(1, ((1 / ipp) * scale) / 2)}
          cornerRadius={(1.5 / ipp) * scale}
          shadowColor={lit ? (el.ledColor ?? "#fff8e0") : "black"}
          shadowBlur={lit ? boxH * 0.5 : 8 * scale}
          shadowOffsetY={lit ? 0 : 4 * scale}
          shadowOpacity={lit ? 0.9 : night ? 0 : 0.45}
          listening
        />
        <KText
          text={el.text}
          fontSize={fs}
          fontFamily={family}
          fontStyle="bold"
          fill={night && !lit ? shade(el.fill, -0.4) : el.fill}
          listening={false}
        />
      </Group>
    );
  }

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
          fill={haloLed}
          opacity={0.9}
          shadowColor={haloLed}
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
          fill={frontLed}
          opacity={0.4}
          shadowColor={frontLed}
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
        shadowColor={frontNight ? frontLed : undefined}
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
  const led = el.ledColor ?? "#fff3d6";
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
      shadowColor={lit ? led : "black"}
      shadowBlur={lit ? el.height * scale * 0.6 : 8 * scale}
      shadowOffsetY={lit ? 0 : 5 * scale}
      shadowOpacity={lit ? 0.9 : night ? 0 : 0.45}
      {...draggableProps}
    />
  );
}

/** Free-standing painted backer panel; text/logos layer on top of it. */
function PanelNode({
  el,
  scale,
  night,
  draggableProps,
}: {
  el: PanelElement;
  scale: number;
  night: boolean;
  draggableProps: Konva.NodeConfig & { id: string };
}) {
  const fill = el.fill ?? "#3a2f28";
  return (
    <Rect
      x={el.x * scale}
      y={el.y * scale}
      width={el.width * scale}
      height={el.height * scale}
      rotation={el.rotation}
      fill={night ? shade(fill, -0.45) : fill}
      cornerRadius={2 * scale}
      shadowColor="black"
      shadowBlur={10 * scale}
      shadowOffsetY={6 * scale}
      shadowOpacity={night ? 0.25 : 0.5}
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
  pricingCfg,
  customerMode,
  customerEmail,
  businessName,
  signAnchorY,
  onProposalSent,
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
  // Customer mode: jargon controls hide behind this toggle (PRD non-designer UX)
  const [fineTune, setFineTune] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const showAdvanced = !customerMode || fineTune;

  // Customer mode: never greet them with a blank canvas — the first time they
  // reach this step, drop a finished sign with their business name, centered
  // and sized to the storefront. Reacting beats creating.
  const autoAdded = useRef(false);
  useEffect(() => {
    if (!customerMode || autoAdded.current || elements.length > 0) return;
    const text = (businessName ?? "").trim();
    if (!text) return;
    autoAdded.current = true;
    const family = SIGN_FONT;
    let fontSize = fontSizeForLetterHeight(18, ipp, family);
    const maxW = image.naturalWidth * 0.7;
    const w = measureTextWidth(text, fontSize, family);
    if (w > maxW) fontSize *= maxW / w;
    fontSize = Math.max(fontSize, fontSizeForLetterHeight(8, ipp, family));
    const finalW = measureTextWidth(text, fontSize, family);
    const anchor = signAnchorY ?? image.naturalHeight * 0.4;
    const el: TextElement = {
      id: `t${Date.now()}`,
      kind: "text",
      text,
      x: Math.max(0, (image.naturalWidth - finalW) / 2),
      y: Math.max(
        image.naturalHeight * 0.02,
        anchor - image.naturalHeight * 0.03 - fontSize
      ),
      fontSize,
      fill: "#f5f5f5",
      trimColor: "#26221f",
      lighting: "front",
      ledColor: "#ffffff",
      fontFamily: family,
      rotation: 0,
    };
    setElements((els) => (els.length ? els : [...els, el]));
    setSelectedId(el.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerMode, businessName, elements.length]);

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

  const addPanel = () => {
    beginAction();
    const w = image.naturalWidth * 0.3;
    const el: PanelElement = {
      id: `p${Date.now()}`,
      kind: "panel",
      x: image.naturalWidth * 0.35,
      y: image.naturalHeight * 0.1,
      width: w,
      height: w * 0.55,
      rotation: 0,
      fill: "#3a2f28",
    };
    setElements((els) => [...els, el]);
    setSelectedId(el.id);
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

  /** Average the photo's pixels in a region — "painted to match wall". */
  const sampleRegion = (
    x: number,
    y: number,
    w: number,
    h: number
  ): string => {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 4;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#3f3c38";
    try {
      ctx.drawImage(image, x, y, Math.max(8, w), Math.max(4, h), 0, 0, 16, 4);
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

  const sampleWallColor = (el: TextElement): string => {
    const textW = measureTextWidth(el.text, el.fontSize, el.fontFamily);
    const padPx = 2 / ipp;
    const hPx = 8 / ipp;
    return sampleRegion(
      el.x - padPx,
      el.y + el.fontSize / 2 - hPx / 2,
      textW + padPx * 2,
      hPx
    );
  };

  const nodeDims = (node: Konva.Node, el: SignElement) =>
    el.kind === "text"
      ? el.signStyle === "cabinet"
        ? {
            w:
              (textWidthInches(el, ipp) + CABINET_PAD_IN.x * 2) *
              Math.abs(node.scaleX()),
            h: cabinetHeightInches(el, ipp) * Math.abs(node.scaleY()),
          }
        : {
            w: textWidthInches(el, ipp) * Math.abs(node.scaleX()),
            h: textLetterHeightInches(el, ipp) * Math.abs(node.scaleY()),
          }
      : {
          w: el.width * ipp * Math.abs(node.scaleX()),
          h: el.height * ipp * Math.abs(node.scaleY()),
        };

  const elementStageSize = (el: SignElement) =>
    el.kind === "text"
      ? el.signStyle === "cabinet"
        ? {
            w:
              (measureTextWidth(el.text, el.fontSize, el.fontFamily) +
                (CABINET_PAD_IN.x * 2) / ipp) *
              scale,
            h: (el.fontSize + (CABINET_PAD_IN.y * 2) / ipp) * scale,
          }
        : {
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
        } else if (el.kind === "panel") {
          // panels resize freely — width and height snap independently
          const w = Math.max(6, Math.round(el.width * sx * ipp)) / ipp;
          const h = Math.max(6, Math.round(el.height * sy * ipp)) / ipp;
          update(el.id, {
            x: node.x() / scale,
            y: node.y() / scale,
            width: w,
            height: h,
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

  /** Full-resolution capture with clean view (no selection, badges, zoom).
   *  Uses rAF for a settled paint but falls back to a timeout so hidden or
   *  throttled tabs can't hang the capture forever. */
  const capture = async (): Promise<string> => {
    const stage = stageRef.current;
    if (!stage) return "";
    const prevView = view;
    setSelectedId(null);
    setShowDims(false);
    setView({ z: 1, x: 0, y: 0 });
    await new Promise<void>((r) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          r();
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 300);
    });
    const url = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: "image/png" });
    setShowDims(true);
    setView(prevView);
    return url;
  };

  const exportPng = async () => {
    const url = await capture();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "hsc-mockup.png";
    a.click();
  };

  const makeProposal = async (toEmail?: string, silent = false) => {
    // staff flow opens the proposal page; customer flow sends silently
    let win: Window | null = null;
    if (!silent) {
      // open synchronously so the popup isn't blocked, fill in async
      win = window.open("about:blank", "_blank");
      if (!win) {
        alert("Allow pop-ups for this site to open the proposal.");
        return;
      }
      win.document.write("<title>Preparing proposal…</title>");
    }
    const token = crypto.randomUUID();
    const wasNight = night;
    setNight(false);
    await new Promise((r) => setTimeout(r, 60));
    const dayPng = await capture();
    setNight(true);
    await new Promise((r) => setTimeout(r, 60));
    const nightPng = await capture();
    setNight(wasNight);

    const cfg = pricingCfg;
    const roundTo = (v: number) => Math.round(v / cfg.roundTo) * cfg.roundTo;
    const toRange = (cost: number) => ({
      low: roundTo(cost / (1 - cfg.lowMargin)),
      high: roundTo(cost / (1 - cfg.highMargin)),
    });
    const lightingLabel = (l?: Lighting) =>
      l === "halo" ? "halo-illuminated" : l === "none" ? "non-illuminated" : "front-lit";

    const signItems = elements.flatMap((el) => {
      if (el.kind === "text") {
        if (el.signStyle === "cabinet") {
          const bh = cabinetHeightInches(el, ipp);
          const bw = textWidthInches(el, ipp) + CABINET_PAD_IN.x * 2;
          return {
            label: `“${el.text}” cabinet sign`,
            detail: `Approx. ${formatFeetInches(bw)} W × ${formatFeetInches(bh)} H ${lightingLabel(el.lighting)} cabinet/box sign.`,
            ...toRange(bh * cfg.coefficient),
          };
        }
        const h = textLetterHeightInches(el, ipp);
        const w = textWidthInches(el, ipp);
        const count = el.text.replace(/\s/g, "").length;
        return {
          label: `“${el.text}” channel letters`,
          detail: `Approx. ${formatFeetInches(w)} W overall · ${formatFeetInches(h)} letter height · ${count} ${lightingLabel(el.lighting)} channel letters${el.raceway ? ", raceway mounted (painted to match wall)" : ", flush mounted"}.`,
          ...toRange(h * count * cfg.coefficient),
        };
      }
      if (el.kind === "panel") return [];
      const h = el.height * ipp;
      const w = el.width * ipp;
      if (el.priceAsLetters) {
        const lh = (el.letterHeightRatio ?? 0.6) * h;
        const n = el.letterCount ?? 10;
        return {
          label: "Logo — fabricated as channel letters",
          detail: `Approx. ${formatFeetInches(w)} W × ${formatFeetInches(h)} H ${lightingLabel(el.lighting)} logo set — ${n} letters at ${formatFeetInches(lh)} letter height.`,
          ...toRange(lh * n * cfg.coefficient),
        };
      }
      return {
        label: "Illuminated logo",
        detail: `Approx. ${formatFeetInches(w)} W × ${formatFeetInches(h)} H ${lightingLabel(el.lighting)} logo assembly.`,
        ...toRange(h * cfg.coefficient),
      };
    });

    const wireways = racewayCount(elements);
    const backers = backerCount(elements);
    const deliveryItems = [
      {
        label: "Fabrication base, delivery & standard installation",
        detail: "Standard exterior installation; permits and engineering confirmed at consultation.",
        ...toRange(cfg.baseCost),
      },
      ...(wireways > 0
        ? [
            {
              label: "Wireway / raceway",
              detail: `${wireways} raceway${wireways > 1 ? "s" : ""} painted to match the wall — one flat allowance per project.`,
              ...toRange(cfg.addOnCost),
            },
          ]
        : []),
      ...(backers > 0
        ? [
            {
              label: `Backer plate${backers > 1 ? `s (${backers})` : ""}`,
              detail: "Painted aluminum backer panel(s) behind the letters.",
              ...toRange(backers * cfg.addOnCost),
            },
          ]
        : []),
    ];

    const sec = (
      title: string,
      items: { label: string; detail?: string; low: number; high: number }[]
    ) => ({
      title,
      items,
      low: items.reduce((s, i) => s + i.low, 0),
      high: items.reduce((s, i) => s + i.high, 0),
    });

    const pricing = calculatePricing(
      elementsToPieces(elements, ipp),
      backers,
      wireways,
      cfg
    );

    const firstText = elements.find((e): e is TextElement => e.kind === "text");
    const trimName = firstText?.trimColor ?? "dark bronze (#26221f)";
    const specs = firstText
      ? [
          { label: "Face", value: `3/16" acrylic (${firstText.fill})` },
          { label: "Backs", value: ".040 aluminum" },
          { label: "Returns", value: `5" aluminum, painted (${trimName})` },
          { label: "Trimcap", value: `1" (${trimName})` },
          {
            label: "LED",
            value:
              (firstText.lighting ?? "front") === "none"
                ? "None — non-illuminated"
                : firstText.ledColor
                  ? `LED modules (${firstText.ledColor})`
                  : "White LEDs (6500K)",
          },
          {
            label: "Mounting",
            value: firstText.raceway
              ? '2" deep × 5" high raceway, painted to match wall'
              : "Flush to wall",
          },
        ]
      : [];

    try {
      // host the mockup images so the proposal page and email can use them
      const [dayUrl, nightUrl] = await Promise.all([
        uploadAsset(`proposals/${token}/day.png`, dayPng),
        uploadAsset(`proposals/${token}/night.png`, nightPng),
      ]);
      const html = buildProposalHtml({
        projectName,
        dayPng: dayUrl,
        nightPng: nightUrl,
        sections: [
          sec("Storefront sign", signItems),
          sec("Project delivery and allowances", deliveryItems),
        ],
        totalLow: pricing.low,
        totalHigh: pricing.high,
        specs,
      });
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          projectName,
          html,
          priceLow: pricing.low,
          priceHigh: pricing.high,
          toEmail,
        }),
      });
      if (!res.ok) throw new Error(`proposal save failed: ${res.status}`);
      const out = (await res.json()) as {
        url: string;
        emailed: boolean;
        hookConfigured: boolean;
      };
      if (win) win.location.href = out.url;
      if (silent && toEmail) {
        if (out.emailed) {
          onProposalSent?.(toEmail);
        } else {
          alert(
            "We couldn't email your proposal just now — your sign specialist will send it to you shortly."
          );
        }
        return;
      }
      if (toEmail) {
        alert(
          out.emailed
            ? `Proposal emailed to ${toEmail} via your Zapier automation.`
            : out.hookConfigured
              ? "The proposal link was created, but the Zapier webhook call failed — send the link manually."
              : "Proposal link created — but no Zapier webhook is connected yet, so no email was sent. Copy the link from the opened page."
        );
      }
    } catch (e) {
      win?.close();
      if (silent) {
        alert("Something went wrong creating your proposal — please try again.");
      } else {
        alert(`Could not create the proposal: ${e instanceof Error ? e.message : e}`);
      }
    }
  };

  const emailProposal = () => {
    const to = window.prompt("Customer email for this proposal:");
    if (to && /.+@.+\..+/.test(to)) void makeProposal(to.trim());
    else if (to) alert("That doesn't look like an email address.");
  };

  const selectedDims =
    liveDims ??
    (selected
      ? selected.kind === "text"
        ? selected.signStyle === "cabinet"
          ? {
              w: textWidthInches(selected, ipp) + CABINET_PAD_IN.x * 2,
              h: cabinetHeightInches(selected, ipp),
            }
          : {
              w: textWidthInches(selected, ipp),
              h: textLetterHeightInches(selected, ipp),
            }
        : { w: selected.width * ipp, h: selected.height * ipp }
      : null);

  // "Pick a look" applies to the selected text element, else the first one.
  const lookTarget =
    selected?.kind === "text"
      ? selected
      : (elements.find((e): e is TextElement => e.kind === "text") ?? null);
  const lookIsActive = (el: TextElement, look: SignLook): boolean =>
    (el.fontFamily ?? SIGN_FONT) === look.patch.fontFamily &&
    (el.lighting ?? "front") === look.patch.lighting &&
    (el.signStyle ?? "letters") === look.patch.signStyle &&
    el.fill === look.patch.fill;
  const applyLook = (look: SignLook) => {
    if (!lookTarget) return;
    commit(lookTarget.id, lookPatch(lookTarget, look, ipp));
    setSelectedId(lookTarget.id);
  };

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
          {showAdvanced && (
            <button
              onClick={addPanel}
              title="Add a free-standing backer panel (+$400) — size it freely, layer text and logos on top"
              className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
            >
              Add panel
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => addLogo(e.target.files?.[0])}
          />
          {showAdvanced && selected?.kind === "panel" && (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Panel
                <input
                  type="color"
                  title="Panel color"
                  value={selected.fill ?? "#3a2f28"}
                  onChange={(e) => commit(selected.id, { fill: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-900"
                />
              </label>
              <button
                onClick={() =>
                  commit(selected.id, {
                    fill: sampleRegion(
                      selected.x,
                      selected.y,
                      selected.width,
                      selected.height
                    ),
                  })
                }
                className="rounded-lg border border-zinc-600 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                title="Sample the wall color behind the panel"
              >
                Match wall
              </button>
              <label className="flex items-center gap-1 text-sm text-zinc-300">
                W (in)
                <input
                  type="number"
                  min={6}
                  step={1}
                  value={Number((selected.width * ipp).toFixed(0))}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    if (inches > 0)
                      commit(selected.id, { width: inches / ipp });
                  }}
                  className="w-16 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-right tabular-nums text-zinc-100"
                />
              </label>
              <label className="flex items-center gap-1 text-sm text-zinc-300">
                H (in)
                <input
                  type="number"
                  min={6}
                  step={1}
                  value={Number((selected.height * ipp).toFixed(0))}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    if (inches > 0)
                      commit(selected.id, { height: inches / ipp });
                  }}
                  className="w-16 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-right tabular-nums text-zinc-100"
                />
              </label>
            </>
          )}
          {showAdvanced && selected && selected.kind !== "panel" && (
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
          {showAdvanced && selected && selected.kind !== "panel" && (selected.lighting ?? "front") !== "none" && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              LED
              <input
                type="color"
                title="LED color — the glow at night (halo wash / front-lit)"
                value={
                  selected.ledColor ??
                  (selected.kind === "text" &&
                  (selected.lighting ?? "front") === "front"
                    ? selected.fill
                    : "#fff3d6")
                }
                onChange={(e) =>
                  commit(selected.id, { ledColor: e.target.value })
                }
                className="h-8 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-900"
              />
            </label>
          )}
          {showAdvanced && selected?.kind === "text" && (
            <>
              <select
                value={selected.signStyle ?? "letters"}
                onChange={(e) => {
                  const v = e.target.value as "letters" | "cabinet";
                  commit(
                    selected.id,
                    v === "cabinet"
                      ? {
                          signStyle: v,
                          raceway: false,
                          backer: false,
                          backerColor: "#f7f5f0",
                          fill:
                            selected.fill === "#f5f5f5"
                              ? "#1c1917"
                              : selected.fill,
                        }
                      : { signStyle: v, backerColor: "#3f3c38" }
                  );
                }}
                title="Sign construction"
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="letters">Channel letters</option>
                <option value="cabinet">Cabinet sign</option>
              </select>
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
              {selected.signStyle === "cabinet" && (
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  Box
                  <input
                    type="color"
                    title="Cabinet face color"
                    value={selected.backerColor ?? "#f7f5f0"}
                    onChange={(e) =>
                      commit(selected.id, { backerColor: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-900"
                  />
                </label>
              )}
              {selected.signStyle !== "cabinet" && (
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
              )}
              {selected.signStyle !== "cabinet" && (
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
              )}
              {selected.signStyle !== "cabinet" && selected.raceway && (
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
          {showAdvanced && selected?.kind === "logo" && (
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
              {!customerMode && (
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
              )}
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
          {customerMode && !night && (
            <span className="text-xs text-blue-300">See it lit up at night →</span>
          )}
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
          {!customerMode && (
            <>
              <button
                onClick={exportPng}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Export PNG
              </button>
              <button
                onClick={() => void makeProposal()}
                disabled={elements.length === 0}
                className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
              >
                Proposal
              </button>
              <button
                onClick={emailProposal}
                disabled={elements.length === 0}
                title="Create the proposal and email it to the customer via Zapier"
                className="rounded-lg border border-amber-400/60 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
              >
                ✉ Email
              </button>
            </>
          )}
          {customerMode && (
            <button
              onClick={() =>
                customerEmail
                  ? void makeProposal(customerEmail, true)
                  : alert(
                      "We don't have your email on file — call or text (832) 974-2546 and we'll send your proposal."
                    )
              }
              disabled={elements.length === 0}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-40"
            >
              ✉ Email my proposal
            </button>
          )}
        </div>

        {customerMode && lookTarget && (
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">
                Pick a look — tap to try it on your building
              </span>
              <button
                onClick={() => setFineTune((f) => !f)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {fineTune ? "Hide fine-tune ▲" : "Fine-tune ▼"}
              </button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {SIGN_LOOKS.map((look) => {
                const active = lookIsActive(lookTarget, look);
                return (
                  <button
                    key={look.id}
                    onClick={() => applyLook(look)}
                    className={`w-36 shrink-0 rounded-xl border p-2 text-left transition-colors ${
                      active
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                    }`}
                  >
                    <div
                      className="flex h-12 items-center justify-center overflow-hidden rounded-lg"
                      style={{
                        background:
                          "linear-gradient(180deg, #101014 0%, #1c1c22 100%)",
                      }}
                    >
                      <span
                        className="max-w-full truncate px-2 py-1 text-base font-bold"
                        style={{ ...look.preview.plate, ...look.preview.text }}
                      >
                        {lookTarget.text || "Your Sign"}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-zinc-100">
                      {look.name}
                    </div>
                    <div className="text-[11px] leading-tight text-zinc-400">
                      {look.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Nothing is final — play around. Prefer we handle it? We&apos;ll
              design it together live on your call.
            </p>
          </div>
        )}

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
              {/* free-standing backer panels render behind everything else */}
              {elements.map((el) =>
                el.kind === "panel" ? (
                  <PanelNode
                    key={el.id}
                    el={el}
                    scale={scale}
                    night={night}
                    draggableProps={commonProps(el)}
                  />
                ) : null
              )}
              {elements.map((el) => {
                // raceway strip drawn behind its letters
                if (
                  el.kind !== "text" ||
                  el.signStyle === "cabinet" ||
                  !el.raceway
                )
                  return null;
                const textW = measureTextWidth(el.text, el.fontSize, el.fontFamily);
                const rwPad = 2 / ipp; // 2" side margins
                const rwH = 8 / ipp; // standard ~8" raceway
                return (
                  <Rect
                    key={`mount-${el.id}`}
                    listening={false}
                    x={(el.x - rwPad) * scale}
                    y={(el.y + el.fontSize / 2 - rwH / 2) * scale}
                    width={(textW + rwPad * 2) * scale}
                    height={rwH * scale}
                    rotation={el.rotation}
                    fill={el.racewayColor ?? "#3f3c38"}
                    cornerRadius={2 * scale}
                    shadowColor="black"
                    shadowBlur={6 * scale}
                    shadowOffsetY={4 * scale}
                    shadowOpacity={0.4}
                  />
                );
              })}
              {elements.map((el) =>
                el.kind === "panel" ? null : el.kind === "text" ? (
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
                    ? el.signStyle === "cabinet"
                      ? cabinetHeightInches(el, ipp)
                      : textLetterHeightInches(el, ipp)
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
                keepRatio={selected?.kind !== "panel"}
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
                ? selected.signStyle === "cabinet"
                  ? `Cabinet: ${formatFeetInches(selectedDims.w)} × ${formatFeetInches(selectedDims.h)}`
                  : `Letters: ${formatFeetInches(selectedDims.h)} tall · ${formatFeetInches(selectedDims.w)} wide`
                : `Logo: ${formatFeetInches(selectedDims.w)} × ${formatFeetInches(selectedDims.h)}`}
            </span>
          )}
        </div>
      </div>

      {sidebar}
    </div>
  );
}
