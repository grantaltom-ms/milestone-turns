"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { STAGES } from "@/lib/stages";
import type { TurnEvent } from "@/lib/supabase/types";

// ── relative time ─────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── human-readable descriptions ───────────────────────────────────────────────

function describe(event: TurnEvent): string {
  const p = event.payload as Record<string, unknown> | null ?? {};
  const stageName = (idx: unknown) =>
    typeof idx === "number" && STAGES[idx] ? STAGES[idx].name : String(idx);

  switch (event.event_type) {
    case "created":
      return "created this turn";
    case "advanced":
      return `advanced to ${stageName(p.to_stage)}`;
    case "handed_off":
      return `handed off to ${stageName(p.to_stage)}${p.assigned_to ? ` → ${p.assigned_to}` : ""}`;
    case "held": {
      const label = p.hold_status === "blocked" ? "blocked" : "put on hold";
      return p.reason ? `${label} — "${p.reason}"` : label;
    }
    case "resumed":
      return "resumed the turn";
    case "assigned":
      return `assigned turn to ${p.assignee ?? "–"}`;
    case "task_assigned":
      return `assigned "${p.task_name ?? "task"}" to ${p.assignee ?? "–"}`;
    case "edited": {
      const fields = Array.isArray(p.fields_changed) ? (p.fields_changed as string[]).join(", ") : "";
      return fields ? `edited ${fields}` : "edited turn details";
    }
    case "task_completed":
      return `checked off "${p.task_name ?? "a task"}"`;
    case "task_reopened":
      return `unchecked "${p.task_name ?? "a task"}"`;
    case "note_added":
      return `added a note on "${p.task_name ?? "a task"}"`;
    case "phase_skipped":
      return `skipped the ${stageName(p.stage)} phase`;
    case "phase_unskipped":
      return `restored the ${stageName(p.stage)} phase`;
    case "task_added":
      return `added task "${p.task_name ?? "a task"}"`;
    case "task_removed":
      return `removed task "${p.task_name ?? "a task"}"`;
    default:
      return event.event_type;
  }
}

// ── avatar color — deterministic from initials ────────────────────────────────

const COLORS = [
  "#2E6B5E", "#1A2E44", "#C8922A", "#8B4A2F", "#5BAE97",
  "#697E94", "#3D7A5F", "#6B4226", "#A07840", "#2A5C46",
];

function colorForInitials(initials: string): string {
  let hash = 0;
  for (const ch of initials) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

// ── component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export function ActivityLog({ initialEvents }: { initialEvents: TurnEvent[] }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = initialEvents.slice(0, shown);
  const hasMore = shown < initialEvents.length;

  if (initialEvents.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.45 }}
        >
          <circle cx="8" cy="8" r="6.5" stroke="#0B1B2B" strokeWidth="1.5" />
          <path d="M8 4.5v4l2.5 2" stroke="#0B1B2B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          style={{
            fontWeight: 600,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: "rgba(11,27,43,0.45)",
          }}
        >
          Activity
        </span>
      </div>

      {/* Timeline */}
      <div
        style={{
          borderLeft: "2px solid rgba(11,27,43,0.1)",
          marginLeft: 10,
          paddingLeft: 16,
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {visible.map((event) => (
          <div
            key={event.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              paddingBottom: 14,
              position: "relative",
            }}
          >
            {/* Dot on the timeline */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: -22,
                top: 5,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "rgba(11,27,43,0.15)",
                border: "1.5px solid rgba(11,27,43,0.1)",
                boxSizing: "border-box",
              }}
            />

            <Avatar
              initials={event.actor}
              size={22}
              color={colorForInitials(event.actor)}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 12.5,
                  color: "rgba(11,27,43,0.75)",
                }}
              >
                {event.actor}
              </span>{" "}
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 12.5,
                  color: "rgba(11,27,43,0.55)",
                }}
              >
                {describe(event)}
              </span>
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  color: "rgba(11,27,43,0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                · {relativeTime(event.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          style={{
            marginLeft: 26,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: 12.5,
            color: "rgba(11,27,43,0.45)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Show {Math.min(PAGE_SIZE, initialEvents.length - shown)} more
        </button>
      )}
    </div>
  );
}
