"use client";

import Link from "next/link";

type Tab = "board" | "tasks";

function BoardIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
    </svg>
  );
}

function TasksIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6.5l1.6 1.6L8.5 5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13.5l1.6 1.6L8.5 12" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 7h6M11 14h6" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}

export function BottomNav({ active }: { active: Tab }) {
  const items: { key: Tab; href: string; label: string; Icon: typeof BoardIcon }[] = [
    { key: "board", href: "/", label: "Board", Icon: BoardIcon },
    { key: "tasks", href: "/my-tasks", label: "My Tasks", Icon: TasksIcon },
  ];

  return (
    <nav
      style={{
        flexShrink: 0,
        display: "flex",
        borderTop: "1px solid rgba(11,27,43,0.1)",
        background: "#F5F1E8",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {items.map(({ key, href, label, Icon }) => {
        const isActive = key === active;
        const color = isActive ? "#2E6B5E" : "rgba(11,27,43,0.5)";
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "9px 0 11px",
              textDecoration: "none",
              color,
            }}
          >
            <Icon active={isActive} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: isActive ? 600 : 500, letterSpacing: "0.01em" }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
