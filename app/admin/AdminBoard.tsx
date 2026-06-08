"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Team } from "@/lib/stages";
import {
  addDefaultTaskAction,
  deleteDefaultTaskAction,
  reorderTasksInStageAction,
} from "./actions";

type Task = { id: number; stage_idx: number; name: string; sort_order: number };

export type AdminStage = {
  stageIdx: number;
  name: string;
  color: string;
  team: Team;
  tasks: Task[];
};

export function AdminBoard({ stages: initial }: { stages: AdminStage[] }) {
  const [stages, setStages] = useState<AdminStage[]>(initial);

  function patchStage(stageIdx: number, tasks: Task[]) {
    setStages((prev) =>
      prev.map((s) => (s.stageIdx === stageIdx ? { ...s, tasks } : s)),
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--color-cream)" }}>
      {/* Header */}
      <div style={{ background: "#1A2E44", padding: "50px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Link
              href="/"
              style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "rgba(245,241,232,0.6)", textDecoration: "none" }}
            >
              ← Board
            </Link>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#F5F1E8", letterSpacing: "-0.01em", marginTop: 6 }}>
              Admin · Default Tasks
            </h1>
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Admin
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "rgba(245,241,232,0.55)", marginTop: 10, maxWidth: 520, lineHeight: 1.5 }}>
          Drag tasks to reorder them within a phase. Changes apply to the default
          checklist new turns are seeded with.
        </p>
      </div>

      {/* Phase cards */}
      <div style={{ padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 720, margin: "0 auto" }}>
        {stages.map((stage) => (
          <PhaseCard key={stage.stageIdx} stage={stage} onTasksChange={(t) => patchStage(stage.stageIdx, t)} />
        ))}
      </div>
    </div>
  );
}

function PhaseCard({
  stage,
  onTasksChange,
}: {
  stage: AdminStage;
  onTasksChange: (tasks: Task[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stage.tasks.findIndex((t) => t.id === active.id);
    const newIndex = stage.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(stage.tasks, oldIndex, newIndex).map((t, i) => ({
      ...t,
      sort_order: i,
    }));
    onTasksChange(reordered); // optimistic
    startTransition(async () => {
      try {
        await reorderTasksInStageAction(reordered.map((t) => ({ id: t.id, sort_order: t.sort_order })));
      } catch {
        onTasksChange(stage.tasks); // revert
      }
    });
  }

  function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    setAdding(false);
    startTransition(async () => {
      try {
        const row = await addDefaultTaskAction(stage.stageIdx, name);
        onTasksChange([...stage.tasks, row]);
      } catch {
        // leave list unchanged on failure
      }
    });
  }

  function handleDelete(id: number) {
    const next = stage.tasks.filter((t) => t.id !== id);
    onTasksChange(next); // optimistic
    startTransition(async () => {
      try {
        await deleteDefaultTaskAction(id);
      } catch {
        onTasksChange(stage.tasks); // revert
      }
    });
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--color-fog)", overflow: "hidden", boxShadow: "0 1px 2px rgba(11,27,43,0.04)" }}>
      {/* Phase header (phases are fixed — not reorderable) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 15, color: "var(--color-ink)" }}>
          {stage.name}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {stage.team}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-slate)" }}>
          {stage.tasks.length} {stage.tasks.length === 1 ? "task" : "tasks"}
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--color-slate)" }} aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stage.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {stage.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onDelete={() => handleDelete(t.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {stage.tasks.length === 0 && !adding && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--color-slate)", padding: "8px 6px" }}>
              No default tasks yet.
            </p>
          )}

          {adding ? (
            <div style={{ display: "flex", gap: 6, marginTop: 6, padding: "0 4px" }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setAdding(false); setDraft(""); }
                }}
                placeholder="Task name…"
                style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-fog)", outline: "none" }}
              />
              <button type="button" onClick={handleAdd} style={btnPrimary}>Add</button>
              <button type="button" onClick={() => { setAdding(false); setDraft(""); }} style={btnGhost}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} style={addBtn}>
              + Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 8px",
    borderRadius: 8,
    background: isDragging ? "var(--color-cream)" : "#fff",
    border: "1px solid var(--color-fog)",
    boxShadow: isDragging ? "0 4px 12px rgba(11,27,43,0.12)" : "none",
    opacity: isDragging ? 0.95 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ cursor: "grab", touchAction: "none", border: "none", background: "transparent", color: "var(--color-slate-light)", padding: "2px 4px", display: "flex" }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" />
          <circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" />
          <circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" />
        </svg>
      </button>
      <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--color-ink)" }}>
        {task.name}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${task.name}`}
        style={{ border: "none", background: "transparent", color: "var(--color-slate-light)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 6px", borderRadius: 6 }}
      >
        ×
      </button>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, padding: "8px 14px",
  borderRadius: 8, border: "none", background: "var(--color-evergreen)", color: "#fff", cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: 13, padding: "8px 12px",
  borderRadius: 8, border: "1px solid var(--color-fog)", background: "#fff", color: "var(--color-slate)", cursor: "pointer",
};
const addBtn: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, marginTop: 6, padding: "8px 10px",
  borderRadius: 8, border: "1px dashed var(--color-fog)", background: "transparent", color: "var(--color-evergreen)",
  cursor: "pointer", width: "100%", textAlign: "left",
};
