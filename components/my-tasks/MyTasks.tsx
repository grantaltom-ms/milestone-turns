"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toggleTaskAction } from "@/app/actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Avatar } from "@/components/Avatar";
import { StageTag } from "@/components/StageTag";
import { BottomNav } from "@/components/BottomNav";
import { useT } from "@/lib/i18n-context";
import type { MyTaskItem, MyTasksResult } from "@/lib/data";
import type { Profile } from "@/lib/supabase/types";

export function MyTasks({ currentUser, tasks }: { currentUser: Profile; tasks: MyTasksResult }) {
  const { t, tp } = useT();
  const router = useRouter();
  // Track ids just checked off so they hide immediately; the server refresh
  // then drops them from `tasks.now`. Deriving avoids a sync effect.
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Which unit cards are expanded — collapsed by default.
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const now = useMemo(() => tasks.now.filter((x) => !completed.has(x.task_id)), [tasks.now, completed]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel("mytasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "turn_tasks" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "turns" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router]);

  function toggleUnit(turnId: string) {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }

  function complete(item: MyTaskItem) {
    setCompleted((prev) => new Set(prev).add(item.task_id)); // optimistic hide
    startTransition(async () => {
      try {
        await toggleTaskAction(item.task_id, true);
      } catch {
        setCompleted((prev) => {
          const n = new Set(prev);
          n.delete(item.task_id);
          return n;
        });
      }
      router.refresh();
    });
  }

  // Group actionable tasks by unit so a worker can clear a whole unit at once.
  const groups = useMemo(() => {
    const m = new Map<string, MyTaskItem[]>();
    for (const it of now) {
      const arr = m.get(it.turn_id) ?? [];
      arr.push(it);
      m.set(it.turn_id, arr);
    }
    return Array.from(m.values());
  }, [now]);

  const isEmpty = groups.length === 0 && tasks.later.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ background: "#1A2E44", padding: "50px 20px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#F5F1E8", letterSpacing: "-0.01em" }}>
              {t("mytasks.title")}
            </h1>
            <p style={{ fontWeight: 300, fontSize: 13, color: "rgba(245,241,232,0.58)", marginTop: 4 }}>
              {t("mytasks.subtitle")}
            </p>
          </div>
          <Avatar initials={currentUser.initials} size={30} color={currentUser.avatar_color} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 28px", background: "#F5F1E8" }}>
        {isEmpty ? (
          <div style={{ textAlign: "center", marginTop: 52 }}>
            <div style={{ fontSize: 34, color: "#3D7A5F", lineHeight: 1 }}>✓</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "#0B1B2B", marginTop: 10 }}>{t("mytasks.empty")}</div>
            <div style={{ fontWeight: 400, fontSize: 13.5, color: "rgba(11,27,43,0.5)", marginTop: 4 }}>{t("mytasks.emptyHint")}</div>
          </div>
        ) : (
          <>
            {groups.map((group) => {
              const head = group[0];
              const open = openUnits.has(head.turn_id);
              return (
                <div key={head.turn_id} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(11,27,43,0.08)", marginBottom: 10, overflow: "hidden" }}>
                  {/* Collapsed by default: unit + how many tasks are yours. Tap to expand. */}
                  <button
                    type="button"
                    onClick={() => toggleUnit(head.turn_id)}
                    aria-expanded={open}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "13px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14.5, color: "#0B1B2B", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {head.property_name} <span style={{ color: "#2E6B5E" }}>{head.unit}</span>
                    </span>
                    {head.hold_status ? (
                      <span style={{ flexShrink: 0, background: "#C8922A", color: "#fff", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {t("status.onHold")}
                      </span>
                    ) : head.overdue ? (
                      <span style={{ flexShrink: 0, background: "#C84A2F", color: "#fff", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {t("mytasks.overdue")}
                      </span>
                    ) : null}
                    <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "rgba(11,27,43,0.5)" }}>
                      {tp("mytasks.tasksHere", group.length)}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: "rgba(11,27,43,0.4)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {open && (
                    <div style={{ padding: "2px 8px 8px", borderTop: "1px solid rgba(11,27,43,0.06)" }}>
                      {group.map((item) => (
                        <button
                          key={item.task_id}
                          type="button"
                          onClick={() => complete(item)}
                          style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: "transparent", border: "none", padding: "9px 6px", cursor: "pointer", textAlign: "left" }}
                        >
                          <span style={{ width: 21, height: 21, borderRadius: 6, border: "2px solid rgba(46,107,94,0.5)", flexShrink: 0 }} />
                          <span style={{ fontSize: 14, color: "#0B1B2B", lineHeight: 1.35 }}>{item.name}</span>
                        </button>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 6px 2px" }}>
                        <StageTag stageIdx={head.stage_idx} />
                        <Link href={`/turns/${head.turn_id}`} style={{ fontSize: 12.5, fontWeight: 500, color: "#2E6B5E", textDecoration: "none" }}>
                          {t("mytasks.openUnit")}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {tasks.later.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(11,27,43,0.42)", marginBottom: 8 }}>
                  {t("mytasks.comingUp")}
                </div>
                {tasks.later.map((item) => (
                  <Link
                    key={item.task_id}
                    href={`/turns/${item.turn_id}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(11,27,43,0.06)", borderRadius: 8, marginBottom: 6, textDecoration: "none" }}
                  >
                    <span style={{ fontSize: 13, color: "rgba(11,27,43,0.72)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
                    <span style={{ fontSize: 11.5, color: "rgba(11,27,43,0.45)", flexShrink: 0 }}>
                      {item.property_name} {item.unit}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="tasks" />
    </div>
  );
}
