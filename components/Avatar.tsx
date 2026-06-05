const FALLBACK_COLOR = "#697E94";

export function Avatar({
  initials,
  size = 30,
  color,
}: {
  initials: string;
  size?: number;
  color?: string;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color ?? FALLBACK_COLOR,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.38),
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </span>
  );
}
