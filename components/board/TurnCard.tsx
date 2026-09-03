"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { StageTag } from "@/components/StageTag";
import { useT } from "@/lib/i18n-context";
import { avatarColorFromProfiles, type ProfileMember } from "@/lib/stages";
import type { Turn } from "@/lib/supabase/types";
import type { TurnMeta } from "@/lib/turn-meta";

/** Whole-day diff between today and a future date string ("YYYY-MM-DD"). */
function daysUntil(iso: string): number {
  const target = new Date(iso + "T00:00:00").getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

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
  const { t, tp, stage } = useT();
  const stageName = stage(turn.stage_idx);
  const days = meta?.daysInStage ?? 0;
  const moveInDays = turn.next_move_in ? daysUntil(turn.next_move_in) : null;
  const moveInLabel =
    moveInDays === 0 ? t("card.moveInToday")
    : moveInDays === 1 ? t("card.moveInTomorrow")
    : moveInDays !== null ? tp("card.daysToMoveIn", moveInDays)
    : null;
  const flooringDays = turn.flooring_install_date ? daysUntil(turn.flooring_install_date) : null;
  const flooringLabel =
    flooringDays === 0 ? t("card.flooringToday")
    : flooringDays === 1 ? t("card.flooringTomorrow")
    : flooringDays !== null ? tp("card.daysToFlooring", flooringDays)
    : null;
  const cleaningDays = turn.cleaning_scheduled_date ? daysUntil(turn.cleaning_scheduled_date) : null;
  const cleaningLabel =
    cleaningDays === 0 ? t("card.cleaningToday")
    : cleaningDays === 1 ? t("card.cleaningTomorrow")
    : cleaningDays !== null ? tp("card.daysToCleaning", cleaningDays)
    : null;

  return (
    <Link
      href={`/turns/${turn.id}`}
      style={{
        display: "block",
        background: "#fff",
        borderRadius: 10,
        border: "1px solid rgba(11,27,43,0.08)",
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, color: "#0B1B2B", whiteSpace: "nowrap" }}>
          {turn.property_name ?? "Property"}{" "}
          <span style={{ color: "#2E6B5E" }}>{turn.unit}</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StageTag stageIdx={turn.stage_idx} />
          {flooringLabel !== null && flooringDays !== null && flooringDays >= 0 && (
            <span
              style={{
                background: "#8B4A2F",
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
              {flooringLabel}
            </span>
          )}
          {cleaningLabel !== null && cleaningDays !== null && cleaningDays >= 0 && (
            <span
              style={{
                background: "#4A7FA5",
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
              {cleaningLabel}
            </span>
          )}
        </div>
      </div>
      {moveInLabel !== null && moveInDays !== null && moveInDays >= 0 && (
        <div style={{ marginTop: 7 }}>
          <span
            style={{
              background: "#4A7FA5",
              color: "#fff",
              borderRadius: 999,
              padding: "3px 9px",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 11.5,
              whiteSpace: "nowrap",
            }}
          >
            {moveInLabel}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
        <span style={{ fontWeight: 400, fontSize: 12.5, color: openTasks === 0 ? "#3D7A5F" : "rgba(11,27,43,0.48)" }}>
          {openTasks === 0 ? t("card.allDone") : tp("card.tasksLeft", openTasks)}
          {days > 0 && (
            <span style={{ color: "rgba(11,27,43,0.38)", marginLeft: 8 }}>
              · {t("card.daysInStage", { n: days, stage: stageName })}
            </span>
          )}
        </span>
        <Avatar initials={turn.assignee} size={26} color={avatarColorFromProfiles(turn.assignee, profiles)} />
      </div>
    </Link>
  );
}
