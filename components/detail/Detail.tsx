"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { advanceTurnAction, toggleTaskAction } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { SegBar } from "@/components/SegBar";
import { StageTag } from "@/components/StageTag";
import { formatDate, STAGES } from "@/lib/stages";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Task, TurnWithTasks } from "@/lib/supabase/types";

export function Detail({ turn }: { turn: TurnWithTasks }) {
  const router = useRouter();
  // Optimistic mirror of tasks so the checkbox feels instant
  const [tasks, setTasks] = useState<Task[]>(turn.tasks);
  const [, startTransition] = useTransition();

  // Keep local state in sync if the server pushes new data
  useEffect(() => { setTasks(turn.tasks); }, [turn.tasks]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`turn-${turn.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turn_tasks", filter: `turn_id=eq.${turn.id}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "turns", filter: `id=eq.${turn.id}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [turn.id, router]);

  const isLast = turn.stage_idx === STAGES.length - 1;
  const open = tasks.filter((t) => !t.done).length;
  const allDone = open === 0;

  function onToggle(task: Task) {
    const next = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    startTransition(() => { void toggleTaskAction(task.id, next); });
  }

  function onAdvance() {
    if (!allDone || isLast) return;
    startTransition(() => { void advanceTurnAction(turn.id); });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "#1A2E44", padding: "50px 20px 0", flexShrink: 0 }}>
        <Link
          href="/"
          style={{
            background: "transparent",
            color: "rgba(245,241,232,0.72)",
            fontWeight: 500,
            fontSize: 13.5,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            paddingBottom: 10,
          }}
        >
          ← Back
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 20,
                color: "#F5F1E8",
              }}
            >
              {turn.property_name ?? "Property"} <span style={{ color: "#5BAE97" }}>{turn.unit}</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 7 }}>
              {[
                ["Vacated", formatDate(turn.vacate_date)],
                ["Target", formatDate(turn.target_date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 9.5,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(245,241,232,0.48)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      color: "rgba(245,241,232,0.88)",
                      marginTop: 1,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <StageTag stageIdx={turn.stage_idx} lg />
        </div>
        <SegBar stageIdx={turn.stage_idx} dark />
        <div
          style={{
            fontWeight: 500,
            fontSize: 11.5,
            color: "rgba(245,241,232,0.5)",
            marginTop: 7,
            paddingBottom: 16,
            letterSpacing: "0.03em",
          }}
        >
          Stage {turn.stage_idx + 1} of {STAGES.length} — {STAGES[turn.stage_idx].name}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px", background: "#F5F1E8" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: "#2E6B5E",
            marginBottom: 11,
          }}
        >
          Current stage tasks
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onToggle(task)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                background: "#fff",
                borderRadius: 8,
                border: "1px solid rgba(11,27,43,0.07)",
                opacity: task.done ? 0.65 : 1,
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: `2px solid ${task.done ? "#2E6B5E" : "rgba(11,27,43,0.2)"}`,
                  background: task.done ? "#2E6B5E" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {task.done && (
                  <svg width="12" height="9" viewBox="0 0 12 9">
                    <path
                      d="M1 4l3.5 3.5L11 1"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                )}
              </div>
              <span
                style={{
                  flex: 1,
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: "#0B1B2B",
                  textDecoration: task.done ? "line-through" : "none",
                }}
              >
                {task.name}
              </span>
              <Avatar initials={task.assignee} size={24} />
            </button>
          ))}
        </div>

        {allDone && !isLast && (
          <div
            style={{
              background: "rgba(46,107,94,0.1)",
              border: "1px solid rgba(46,107,94,0.25)",
              borderRadius: 8,
              padding: "12px 14px",
              marginTop: 16,
              fontWeight: 400,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "#2A5C46",
            }}
          >
            All done. Tap below to advance to <strong>{STAGES[turn.stage_idx + 1].name}</strong>.
          </div>
        )}
        {isLast && allDone && (
          <div
            style={{
              background: "rgba(61,122,95,0.12)",
              border: "1px solid rgba(61,122,95,0.25)",
              borderRadius: 8,
              padding: "12px 14px",
              marginTop: 16,
              fontWeight: 600,
              fontSize: 13.5,
              color: "#3D7A5F",
            }}
          >
            ✓ This unit is Make-Ready.
          </div>
        )}
      </div>

      {!isLast && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 16px 28px",
            background: "#F5F1E8",
            borderTop: "1px solid rgba(11,27,43,0.08)",
          }}
        >
          <button
            type="button"
            onClick={onAdvance}
            disabled={!allDone}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 8,
              border: "none",
              cursor: allDone ? "pointer" : "not-allowed",
              background: allDone ? "#2E6B5E" : "#E8E4DC",
              color: allDone ? "#fff" : "rgba(11,27,43,0.28)",
              fontWeight: 600,
              fontSize: 15,
              transition: "background 0.2s",
            }}
          >
            {allDone
              ? `Advance to ${STAGES[turn.stage_idx + 1].name} →`
              : `${open} task${open !== 1 ? "s" : ""} left before advancing`}
          </button>
        </div>
      )}
    </div>
  );
}
