"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { STAGE_FILTER_CATEGORY, STAGES, type ProfileMember } from "@/lib/stages";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { DashboardStats, Profile, Turn } from "@/lib/supabase/types";
import type { TurnMeta } from "@/lib/turn-meta";
import { UserHeader } from "@/components/UserHeader";
import { DashboardHeader } from "./DashboardHeader";
import { TurnCard } from "./TurnCard";

type Filter = "All" | "Office" | "Maintenance" | "Ready" | "Mine" | "On Hold" | "Overdue";
const FILTERS: Filter[] = ["All", "Mine", "Office", "Maintenance", "Ready", "On Hold", "Overdue"];

type SortBy = "stage" | "aging" | "target" | "property";
type GroupBy = "none" | "property" | "stage";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "stage", label: "Stage" },
  { value: "aging", label: "Aging ↓" },
  { value: "target", label: "Target date" },
  { value: "property", label: "Property" },
];

/** Days since a YYYY-MM-DD string, client-side. */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

function sortTurns(turns: Turn[], sortBy: SortBy): Turn[] {
  return [...turns].sort((a, b) => {
    switch (sortBy) {
      case "stage":   return a.stage_idx - b.stage_idx;
      case "aging":   return daysSince(b.vacate_date) - daysSince(a.vacate_date);
      case "target":  return a.target_date.localeCompare(b.target_date);
      case "property": return (a.property_name ?? "").localeCompare(b.property_name ?? "");
      default: return 0;
    }
  });
}

export function Board({
  turns, openCounts, currentUser, profiles, mineIds, meta, stats,
}: {
  turns: Turn[];
  openCounts: Record<string, number>;
  currentUser: Profile;
  profiles: ProfileMember[];
  mineIds: string[];
  meta: Record<string, TurnMeta>;
  stats: DashboardStats;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [sortBy, setSortBy] = useState<SortBy>("stage");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
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

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const visible = useMemo(() => {
    const filtered = turns.filter((t) => {
      if (filter === "All") return true;
      if (filter === "Mine") return mineSet.has(t.id);
      if (filter === "On Hold") return t.hold_status != null;
      if (filter === "Overdue") return t.target_date < todayStr && t.stage_idx < 5;
      const cat = STAGE_FILTER_CATEGORY[t.stage_idx];
      if (filter === "Office") return cat === "office";
      if (filter === "Maintenance") return cat === "maintenance";
      if (filter === "Ready") return cat === "ready";
      return true;
    });
    return sortTurns(filtered, sortBy);
  }, [turns, filter, sortBy, mineSet, todayStr]);

  const onHoldCount = useMemo(() => turns.filter((t) => t.hold_status != null).length, [turns]);
  const overdueCount = useMemo(
    () => turns.filter((t) => t.target_date < todayStr && t.stage_idx < 5).length,
    [turns, todayStr],
  );

  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const buckets = new Map<string, Turn[]>();
    for (const t of visible) {
      const key = groupBy === "property" ? (t.property_name ?? "Unknown") : String(t.stage_idx);
      const arr = buckets.get(key) ?? [];
      arr.push(t);
      buckets.set(key, arr);
    }
    return buckets;
  }, [visible, groupBy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "#1A2E44", flexShrink: 0 }}>
        {/* Top bar */}
        <div style={{ padding: "50px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#F5F1E8", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
              Unit Turns
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UserHeader profile={currentUser} />
              {currentUser.role === "admin" && (
                <Link href="/admin" aria-label="Admin" title="Admin"
                  style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: "1.5px solid rgba(245,241,232,0.3)", color: "rgba(245,241,232,0.85)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 1.5l1 1.6 1.9-.5.3 1.9 1.9.6-.7 1.8 1.3 1.5-1.3 1.5.7 1.8-1.9.6-.3 1.9-1.9-.5-1 1.6-1-1.6-1.9.5-.3-1.9-1.9-.6.7-1.8L1.6 8l1.3-1.5-.7-1.8 1.9-.6.3-1.9 1.9.5 1-1.6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
              <Link href="/turns/import" aria-label="Import CSV" title="Import CSV"
                style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: "1.5px solid rgba(245,241,232,0.3)", color: "rgba(245,241,232,0.85)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 10V2M8 2L5 5M8 2L11 5M3 11v1.5A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/turns/new" aria-label="New turn"
                style={{ width: 34, height: 34, borderRadius: "50%", background: "#2E6B5E", color: "#fff", fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
              >
                +
              </Link>
            </div>
          </div>
        </div>

        {/* Dashboard stat tiles */}
        <DashboardHeader stats={stats} onFilterChange={(f) => setFilter(f)} />

        {/* Sort + Group row */}
        <div style={{ padding: "10px 16px 6px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "rgba(245,241,232,0.5)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Sort</span>
            <div style={{ display: "flex", gap: 4 }}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => setSortBy(opt.value)}
                    style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${active ? "transparent" : "rgba(245,241,232,0.2)"}`, background: active ? "rgba(245,241,232,0.18)" : "transparent", color: active ? "#F5F1E8" : "rgba(245,241,232,0.6)", fontFamily: "var(--font-sans)", fontWeight: active ? 600 : 400, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                  >{opt.label}</button>
                );
              })}
            </div>
          </div>
          <div style={{ width: 1, height: 16, background: "rgba(245,241,232,0.15)", flex: "0 0 auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "rgba(245,241,232,0.5)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Group</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["none", "property", "stage"] as GroupBy[]).map((g) => {
                const active = groupBy === g;
                const label = g === "none" ? "None" : g === "property" ? "Property" : "Stage";
                return (
                  <button key={g} type="button" onClick={() => setGroupBy(g)}
                    style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${active ? "transparent" : "rgba(245,241,232,0.2)"}`, background: active ? "rgba(245,241,232,0.18)" : "transparent", color: active ? "#F5F1E8" : "rgba(245,241,232,0.6)", fontFamily: "var(--font-sans)", fontWeight: active ? 600 : 400, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                  >{label}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, padding: "6px 16px 14px", overflowX: "auto" }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const isHoldChip = f === "On Hold";
            const isOverdueChip = f === "Overdue";
            const chipCount = isHoldChip ? onHoldCount : isOverdueChip ? overdueCount : 0;
            const chipColor = isOverdueChip ? "#C84A2F" : isHoldChip ? "#C8922A" : undefined;
            return (
              <button key={f} type="button" onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px", borderRadius: 999,
                  border: `1.5px solid ${active ? "transparent" : chipColor ? `${chipColor}80` : "rgba(245,241,232,0.3)"}`,
                  background: active ? (chipColor ?? "#F5F1E8") : "transparent",
                  color: active ? (chipColor ? "#fff" : "#1A2E44") : chipColor ? chipColor : "rgba(245,241,232,0.8)",
                  fontFamily: "var(--font-sans)", fontWeight: active ? 600 : 400, fontSize: 13,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {f}
                {chipCount > 0 && (
                  <span style={{ background: active ? "rgba(255,255,255,0.3)" : `${chipColor}2e`, color: active ? "#fff" : chipColor, borderRadius: 999, padding: "1px 6px", fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>
                    {chipCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px", background: "#F5F1E8" }}>
        {visible.length === 0 ? (
          <p style={{ textAlign: "center", fontWeight: 400, fontSize: 14, color: "rgba(11,27,43,0.38)", marginTop: 40 }}>
            No units match this filter.
          </p>
        ) : grouped ? (
          Array.from(grouped.entries()).map(([groupKey, groupTurns]) => {
            const stageIdx = groupBy === "stage" ? Number(groupKey) : null;
            const stageMeta = stageIdx !== null ? STAGES[stageIdx] : null;
            return (
              <div key={groupKey}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 6, position: "sticky", top: 0, zIndex: 1, background: "#F5F1E8", paddingTop: 4, paddingBottom: 4 }}>
                  {stageMeta ? (
                    <span style={{ background: stageMeta.color, color: "#fff", borderRadius: 999, padding: "3px 10px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 12 }}>{stageMeta.name}</span>
                  ) : (
                    <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13, color: "#1A2E44", letterSpacing: "-0.01em" }}>{groupKey}</span>
                  )}
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(11,27,43,0.38)", fontWeight: 400 }}>{groupTurns.length} unit{groupTurns.length !== 1 ? "s" : ""}</span>
                </div>
                {groupTurns.map((t) => (
                  <TurnCard key={t.id} turn={t} openTasks={openCounts[t.id] ?? 0} profiles={profiles} meta={meta[t.id]} />
                ))}
              </div>
            );
          })
        ) : (
          visible.map((t) => (
            <TurnCard key={t.id} turn={t} openTasks={openCounts[t.id] ?? 0} profiles={profiles} meta={meta[t.id]} />
          ))
        )}
      </div>
    </div>
  );
}
