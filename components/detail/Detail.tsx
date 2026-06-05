"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addTaskAction,
  advanceTurnAction,
  deleteTaskAction,
  deleteTurnAction,
  handoffToMaintenanceAction,
  setStageAssigneeAction,
  setTaskAssigneeAction,
  toggleTaskAction,
  updateTurnAction,
} from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { SegBar } from "@/components/SegBar";
import { StageTag } from "@/components/StageTag";
import { TaskNotes } from "@/components/TaskNotes";
import { UserHeader } from "@/components/UserHeader";
import {
  avatarColorFromProfiles,
  formatDate,
  membersOnTeam,
  STAGE_TEAM,
  STAGES,
  type ProfileMember,
} from "@/lib/stages";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Profile, Task, TaskNote, TurnWithTasks } from "@/lib/supabase/types";
import { computeTurnMeta } from "@/lib/turn-meta";

type Interactivity = "past" | "current" | "future";

export function Detail({
  turn,
  profiles,
  currentUser,
  initialNotes,
}: {
  turn: TurnWithTasks;
  profiles: ProfileMember[];
  currentUser: Profile;
  initialNotes: TaskNote[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(turn.tasks);
  const [picker, setPicker] = useState<
    | { kind: "task"; taskId: string }
    | { kind: "stage"; stageIdx: number }
    | null
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [, startTransition] = useTransition();

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_notes", filter: `turn_id=eq.${turn.id}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [turn.id, router]);

  const isLast = turn.stage_idx === STAGES.length - 1;

  // Group tasks by stage for the full-pipeline view.
  const tasksByStage = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (let i = 0; i < STAGES.length; i++) m.set(i, []);
    for (const t of tasks) {
      const arr = m.get(t.stage_idx);
      if (arr) arr.push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [tasks]);

  // Build per-stage notes lookup: stageIdx → (task_name → notes[])
  const notesByStageTask = useMemo(() => {
    const m = new Map<number, Map<string, TaskNote[]>>();
    for (const note of initialNotes) {
      const stageMap = m.get(note.stage_idx) ?? new Map<string, TaskNote[]>();
      const arr = stageMap.get(note.task_name) ?? [];
      arr.push(note);
      stageMap.set(note.task_name, arr);
      m.set(note.stage_idx, stageMap);
    }
    return m;
  }, [initialNotes]);

  const currentTasks = tasksByStage.get(turn.stage_idx) ?? [];
  const openCurrent = currentTasks.filter((t) => !t.done).length;
  const allCurrentDone = openCurrent === 0 && currentTasks.length > 0;
  const isHandoffPoint =
    allCurrentDone &&
    !isLast &&
    STAGE_TEAM[turn.stage_idx] === "office" &&
    STAGE_TEAM[turn.stage_idx + 1] === "maintenance";

  const pickerStageIdx =
    picker?.kind === "stage"
      ? picker.stageIdx
      : picker?.kind === "task"
        ? tasks.find((t) => t.id === picker.taskId)?.stage_idx ?? turn.stage_idx
        : turn.stage_idx;
  const pickerStageTeam = STAGE_TEAM[pickerStageIdx];
  const pickerMembers = useMemo<ProfileMember[]>(
    () => membersOnTeam(pickerStageTeam, profiles),
    [pickerStageTeam, profiles],
  );

  function interactivityFor(stageIdx: number): Interactivity {
    if (stageIdx < turn.stage_idx) return "past";
    if (stageIdx === turn.stage_idx) return "current";
    return "future";
  }

  function onToggle(task: Task) {
    if (task.stage_idx !== turn.stage_idx) return;
    const next = !task.done;
    const nowIso = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              done: next,
              done_at: next ? nowIso : null,
              completed_by: next ? currentUser.initials : null,
            }
          : t,
      ),
    );
    startTransition(() => { void toggleTaskAction(task.id, next); });
  }

  function onAdvance() {
    if (!allCurrentDone || isLast) return;
    startTransition(() => { void advanceTurnAction(turn.id); });
  }

  function onPickTaskAssignee(taskId: string, newAssignee: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assignee: newAssignee } : t)));
    setPicker(null);
    startTransition(() => { void setTaskAssigneeAction(taskId, newAssignee); });
  }

  function onPickStageAssignee(stageIdx: number, newAssignee: string) {
    setTasks((prev) => prev.map((t) => (t.stage_idx === stageIdx ? { ...t, assignee: newAssignee } : t)));
    setPicker(null);
    // setStageAssigneeAction bulk-updates all tasks for the turn, so it's the
    // right action only when stageIdx === current stage. For non-current
    // stages, fall back to per-task updates.
    startTransition(() => {
      if (stageIdx === turn.stage_idx) {
        void setStageAssigneeAction(turn.id, newAssignee);
      } else {
        // Per-task update for past/future stage
        const targets = tasks.filter((t) => t.stage_idx === stageIdx);
        for (const t of targets) void setTaskAssigneeAction(t.id, newAssignee);
      }
    });
  }

  const currentStageTeamLabel = STAGE_TEAM[turn.stage_idx] === "office" ? "Office" : "Maintenance";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ background: "#1A2E44", padding: "50px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
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
            }}
          >
            ← Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Edit turn"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "transparent",
                border: "1.5px solid rgba(245,241,232,0.3)",
                color: "rgba(245,241,232,0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <UserHeader profile={currentUser} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "#F5F1E8" }}>
              {turn.property_name ?? "Property"} <span style={{ color: "#5BAE97" }}>{turn.unit}</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 7, alignItems: "flex-end", flexWrap: "wrap" }}>
              {[
                ["Vacated", formatDate(turn.vacate_date)],
                ["Target", formatDate(turn.target_date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontWeight: 500, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,241,232,0.48)" }}>
                    {label}
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: "rgba(245,241,232,0.88)", marginTop: 1 }}>
                    {value}
                  </div>
                </div>
              ))}
              {(() => {
                const meta = computeTurnMeta(turn);
                return (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {meta.daysInStage > 0 && (
                      <span
                        style={{
                          background: "rgba(245,241,232,0.12)",
                          color: "rgba(245,241,232,0.88)",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontWeight: 500,
                          fontSize: 11.5,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {meta.daysInStage}d in {STAGES[turn.stage_idx].name}
                      </span>
                    )}
                    {meta.isOverdue && (
                      <span
                        style={{
                          background: "#C45C3B",
                          color: "#fff",
                          borderRadius: 999,
                          padding: "3px 9px",
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        OVERDUE
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <StageTag stageIdx={turn.stage_idx} lg />
        </div>
        <SegBar stageIdx={turn.stage_idx} dark />
        <div style={{ fontWeight: 500, fontSize: 11.5, color: "rgba(245,241,232,0.5)", marginTop: 7, paddingBottom: 16, letterSpacing: "0.03em" }}>
          Stage {turn.stage_idx + 1} of {STAGES.length} — {STAGES[turn.stage_idx].name} ({currentStageTeamLabel})
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px", background: "#F5F1E8" }}>
        {STAGES.map((stage, i) => (
          <StageSection
            key={i}
            stageIdx={i}
            stageName={stage.name}
            stageColor={stage.color}
            interactivity={interactivityFor(i)}
            tasks={tasksByStage.get(i) ?? []}
            profiles={profiles}
            notesByTask={notesByStageTask.get(i) ?? new Map()}
            turnId={turn.id}
            onToggle={onToggle}
            onReassignTask={(taskId) => setPicker({ kind: "task", taskId })}
            onReassignStage={(stageIdx) => setPicker({ kind: "stage", stageIdx })}
            onAddTask={(name) => {
              startTransition(() => { void addTaskAction(turn.id, i, name); });
            }}
            onDeleteTask={(taskId) => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
              startTransition(() => { void deleteTaskAction(taskId); });
            }}
          />
        ))}

        {isHandoffPoint && (
          <div style={{ background: "rgba(26,46,68,0.07)", border: "1px solid rgba(26,46,68,0.18)", borderRadius: 8, padding: "12px 14px", marginTop: 16, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#1A2E44", marginBottom: 2 }}>Office work complete</div>
            <div style={{ fontWeight: 400, fontSize: 13, color: "rgba(11,27,43,0.6)" }}>
              Tap below to assign a maintenance team member and hand off to <strong>{STAGES[turn.stage_idx + 1].name}</strong>.
            </div>
          </div>
        )}
        {allCurrentDone && !isLast && !isHandoffPoint && (
          <div style={{ background: "rgba(46,107,94,0.1)", border: "1px solid rgba(46,107,94,0.25)", borderRadius: 8, padding: "12px 14px", marginTop: 16, fontWeight: 400, fontSize: 13.5, lineHeight: 1.5, color: "#2A5C46" }}>
            All done. Tap below to advance to <strong>{STAGES[turn.stage_idx + 1].name}</strong>.
          </div>
        )}
        {isLast && allCurrentDone && (
          <div style={{ background: "rgba(61,122,95,0.12)", border: "1px solid rgba(61,122,95,0.25)", borderRadius: 8, padding: "12px 14px", marginTop: 16, fontWeight: 600, fontSize: 13.5, color: "#3D7A5F" }}>
            ✓ This unit is Ready.
          </div>
        )}
      </div>

      {/* Advance / Handoff button */}
      {!isLast && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px 28px", background: "#F5F1E8", borderTop: "1px solid rgba(11,27,43,0.08)" }}>
          {isHandoffPoint ? (
            <button
              type="button"
              onClick={() => setHandoffOpen(true)}
              style={{
                width: "100%",
                padding: 15,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: "#1A2E44",
                color: "#F5F1E8",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Hand off to Maintenance →
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdvance}
              disabled={!allCurrentDone}
              style={{
                width: "100%",
                padding: 15,
                borderRadius: 8,
                border: "none",
                cursor: allCurrentDone ? "pointer" : "not-allowed",
                background: allCurrentDone ? "#2E6B5E" : "#E8E4DC",
                color: allCurrentDone ? "#fff" : "rgba(11,27,43,0.28)",
                fontWeight: 600,
                fontSize: 15,
                transition: "background 0.2s",
              }}
            >
              {allCurrentDone
                ? `Advance to ${STAGES[turn.stage_idx + 1].name} →`
                : `${openCurrent} task${openCurrent !== 1 ? "s" : ""} left before advancing`}
            </button>
          )}
        </div>
      )}

      {/* Handoff sheet */}
      {handoffOpen && (
        <HandoffSheet
          turn={turn}
          profiles={profiles}
          onConfirm={(assignee) => {
            setHandoffOpen(false);
            startTransition(() => { void handoffToMaintenanceAction(turn.id, assignee); });
          }}
          onClose={() => setHandoffOpen(false)}
        />
      )}

      {/* Edit sheet */}
      {editOpen && (
        <EditTurnSheet
          turn={turn}
          onClose={() => setEditOpen(false)}
        />
      )}

      {/* Pickers */}
      {picker && (
        <AssigneeSheet
          members={pickerMembers}
          teamLabel={
            picker.kind === "stage"
              ? `Assign all ${STAGES[picker.stageIdx].name} tasks`
              : pickerStageTeam === "office"
                ? "Office team"
                : "Maintenance team"
          }
          current={
            picker.kind === "stage"
              ? tasksByStage.get(picker.stageIdx)?.[0]?.assignee
              : tasks.find((t) => t.id === picker.taskId)?.assignee
          }
          onPick={(initials) =>
            picker.kind === "stage"
              ? onPickStageAssignee(picker.stageIdx, initials)
              : onPickTaskAssignee(picker.taskId, initials)
          }
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function StageSection({
  stageIdx,
  stageName,
  stageColor,
  interactivity,
  tasks,
  profiles,
  notesByTask,
  turnId,
  onToggle,
  onReassignTask,
  onReassignStage,
  onAddTask,
  onDeleteTask,
}: {
  stageIdx: number;
  stageName: string;
  stageColor: string;
  interactivity: Interactivity;
  tasks: Task[];
  profiles: ProfileMember[];
  notesByTask: Map<string, TaskNote[]>;
  turnId: string;
  onToggle: (t: Task) => void;
  onReassignTask: (taskId: string) => void;
  onReassignStage: (stageIdx: number) => void;
  onAddTask: (name: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(interactivity === "current");
  const [newTaskName, setNewTaskName] = useState("");
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const canReassign = interactivity !== "past";

  const summary =
    interactivity === "past"
      ? totalCount > 0
        ? `Complete · ${totalCount} task${totalCount !== 1 ? "s" : ""}`
        : "Complete"
      : interactivity === "future"
        ? `${totalCount} task${totalCount !== 1 ? "s" : ""} queued`
        : totalCount > 0
          ? `${doneCount} of ${totalCount} done`
          : "No tasks";

  const eyebrowColor =
    interactivity === "past"
      ? "rgba(11,27,43,0.45)"
      : interactivity === "future"
        ? "rgba(11,27,43,0.55)"
        : "#2E6B5E";

  const stageAssignee = tasks[0]?.assignee;

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "0 0 8px 0",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        aria-expanded={open}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 2,
            background: interactivity === "future" ? "rgba(11,27,43,0.15)" : stageColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontWeight: 600,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: eyebrowColor,
          }}
        >
          {interactivity === "past" && "✓ "}
          {stageIdx + 1}. {stageName} · {summary}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "rgba(11,27,43,0.4)",
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 0.15s",
          }}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>

      {open && tasks.length === 0 && (
        <div style={{ fontWeight: 400, fontSize: 12.5, color: "rgba(11,27,43,0.4)", fontStyle: "italic", padding: "8px 4px" }}>
          No tasks for this stage.
        </div>
      )}

      {open && tasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Stage-level assignee row (only when interactive) */}
          {canReassign && stageAssignee && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.6)",
                borderRadius: 8,
                border: "1px solid rgba(11,27,43,0.05)",
              }}
            >
              <span style={{ flex: 1, fontWeight: 500, fontSize: 12, color: "rgba(11,27,43,0.55)" }}>
                Stage assigned to
              </span>
              <button
                type="button"
                onClick={() => onReassignStage(stageIdx)}
                title="Change stage assignee"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Avatar
                  initials={stageAssignee}
                  size={22}
                  color={avatarColorFromProfiles(stageAssignee, profiles)}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0B1B2B" }}>
                  {profiles.find((p) => p.initials === stageAssignee)?.name ?? stageAssignee}
                </span>
                <span style={{ fontSize: 11, color: "rgba(11,27,43,0.35)" }}>›</span>
              </button>
            </div>
          )}

          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              interactivity={interactivity}
              profiles={profiles}
              notes={notesByTask.get(task.name) ?? []}
              turnId={turnId}
              stageIdx={stageIdx}
              onToggle={onToggle}
              onReassign={onReassignTask}
              onDelete={onDeleteTask}
            />
          ))}

          {interactivity === "current" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newTaskName.trim();
                if (!name) return;
                onAddTask(name);
                setNewTaskName("");
              }}
              style={{ display: "flex", gap: 6, marginTop: 2 }}
            >
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Add a task…"
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px dashed rgba(11,27,43,0.2)",
                  background: "rgba(255,255,255,0.5)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  color: "#0B1B2B",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!newTaskName.trim()}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: newTaskName.trim() ? "#2E6B5E" : "rgba(11,27,43,0.08)",
                  color: newTaskName.trim() ? "#fff" : "rgba(11,27,43,0.3)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: newTaskName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Add
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  interactivity,
  profiles,
  notes,
  turnId,
  stageIdx,
  onToggle,
  onReassign,
  onDelete,
}: {
  task: Task;
  interactivity: Interactivity;
  profiles: ProfileMember[];
  notes: TaskNote[];
  turnId: string;
  stageIdx: number;
  onToggle: (t: Task) => void;
  onReassign: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const canToggle = interactivity === "current";
  const canReassign = interactivity !== "past";
  const canDelete = interactivity === "current" && !task.done;
  const dim = interactivity === "current" ? (task.done ? 0.65 : 1) : 0.78;

  return (
    <div
      style={{
        padding: "11px 14px 12px",
        background: interactivity === "current" ? "#fff" : "rgba(255,255,255,0.6)",
        borderRadius: 8,
        border: "1px solid rgba(11,27,43,0.07)",
        opacity: dim,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          role={canToggle ? "button" : undefined}
          tabIndex={canToggle ? 0 : -1}
          onClick={canToggle ? () => onToggle(task) : undefined}
          onKeyDown={
            canToggle
              ? (e) => { if (e.key === "Enter" || e.key === " ") onToggle(task); }
              : undefined
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: 1,
            cursor: canToggle ? "pointer" : "default",
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
                <path d="M1 4l3.5 3.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
        </div>
        <button
          type="button"
          disabled={!canReassign}
          aria-label={canReassign ? `Reassign (currently ${task.assignee})` : `Assigned to ${task.assignee}`}
          onClick={canReassign ? () => onReassign(task.id) : undefined}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: canReassign ? "pointer" : "default",
          }}
        >
          <Avatar
            initials={task.assignee}
            size={24}
            color={avatarColorFromProfiles(task.assignee, profiles)}
          />
        </button>
        {canDelete && (
          <button
            type="button"
            aria-label="Delete task"
            onClick={() => onDelete(task.id)}
            style={{
              background: "transparent",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              color: "rgba(11,27,43,0.25)",
              fontSize: 16,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            ×
          </button>
        )}
      </div>

      {interactivity === "current" && (
        <TaskNotes
          turnId={turnId}
          stageIdx={stageIdx}
          taskName={task.name}
          initialNotes={notes}
        />
      )}
      {interactivity !== "current" && notes.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px dashed rgba(11,27,43,0.08)",
            fontSize: 12,
            color: "rgba(11,27,43,0.55)",
          }}
        >
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

function HandoffSheet({
  turn,
  profiles,
  onConfirm,
  onClose,
}: {
  turn: TurnWithTasks;
  profiles: ProfileMember[];
  onConfirm: (assignee: string) => void;
  onClose: () => void;
}) {
  const maintenanceMembers = useMemo(
    () => profiles.filter((p) => p.role === "maintenance_lead" || p.role === "maintenance"),
    [profiles],
  );
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(11,27,43,0.5)", zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#F5F1E8", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: "20px 16px 32px", boxShadow: "0 -8px 24px rgba(11,27,43,0.2)" }}
      >
        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1A2E44" }}>Hand off to Maintenance</div>
          <div style={{ fontWeight: 400, fontSize: 13, color: "rgba(11,27,43,0.55)", marginTop: 3 }}>
            {turn.property_name} · Unit {turn.unit} — Office work is complete.
            Pick who takes it from here.
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(11,27,43,0.08)", margin: "14px 0" }} />

        <div style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(11,27,43,0.45)", marginBottom: 10 }}>
          Maintenance team
        </div>

        {maintenanceMembers.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "rgba(11,27,43,0.5)", margin: "0 0 12px" }}>
            No maintenance members found. Ask your admin to set roles in Supabase.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {maintenanceMembers.map((m) => {
              const active = selected === m.initials;
              return (
                <button
                  key={m.initials}
                  type="button"
                  onClick={() => setSelected(m.initials)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 14px",
                    background: active ? "rgba(26,46,68,0.06)" : "#fff",
                    border: `1.5px solid ${active ? "#1A2E44" : "rgba(11,27,43,0.08)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Avatar initials={m.initials} size={30} color={m.avatar_color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0B1B2B" }}>{m.name}</div>
                    <div style={{ fontWeight: 400, fontSize: 12, color: "rgba(11,27,43,0.5)", textTransform: "capitalize" }}>
                      {m.role.replace("_", " ")}
                    </div>
                  </div>
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#1A2E44" />
                      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "none",
            background: selected ? "#1A2E44" : "rgba(11,27,43,0.1)",
            color: selected ? "#F5F1E8" : "rgba(11,27,43,0.3)",
            fontWeight: 600,
            fontSize: 15,
            cursor: selected ? "pointer" : "not-allowed",
          }}
        >
          {selected ? `Hand off to ${profiles.find((p) => p.initials === selected)?.name ?? selected} →` : "Select a team member"}
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 8, width: "100%", padding: 12, background: "transparent", border: "1px solid rgba(11,27,43,0.15)", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14, color: "rgba(11,27,43,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditTurnSheet({
  turn,
  onClose,
}: {
  turn: TurnWithTasks;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState(turn.unit);
  const [vacateDate, setVacateDate] = useState(turn.vacate_date);
  const [targetDate, setTargetDate] = useState(turn.target_date);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateTurnAction(turn.id, {
        unit: unit.trim(),
        vacate_date: vacateDate,
        target_date: targetDate,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteTurnAction(turn.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(11,27,43,0.15)",
    background: "#fff",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "#0B1B2B",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(11,27,43,0.4)", zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#F5F1E8", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: "20px 16px 32px", boxShadow: "0 -8px 24px rgba(11,27,43,0.18)" }}
      >
        <div style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.16em", color: "#2E6B5E", marginBottom: 16 }}>
          Edit Turn
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: 11.5, color: "rgba(11,27,43,0.55)", marginBottom: 4 }}>Unit</label>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: 11.5, color: "rgba(11,27,43,0.55)", marginBottom: 4 }}>Vacated</label>
            <input type="date" value={vacateDate} onChange={(e) => setVacateDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: 11.5, color: "rgba(11,27,43,0.55)", marginBottom: 4 }}>Target date</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && (
          <p style={{ marginTop: 10, fontSize: 13, color: "#C45C3B" }}>{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !unit.trim()}
          style={{
            marginTop: 18,
            width: "100%",
            padding: 13,
            borderRadius: 8,
            border: "none",
            background: saving || !unit.trim() ? "rgba(11,27,43,0.1)" : "#2E6B5E",
            color: saving || !unit.trim() ? "rgba(11,27,43,0.35)" : "#fff",
            fontWeight: 600,
            fontSize: 14.5,
            cursor: saving || !unit.trim() ? "not-allowed" : "pointer",
          }}
        >
          {saving && !confirmDelete ? "Saving…" : "Save changes"}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{ marginTop: 8, width: "100%", padding: 13, borderRadius: 8, border: "1px solid rgba(196,92,59,0.3)", background: "transparent", color: "#C45C3B", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
          >
            Delete turn…
          </button>
        ) : (
          <div style={{ marginTop: 8, background: "rgba(196,92,59,0.08)", border: "1px solid rgba(196,92,59,0.25)", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#C45C3B", fontWeight: 500 }}>
              Delete this turn and all its tasks? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(11,27,43,0.15)", background: "transparent", color: "rgba(11,27,43,0.6)", fontWeight: 500, fontSize: 13.5, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#C45C3B", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 10, width: "100%", padding: 12, background: "transparent", border: "1px solid rgba(11,27,43,0.15)", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14, color: "rgba(11,27,43,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AssigneeSheet({
  members,
  teamLabel,
  current,
  onPick,
  onClose,
}: {
  members: ProfileMember[];
  teamLabel: string;
  current?: string;
  onPick: (initials: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(11,27,43,0.4)", zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#F5F1E8", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: "20px 16px 28px", boxShadow: "0 -8px 24px rgba(11,27,43,0.18)" }}
      >
        <div style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.16em", color: "#2E6B5E", marginBottom: 11 }}>
          {teamLabel}
        </div>

        {members.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "rgba(11,27,43,0.5)", margin: "0 0 12px" }}>
            No team members found. Ask your admin to set roles in Supabase.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map((m) => {
              const selected = current === m.initials;
              return (
                <button
                  key={m.initials}
                  type="button"
                  onClick={() => onPick(m.initials)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "#fff",
                    border: `1px solid ${selected ? m.avatar_color : "rgba(11,27,43,0.07)"}`,
                    borderLeft: `4px solid ${selected ? m.avatar_color : "transparent"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Avatar initials={m.initials} size={28} color={m.avatar_color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0B1B2B" }}>{m.name}</div>
                    <div style={{ fontWeight: 400, fontSize: 12, color: "rgba(11,27,43,0.55)", textTransform: "capitalize" }}>
                      {m.role.replace("_", " ")}
                    </div>
                  </div>
                  {selected && <span style={{ color: m.avatar_color, fontSize: 16 }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 14, width: "100%", padding: "12px", background: "transparent", border: "1px solid rgba(11,27,43,0.15)", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14, color: "rgba(11,27,43,0.6)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
