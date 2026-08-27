# 시연 영상 대본

목표 길이: 3~4분, 5장면 구성. 아래 명령은 전부 실제로 실행해서 출력을 확인
했습니다 (2026-08-27, `main` 기준).

## 녹화 전 준비물

- [ ] 저장소를 **새로 clone**해서 녹화 (README를 처음 보는 사람과 같은 상태로
      시작해야 "설치·실행이 정말 된다"는 걸 그대로 보여줄 수 있습니다)
      ```console
      git clone https://github.com/ohssorry/APrIce.git
      cd APrIce
      pip install -e ".[dev]"
      ```
- [ ] 터미널 폰트 크기 18pt 이상, `clear`로 화면 비우고 시작
- [ ] 아래 "사전 준비 파일" 만들어 두기 (장면 2, 3용)
- [ ] 화면 녹화: macOS 기본 QuickTime Player (`Cmd+Shift+5`)
- [ ] 리허설 1회 후 실제 소요 시간 기록

## 사전 준비 파일

**장면 2용** — `demo/comment_trick.py` (AST 증명):

```python
import anthropic

client = anthropic.Anthropic()

# client.messages.create(model="claude-opus-5", max_tokens=4096, messages=[])
example_log_line = "client.messages.create(model='claude-opus-5', max_tokens=4096)"


def summarize(document):
    return client.messages.create(
        model="claude-sonnet-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": document}],
    )
```

진짜 호출 1개, 주석 속 가짜 호출 1개, 문자열 속 가짜 호출 1개. `aprice scan`은
진짜 호출 1개만 찾아야 합니다 (실행해서 확인 완료).

**장면 3용** — 로컬 전용 커밋 (절대 push하지 않음). `tests/fixtures/sample_app.py`
맨 끝에 아래 함수를 추가하고 커밋:

```python
def batch_translate(docs):
    for doc in docs:
        client.messages.create(
            model="claude-opus-5",
            max_tokens=2048,
            messages=[{"role": "user", "content": doc}],
        )
```

```console
git add tests/fixtures/sample_app.py
git commit -m "demo: 임시 커밋, push 금지"
```

이렇게 하면 `aprice diff`가 "변화 없음" 대신 실제 비용 증가와 차단 위험을
보여줍니다 (아래 장면 3 출력 참고). **녹화 후 `git reset --hard origin/main`으로
되돌리고 실제로 push하지 마세요.**

## 장면별 대본

| # | 장면 | 화면 | 대사 (요약) | 길이 |
|---|---|---|---|---|
| 1 | 문제 제시 | 에디터에 코드 스니펫 | "API 호출 비용, 코드만 봐서는 감이 안 옵니다." `for user in users: client.messages.create(...)` 같은 코드를 보여주며: "이게 배포되면 얼마 나갈지, 리뷰 시점에 미리 알 수 있을까요?" | 30초 |
| 2 | `aprice scan` + AST 증명 | 터미널, 장면 2 명령 두 개 | "이 저장소의 샘플 파일을 스캔해보겠습니다." → 비용 범위와 `call-in-loop` 경고를 짚으며: "몇 번 실행되는지는 정적 분석으로 알 수 없으니, 아는 것만 정직하게 보여줍니다." → `comment_trick.py`로 전환: "주석과 문자열에도 같은 글자가 있지만, AST로 읽기 때문에 진짜 호출 1개만 잡습니다." | 70초 |
| 3 | `aprice diff` + Guard | 터미널 → 브라우저(GitHub PR) | "PR을 만들면 비용이 어떻게 바뀌는지 바로 보여줍니다." → diff 출력에서 비용 증가와 "new blocking risk"를 짚음 → 브라우저로 전환, 실제 PR의 APrIce Guard 코멘트를 보여주며: "이 저장소 자체의 PR에서, GitHub Actions로 자동으로 달리는 코멘트입니다." | 60초 |
| 4 | `aprice-advisor` (선택) | 터미널 | "정적 분석이 못 보는 실행 시점 낭비는, 실제 로그로 봅니다." → retry·cache-miss 권고를 짚음 | 35초 |
| 5 | 마무리 | 에디터(YAML) 또는 슬라이드 | "가격표는 코드가 아니라 YAML이라, Python을 몰라도 기여할 수 있습니다." 탐지·가격·출력을 세 명이 나눠 맡은 구조도 짧게 언급 | 20초 |

## 장면 2 명령

```console
aprice scan tests/fixtures/sample_app.py
```

실제 출력:

```text
APrIce: 5 API call(s) found

Cost per request
  tests/fixtures/sample_app.py:27  claude-opus-5            $0.03572 - $0.10740
  tests/fixtures/sample_app.py:15  claude-sonnet-5          $0.00761 - $0.01836
  tests/fixtures/sample_app.py:40  gpt-4o                   $0.00327 - $0.00506
  tests/fixtures/sample_app.py:58  gpt-4o-mini              $0.00033 - $0.00076

  Total per request: $0.04693 - $0.13158

Unpriced (model name is not a literal, or not in the price DB)
  tests/fixtures/sample_app.py:49  anthropic/<dynamic>

Findings
  ! tests/fixtures/sample_app.py:27  [call-in-loop] API call inside a loop: cost scales with the number of iterations, which this tool cannot see.
  ! tests/fixtures/sample_app.py:40  [call-in-nested-loop] API call nested 2 loops deep: cost scales multiplicatively.
  - tests/fixtures/sample_app.py:49  [model-not-literal] Model name is not a literal, so this call cannot be priced.
  - tests/fixtures/sample_app.py:58  [no-max-tokens] No literal max_tokens: the output cost has no visible ceiling.
```

바로 이어서:

```console
aprice scan demo/comment_trick.py
```

```text
APrIce: 1 API call(s) found

Cost per request
  demo/comment_trick.py:10  claude-sonnet-5          $0.00761 - $0.01836

  Total per request: $0.00761 - $0.01836
```

> **주의**: `src/`를 스캔하면 안 됩니다 — APrIce 자신의 소스코드는 API를
> 호출하지 않으므로 `"APrIce: no paid API calls found."`만 뜹니다. 반드시
> `tests/fixtures/sample_app.py`처럼 실제 호출이 있는 파일을 스캔하세요.

## 장면 3 명령

"사전 준비 파일"의 임시 커밋을 만든 뒤:

```console
aprice diff --base origin/main --head HEAD
```

실제 출력:

```text
APrIce: cost delta origin/main -> HEAD

  + tests/fixtures/sample_app.py:67  anthropic/claude-opus-5            low +$0.02036  high +$0.05620  [added]

  Net change per request: low +$0.02036  high +$0.05620

  ! 1 new blocking risk(s):
    [new-loop-call] tests/fixtures/sample_app.py:67  New API call added inside a loop (depth 1).
```

`--fail-on-risk`를 붙이면 종료 코드가 `1`이 되는 것도 보여줄 수 있습니다
(터미널에서 `echo $?`).

**주의**: `--base origin/develop`은 더 이상 쓸 수 없습니다 — `develop` 브랜치는
삭제됐고 `main`이 유일한 통합 브랜치입니다 (`AGENTS.md`도 갱신됨).

**GitHub 화면 전환**: 기존 merged PR들의 Guard 코멘트는 대부분
"No API call changes detected"라 화면상 임팩트가 적습니다. 더 극적인 장면을
원하면 녹화 직전에 위와 같은 변경으로 실제 `main` 대상 데모 PR을 하나 열어서
Guard가 실시간으로 코멘트 다는 걸 보여주고, 녹화 후 머지하지 말고 닫으세요.

## 장면 4 명령

```console
cd advisor
pip install -e ".[dev]"
aprice-advisor analyze events.jsonl
```

`events.jsonl` 예시 (retry 1건 + cache miss 1건 포함):

```json
{"schema_version": 1, "timestamp": "2026-08-27T12:00:00Z", "project_id": "proj-a", "provider": "anthropic", "model": "claude-sonnet-5", "operation": "messages.create", "request_id": "req-1", "input_tokens": 100, "output_tokens": 50, "status": "success"}
{"schema_version": 1, "timestamp": "2026-08-27T12:00:01Z", "project_id": "proj-a", "provider": "anthropic", "model": "claude-sonnet-5", "operation": "messages.create", "request_id": "req-2", "retry_of": "req-1", "input_tokens": 100, "output_tokens": 50, "status": "error"}
{"schema_version": 1, "timestamp": "2026-08-27T12:00:02Z", "project_id": "proj-a", "provider": "anthropic", "model": "claude-sonnet-5", "operation": "messages.create", "request_id": "req-3", "input_tokens": 100, "output_tokens": 50, "status": "success", "cache_eligible": true, "cache_status": "miss"}
```

실제 출력:

```text
## APrIce Advisor report: `events.jsonl`

<sub>Standard-price cost applies the verified price table to actual logged tokens -- it is not an invoice amount. Real billing may include caching, batch, or committed-use discounts this table doesn't model. Duplicate detection uses a 300-second observation window.</sub>

**Total usage:** 3 request(s), standard cost $0.00315 (0 unpriced request(s) excluded).

### Recommendations (2)
- **[cache-miss]** (no location) -- Review provider cache configuration for this call.
- **[retry]** (no location) -- Review retry policy and maximum attempts for this call.
```

## 녹화 후 정리

```console
git reset --hard origin/main   # 장면 3의 임시 커밋 제거 (push한 적 없어야 함)
rm -rf demo/                    # 데모용 파일 제거 (선택)
```

## 리허설 기록

- [ ] 1회 리허설 완료, 실제 소요 시간: ___분 ___초
- [ ] 장면 3에 쓸 실제/데모 PR 링크 확정: ___________________
