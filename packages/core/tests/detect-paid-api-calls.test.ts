import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { detectPaidApiCalls } from '../index.js';
import type { SupportedProvider } from '../index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const providerFixtures = [
  {
    file: 'openai.ts',
    product: 'gpt-4o-mini',
    provider: 'openai',
  },
  {
    file: 'anthropic.ts',
    product: 'claude-3-5-haiku-latest',
    provider: 'anthropic',
  },
  {
    file: 'google-maps.ts',
    product: 'geocode',
    provider: 'google-maps',
  },
  {
    file: 'twilio.ts',
    product: 'messages',
    provider: 'twilio',
  },
  {
    file: 'aws-s3.ts',
    product: 'put-object',
    provider: 'aws-s3',
  },
  {
    file: 'sendgrid.ts',
    product: 'mail',
    provider: 'sendgrid',
  },
] satisfies Array<{
  file: string;
  product: string;
  provider: SupportedProvider;
}>;

describe('detectPaidApiCalls', () => {
  it.each(providerFixtures)(
    '$provider fixture에서 유료 호출 1건을 탐지한다',
    ({ file, product, provider }) => {
      const fixturePath = `fixtures/providers/${file}`;
      const source = readFileSync(`${repoRoot}${fixturePath}`, 'utf8');
      const result = detectPaidApiCalls(source, fixturePath);

      expect(result.skipped).toEqual([]);
      expect(result.detections).toHaveLength(1);
      expect(result.detections[0]).toMatchObject({
        file: fixturePath,
        product,
        provider,
      });
      expect(result.detections[0]?.line).toBeGreaterThan(0);
      expect(result.detections[0]?.snippet).toMatch(/\(\{\.\.\.\}\)$/);
    },
  );

  it('일반 JavaScript 최상위 호출을 탐지한다', () => {
    const source = `
      import OpenAI from 'openai';
      const openai = new OpenAI();
      openai.chat.completions.create({ model: 'gpt-4o-mini' });
    `;

    const result = detectPaidApiCalls(source, 'src/top-level.js');

    expect(result.detections).toEqual([
      expect.objectContaining({
        provider: 'openai',
        product: 'gpt-4o-mini',
        line: 4,
      }),
    ]);
  });

  it('TypeScript 함수 내부 호출과 동적인 상품을 탐지한다', () => {
    const source = `
      import Anthropic from '@anthropic-ai/sdk';
      const anthropic = new Anthropic();

      function requestMessage(model: string) {
        return anthropic.messages.create({ model, max_tokens: 32 });
      }
    `;

    const result = detectPaidApiCalls(source, 'src/function.ts');

    expect(result.detections).toEqual([
      expect.objectContaining({
        provider: 'anthropic',
        product: null,
        line: 6,
      }),
    ]);
  });

  it('TSX async 함수의 await 호출을 탐지한다', () => {
    const source = `
      import twilioFactory from 'twilio';
      const sms = twilioFactory('account', 'token');

      export async function MessageButton() {
        await sms.messages.create({ body: 'fixture' });
        return <button>전송</button>;
      }
    `;

    const result = detectPaidApiCalls(source, 'src/message-button.tsx');

    expect(result.detections).toEqual([
      expect.objectContaining({
        provider: 'twilio',
        product: 'messages',
        line: 6,
      }),
    ]);
  });

  it('import와 client 별칭을 따라간다', () => {
    const source = `
      import OpenAIClient from 'openai';
      const ai = new OpenAIClient();
      ai['chat']['completions']['create']({ model: 'gpt-4o-mini' });
    `;

    const result = detectPaidApiCalls(source, 'src/alias.ts');

    expect(result.detections).toEqual([
      expect.objectContaining({
        provider: 'openai',
        snippet: 'ai.chat.completions.create({...})',
      }),
    ]);
  });

  it('지원 모듈 import가 없는 유사 호출과 설정 호출은 무시한다', () => {
    const source = `
      import sendgrid from '@sendgrid/mail';
      sendgrid.setApiKey('SG.fixture-secret');

      const openai = {
        chat: { completions: { create() {} } },
      };
      openai.chat.completions.create({ apiKey: 'sk-fixture-secret' });
    `;

    const result = detectPaidApiCalls(source, 'src/false-positive.ts');

    expect(result.detections).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('snippet에 전체 인자값이나 비밀값을 포함하지 않는다', () => {
    const source = `
      import sendgrid from '@sendgrid/mail';
      sendgrid.send({
        apiKey: 'SG.fixture-secret',
        to: 'private@example.com',
        text: '외부로 노출되면 안 되는 본문',
      });
    `;

    const result = detectPaidApiCalls(source, 'src/mail.ts');
    const snippet = result.detections[0]?.snippet;

    expect(snippet).toBe('sendgrid.send({...})');
    expect(snippet).not.toContain('SG.fixture-secret');
    expect(snippet).not.toContain('private@example.com');
    expect(snippet).not.toContain('외부로 노출되면 안 되는 본문');
  });

  it('문법 오류를 skipped로 격리한다', () => {
    const result = detectPaidApiCalls(
      'export function broken( {',
      'src/broken.ts',
    );

    expect(result).toEqual({
      detections: [],
      skipped: [
        {
          file: 'src/broken.ts',
          reason: 'parse_error',
        },
      ],
    });
  });
});
