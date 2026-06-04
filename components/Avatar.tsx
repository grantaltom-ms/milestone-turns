import { avatarColor } from "@/lib/stages";

export function Avatar({ initials, size = 30 }: { initials: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarColor(initials),
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.38),
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}
