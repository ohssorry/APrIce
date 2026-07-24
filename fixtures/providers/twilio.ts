// 탐지되어야 할 유료 API 호출: 1개
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export async function sendTextMessage() {
  return twilioClient.messages.create({
    from: process.env.TWILIO_FROM_NUMBER ?? '',
    to: process.env.TWILIO_TO_NUMBER ?? '',
    body: 'APrIce 픽스처 메시지',
  });
}
