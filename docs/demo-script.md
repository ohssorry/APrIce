# 시연 영상 대본

목표 길이: 3~4분. 아래 표의 각 장면을 순서대로 녹화합니다. 이 문서의 명령은
전부 실제로 실행해서 출력을 확인했습니다 (2026-08-27, `main` 기준).

## 녹화 전 준비물

- [ ] 저장소를 **새로 clone**해서 녹화 — 지금 개발 중인 작업 디렉터리 말고,
      README를 처음 보는 사람과 같은 상태로 시작해야 "설치·실행이 정말
      된다"는 걸 그대로 보여줄 수 있습니다.
      ```console
      git clone https://github.com/ohssorry/APrIce.git
      cd APrIce
      pip install -e ".[dev]"
      ```
- [ ] 터미널 폰트 크기를 18pt 이상으로 키우기
- [ ] 터미널을 `clear`로 비우고 시작
- [ ] 아래 "사전 준비 파일" 두 개를 미리 만들어 두기 (장면 3, 6용)
- [ ] 화면 녹화: macOS 기본 QuickTime Player (`Cmd+Shift+5`) 또는 화면 전체 녹화
- [ ] 리허설 1회 후 실제 소요 시간 기록 — 아래 표는 목표치이며 실제 말하는
      속도에 맞춰 조정

## 사전 준비 파일

**장면 3용** — `demo/comment_trick.py`:

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

이 파일은 진짜 호출 1개, 주석 속 가짜 호출 1개, 문자열 속 가짜 호출 1개를
담고 있습니다. `aprice scan`은 진짜 호출 1개만 찾아야 합니다 (실행해서 확인
완료).

**장면 6용** — 별도 파일 불필요, `src/aprice/prices/anthropic.yaml`을 그
자리에서 직접 수정합니다. 녹화 후에는 반드시 `git checkout -- src/aprice/prices/anthropic.yaml`로
되돌리세요 (실제 가격 DB이므로 데모용 가짜 항목을 커밋하면 안 됩니다).

## 장면별 대본

| # | 장면 | 화면 | 대사 (요약) | 길이 |
|---|---|---|---|---|
| 1 | 문제 제기 | `tests/fixtures/sample_app.py`의 `summarize_all` 함수를 에디터로 보여줌 (루프 안에서 `client.messages.create` 호출) | "이 코드, 리뷰할 때 비용 문제가 보이시나요? 루프 안에 API 호출이 있습니다. documents가 10개면 괜찮지만, 1,000개면 그대로 1,000배입니다." | 20초 |
| 2 | `aprice scan` 실행 | 터미널에서 아래 명령 실행 | "이 파일 하나를 스캔해보겠습니다." → 출력이 뜨면 `call-in-loop` 경고와 비용 범위를 손가락/커서로 짚으며: "요청당 비용은 범위로, 그리고 루프 안에 있다는 경고까지 같이 나옵니다." | 40초 |
| 3 | 왜 정규식이 아닌가 | `demo/comment_trick.py`를 보여준 뒤 스캔 | "주석과 문자열 안에도 `client.messages.create`라는 글자가 있죠. 정규식이었다면 셋 다 잡혔을 겁니다. APrIce는 AST로 문법 구조를 읽어서, 진짜 호출 1개만 찾습니다." | 30초 |
| 4 | PR 코멘트 (Guard) | 브라우저로 실제 GitHub PR 화면 전환 (아래 "장면 4 준비" 참고) | "이 저장소 자체의 PR에서도 똑같이 씁니다. PR을 열면 APrIce Guard가 자동으로 비용 변화를 코멘트로 남기고, 새로운 구조적 위험이 있을 때만 CI를 막습니다." | 60초 |
| 5 | 정직성 | 터미널에 `docs/methodology.md`의 비용 방정식 부분을 `cat` 또는 에디터로 보여줌 | "여기 방정식에서 `calls`, 즉 호출 횟수만 빨간색입니다. 소스코드만 봐서는 이 줄이 하루에 열 번 실행되는지 천만 번 실행되는지 알 수 없어요. 그래서 저희는 월 비용을 예측하지 않습니다. 못 하는 게 아니라, 안 하기로 한 겁니다." | 30초 |
| 6 | 오픈소스 기여 | 터미널에서 YAML 수정 전/후 스캔 비교 (아래 "장면 6 명령" 참고) | "가격표는 코드가 아니라 YAML입니다. Python을 몰라도 새 모델 하나, 이렇게 네 줄만 추가하면 바로 인식됩니다." | 30초 |

## 장면 2 명령

```console
aprice scan tests/fixtures/sample_app.py
```

실제 출력 (2026-08-27 확인):

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

`call-in-loop` 줄과 `Total per request` 범위를 강조하세요.

## 장면 3 명령

```console
aprice scan demo/comment_trick.py
```

실제 출력 (2026-08-27 확인) — 호출 1건만 잡힙니다:

```text
APrIce: 1 API call(s) found

Cost per request
  demo/comment_trick.py:10  claude-sonnet-5          $0.00761 - $0.01836

  Total per request: $0.00761 - $0.01836
```

## 장면 4 준비

로컬에서 실행할 게 아니라 **실제 GitHub PR 화면을 녹화**합니다.

기존 PR들(#56, #58, #59, #60 등)의 Guard 코멘트를 확인해봤는데, 전부
"No API call changes detected"만 나옵니다 — 그 PR들이 건드린 코드가
`advisor/` 쪽이거나 `src/aprice/`의 호출 패턴을 바꾸지 않아서입니다.
화면상 임팩트가 없으므로 **이 장면은 그대로 재사용하지 말고, 녹화 직전에
작은 데모 PR을 새로 하나 열 것을 권장**합니다.

1. `src/aprice/`에 `call-in-loop`를 발생시키는 작은 변경(또는
   `tests/fixtures/sample_app.py`에 새 호출 하나 추가)으로 브랜치를 만들고
   `main` 대상 PR을 엽니다.
2. Guard가 몇 초 안에 코멘트를 답니다 — 비용 변화(`+$...`)와
   "new blocking risk" 표시가 실제로 뜨는 걸 화면에 그대로 녹화합니다.
3. 녹화가 끝나면 이 데모 PR은 머지하지 말고 닫아주세요.

팀과 상의 없이 진행하기 부담스러우면, 대안으로 기존 PR의 "No API call
changes detected" 코멘트를 보여주면서 "코드에 실제 변화가 없으면 이렇게
조용히 통과한다"는 걸로 대사를 바꿔도 됩니다 — 덜 극적이지만 거짓은
아닙니다.

## 장면 6 명령

```console
# 1. 아직 없는 모델이라 Unpriced로 나오는 것부터 보여주기
aprice scan demo/new_model_call.py
```

`demo/new_model_call.py`는 `model="claude-haiku-6"`로 호출하는 짧은 파일로
미리 준비해 둡니다 (장면 3 파일과 같은 방식). 첫 실행 결과:

```text
APrIce: 1 API call(s) found

Unpriced (model name is not a literal, or not in the price DB)
  demo/new_model_call.py:7  anthropic/claude-haiku-6
```

그다음 `src/aprice/prices/anthropic.yaml` 맨 끝에 아래 네 줄을 추가:

```yaml
  - id: claude-haiku-6
    input_per_mtok: 1.00
    output_per_mtok: 5.00
    verified_on: 2026-08-27
```

다시 스캔하면 바로 가격이 잡힙니다:

```text
APrIce: 1 API call(s) found

Cost per request
  demo/new_model_call.py:7  claude-haiku-6           $0.00254 - $0.00612

  Total per request: $0.00254 - $0.00612
```

**녹화 후 필수**: `git checkout -- src/aprice/prices/anthropic.yaml`로 가짜
항목을 되돌리세요. 실제 가격 DB에 검증되지 않은 데모용 가격이 남으면 안
됩니다.

## 리허설 기록

- [ ] 1회 리허설 완료, 실제 소요 시간: ___분 ___초
- [ ] 장면 4에 쓸 실제 PR 링크 확정: ___________________
