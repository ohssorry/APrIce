// 탐지되어야 할 유료 API 호출: 1개
import sendgrid from '@sendgrid/mail';

sendgrid.setApiKey(process.env.SENDGRID_API_KEY ?? '');

export async function sendReportEmail() {
  return sendgrid.send({
    from: process.env.SENDGRID_FROM_EMAIL ?? '',
    to: process.env.SENDGRID_TO_EMAIL ?? '',
    subject: 'APrIce 분석 결과',
    text: 'APrIce 픽스처 메시지',
  });
}
