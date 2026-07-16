"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { colorForInitials, describeEvent, relativeTime } from "@/lib/activity-format";
import { useT } from "@/lib/i18n-context";
import type { GlobalActivityEvent } from "@/lib/supabase/types";

const PAGE_SIZE = 30;

export function ActivityFeedBoard({ events }: { events: GlobalActivityEvent[] }) {
  const tFns = useT();
  const { t } = tFns;
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = events.slice(0, shown);
  const hasMore = shown < events.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ background: "#1A2E44", padding: "50px 20px 16px", flexShrink: 0 }}>
        <Link href="/admin" style={{ color: "rgba(245,241,232,0.72)", fontWeight: 500, fontSize: 13.5, textDecoration: "none" }}>
          ← Admin
        </Link>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#F5F1E8", marginTop: 8 }}>
          Activity feed
        </h1>
        <p style={{ fontWeight: 300, fontSize: 13, color: "rgba(245,241,232,0.6)", marginTop: 4, lineHeight: 1.45 }}>
          Every action across all properties and units, most recent first.
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 40px", background: "#F5F1E8" }}>
        {events.length === 0 ? (
          <p style={{ textAlign: "center", fontWeight: 400, fontSize: 14, color: "rgba(11,27,43,0.38)", marginTop: 40 }}>
            No activity yet.
          </p>
        ) : (
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
              <Link
                key={event.id}
                href={`/turns/${event.turn_id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  paddingBottom: 16,
                  position: "relative",
                  textDecoration: "none",
                }}
              >
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

                <Avatar initials={event.actor} size={24} color={colorForInitials(event.actor)} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(11,27,43,0.75)" }}>
                      {event.actor}
                    </span>{" "}
                    <span style={{ fontWeight: 400, fontSize: 12.5, color: "rgba(11,27,43,0.55)" }}>
                      {describeEvent(event, tFns)}
                    </span>
                    <span style={{ marginLeft: 6, fontSize: 11, color: "rgba(11,27,43,0.35)", whiteSpace: "nowrap" }}>
                      · {relativeTime(event.created_at, t)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: "#2E6B5E", marginTop: 2 }}>
                    {event.property_name} <span style={{ color: "rgba(11,27,43,0.4)", fontWeight: 500 }}>· Unit {event.unit}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE_SIZE)}
            style={{
              marginLeft: 26,
              marginTop: 4,
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
            Show {Math.min(PAGE_SIZE, events.length - shown)} more
          </button>
        )}
      </div>
    </div>
  );
}
