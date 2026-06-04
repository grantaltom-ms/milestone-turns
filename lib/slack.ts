// Slack DM dispatcher. No-op until SLACK_BOT_TOKEN is configured
// (Phase 2 — see README "Slack setup"). Designed so the call site never
// has to care whether Slack is wired up.

type TaskAssignedPayload = {
  taskId: string;
  taskName: string;
  turnId: string;
  assignee: string; // team initials
};

export async function notifyTaskAssigned(payload: TaskAssignedPayload): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return; // Slack not configured yet — nothing to do.

  // The app_users.slack_user_id map lands in Phase 2. For now we'd post to a
  // default channel if one is configured, but skip otherwise.
  const fallbackChannel = process.env.SLACK_FALLBACK_CHANNEL;
  if (!fallbackChannel) return;

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: fallbackChannel,
        text: `:wrench: *${payload.assignee}* was assigned task "${payload.taskName}"`,
      }),
    });
  } catch (err) {
    // Don't fail the user-facing action because Slack hiccupped.
    console.error("[slack] notifyTaskAssigned failed:", err);
  }
}
