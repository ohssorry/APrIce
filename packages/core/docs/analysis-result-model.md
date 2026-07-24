# `AnalysisResult` 데이터 모델 요구사항

> 관련 이슈: #1
> 상태: 가영 측 요구사항 초안
> 대상: 은지(`cli`·스키마), 예은(`report`·`comment`)

## 1. 목적

`AnalysisResult`는 `core`가 생성하고 CLI, HTML 리포트, PR 코멘트가 함께
소비하는 유일한 교차 패키지 계약이다. 이 문서는 분석 엔진이 제공해야 하는
필드의 타입, 필수 여부, 단위, 의미를 정리한다.

정본은 팀 합의 후 작성될 `schemas/analysis-result.schema.json`이다. 이 문서는
정본을 임의로 확정하지 않으며, 스키마 작성과 리포트 설계에 필요한 가영 측
요구사항을 제안한다.

## 2. 공통 원칙

- 모든 배열은 값이 없어도 빈 배열을 사용하고 `null`을 사용하지 않는다.
- 금액은 USD 기준 숫자로 전달하며 렌더러는 값을 보정하지 않는다.
- 파일 경로는 레포 루트 기준 상대 경로만 허용한다.
- 줄 번호는 1부터 시작한다.
- 알 수 없는 값은 빈 문자열이나 임의 기본값으로 숨기지 않는다.
- `estimatedMonthlyUsd`가 `null`이면 `unsupportedReason`에 이유를 남긴다.
- 소비자는 지원하지 않는 `version`을 추측해서 렌더링하지 않는다.

## 3. 최상위 구조

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `version` | `string` | O | 정수 문자열 | 결과 JSON 스키마 버전 |
| `generatedAt` | `string` | O | ISO 8601 UTC | 결과 생성 시각 |
| `repo` | `RepoContext` | O | - | 분석한 레포와 ref 정보 |
| `budget` | `Budget` | O | - | 사용자가 설정한 월 예산 |
| `traffic` | `Traffic` | O | - | 비용 추정에 사용한 트래픽 가정 |
| `summary` | `Summary` | O | - | 전체 비용과 예산 게이트 결론 |
| `detections` | `Detection[]` | O | 건 | 탐지된 유료 API call-site 목록 |
| `skipped` | `Skipped[]` | O | 건 | 분석하지 못한 파일 목록 |

## 4. `RepoContext`

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `name` | `string` | O | - | `owner/repo` 형식의 레포 이름 |
| `baseRef` | `string \| null` | O | git ref | diff 기준 ref. 전체 스캔은 `null` |
| `headRef` | `string \| null` | O | git ref | 분석 대상 ref. 로컬 실행에서는 `null` 가능 |

`core`는 git 정보를 직접 조회하지 않는다. 위 값은 호출자가 제공한 컨텍스트를
결과에 그대로 반영한다.

## 5. `Budget`

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `monthlyUsd` | `number` | O | USD/월 | 사용자가 설정한 월 예산 |
| `currency` | `"USD"` | O | ISO 4217 | v1 계산 기준 통화 |

KRW 병기 여부는 렌더링 정책에 관한 미결 사항이다. `core`의 계산 결과와
`AnalysisResult`의 금액 단위는 v1에서 USD로 유지한다.

## 6. `Traffic`

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `dau` | `number` | O | 사용자/일 | 일간 활성 사용자 수 가정 |
| `requestsPerUserPerDay` | `number` | O | 요청/사용자/일 | 사용자 한 명의 일간 요청 수 가정 |

두 값은 실측값이 아니라 `.aprice.yml`에서 받은 사용자 가정값이다. 리포트에서
추정 비용의 전제임을 표시할 수 있도록 결과에 포함한다.

## 7. `Summary`

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `totalMonthlyUsd` | `number` | O | USD/월 | 가격을 계산할 수 있는 탐지 결과의 월 예상 비용 합계 |
| `deltaMonthlyUsd` | `number \| null` | O | USD/월 | diff 모드에서 이번 변경으로 증가한 월 예상 비용 |
| `verdict` | `"pass" \| "warn" \| "fail"` | O | - | 월 예산 대비 예산 게이트 판정 |
| `detectionCount` | `number` | O | 건 | 탐지 결과 개수 |

### 불변 조건

- `detectionCount === detections.length`
- 전체 스캔 모드에서는 `deltaMonthlyUsd === null`
- `totalMonthlyUsd`에는 `estimatedMonthlyUsd === null`인 탐지 결과를 더하지 않는다.
- `core`는 `verdict`까지만 만들고 프로세스 exit code는 결정하지 않는다.
- 현재 계약상 `warn`은 예산의 80% 초과, `fail`은 100% 초과를 뜻한다.
- `warn`을 GitHub Action 실패로 처리할지는 이 모델이 아닌 제품 정책에서 결정한다.

## 8. `Detection`

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `id` | `string` | O | - | 한 결과 안에서 고유한 식별자이자 리포트 앵커 |
| `provider` | `string` | O | - | 가격 DB 파일명과 일치하는 소문자 provider 키 |
| `product` | `string \| null` | O | - | 모델 또는 상품 ID. 정적으로 판별할 수 없으면 `null` |
| `file` | `string` | O | 상대 경로 | call-site가 있는 파일 |
| `line` | `number` | O | 1-based 줄 번호 | call-site 시작 줄 |
| `snippet` | `string` | O | - | 비밀값을 제거한 호출부 축약 문자열 |
| `multiplier` | `number` | O | 배/요청 | 요청 한 번에 call-site가 실행될 것으로 추정한 횟수 |
| `multiplierReason` | `string` | O | - | multiplier의 근거를 설명하는 한글 문자열 |
| `estimatedCallsPerMonth` | `number` | O | 호출/월 | 트래픽과 multiplier를 반영한 월 예상 호출 수 |
| `estimatedMonthlyUsd` | `number \| null` | O | USD/월 | 해당 call-site의 월 예상 비용 |
| `unsupportedReason` | `string \| null` | O | - | 비용을 계산하지 못한 이유 |
| `confidence` | `"high" \| "medium" \| "low"` | O | - | 추정 결과의 신뢰도 등급 |
| `isNew` | `boolean` | O | - | diff 모드에서 이번 변경으로 추가된 호출인지 여부 |

### 불변 조건

- `id`는 한 `AnalysisResult` 안에서 중복되지 않는다.
- `file`은 절대 경로가 될 수 없다.
- `line`은 1 이상의 정수다.
- `snippet`은 API 키와 전체 인자값을 포함하지 않고 인자를 `{...}`로 축약한다.
- `multiplier`는 1 이상의 숫자다.
- `multiplier === 1`이면 `multiplierReason`은 `"단일 호출"`이다.
- `estimatedCallsPerMonth`는 0 이상의 숫자다.
- `estimatedMonthlyUsd === null`이면 `unsupportedReason`은 `null`이 아니다.
- `estimatedMonthlyUsd !== null`이면 `unsupportedReason === null`이다.
- 전체 스캔 모드에서는 `isNew === false`다.

`multiplier` 추정 규칙과 `confidence` 등급 판정 기준은 팀 미결 사항이다. 이
문서는 결과의 형태만 정의하며 판정 알고리즘을 확정하지 않는다.

## 9. `Skipped`

| 필드 | 타입 | 필수 | 단위 | 의미 |
|---|---|:---:|---|---|
| `file` | `string` | O | 상대 경로 | 분석하지 못한 파일 |
| `reason` | `string` | O | - | 분석을 건너뛴 기계 판독용 사유 코드 |

초기 사유 코드 후보는 `parse_error`, `unsupported_language`, `excluded`다.
파싱 실패는 전체 스캔을 중단시키지 않고 `skipped`에 기록한다.

## 10. 생성자와 소비자

| 데이터 | 생성 책임 | 소비 책임 |
|---|---|---|
| `repo` | CLI | 리포트·PR 코멘트 |
| `budget`, `traffic` | CLI가 설정을 로드하고 `core`가 결과에 반영 | `core`·리포트·PR 코멘트 |
| `detections`, `skipped` | `core` | CLI·리포트·PR 코멘트 |
| `summary`, `verdict` | `core` | CLI·Action·리포트·PR 코멘트 |
| exit code | CLI | 셸·GitHub Action |

## 11. 팀 검토가 필요한 쟁점

아래 항목은 이 문서에서 확정하지 않는다.

1. `AnalysisResult` 필드 구조와 필수 여부의 최종 승인
2. `.aprice.yml`의 `traffic` 기본값과 검증 범위
3. `multiplier` 추정 규칙
4. `confidence` 세 등급의 판정 기준
5. `warn`을 GitHub Action 실패로 처리할지 여부
6. USD만 표시할지 KRW를 함께 표시할지 여부
7. 지원 provider를 6종으로 유지할지 3종으로 축소할지 여부

### 기존 문서 간 확인 사항

- ROADMAP의 `sample-result.json` 예시에는 `unsupportedReason`이 없지만,
  AGENT의 상세 계약에서는 필수 필드다.
- 이 초안은 더 구체적인 AGENT 계약을 따라 `unsupportedReason`을 포함했다.
- IP-1에서 최종 스키마와 샘플 JSON에 이 필드를 함께 넣을지 세 명이 확인해야 한다.

## 12. 스키마 반영 체크리스트

- [ ] 이 문서의 필드가 `schemas/analysis-result.schema.json`에 반영되었다.
- [ ] `fixtures/sample-result.json`이 스키마 검증을 통과한다.
- [ ] `unsupportedReason`의 조건부 필수 규칙이 검증된다.
- [ ] `detectionCount`와 `detections.length`의 일치 여부를 코드에서 검증한다.
- [ ] 세 명이 필드 구조와 표시 요구사항을 승인했다.
