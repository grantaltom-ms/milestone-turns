"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { colorForInitials, describeEvent, relativeTime } from "@/lib/activity-format";
import { useT } from "@/lib/i18n-context";
import type { TurnEvent } from "@/lib/supabase/types";

// ── component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export function ActivityLog({ initialEvents }: { initialEvents: TurnEvent[] }) {
  const tFns = useT();
  const { t } = tFns;
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
          {t("activity.title")}
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
                {describeEvent(event, tFns)}
              </span>
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  color: "rgba(11,27,43,0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                · {relativeTime(event.created_at, t)}
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
          {t("activity.showMore", { n: Math.min(PAGE_SIZE, initialEvents.length - shown) })}
        </button>
      )}
    </div>
  );
}
