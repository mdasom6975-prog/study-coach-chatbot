// In-memory per-user state: profile (tone, level, goals) and chat history.
// Everything is keyed by userId, and each user gets their own objects.
export const TONES = ["반말", "존댓말"];
export const LEVELS = ["초급", "중급", "고급"];

const users = new Map();

function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, { profile: { tone: "반말", level: "초급", goals: [] }, history: [] });
  }
  return users.get(userId);
}

export function getProfile(userId) {
  return getUser(userId).profile;
}

// Accepts a partial profile. Unknown tone/level values are ignored.
export function updateProfile(userId, patch = {}) {
  const profile = getProfile(userId);
  if (TONES.includes(patch.tone)) profile.tone = patch.tone;
  if (LEVELS.includes(patch.level)) profile.level = patch.level;
  if (Array.isArray(patch.goals)) {
    profile.goals = patch.goals.map((g) => String(g).trim()).filter(Boolean).slice(0, 10);
  }
  return profile;
}

export function getHistory(userId) {
  return getUser(userId).history;
}

export function addTurn(userId, role, content) {
  getUser(userId).history.push({ role, content });
}

export function resetUser(userId) {
  users.delete(userId);
}
