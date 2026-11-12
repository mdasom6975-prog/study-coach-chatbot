// Practice target: user profile memory for a personal study-coach chatbot.
// It has a planted bug. The fix belongs here, not in the test.
const DEFAULT_PROFILE = { tone: "반말", level: "초급", goals: [] };
const profiles = new Map();

export function getProfile(userId) {
  if (!profiles.has(userId)) profiles.set(userId, DEFAULT_PROFILE);
  return profiles.get(userId);
}

export function updatePreference(userId, key, value) {
  const profile = getProfile(userId);
  if (key === "goals") profile.goals.push(value);
  else profile[key] = value;
  return profile;
}

export function buildSystemPrompt(userId) {
  const p = getProfile(userId);
  return ["말투: " + p.tone, "수준: " + p.level, "목표: " + (p.goals.join(", ") || "없음")].join("\n");
}

export function resetProfiles() {
  profiles.clear();
}
