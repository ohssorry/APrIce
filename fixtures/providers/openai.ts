// 탐지되어야 할 유료 API 호출: 1개
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createChatCompletion() {
  return openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: 'APrIce 픽스처 요청',
      },
    ],
  });
}
