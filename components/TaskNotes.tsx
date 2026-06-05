"use client";

import { useState, useTransition } from "react";
import { addTaskNoteAction } from "@/app/actions";
import type { TaskNote } from "@/lib/supabase/types";

function formatNoteTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function TaskNotes({
  turnId,
  stageIdx,
  taskName,
  initialNotes,
}: {
  turnId: string;
  stageIdx: number;
  taskName: string;
  initialNotes: TaskNote[];
}) {
  const [notes, setNotes] = useState<TaskNote[]>(initialNotes);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const optimistic: TaskNote = {
      id: `temp-${Date.now()}`,
      turn_id: turnId,
      stage_idx: stageIdx,
      task_name: taskName,
      author_id: "",
      author_name: "You",
      content: draft.trim(),
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, optimistic]);
    setDraft("");
    setComposing(false);
    setExpanded(true);
    startTransition(async () => {
      try {
        await addTaskNoteAction({ turn_id: turnId, stage_idx: stageIdx, task_name: taskName, content: draft.trim() });
      } catch {
        // revert optimistic note on error
        setNotes((prev) => prev.filter((n) => n.id !== optimistic.id));
      }
    });
  }

  return (
    <div style={{ marginTop: 4, paddingLeft: 34 }}>
      {/* Notes list (collapsible) */}
      {notes.length > 0 && (
        <div style={{ marginBottom: composing ? 6 : 0 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "rgba(11,27,43,0.45)",
              fontSize: 11.5,
              fontWeight: 500,
            }}
          >
            <span style={{
              display: "inline-block",
              width: 12,
              transition: "transform 0.15s",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}>▶</span>
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: "rgba(200,146,42,0.07)",
                    border: "1px solid rgba(200,146,42,0.18)",
                    borderRadius: 6,
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 11.5, color: "#0B1B2B" }}>
                      {note.author_name}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(11,27,43,0.38)" }}>
                      {formatNoteTime(note.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#0B1B2B", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose area */}
      {composing ? (
        <form onSubmit={submitNote} style={{ marginTop: notes.length ? 8 : 0 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            placeholder="Type a note…"
            rows={2}
            style={{
              width: "100%",
              border: "1.5px solid rgba(200,146,42,0.35)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 13,
              color: "#0B1B2B",
              background: "#FEFCF7",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              lineHeight: 1.45,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNote(e as unknown as React.FormEvent); }
              if (e.key === "Escape") { setComposing(false); setDraft(""); }
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
            <button
              type="submit"
              disabled={!draft.trim()}
              style={{
                padding: "6px 13px",
                background: "#2E6B5E",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: draft.trim() ? "pointer" : "not-allowed",
                opacity: draft.trim() ? 1 : 0.55,
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setComposing(false); setDraft(""); }}
              style={{
                padding: "6px 10px",
                background: "transparent",
                color: "rgba(11,27,43,0.5)",
                border: "1px solid rgba(11,27,43,0.15)",
                borderRadius: 6,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          style={{
            marginTop: notes.length > 0 ? 6 : 2,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "rgba(11,27,43,0.38)",
            fontSize: 11.5,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Add note
        </button>
      )}
    </div>
  );
}
