import React, { useState, useEffect } from "react";
import { Plus, Trash2, X, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

interface GradientPoint {
  color: string;
  position: number;
  opacity: number;
}

interface GradientPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function GradientPicker({ value, onChange, label }: GradientPickerProps) {
  const [points, setPoints] = useState<GradientPoint[]>([]);
  const [angle, setAngle] = useState(180);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Parse CSS gradient string on initial load
  useEffect(() => {
    if (!value) return;

    if (value.includes("linear-gradient")) {
      try {
        // Simple regex to parse angle and colors
        // Expected format: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(0,0,0,1) 100%)
        const angleMatch = value.match(/(\d+)deg/);
        if (angleMatch) setAngle(parseInt(angleMatch[1]));

        const colorParts = value.match(/(rgba?\(.*?\)|#[a-fA-F0-9]+)\s+(\d+)%/g);
        if (colorParts) {
          const newPoints = colorParts.map((part) => {
            const colorMatch = part.match(/(rgba?\(.*?\)|#[a-fA-F0-9]+)/);
            const posMatch = part.match(/(\d+)%/);
            
            let color = colorMatch ? colorMatch[0] : "#000000";
            let opacity = 1;

            if (color.startsWith("rgba")) {
              const rgbaParts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
              if (rgbaParts) {
                const r = parseInt(rgbaParts[1]);
                const g = parseInt(rgbaParts[2]);
                const b = parseInt(rgbaParts[3]);
                opacity = rgbaParts[4] ? parseFloat(rgbaParts[4]) : 1;
                color = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
              }
            }

            return {
              color,
              position: posMatch ? parseInt(posMatch[1]) : 0,
              opacity
            };
          });
          setPoints(newPoints);
        }
      } catch (e) {
        console.error("Failed to parse gradient:", e);
      }
    } else if (value.startsWith("#") || value.startsWith("rgba") || value === "transparent") {
      // It's a solid color, treat as a single point gradient for now or just set as base
      let color = value === "transparent" ? "#ffffff" : value;
      let opacity = value === "transparent" ? 0 : 1;
      
      if (value.startsWith("rgba")) {
        const rgbaParts = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaParts) {
          const r = parseInt(rgbaParts[1]);
          const g = parseInt(rgbaParts[2]);
          const b = parseInt(rgbaParts[3]);
          opacity = rgbaParts[4] ? parseFloat(rgbaParts[4]) : 1;
          color = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }
      }
      
      setPoints([{ color, position: 0, opacity }, { color, position: 100, opacity }]);
    }
  }, []);

  const updateGradient = (newPoints: GradientPoint[], newAngle: number) => {
    if (newPoints.length === 0) {
      onChange("transparent");
      return;
    }

    if (newPoints.length === 1) {
      const p = newPoints[0];
      onChange(hexToRgba(p.color, p.opacity));
      return;
    }

    // Sort points by position
    const sortedPoints = [...newPoints].sort((a, b) => a.position - b.position);
    const colorStops = sortedPoints
      .map((p) => `${hexToRgba(p.color, p.opacity)} ${p.position}%`)
      .join(", ");
    
    onChange(`linear-gradient(${newAngle}deg, ${colorStops})`);
  };

  const hexToRgba = (hex: string, opacity: number) => {
    if (!hex.startsWith("#")) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const handleAddPoint = () => {
    const newPoint = { color: "#3b82f6", position: 50, opacity: 1 };
    const newPoints = [...points, newPoint];
    setPoints(newPoints);
    setActivePointIndex(newPoints.length - 1);
    updateGradient(newPoints, angle);
  };

  const handleRemovePoint = (index: number) => {
    const newPoints = points.filter((_, i) => i !== index);
    setPoints(newPoints);
    setActivePointIndex(null);
    updateGradient(newPoints, angle);
  };

  const handleUpdatePoint = (index: number, updates: Partial<GradientPoint>) => {
    const newPoints = points.map((p, i) => i === index ? { ...p, ...updates } : p);
    setPoints(newPoints);
    updateGradient(newPoints, angle);
  };

  return (
    <div className="space-y-3 p-1">
      {label && <Label className="text-xs font-medium">{label}</Label>}
      
      {/* Gradient Preview Bar */}
      <div 
        className="h-10 w-full rounded-md border relative cursor-crosshair overflow-hidden mb-2"
        style={{ background: value }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const position = Math.round((x / rect.width) * 100);
            const newPoint = { color: "#3b82f6", position, opacity: 1 };
            const newPoints = [...points, newPoint];
            setPoints(newPoints);
            setActivePointIndex(newPoints.length - 1);
            updateGradient(newPoints, angle);
          }
        }}
      >
        {points.map((point, index) => (
          <Popover key={index} open={activePointIndex === index} onOpenChange={(open) => setActivePointIndex(open ? index : null)}>
            <PopoverTrigger asChild>
              <button
                className={`absolute top-0 bottom-0 w-3 border-x border-white shadow-sm transition-transform hover:scale-110 ${activePointIndex === index ? 'z-10 ring-2 ring-primary' : 'z-0'}`}
                style={{ 
                  left: `${point.position}%`, 
                  backgroundColor: point.color,
                  transform: `translateX(-50%)`
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="top">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Configurar Cor</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive" 
                    disabled={points.length <= 1}
                    onClick={() => handleRemovePoint(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px]">Cor</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={point.color}
                      onChange={(e) => handleUpdatePoint(index, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-none p-0"
                    />
                    <Input
                      value={point.color}
                      onChange={(e) => handleUpdatePoint(index, { color: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[10px]">Opacidade</Label>
                    <span className="text-[10px]">{Math.round(point.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[point.opacity * 100]}
                    onValueChange={(val: number[]) => handleUpdatePoint(index, { opacity: val[0] / 100 })}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[10px]">Posição</Label>
                    <span className="text-[10px]">{point.position}%</span>
                  </div>
                  <Slider
                    value={[point.position]}
                    onValueChange={(val: number[]) => handleUpdatePoint(index, { position: val[0] })}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px]">Ângulo</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[angle]}
              onValueChange={(val: number[]) => {
                setAngle(val[0]);
                updateGradient(points, val[0]);
              }}
              max={360}
              step={1}
              className="flex-1"
            />
            <span className="text-[10px] w-8">{angle}°</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-1 px-2" 
          onClick={handleAddPoint}
        >
          <Plus className="h-3 w-3" />
          <span className="text-[10px]">Cor Extra</span>
        </Button>
      </div>

      <div className="flex gap-2">
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-[10px] font-mono"
          placeholder="rgba(...) ou linear-gradient(...)"
        />
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={() => {
            setPoints([{ color: "#ffffff", position: 0, opacity: 0 }]);
            updateGradient([{ color: "#ffffff", position: 0, opacity: 0 }], angle);
          }}
          title="Limpar / Transparente"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
