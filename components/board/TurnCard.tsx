"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SegBar } from "@/components/SegBar";
import { StageTag } from "@/components/StageTag";
import { avatarColorFromProfiles, STAGES, type ProfileMember } from "@/lib/stages";
import type { Turn } from "@/lib/supabase/types";
import type { TurnMeta } from "@/lib/turn-meta";

export function TurnCard({
  turn,
  openTasks,
  profiles,
  meta,
}: {
  turn: Turn;
  openTasks: number;
  profiles: ProfileMember[];
  meta?: TurnMeta;
}) {
  const stageName = STAGES[turn.stage_idx]?.name ?? "?";
  const days = meta?.daysInStage ?? 0;
  const isHeld = turn.hold_status != null;
  const isBlocked = turn.hold_status === "blocked";
  const holdBg = isBlocked ? "#8B4A2F" : "#C8922A";
  const holdLabel = isBlocked ? "Blocked" : "On Hold";

  return (
    <Link
      href={`/turns/${turn.id}`}
      style={{
        display: "block",
        background: "#fff",
        borderRadius: 10,
        border: isHeld ? `1.5px solid ${holdBg}33` : "1px solid rgba(11,27,43,0.08)",
        padding: "14px 15px",
        marginBottom: 10,
        textDecoration: "none",
        transition: "box-shadow 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(11,27,43,0.09)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      {isHeld && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: holdBg,
            borderRadius: "10px 0 0 10px",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, color: "#0B1B2B", whiteSpace: "nowrap" }}>
          {turn.property_name ?? "Property"}{" "}
          <span style={{ color: "#2E6B5E" }}>{turn.unit}</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isHeld ? (
            <span
              style={{
                background: holdBg,
                color: "#fff",
                borderRadius: 999,
                padding: "3px 9px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: 11.5,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {holdLabel}
            </span>
          ) : (
            <StageTag stageIdx={turn.stage_idx} />
          )}
        </div>
      </div>
      {isHeld && turn.hold_reason && (
        <div
          style={{
            marginTop: 5,
            fontSize: 12.5,
            color: holdBg,
            fontWeight: 400,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: 0.85,
          }}
        >
          {turn.hold_reason}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: isHeld && turn.hold_reason ? 8 : 9 }}>
        <span style={{ fontWeight: 400, fontSize: 12.5, color: isHeld ? "rgba(11,27,43,0.42)" : openTasks === 0 ? "#3D7A5F" : "rgba(11,27,43,0.48)" }}>
          {openTasks === 0 ? "✓ All done" : `${openTasks} task${openTasks !== 1 ? "s" : ""} left`}
          {!isHeld && days > 0 && (
            <span style={{ color: "rgba(11,27,43,0.38)", marginLeft: 8 }}>
              · {days}d in {stageName}
            </span>
          )}
          {isHeld && (
            <span style={{ color: "rgba(11,27,43,0.38)" }}>{" "}· {stageName}</span>
          )}
        </span>
        <Avatar initials={turn.assignee} size={26} color={avatarColorFromProfiles(turn.assignee, profiles)} />
      </div>
      <div style={{ marginTop: 9 }}>
        <SegBar stageIdx={turn.stage_idx} />
      </div>
    </Link>
  );
}
