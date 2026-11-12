# 학습 코치 챗봇

사용자마다 말투·수준·학습 목표를 기억하고, 그에 맞춰 학습 계획과 과정을 추천하는 개인 맞춤형 챗봇입니다.
하네스 엔지니어링 특강 실습용으로 만들었고, 외부 패키지 없이 Node 내장 모듈만 사용합니다.

## 빠른 시작

필요한 것: Node 18 이상, Git

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다. 포트는 `PORT` 환경 변수로 바꿀 수 있습니다.

### 답변 방식

| 모드 | 조건 | 동작 |
|---|---|---|
| Claude | `.env`에 `ANTHROPIC_API_KEY`가 있음 | Claude API로 답변합니다. 대화 기록과 프로필, 과정 데이터를 반영합니다. |
| 목업 | 키가 없음 | 키워드 규칙으로 정해진 문장을 답합니다. 서버와 평가 스크립트를 키 없이 돌려 볼 때만 씁니다. |

Claude 모드를 쓰려면 `.env.example`을 `.env`로 복사하고 키를 채운 뒤 서버를 다시 시작합니다.
`.env`는 `.gitignore`에 들어 있어 Git에 올라가지 않습니다.

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 없음 | 비어 있으면 목업 모드 |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | 사용할 모델 |
| `PORT` | `3000` | 서버 포트 |

## API

모든 요청과 응답은 JSON입니다. `userId`는 비어 있지 않은 문자열이며(64자를 넘으면 잘립니다), 사용자마다 프로필과 대화 기록이 따로 저장됩니다.

| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| POST | `/api/chat` | `{ "userId", "message" }` | `{ "reply" }` |
| GET | `/api/profile?userId=...` | | `{ "profile" }` |
| POST | `/api/profile` | `{ "userId", "tone"?, "level"?, "goals"? }` | `{ "profile" }` |
| POST | `/api/reset` | `{ "userId" }` | `{ "ok": true }` |
| GET | `/api/health` | | `{ "ok": true, "mode": "claude" \| "mock" }` |

프로필 값은 `tone`이 `반말`/`존댓말`, `level`이 `초급`/`중급`/`고급`, `goals`가 문자열 배열(최대 10개)입니다.
허용 범위 밖의 `tone`, `level`은 무시됩니다.

```bash
curl -X POST localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"userId":"u-a","message":"오늘 공부할 내용을 30분 분량으로 추천해 줘"}'
```

## 구조

```
src/
  server.mjs     HTTP 서버와 API 경로
  coach.mjs      시스템 프롬프트, Claude 호출, 목업 답변
  store.mjs      사용자별 프로필과 대화 기록 (메모리)
  env.mjs        .env 읽기
public/
  index.html     채팅 화면
data/
  courses.json   추천 가능한 과정 12개 (예시 데이터)
```

- 서버를 다시 시작하면 프로필과 대화 기록이 사라집니다. 저장은 메모리에만 합니다.
- `data/courses.json`은 실습용 가상 데이터입니다. 챗봇은 이 목록 안의 과정만 추천하도록 지시받으므로, 실제 과정 정보가 있으면 이 파일만 바꾸면 됩니다.
- 대화 기록에는 답변 텍스트만 저장합니다. Claude의 `thinking` 블록은 만들어질 때의 시스템 프롬프트에 묶이는데, 프로필을 저장하면 프롬프트가 바뀌어 다음 요청이 400으로 거부되기 때문입니다.

## 하네스 실습 파일

특강 스타터 키트의 실습 파일이 함께 들어 있습니다. 챗봇 자체와는 별개입니다.

| 경로 | 하는 일 |
|---|---|
| `CLAUDE.md` | 프로젝트 규칙. `tests/` 수정 금지, 실패는 `/fix-with-evidence`로 고치기 |
| `harness.config.json` | 보호 경로, 검증 명령, 반복 상한, 평가 설정 |
| `.claude/skills/fix-with-evidence/` | 재현 → 수정 → 재검증 → 보고 순서를 고정하는 Skill |
| `.claude/hooks/` | `protect-paths`(보호 경로 수정 차단), `verify-on-stop`(끝내기 전 검증), `log-tools`(도구 사용 기록) |
| `.claude/settings.json` | Hook 연결과 `.env` 읽기 거부 |
| `.claude/agents/reviewer.md` | 읽기 전용 리뷰어 Subagent |
| `lab/profile.mjs`, `tests/` | 실습 대상 코드와 테스트. 작업 이력에서 미끼 버그는 이미 고쳐 둔 상태 |
| `scripts/ralph.mjs`, `ralph/` | 최대 3회 반복하는 수정 루프. 완료 판단은 검증 명령이 함 |
| `scripts/run-evals.mjs`, `evals/` | 챗봇 회귀 평가 10건과 직전 결과 비교 |

### 명령

```bash
npm test                                                    # 검증: node --test
node scripts/ralph.mjs --dry-run                            # 에이전트 없이 검증과 기록만 실행
node scripts/ralph.mjs --max 3                              # claude -p를 최대 3회 실행
node scripts/run-evals.mjs --saved evals/sample-responses.jsonl   # 서버 없이 저장된 응답만 판정
node scripts/run-evals.mjs                                  # 실행 중인 챗봇(localhost:3000)을 실제로 호출
```

Ralph 루프의 종료 코드는 0 success, 3 needs_human, 4 limit_reached, 5 check_error입니다.
평가 결과와 Hook 기록은 `.harness/`에 쌓이며 Git에서 제외됩니다.

### 알려진 한계

- `protect-paths`는 Bash 명령을 문자열로만 검사합니다. `node -e`처럼 스크립트로 파일을 쓰면 막지 못하므로 `git diff` 리뷰와 CI를 함께 둡니다.
- Stop Hook은 사용자가 중단하거나 API 오류가 나면 실행되지 않을 수 있습니다. 같은 검증 명령을 CI에서도 실행합니다.
- 평가의 정규식 검사는 형식과 금지 표현만 확인합니다. 답변의 의미는 사람이나 별도 평가 모델이 봐야 합니다.
- 검증 명령은 PDF 원문의 `node --test tests/` 대신 `node --test`를 씁니다. Node 22 이상에서는 폴더 경로를 주면 테스트를 찾지 못하기 때문입니다.
