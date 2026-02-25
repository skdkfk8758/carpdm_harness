// src/hooks/event-logger.ts
import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
function main() {
  let input;
  try {
    const raw = readFileSync("/dev/stdin", "utf-8");
    input = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  const toolName = input.tool_name || "";
  if (!toolName.startsWith("harness_")) {
    process.stdout.write(JSON.stringify({ result: "continue" }));
    return;
  }
  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || "unknown";
  const eventsDir = join(cwd, ".harness", "events");
  try {
    mkdirSync(eventsDir, { recursive: true });
    const entry = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      tool: toolName,
      session: sessionId
    };
    appendFileSync(join(eventsDir, `${sessionId}.jsonl`), JSON.stringify(entry) + "\n");
  } catch {
  }
  process.stdout.write(JSON.stringify({ result: "continue" }));
}
main();
//# sourceMappingURL=event-logger.js.map