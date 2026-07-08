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
  deleteTemplateAction,
  loadTemplateAction,
  reorderStagesAction,
  reorderTasksInStageAction,
  saveTemplateAction,
} from "./actions";

type Task = { id: number; stage_idx: number; name: string; sort_order: number };
type TemplateMeta = { id: number; name: string; itemCount: number };

export type AdminStage = {
  stageIdx: number;
  name: string;
  color: string;
  team: Team;
  displayOrder: number;
  tasks: Task[];
  templates: TemplateMeta[];
};

// Shared drag-handle glyph (six dots).
function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}

export function AdminBoard({ stages: initial }: { stages: AdminStage[] }) {
  const [stages, setStages] = useState<AdminStage[]>(initial);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patchStage(stageIdx: number, tasks: Task[]) {
    setStages((prev) =>
      prev.map((s) => (s.stageIdx === stageIdx ? { ...s, tasks } : s)),
    );
  }

  function patchStageTemplates(stageIdx: number, templates: TemplateMeta[]) {
    setStages((prev) =>
      prev.map((s) => (s.stageIdx === stageIdx ? { ...s, templates } : s)),
    );
  }

  function handlePhaseDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.stageIdx === active.id);
    const newIndex = stages.findIndex((s) => s.stageIdx === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({ ...s, displayOrder: i }));
    const prev = stages;
    setStages(reordered); // optimistic
    startTransition(async () => {
      try {
        await reorderStagesAction(reordered.map((s) => ({ stage_idx: s.stageIdx, display_order: s.displayOrder })));
      } catch {
        setStages(prev); // revert
      }
    });
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--color-cream)" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <Link
              href="/admin/access"
              style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(245,241,232,0.7)", textDecoration: "none", border: "1px solid rgba(245,241,232,0.25)", padding: "5px 12px", borderRadius: 6, whiteSpace: "nowrap" }}
            >
              Building access →
            </Link>
            <Link
              href="/admin/appfolio"
              style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(245,241,232,0.7)", textDecoration: "none", border: "1px solid rgba(245,241,232,0.25)", padding: "5px 12px", borderRadius: 6, whiteSpace: "nowrap" }}
            >
              AppFolio Sync →
            </Link>
            <Link
              href="/admin/notifications"
              style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(245,241,232,0.7)", textDecoration: "none", border: "1px solid rgba(245,241,232,0.25)", padding: "5px 12px", borderRadius: 6, whiteSpace: "nowrap" }}
            >
              Slack notifications →
            </Link>
          </div>
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "rgba(245,241,232,0.55)", marginTop: 10, maxWidth: 520, lineHeight: 1.5 }}>
          Drag phases by the handle to set their display order here. Drag tasks to
          reorder them within a phase. Task changes seed the default checklist new
          turns start with. Save a phase&apos;s tasks as a template, or load one to
          replace that phase&apos;s defaults.
        </p>
      </div>

      {/* Phase cards (sortable for display order) */}
      <div style={{ padding: "16px 16px 48px", maxWidth: 720, margin: "0 auto" }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePhaseDragEnd}>
          <SortableContext items={stages.map((s) => s.stageIdx)} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stages.map((stage) => (
                <PhaseCard
                  key={stage.stageIdx}
                  stage={stage}
                  onTasksChange={(t) => patchStage(stage.stageIdx, t)}
                  onTemplatesChange={(t) => patchStageTemplates(stage.stageIdx, t)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function PhaseCard({
  stage,
  onTasksChange,
  onTemplatesChange,
}: {
  stage: AdminStage;
  onTasksChange: (tasks: Task[]) => void;
  onTemplatesChange: (templates: TemplateMeta[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  // Sortable wiring for the phase card itself (display order).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.stageIdx });
  const cardStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid var(--color-fog)",
    overflow: "hidden",
    boxShadow: isDragging ? "0 8px 24px rgba(11,27,43,0.16)" : "0 1px 2px rgba(11,27,43,0.04)",
    opacity: isDragging ? 0.95 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stage.tasks.findIndex((t) => t.id === active.id);
    const newIndex = stage.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(stage.tasks, oldIndex, newIndex).map((t, i) => ({ ...t, sort_order: i }));
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
    <div ref={setNodeRef} style={cardStyle}>
      {/* Phase header */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "13px 14px" }}>
        {/* Phase drag handle (left of header) */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${stage.name}`}
          style={{ cursor: "grab", touchAction: "none", border: "none", background: "transparent", color: "var(--color-slate-light)", padding: "4px 6px 4px 0", display: "flex", flexShrink: 0 }}
        >
          <GripIcon />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
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
      </div>

      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
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

          <TemplatesSection
            stage={stage}
            onTasksChange={onTasksChange}
            onTemplatesChange={onTemplatesChange}
          />
        </div>
      )}
    </div>
  );
}

function TemplatesSection({
  stage,
  onTasksChange,
  onTemplatesChange,
}: {
  stage: AdminStage;
  onTasksChange: (tasks: Task[]) => void;
  onTemplatesChange: (templates: TemplateMeta[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [pending, startTransition] = useTransition();

  const templates = stage.templates;

  function handleLoad() {
    if (selectedId === "") return;
    const tpl = templates.find((t) => t.id === selectedId);
    const label = tpl ? `“${tpl.name}”` : "this template";
    if (!window.confirm(`Load ${label} into ${stage.name}? This replaces the phase's current default tasks.`)) return;
    startTransition(async () => {
      try {
        const rows = await loadTemplateAction(stage.stageIdx, selectedId);
        onTasksChange(rows);
      } catch {
        // leave tasks unchanged on failure
      }
    });
  }

  function handleSave() {
    const name = draftName.trim();
    if (!name) return;
    setDraftName("");
    setSaving(false);
    startTransition(async () => {
      try {
        const tpl = await saveTemplateAction(stage.stageIdx, name);
        const meta: TemplateMeta = { id: tpl.id, name: tpl.name, itemCount: tpl.items.length };
        // Upsert by id (overwrite returns the existing id).
        const next = templates.some((t) => t.id === meta.id)
          ? templates.map((t) => (t.id === meta.id ? meta : t))
          : [...templates, meta].sort((a, b) => a.name.localeCompare(b.name));
        onTemplatesChange(next);
        setSelectedId(meta.id);
      } catch {
        // leave templates unchanged on failure
      }
    });
  }

  function handleDelete() {
    if (selectedId === "") return;
    const tpl = templates.find((t) => t.id === selectedId);
    if (!window.confirm(`Delete template ${tpl ? `“${tpl.name}”` : ""}? This does not change the phase's current tasks.`)) return;
    const id = selectedId;
    const next = templates.filter((t) => t.id !== id);
    onTemplatesChange(next); // optimistic
    setSelectedId("");
    startTransition(async () => {
      try {
        await deleteTemplateAction(id);
      } catch {
        onTemplatesChange(templates); // revert
      }
    });
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-fog)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-slate)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, padding: "0 4px" }}>
        Templates
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "0 4px", flexWrap: "wrap" }}>
        <select
          value={selectedId === "" ? "" : String(selectedId)}
          onChange={(e) => setSelectedId(e.target.value === "" ? "" : Number(e.target.value))}
          disabled={templates.length === 0 || pending}
          style={{ flex: "1 1 160px", fontFamily: "var(--font-sans)", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-fog)", background: "#fff", color: "var(--color-ink)", cursor: templates.length === 0 ? "default" : "pointer" }}
        >
          <option value="">{templates.length === 0 ? "No templates saved" : "Select a template…"}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.itemCount})
            </option>
          ))}
        </select>
        <button type="button" onClick={handleLoad} disabled={selectedId === "" || pending} style={selectedId === "" || pending ? btnDisabled : btnPrimary}>
          Load
        </button>
        <button type="button" onClick={handleDelete} disabled={selectedId === "" || pending} style={selectedId === "" || pending ? btnDisabled : btnGhost} aria-label="Delete selected template">
          Delete
        </button>
      </div>

      {saving ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "0 4px" }}>
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setSaving(false); setDraftName(""); }
            }}
            placeholder="Template name…"
            style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-fog)", outline: "none" }}
          />
          <button type="button" onClick={handleSave} style={btnPrimary}>Save</button>
          <button type="button" onClick={() => { setSaving(false); setDraftName(""); }} style={btnGhost}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setSaving(true)} disabled={pending} style={addBtn}>
          + Save current tasks as template
        </button>
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
        <GripIcon />
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
const btnDisabled: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: 13, padding: "8px 12px",
  borderRadius: 8, border: "1px solid var(--color-fog)", background: "#fff", color: "var(--color-slate-light)", cursor: "default",
};
const addBtn: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, marginTop: 6, padding: "8px 10px",
  borderRadius: 8, border: "1px dashed var(--color-fog)", background: "transparent", color: "var(--color-evergreen)",
  cursor: "pointer", width: "100%", textAlign: "left",
};
