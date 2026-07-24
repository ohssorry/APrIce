// 탐지되어야 할 유료 API 호출: 1개
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function createMessage() {
  return anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: 'APrIce 픽스처 요청',
      },
    ],
  });
}
