"use client";

import { useRef, useState, useTransition } from "react";
import { addTaskNoteAction } from "@/app/actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  function clearPhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetCompose() {
    setDraft("");
    clearPhoto();
    setComposing(false);
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && !photoFile) return;
    setUploading(true);

    try {
      let photoUrl: string | undefined;

      if (photoFile) {
        const supabase = getBrowserSupabase();
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${turnId}/${stageIdx}/${encodeURIComponent(taskName)}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("task-photos")
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("task-photos").getPublicUrl(path);
        photoUrl = publicUrl;
      }

      const optimistic: TaskNote = {
        id: `temp-${Date.now()}`,
        turn_id: turnId,
        stage_idx: stageIdx,
        task_name: taskName,
        author_id: "",
        author_name: "You",
        content: draft.trim() || null,
        photo_url: photoUrl ?? null,
        created_at: new Date().toISOString(),
      };

      setNotes((prev) => [...prev, optimistic]);
      setExpanded(true);
      resetCompose();

      startTransition(async () => {
        try {
          await addTaskNoteAction({
            turn_id: turnId,
            stage_idx: stageIdx,
            task_name: taskName,
            content: draft.trim() || undefined,
            photo_url: photoUrl,
          });
        } catch {
          setNotes((prev) => prev.filter((n) => n.id !== optimistic.id));
        }
      });
    } catch {
      // upload failed — leave compose open so user can retry
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = (draft.trim().length > 0 || !!photoFile) && !uploading;

  return (
    <div style={{ marginTop: 4, paddingLeft: 34 }}>
      {/* Notes list (collapsible) */}
      {notes.length > 0 && (
        <div style={{ marginBottom: composing ? 6 : 0 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "transparent", border: "none", padding: 0,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              color: "rgba(11,27,43,0.45)", fontSize: 11.5, fontWeight: 500,
            }}
          >
            <span style={{ display: "inline-block", width: 12, transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{ background: "rgba(200,146,42,0.07)", border: "1px solid rgba(200,146,42,0.18)", borderRadius: 6, padding: "8px 10px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 11.5, color: "#0B1B2B" }}>{note.author_name}</span>
                    <span style={{ fontSize: 11, color: "rgba(11,27,43,0.38)" }}>{formatNoteTime(note.created_at)}</span>
                  </div>
                  {note.content && (
                    <p style={{ margin: 0, fontSize: 13, color: "#0B1B2B", lineHeight: 1.45, whiteSpace: "pre-wrap", marginBottom: note.photo_url ? 6 : 0 }}>
                      {note.content}
                    </p>
                  )}
                  {note.photo_url && (
                    <a href={note.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                      <img
                        src={note.photo_url}
                        alt="Note photo"
                        style={{ maxWidth: "100%", borderRadius: 5, marginTop: note.content ? 4 : 0, display: "block" }}
                      />
                    </a>
                  )}
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
            placeholder="Type a note… (optional if adding a photo)"
            rows={2}
            style={{
              width: "100%", border: "1.5px solid rgba(200,146,42,0.35)", borderRadius: 6,
              padding: "8px 10px", fontSize: 13, color: "#0B1B2B", background: "#FEFCF7",
              outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.45,
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") resetCompose();
            }}
          />

          {/* Photo preview */}
          {photoPreview && (
            <div style={{ position: "relative", marginTop: 6, display: "inline-block" }}>
              <img src={photoPreview} alt="Selected" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 6, display: "block" }} />
              <button
                type="button"
                onClick={clearPhoto}
                style={{
                  position: "absolute", top: 4, right: 4,
                  background: "rgba(11,27,43,0.55)", border: "none", borderRadius: "50%",
                  width: 22, height: 22, color: "#fff", fontSize: 14, lineHeight: 1,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              style={{ display: "none" }}
            />
            {/* Photo button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Add photo"
              style={{
                padding: "6px 10px", background: "transparent",
                border: "1px solid rgba(200,146,42,0.4)", borderRadius: 6,
                color: "rgba(200,146,42,0.85)", fontSize: 16, lineHeight: 1,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 15 }}>📷</span>
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: "6px 13px", background: "#2E6B5E", color: "#fff",
                border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.55,
              }}
            >
              {uploading ? "Uploading…" : "Save"}
            </button>
            <button
              type="button"
              onClick={resetCompose}
              style={{
                padding: "6px 10px", background: "transparent", color: "rgba(11,27,43,0.5)",
                border: "1px solid rgba(11,27,43,0.15)", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
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
            marginTop: notes.length > 0 ? 6 : 2, background: "transparent", border: "none",
            padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            color: "rgba(11,27,43,0.38)", fontSize: 11.5, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Add Note // Picture
        </button>
      )}
    </div>
  );
}
