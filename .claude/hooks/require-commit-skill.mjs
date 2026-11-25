// PreToolUse hook. git commit 전에 write-commit-message 스킬을 읽었는지 확인한다.
// 대화 기록(transcript)에 스킬 호출이 없으면 차단(exit 2)한다.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const cmd = String(input.tool_input?.command || "");
if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

let transcript = "";
try { transcript = readFileSync(input.transcript_path, "utf8"); } catch {}

// 스킬 호출 흔적: {"skill":"write-commit-message"}
if (/"skill"\s*:\s*"write-commit-message"/.test(transcript)) process.exit(0);

process.stderr.write(
  "[require-commit-skill] 커밋 전에 Skill 도구로 write-commit-message 스킬을 먼저 읽으세요.\n" +
  "스킬의 규칙(feat(beta): 한국어 메시지)대로 메시지를 작성한 뒤 다시 커밋하세요.\n"
);
process.exit(2);
