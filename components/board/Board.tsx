"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { STAGE_FILTER_CATEGORY, type ProfileMember } from "@/lib/stages";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { DashboardStats, Profile, Turn } from "@/lib/supabase/types";
import type { TurnMeta } from "@/lib/turn-meta";
import { UserHeader } from "@/components/UserHeader";
import { DashboardHeader } from "./DashboardHeader";
import { TurnCard } from "./TurnCard";

type Filter = "All" | "Office" | "Maintenance" | "Ready" | "Mine" | "On Hold" | "Overdue";
const FILTERS: Filter[] = ["All", "Mine", "Office", "Maintenance", "Ready", "On Hold", "Overdue"];

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
  // Which building cards are expanded. Empty by default → landing is compressed.
  const [openBuildings, setOpenBuildings] = useState<Set<string>>(new Set());
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
    return turns.filter((t) => {
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
  }, [turns, filter, mineSet, todayStr]);

  const onHoldCount = useMemo(() => turns.filter((t) => t.hold_status != null).length, [turns]);
  const overdueCount = useMemo(
    () => turns.filter((t) => t.target_date < todayStr && t.stage_idx < 5).length,
    [turns, todayStr],
  );

  // Group the visible units under their building, sorted alphabetically.
  const buildings = useMemo(() => {
    const buckets = new Map<string, Turn[]>();
    for (const t of visible) {
      const key = t.property_name ?? "Unknown";
      const arr = buckets.get(key) ?? [];
      arr.push(t);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  function toggleBuilding(name: string) {
    setOpenBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // A building is open when the user expanded it, when there's only one
  // building to show, or when an active filter turns the list into a results
  // view (so matches are visible without a tap per building).
  const expandForFilter = filter !== "All";
  const isBuildingOpen = (name: string) =>
    expandForFilter || buildings.length === 1 || openBuildings.has(name);

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

      {/* Building list — each building is a card that expands to its units */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 32px", background: "#F5F1E8" }}>
        {buildings.length === 0 ? (
          <p style={{ textAlign: "center", fontWeight: 400, fontSize: 14, color: "rgba(11,27,43,0.38)", marginTop: 40 }}>
            No units match this filter.
          </p>
        ) : (
          buildings.map(([name, group]) => {
            const open = isBuildingOpen(name);
            const heldHere = group.filter((t) => t.hold_status != null).length;
            return (
              <div key={name} style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => toggleBuilding(name)}
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 15px",
                    background: "#fff",
                    border: "1px solid rgba(11,27,43,0.1)",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: open ? "0 2px 10px rgba(11,27,43,0.06)" : "none",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 12,
                      color: "rgba(11,27,43,0.4)",
                      transform: open ? "rotate(90deg)" : "rotate(0)",
                      transition: "transform 0.15s",
                      flexShrink: 0,
                    }}
                  >
                    ▸
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15.5, color: "#0B1B2B", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                  {heldHere > 0 && (
                    <span style={{ background: "rgba(200,146,42,0.14)", color: "#9A6D18", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {heldHere} held
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "baseline", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#2E6B5E" }}>{group.length}</span>
                    <span style={{ fontWeight: 500, fontSize: 11.5, color: "rgba(11,27,43,0.45)" }}>
                      active {group.length === 1 ? "turn" : "turns"}
                    </span>
                  </span>
                </button>

                {open && (
                  <div style={{ marginTop: 8, paddingLeft: 8 }}>
                    {group.map((t) => (
                      <TurnCard key={t.id} turn={t} openTasks={openCounts[t.id] ?? 0} profiles={profiles} meta={meta[t.id]} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
