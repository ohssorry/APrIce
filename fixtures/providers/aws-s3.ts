// 탐지되어야 할 유료 API 호출: 1개
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
});

export async function uploadReport() {
  return s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET ?? '',
      Key: 'reports/aprice-result.json',
      Body: JSON.stringify({ status: 'fixture' }),
      ContentType: 'application/json',
    }),
  );
}
