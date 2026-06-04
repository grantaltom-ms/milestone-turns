import { STAGES } from "@/lib/stages";

export function StageTag({ stageIdx, lg = false }: { stageIdx: number; lg?: boolean }) {
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
      {s.name}
    </span>
  );
}
