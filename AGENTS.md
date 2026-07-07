<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Definition of Done

Every request follows this loop. Do not claim a change is done until it has been **verified against the running app**, not just the compiler.

1. **Restate the request as a checklist.** Before writing code, echo the request back as a numbered list of the discrete, verifiable changes it implies — including implicit ones (e.g. "less overwhelming" → collapsed-by-default). Surface this so the user can catch a misread before any code is written. For multi-item requests, track the checklist with the todo tools so nothing silently drops.

2. **Implement** the changes.

3. **Verify each checklist item behaviorally — not with `npm run build` alone.** A green build proves the code *compiles*, never that the change is *present or correct*. For each item, confirm the actual behavior:
   - **UI changes:** load the affected screen and drive the interaction. This sandbox cannot reach Supabase (egress is blocked), so the app will not render real data locally — verify against the **Vercel preview deployment** for the PR instead. Chromium + Playwright are preinstalled (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`); drive the preview URL and screenshot the specific change. At minimum, open the preview and confirm the change is visibly there.
   - **Database/RPC changes:** query Supabase (MCP `execute_sql`) to confirm the state actually changed.
   - **Server/logic changes:** exercise the code path and observe the result.

4. **Report per item, honestly.** For each checklist item, state ✅ done (with the evidence — a preview screenshot, a query result) or ⚠️ not verified (with the reason). Never a blanket "all done" that papers over an item you did not actually check. If something could not be verified, say so plainly rather than implying success.

The failure this prevents: shipping a change that compiles but was never actually wired into the UI, and reporting it as complete. "It builds" is not "it works."
