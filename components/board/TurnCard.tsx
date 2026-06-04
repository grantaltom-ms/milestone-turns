"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SegBar } from "@/components/SegBar";
import { StageTag } from "@/components/StageTag";
import type { Turn } from "@/lib/supabase/types";

export function TurnCard({ turn, openTasks }: { turn: Turn; openTasks: number }) {
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
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(11,27,43,0.09)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, color: "#0B1B2B", whiteSpace: "nowrap" }}>
          {turn.property_name ?? "Property"}{" "}
          <span style={{ color: "#2E6B5E" }}>{turn.unit}</span>
        </span>
        <StageTag stageIdx={turn.stage_idx} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
        <span
          style={{
            fontWeight: 400,
            fontSize: 12.5,
            color: openTasks === 0 ? "#3D7A5F" : "rgba(11,27,43,0.48)",
          }}
        >
          {openTasks === 0 ? "✓ All done" : `${openTasks} task${openTasks !== 1 ? "s" : ""} left`}
        </span>
        <Avatar initials={turn.assignee} size={26} />
      </div>
      <div style={{ marginTop: 9 }}>
        <SegBar stageIdx={turn.stage_idx} />
      </div>
    </Link>
  );
}
