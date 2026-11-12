// PostToolUse hook. Records which tool ran on which target, so a run can be reviewed afterwards.
// It never blocks: PostToolUse runs after the tool, so it cannot undo the action.
import { appendLog, projectRoot, readStdinJson } from "./lib.mjs";

const input = readStdinJson();
const ti = input.tool_input || {};
appendLog(projectRoot(input), "tool-log.jsonl", {
  session: input.session_id,
  tool: input.tool_name,
  target: ti.file_path || ti.notebook_path || String(ti.command || ti.pattern || "").slice(0, 160),
});
process.exit(0);
