"use client";

import { STAGES } from "@/lib/stages";
import { useT } from "@/lib/i18n-context";

export function StageTag({ stageIdx, lg = false }: { stageIdx: number; lg?: boolean }) {
  const { stage } = useT();
  const s = STAGES[stageIdx];
  return (
    <span
      style={{
        background: s.color,
        color: "#fff",
        borderRadius: 999,
        padding: lg ? "5px 12px" : "3px 9px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: lg ? 13 : 11.5,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {stage(stageIdx)}
    </span>
  );
}
