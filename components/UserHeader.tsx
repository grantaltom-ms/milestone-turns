"use client";

import { useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/supabase/types";

export function UserHeader({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(() => { void signOutAction(); });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Avatar initials={profile.initials} size={28} color={profile.avatar_color} />
      <span
        style={{
          fontWeight: 500,
          fontSize: 13,
          color: "rgba(245,241,232,0.85)",
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {profile.name.split(" ")[0]}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        title="Sign out"
        style={{
          background: "transparent",
          border: "1px solid rgba(245,241,232,0.22)",
          borderRadius: 6,
          padding: "4px 9px",
          color: "rgba(245,241,232,0.55)",
          fontSize: 11.5,
          cursor: pending ? "wait" : "pointer",
          fontWeight: 500,
          letterSpacing: "0.03em",
        }}
      >
        {pending ? "…" : "Sign out"}
      </button>
    </div>
  );
}
