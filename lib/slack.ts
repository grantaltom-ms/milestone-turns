// Slack notification dispatcher. No-op until SLACK_BOT_TOKEN is configured.
// DMs the assigned person directly via their linked profiles.slack_user_id
// (set on /admin/notifications); falls back to SLACK_FALLBACK_CHANNEL if they
// haven't linked one yet. Designed so call sites never have to care whether
// Slack is wired up or whether a given person has linked their account.

import { getServerSupabase } from "@/lib/supabase/server";
import { STAGES } from "@/lib/stages";

type SlackBlock = Record<string, unknown>;

function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "";
}

function turnBlocks(turnId: string, text: string): SlackBlock[] {
  const blocks: SlackBlock[] = [{ type: "section", text: { type: "mrkdwn", text } }];
  const url = appUrl();
  if (url) {
    blocks.push({
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "View turn" }, url: `${url}/turns/${turnId}` },
      ],
    });
  }
  return blocks;
}

/** Resolve where to send a notification for `assignee` (team initials): their
 * linked Slack user (DM) if set, else the shared fallback channel, else null
 * (nothing configured — skip). */
async function resolveTarget(assigneeInitials: string): Promise<string | null> {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from("profiles")
      .select("slack_user_id")
      .eq("initials", assigneeInitials)
      .maybeSingle();
    const linked = (data as { slack_user_id?: string | null } | null)?.slack_user_id;
    if (linked) return linked;
  } catch (err) {
    console.error("[slack] profile lookup failed:", err);
  }
  return process.env.SLACK_FALLBACK_CHANNEL || null;
}

async function post(channel: string, text: string, blocks: SlackBlock[]): Promise<void> {
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel, text, blocks }),
    });
  } catch (err) {
    // Don't fail the user-facing action because Slack hiccupped.
    console.error("[slack] postMessage failed:", err);
  }
}

async function notify(assignee: string, turnId: string, text: string): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) return;
  const channel = await resolveTarget(assignee);
  if (!channel) return;
  await post(channel, text, turnBlocks(turnId, text));
}

type TaskAssignedPayload = { taskId: string; taskName: string; turnId: string; assignee: string };
export async function notifyTaskAssigned(payload: TaskAssignedPayload): Promise<void> {
  await notify(payload.assignee, payload.turnId, `:wrench: You were assigned task "${payload.taskName}"`);
}

type StageAssignedPayload = { turnId: string; unit: string; assignee: string };
export async function notifyStageAssigned(payload: StageAssignedPayload): Promise<void> {
  await notify(payload.assignee, payload.turnId, `:clipboard: You were assigned unit *${payload.unit}*`);
}

type HandoffPayload = { turnId: string; unit: string; assignee: string; stageIdx: number };
export async function notifyHandoff(payload: HandoffPayload): Promise<void> {
  const stageName = STAGES[payload.stageIdx]?.name ?? "the next phase";
  await notify(
    payload.assignee,
    payload.turnId,
    `:construction_worker: Unit *${payload.unit}* was handed off to you for *${stageName}*`,
  );
}

type OnHoldPayload = {
  turnId: string;
  unit: string;
  assignee: string;
  holdStatus: "on_hold" | "blocked";
  reason: string;
};
export async function notifyOnHold(payload: OnHoldPayload): Promise<void> {
  const label = payload.holdStatus === "blocked" ? "blocked" : "put on hold";
  await notify(payload.assignee, payload.turnId, `:pause_button: Unit *${payload.unit}* was ${label}: ${payload.reason}`);
}
