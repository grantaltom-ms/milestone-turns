"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { STAGE_FILTER_CATEGORY, type ProfileMember } from "@/lib/stages";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Profile, Turn } from "@/lib/supabase/types";
import type { TurnMeta } from "@/lib/turn-meta";
import { UserHeader } from "@/components/UserHeader";
import { TurnCard } from "./TurnCard";

type Filter = "All" | "Office" | "Maintenance" | "Ready" | "Mine" | "Overdue";
const FILTERS: Filter[] = ["All", "Mine", "Office", "Maintenance", "Ready", "Overdue"];

export function Board({
  turns,
  openCounts,
  currentUser,
  profiles,
  mineIds,
  meta,
}: {
  turns: Turn[];
  openCounts: Record<string, number>;
  currentUser: Profile;
  profiles: ProfileMember[];
  mineIds: string[];
  meta: Record<string, TurnMeta>;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const router = useRouter();
  const mineSet = useMemo(() => new Set(mineIds), [mineIds]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel("board-turns")
      .on("postgres_changes", { event: "*", schema: "public", table: "turns" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "turn_tasks" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router]);

  const visible = useMemo(() => {
    return turns.filter((t) => {
      if (filter === "All") return true;
      if (filter === "Mine") return mineSet.has(t.id);
      if (filter === "Overdue") return meta[t.id]?.isOverdue ?? false;
      const cat = STAGE_FILTER_CATEGORY[t.stage_idx];
      if (filter === "Office") return cat === "office";
      if (filter === "Maintenance") return cat === "maintenance";
      if (filter === "Ready") return cat === "ready";
      return true;
    });
  }, [turns, filter, mineSet, meta]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "#1A2E44", padding: "50px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 22,
              color: "#F5F1E8",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            Unit Turns
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserHeader profile={currentUser} />
            <Link
              href="/turns/import"
              aria-label="Import CSV"
              title="Import CSV"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "transparent",
                border: "1.5px solid rgba(245,241,232,0.3)",
                color: "rgba(245,241,232,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 10V2M8 2L5 5M8 2L11 5M3 11v1.5A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/turns/new"
              aria-label="New turn"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#2E6B5E",
                color: "#fff",
                fontSize: 22,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              +
            </Link>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, paddingBottom: 14, overflowX: "auto" }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: `1.5px solid ${active ? "transparent" : "rgba(245,241,232,0.3)"}`,
                  background: active ? "#F5F1E8" : "transparent",
                  color: active ? "#1A2E44" : "rgba(245,241,232,0.8)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px", background: "#F5F1E8" }}>
        {visible.length === 0 ? (
          <p style={{ textAlign: "center", fontWeight: 400, fontSize: 14, color: "rgba(11,27,43,0.38)", marginTop: 40 }}>
            No units match this filter.
          </p>
        ) : (
          visible.map((t) => (
            <TurnCard
              key={t.id}
              turn={t}
              openTasks={openCounts[t.id] ?? 0}
              profiles={profiles}
              meta={meta[t.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}
