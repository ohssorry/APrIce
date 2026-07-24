import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(`${repoRoot}${relativePath}`, 'utf8'));
}

const schema = readJson('schemas/analysis-result.schema.json');
const sampleResult = readJson('fixtures/sample-result.json');
const minimalResult = readJson('fixtures/minimal-result.json');

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});
addFormats(ajv);

const validate = ajv.compile(schema);

function cloneResult(): Record<string, unknown> {
  return structuredClone(sampleResult) as Record<string, unknown>;
}

function expectSchemaValid(value: unknown): void {
  const isValid = validate(value);

  expect(validate.errors).toBeNull();
  expect(isValid).toBe(true);
}

describe('AnalysisResult JSON 스키마', () => {
  it('정상 fixture를 허용한다', () => {
    expectSchemaValid(sampleResult);
  });

  it('탐지 결과가 없는 최소 fixture를 허용한다', () => {
    expectSchemaValid(minimalResult);
  });

  it('필수 필드 누락과 정의되지 않은 필드를 거부한다', () => {
    const missingVersion = cloneResult();
    delete missingVersion.version;

    expect(validate(missingVersion)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'required',
          params: {
            missingProperty: 'version',
          },
        }),
      ]),
    );

    const additionalField = cloneResult();
    additionalField.secret = '노출되면 안 되는 값';

    expect(validate(additionalField)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'additionalProperties',
        }),
      ]),
    );
  });

  it.each([
    ['음수 월 예산', ['budget', 'monthlyUsd'], -1],
    ['지원하지 않는 verdict', ['summary', 'verdict'], 'unknown'],
    ['0부터 시작하는 줄 번호', ['detections', 0, 'line'], 0],
    ['절대 파일 경로', ['detections', 0, 'file'], 'C:\\secret\\key.ts'],
  ])('%s을 거부한다', (_name, path, invalidValue) => {
    const result = cloneResult();
    setNestedValue(result, path, invalidValue);

    expect(validate(result)).toBe(false);
  });

  it('비용을 계산하지 못한 탐지 결과에는 사유를 요구한다', () => {
    const result = cloneResult();
    setNestedValue(result, ['detections', 1, 'unsupportedReason'], null);

    expect(validate(result)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: '/detections/1/unsupportedReason',
        }),
      ]),
    );
  });

  it('비용을 계산한 탐지 결과에는 미지원 사유를 허용하지 않는다', () => {
    const result = cloneResult();
    setNestedValue(
      result,
      ['detections', 0, 'unsupportedReason'],
      '잘못된 사유',
    );

    expect(validate(result)).toBe(false);
  });

  it('fixture의 탐지 건수와 탐지 ID 불변 조건을 만족한다', () => {
    for (const fixture of [sampleResult, minimalResult]) {
      const result = fixture as {
        summary: { detectionCount: number };
        detections: Array<{ id: string }>;
      };
      const ids = result.detections.map(({ id }) => id);

      expect(result.summary.detectionCount).toBe(result.detections.length);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

function setNestedValue(
  target: Record<string, unknown>,
  path: Array<string | number>,
  value: unknown,
): void {
  let current: unknown = target;

  for (const segment of path.slice(0, -1)) {
    current = (current as Record<string | number, unknown>)[segment];
  }

  const finalSegment = path.at(-1);
  if (finalSegment === undefined) {
    throw new Error('수정할 경로가 비어 있습니다.');
  }

  (current as Record<string | number, unknown>)[finalSegment] = value;
}
