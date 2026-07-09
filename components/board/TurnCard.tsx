"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { StageTag } from "@/components/StageTag";
import { useT } from "@/lib/i18n-context";
import { avatarColorFromProfiles, formatDate, type ProfileMember } from "@/lib/stages";
import type { Turn } from "@/lib/supabase/types";
import type { TurnMeta } from "@/lib/turn-meta";
import { computeUrgency } from "@/lib/priority";

export function TurnCard({
  turn,
  openTasks,
  profiles,
  meta,
  today,
}: {
  turn: Turn;
  openTasks: number;
  profiles: ProfileMember[];
  meta?: TurnMeta;
  today: string;
}) {
  const { t, tp, stage } = useT();
  const stageName = stage(turn.stage_idx);
  const days = meta?.daysInStage ?? 0;
  const isHeld = turn.hold_status != null;
  const isBlocked = turn.hold_status === "blocked";
  const holdBg = isBlocked ? "#8B4A2F" : "#C8922A";
  const holdLabel = isBlocked ? t("status.blocked") : t("status.onHold");

  // Restrained move-in cue: neutral date always; a single colored clause only
  // when the turn is actually behind / past its move-in.
  const urgency = computeUrgency(turn, today);
  const showMoveIn = !!turn.move_in_date && !isHeld && turn.stage_idx < 5;
  const accent =
    urgency.level === "overdue"
      ? { color: "#C84A2F", text: t("card.pastMoveIn") }
      : urgency.level === "behind"
        ? { color: "#C8922A", text: t("card.behind", { n: urgency.behindBy }) }
        : urgency.level === "tight"
          ? { color: "#C8922A", text: t("card.tight") }
          : null;

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
      {showMoveIn && (
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.3 }}>
          <span style={{ color: "rgba(11,27,43,0.5)", fontWeight: 400 }}>
            {t("card.moveIn", { date: formatDate(turn.move_in_date!) })}
          </span>
          {accent && (
            <span style={{ color: accent.color, fontWeight: 600 }}> · {accent.text}</span>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: showMoveIn ? 8 : isHeld && turn.hold_reason ? 8 : 9 }}>
        <span style={{ fontWeight: 400, fontSize: 12.5, color: isHeld ? "rgba(11,27,43,0.42)" : openTasks === 0 ? "#3D7A5F" : "rgba(11,27,43,0.48)" }}>
          {openTasks === 0 ? t("card.allDone") : tp("card.tasksLeft", openTasks)}
          {!isHeld && days > 0 && (
            <span style={{ color: "rgba(11,27,43,0.38)", marginLeft: 8 }}>
              · {t("card.daysInStage", { n: days, stage: stageName })}
            </span>
          )}
          {isHeld && (
            <span style={{ color: "rgba(11,27,43,0.38)" }}>{" "}· {stageName}</span>
          )}
        </span>
        <Avatar initials={turn.assignee} size={26} color={avatarColorFromProfiles(turn.assignee, profiles)} />
      </div>
    </Link>
  );
}
