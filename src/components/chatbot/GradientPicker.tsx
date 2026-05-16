import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

interface GradientPoint {
  color: string; // hex #rrggbb
  position: number; // 0-100
  opacity: number; // 0-1
}

interface GradientPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

// ---------- color utils ----------
const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(v.slice(0, 2), 16) || 0,
    g: parseInt(v.slice(2, 4), 16) || 0,
    b: parseInt(v.slice(4, 6), 16) || 0,
  };
};
const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
};
const hsvToRgb = (h: number, s: number, v: number) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
};
const hexToRgba = (hex: string, opacity: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// ---------- Color Panel (cssgradient.io style) ----------
interface ColorPanelProps {
  color: string;
  opacity: number;
  onChange: (color: string, opacity: number) => void;
}
const ColorPanel = ({ color, opacity, onChange }: ColorPanelProps) => {
  const { r, g, b } = hexToRgb(color);
  const { h, s, v } = rgbToHsv(r, g, b);
  const svRef = useRef<HTMLDivElement>(null);

  const setHsv = (nh: number, ns: number, nv: number, na = opacity) => {
    const rgb = hsvToRgb(nh, ns, nv);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b), na);
  };

  const handleSvDrag = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setHsv(h, x, 1 - y);
  }, [h, opacity, color]);

  const startSvDrag = (e: React.MouseEvent) => {
    handleSvDrag(e);
    const move = (ev: MouseEvent) => handleSvDrag(ev);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const checker = `repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 10px 10px`;
  const hueColor = (() => { const c = hsvToRgb(h, 1, 1); return rgbToHex(c.r, c.g, c.b); })();

  return (
    <div className="space-y-3">
      {/* SV Picker */}
      <div
        ref={svRef}
        onMouseDown={startSvDrag}
        className="relative w-full h-40 rounded-md cursor-crosshair overflow-hidden select-none"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
      >
        <div
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>

      {/* Hue Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={h}
          onChange={(e) => setHsv(Number(e.target.value), s, v)}
          className="hue-slider w-full h-3 rounded appearance-none cursor-pointer"
          style={{
            background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
          }}
        />
      </div>

      {/* Alpha Slider */}
      <div
        className="relative h-3 rounded overflow-hidden"
        style={{ background: checker }}
      >
        <div
          className="absolute inset-0 rounded"
          style={{ background: `linear-gradient(to right, transparent, ${color})` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(opacity * 100)}
          onChange={(e) => setHsv(h, s, v, Number(e.target.value) / 100)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -mt-2 -ml-1 w-2 h-4 bg-white border border-gray-400 rounded-sm pointer-events-none shadow"
          style={{ left: `${opacity * 100}%` }}
        />
      </div>

      {/* Hex + RGBA */}
      <div className="space-y-2">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Hex</Label>
          <Input
            value={color.toUpperCase()}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#?[0-9a-fA-F]{0,6}$/.test(val)) {
                const hex = val.startsWith("#") ? val : `#${val}`;
                onChange(hex, opacity);
              }
            }}
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {(["R", "G", "B", "A"] as const).map((ch) => {
            const val = ch === "R" ? r : ch === "G" ? g : ch === "B" ? b : Math.round(opacity * 100);
            return (
              <div key={ch}>
                <Label className="text-[10px] text-center block text-muted-foreground">{ch}</Label>
                <Input
                  type="number"
                  min={0}
                  max={ch === "A" ? 100 : 255}
                  value={Math.round(val)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (ch === "A") onChange(color, Math.max(0, Math.min(100, n)) / 100);
                    else {
                      const newR = ch === "R" ? n : r;
                      const newG = ch === "G" ? n : g;
                      const newB = ch === "B" ? n : b;
                      onChange(rgbToHex(newR, newG, newB), opacity);
                    }
                  }}
                  className="h-7 text-[10px] px-1 text-center"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- Main Gradient Picker ----------
export function GradientPicker({ value, onChange, label }: GradientPickerProps) {
  const [points, setPoints] = useState<GradientPoint[]>([
    { color: "#3b82f6", position: 0, opacity: 1 },
    { color: "#8b5cf6", position: 100, opacity: 1 },
  ]);
  const [angle, setAngle] = useState(90);
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    if (!value) { initRef.current = true; return; }
    if (value.includes("linear-gradient")) {
      const angleMatch = value.match(/(\d+)deg/);
      if (angleMatch) setAngle(parseInt(angleMatch[1]));
      const parts = value.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8})\s+(\d+)%/g);
      if (parts && parts.length) {
        const parsed = parts.map((p) => {
          const cm = p.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8})/);
          const pm = p.match(/(\d+)%/);
          let color = "#000000", opacity = 1;
          if (cm) {
            const raw = cm[0];
            if (raw.startsWith("rgba") || raw.startsWith("rgb")) {
              const m = raw.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)/);
              if (m) {
                color = rgbToHex(+m[1], +m[2], +m[3]);
                opacity = m[4] ? parseFloat(m[4]) : 1;
              }
            } else color = raw;
          }
          return { color, position: pm ? +pm[1] : 0, opacity };
        });
        setPoints(parsed);
      }
    } else if (value.startsWith("#")) {
      setPoints([{ color: value, position: 0, opacity: 1 }, { color: value, position: 100, opacity: 1 }]);
    } else if (value.startsWith("rgba") || value.startsWith("rgb")) {
      const m = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)/);
      if (m) {
        const c = rgbToHex(+m[1], +m[2], +m[3]);
        const op = m[4] ? parseFloat(m[4]) : 1;
        setPoints([{ color: c, position: 0, opacity: op }, { color: c, position: 100, opacity: op }]);
      }
    }
    initRef.current = true;
  }, [value]);

  const emit = (pts: GradientPoint[], ang: number) => {
    if (!pts.length) { onChange("transparent"); return; }
    if (pts.length === 1) { onChange(hexToRgba(pts[0].color, pts[0].opacity)); return; }
    const sorted = [...pts].sort((a, b) => a.position - b.position);
    onChange(`linear-gradient(${ang}deg, ${sorted.map((p) => `${hexToRgba(p.color, p.opacity)} ${p.position}%`).join(", ")})`);
  };

  const updatePoint = (idx: number, patch: Partial<GradientPoint>) => {
    const next = points.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    setPoints(next);
    emit(next, angle);
  };

  const addPoint = () => {
    const sorted = [...points].sort((a, b) => a.position - b.position);
    let pos = 50;
    if (sorted.length >= 2) {
      // find biggest gap
      let maxGap = 0, gapPos = 50;
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].position - sorted[i].position;
        if (gap > maxGap) { maxGap = gap; gapPos = sorted[i].position + gap / 2; }
      }
      pos = Math.round(gapPos);
    }
    const next = [...points, { color: "#ffffff", position: pos, opacity: 1 }];
    setPoints(next);
    setActiveIdx(next.length - 1);
    emit(next, angle);
  };

  const removePoint = (idx: number) => {
    if (points.length <= 1) return;
    const next = points.filter((_, i) => i !== idx);
    setPoints(next);
    setActiveIdx(Math.max(0, idx - 1));
    emit(next, angle);
  };

  const checker = `repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 10px 10px`;
  const active = points[activeIdx] ?? points[0];

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-medium">{label}</Label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full h-10 rounded-md border-2 border-border hover:border-primary transition-colors overflow-hidden relative"
            style={{ background: checker }}
            title="Abrir editor de gradiente"
          >
            <div className="absolute inset-0" style={{ background: value || "transparent" }} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[560px] p-0 z-[100] max-h-[85vh] overflow-y-auto" align="end" side="right" sideOffset={10}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-0">
            {/* Left: Color picker */}
            <div className="p-4 border-r">
              <div className="text-[10px] uppercase text-muted-foreground mb-2 font-semibold">Picker</div>
              {active && (
                <ColorPanel
                  color={active.color}
                  opacity={active.opacity}
                  onChange={(c, o) => updatePoint(activeIdx, { color: c, opacity: o })}
                />
              )}
            </div>

            {/* Right: Stops */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Stops</div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addPoint} title="Adicionar cor">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {points.map((pt, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveIdx(idx)}
                    className={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-colors ${activeIdx === idx ? "ring-2 ring-primary bg-accent" : "hover:bg-accent/50"}`}
                  >
                    <div className="w-6 h-6 rounded border shrink-0" style={{ background: checker }}>
                      <div className="w-full h-full rounded" style={{ background: hexToRgba(pt.color, pt.opacity) }} />
                    </div>
                    <Input
                      value={pt.color.toUpperCase()}
                      onChange={(e) => updatePoint(idx, { color: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-[10px] font-mono px-1 flex-1 min-w-0"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={pt.position}
                      onChange={(e) => updatePoint(idx, { position: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-[10px] w-10 px-1 text-center"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      disabled={points.length <= 1}
                      onClick={(e) => { e.stopPropagation(); removePoint(idx); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between">
                  <Label className="text-[10px]">Ângulo</Label>
                  <span className="text-[10px] font-mono">{angle}°</span>
                </div>
                <Slider
                  value={[angle]}
                  onValueChange={(v: number[]) => { setAngle(v[0]); emit(points, v[0]); }}
                  max={360}
                  step={1}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px]"
                onClick={() => { setPoints([{ color: "#ffffff", position: 0, opacity: 0 }]); emit([{ color: "#ffffff", position: 0, opacity: 0 }], angle); }}
              >
                Transparente
              </Button>
            </div>
          </div>

          {/* Bottom preview bar */}
          <div className="p-3 border-t">
            <div className="rounded h-6 border" style={{ background: checker }}>
              <div className="w-full h-full rounded" style={{ background: value }} />
            </div>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 text-[10px] font-mono mt-2"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
