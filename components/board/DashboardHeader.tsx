"use client";

import { useT } from "@/lib/i18n-context";
import type { DashboardStats } from "@/lib/supabase/types";

type TileConfig = {
  key: keyof DashboardStats;
  labelKey: string;
  filterTarget?: "Move-in Soon";
  activeColor: (val: number) => string;
  isDecimal?: boolean;
  labelFontSize?: number;
};

const TILES: TileConfig[] = [
  {
    key: "inTurn",
    labelKey: "tile.inTurn",
    activeColor: () => "#F5F1E8",
  },
  {
    key: "moveInSoon",
    labelKey: "tile.moveInSoon",
    filterTarget: "Move-in Soon",
    activeColor: (v) => (v > 0 ? "#4A7FA5" : "#F5F1E8"),
    labelFontSize: 9.5,
  },
  {
    key: "ready",
    labelKey: "tile.ready",
    activeColor: (v) => (v > 0 ? "#3D7A5F" : "#F5F1E8"),
  },
];

export function DashboardHeader({
  stats,
  onFilterChange,
}: {
  stats: DashboardStats;
  onFilterChange: (f: "Move-in Soon") => void;
}) {
  const { t } = useT();
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "14px 16px 10px",
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        background: "#1A2E44",
        flexShrink: 0,
      }}
    >
      {TILES.map((tile) => {
        const raw = stats[tile.key];
        const val = typeof raw === "number" ? raw : 0;
        const color = tile.activeColor(val);
        const isColored = color !== "#F5F1E8";
        const textColor = isColored ? "#fff" : "#0B1B2B";
        const clickable = !!tile.filterTarget;
        return (
          <button
            key={tile.key}
            type="button"
            onClick={clickable ? () => onFilterChange(tile.filterTarget!) : undefined}
            style={{
              flex: "1 0 0",
              minWidth: 64,
              maxWidth: 90,
              background: color,
              borderRadius: 10,
              border: "none",
              padding: "9px 8px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: clickable ? "pointer" : "default",
              outline: "none",
              transition: "opacity 0.12s",
            }}
            onMouseEnter={(e) => { if (clickable) e.currentTarget.style.opacity = "0.82"; }}
            onMouseLeave={(e) => { if (clickable) e.currentTarget.style.opacity = "1"; }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 22,
                lineHeight: 1,
                color: textColor,
                letterSpacing: "-0.02em",
              }}
            >
              {tile.isDecimal ? val.toFixed(1) : val}
            </span>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: tile.labelFontSize ?? 10.5,
                color: isColored ? "rgba(255,255,255,0.82)" : "rgba(11,27,43,0.52)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {t(tile.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
