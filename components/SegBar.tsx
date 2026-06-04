import { STAGES } from "@/lib/stages";

export function SegBar({ stageIdx, dark = false }: { stageIdx: number; dark?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {STAGES.map((s, i) => {
        const bg =
          i < stageIdx
            ? dark
              ? "rgba(245,241,232,0.55)"
              : "#1A2E44"
            : i === stageIdx
              ? s.color
              : dark
                ? "rgba(245,241,232,0.15)"
                : "#E8E4DC";
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: dark ? 5 : 4,
              borderRadius: 3,
              background: bg,
              transition: "background 0.3s",
            }}
          />
        );
      })}
    </div>
  );
}
