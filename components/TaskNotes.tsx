"use client";

import { useRef, useState, useTransition } from "react";
import { addTaskNoteAction } from "@/app/actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n-context";
import type { TaskNote } from "@/lib/supabase/types";

type TFns = ReturnType<typeof useT>;

function formatNoteTime(iso: string, t: TFns["t"]): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return t("time.justNow");
  if (diffMins < 60) return t("time.minsAgo", { n: diffMins });
  if (diffHours < 24) return t("time.hoursAgo", { n: diffHours });
  if (diffDays < 7) return t("time.daysAgo", { n: diffDays });
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
  const { t, tp } = useT();
  const [notes, setNotes] = useState<TaskNote[]>(initialNotes);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const previews = files.map((f) => URL.createObjectURL(f));
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...previews]);
    // Reset so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearPhotos() {
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoFiles([]);
    setPhotoPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetCompose() {
    setDraft("");
    clearPhotos();
    setComposing(false);
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && photoFiles.length === 0) return;
    setUploading(true);

    try {
      const supabase = getBrowserSupabase();
      const uploadedUrls: string[] = [];

      // Upload all photos in parallel
      await Promise.all(
        photoFiles.map(async (file) => {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${turnId}/${stageIdx}/${encodeURIComponent(taskName)}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("task-photos")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (uploadErr) throw uploadErr;
          const { data: { publicUrl } } = supabase.storage.from("task-photos").getPublicUrl(path);
          uploadedUrls.push(publicUrl);
        })
      );

      const optimistic: TaskNote = {
        id: `temp-${Date.now()}`,
        turn_id: turnId,
        stage_idx: stageIdx,
        task_name: taskName,
        author_id: "",
        author_name: t("notes.you"),
        content: draft.trim() || null,
        photo_urls: uploadedUrls,
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
            photo_urls: uploadedUrls,
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

  const canSubmit = (draft.trim().length > 0 || photoFiles.length > 0) && !uploading;

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
            {tp("notes.count", notes.length)}
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
                    <span style={{ fontSize: 11, color: "rgba(11,27,43,0.38)" }}>{formatNoteTime(note.created_at, t)}</span>
                  </div>
                  {note.content && (
                    <p style={{ margin: 0, fontSize: 13, color: "#0B1B2B", lineHeight: 1.45, whiteSpace: "pre-wrap", marginBottom: note.photo_urls.length > 0 ? 6 : 0 }}>
                      {note.content}
                    </p>
                  )}
                  {note.photo_urls.length > 0 && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: note.photo_urls.length === 1 ? "1fr" : "repeat(2, 1fr)",
                      gap: 4,
                      marginTop: note.content ? 4 : 0,
                    }}>
                      {note.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                          <img
                            src={url}
                            alt={t("notes.photoAlt")}
                            style={{ width: "100%", borderRadius: 5, display: "block", objectFit: "cover", aspectRatio: note.photo_urls.length === 1 ? "auto" : "1" }}
                          />
                        </a>
                      ))}
                    </div>
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
            placeholder={t("notes.placeholderOptional")}
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

          {/* Photo previews grid */}
          {photoPreviews.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 4,
              marginTop: 6,
            }}>
              {photoPreviews.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img
                    src={src}
                    alt={t("notes.selectedAlt")}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, display: "block" }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: "absolute", top: 3, right: 3,
                      background: "rgba(11,27,43,0.55)", border: "none", borderRadius: "50%",
                      width: 20, height: 20, color: "#fff", fontSize: 13, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            {/* Hidden multi-file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              style={{ display: "none" }}
            />
            {/* Photo button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t("notes.addPhotoTitle")}
              style={{
                padding: "6px 10px", background: "transparent",
                border: "1px solid rgba(200,146,42,0.4)", borderRadius: 6,
                color: "rgba(200,146,42,0.85)", fontSize: 16, lineHeight: 1,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                position: "relative",
              }}
            >
              <span style={{ fontSize: 15 }}>📷</span>
              {photoFiles.length > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  background: "#2E6B5E", color: "#fff", borderRadius: "50%",
                  width: 16, height: 16, fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {photoFiles.length}
                </span>
              )}
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
              {uploading ? t("notes.uploading") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={resetCompose}
              style={{
                padding: "6px 10px", background: "transparent", color: "rgba(11,27,43,0.5)",
                border: "1px solid rgba(11,27,43,0.15)", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
              }}
            >
              {t("common.cancel")}
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
          <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> {t("notes.add")}
        </button>
      )}
    </div>
  );
}
