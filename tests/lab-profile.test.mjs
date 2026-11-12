// Practice test for lab/profile.mjs. It fails until the bug in the implementation is fixed.
import test from "node:test";
import assert from "node:assert/strict";
import { getProfile, updatePreference, buildSystemPrompt, resetProfiles } from "../lab/profile.mjs";

test.beforeEach(() => resetProfiles());

test("새 사용자는 기본 프로필로 시작한다", () => {
  assert.deepEqual(getProfile("u-a"), { tone: "반말", level: "초급", goals: [] });
});

test("A의 말투 변경이 B에게 섞이지 않는다", () => {
  updatePreference("u-a", "tone", "존댓말");
  assert.equal(getProfile("u-b").tone, "반말");
});

test("A의 학습 목표가 B에게 섞이지 않는다", () => {
  updatePreference("u-a", "goals", "SQL 기초");
  assert.deepEqual(getProfile("u-b").goals, []);
});

test("바꾼 선호가 다음 시스템 프롬프트에 반영된다", () => {
  updatePreference("u-a", "level", "중급");
  assert.match(buildSystemPrompt("u-a"), /수준: 중급/);
});
