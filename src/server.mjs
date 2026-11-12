// Study-coach chatbot server. Node built-ins only.
//   POST /api/chat     { message, userId } -> { reply }
//   GET  /api/profile?userId=...           -> { profile }
//   POST /api/profile  { userId, tone?, level?, goals? } -> { profile }
//   POST /api/reset    { userId }          -> { ok }
//   GET  /api/health                       -> { ok, mode }
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";
import { chat, mode } from "./coach.mjs";
import { getProfile, updateProfile, resetUser } from "./store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(path.join(root, ".env"));
const port = Number(process.env.PORT) || 3000;
const MAX_BODY = 64 * 1024;

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) { reject(new Error("요청 본문이 너무 큽니다.")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("JSON 형식이 아닙니다.")); }
    });
    req.on("error", reject);
  });
}

const userIdOf = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 64) : null);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(root, "public", "index.html")));
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, mode: mode() });
    }
    if (req.method === "GET" && url.pathname === "/api/profile") {
      const userId = userIdOf(url.searchParams.get("userId"));
      if (!userId) return send(res, 400, { error: "userId가 필요합니다." });
      return send(res, 200, { profile: getProfile(userId) });
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      const body = await readJson(req);
      const userId = userIdOf(body.userId);
      if (!userId) return send(res, 400, { error: "userId가 필요합니다." });

      if (url.pathname === "/api/chat") {
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message) return send(res, 400, { error: "message가 필요합니다." });
        try {
          return send(res, 200, { reply: await chat(userId, message) });
        } catch (err) {
          console.error("[chat]", err.message);
          return send(res, 502, { error: err.message });
        }
      }
      if (url.pathname === "/api/profile") {
        return send(res, 200, { profile: updateProfile(userId, body) });
      }
      if (url.pathname === "/api/reset") {
        resetUser(userId);
        return send(res, 200, { ok: true });
      }
    }
    send(res, 404, { error: "찾을 수 없습니다." });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
});

server.listen(port, () => {
  console.log("학습 코치 챗봇: http://localhost:" + port + " (답변 방식: " + mode() + ")");
});
