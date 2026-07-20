import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    // Generate unique key to prevent overwriting
    const uniqueKey = `room-uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueKey,
      ContentType: contentType,
    });

    // Generate a presigned URL that expires in 1 hour
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Construct the public URL that the client will use after upload
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${uniqueKey}`;

    return NextResponse.json({ presignedUrl, publicUrl });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { DeleteObjectCommand } from '@aws-sdk/client-s3';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('fileUrl');

    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing fileUrl' }, { status: 400 });
    }

    // Extract the key from the URL.
    // Example URL: https://streaus-video-proxy.rizalmahardi109.workers.dev/room-uploads/1704...mp4
    const urlParts = fileUrl.split('/');
    const keyIndex = urlParts.findIndex(part => part === 'room-uploads');
    
    if (keyIndex === -1) {
      return NextResponse.json({ error: 'Invalid fileUrl, room-uploads key not found' }, { status: 400 });
    }
    
    // Join all parts after and including 'room-uploads' to support subdirectories if any
    const objectKey = urlParts.slice(keyIndex).join('/');

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, deletedKey: objectKey });
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
