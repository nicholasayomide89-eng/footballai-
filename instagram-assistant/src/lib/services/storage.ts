import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

let s3: S3Client | undefined;

function client(): S3Client {
  const e = env();
  s3 ??= new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    forcePathStyle: Boolean(e.S3_ENDPOINT),
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
  });
  return s3;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
  if (!res.Body) throw new Error(`Empty object: ${key}`);
  return res.Body.transformToByteArray();
}

/**
 * A short-lived public URL for Instagram to fetch the media from. The bucket
 * itself stays private.
 */
export function presignedGetUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}
