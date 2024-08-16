import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function downloadFromS3(file_key: string) {
    try {
        const client = new S3Client({
            region: 'ap-southeast-2',
            credentials: {
                accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY_ID!,
                secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_ACCESS_KEY!,
            }
        });

        const command = new GetObjectCommand({
            Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME!,
            Key: file_key
        });

        const response = await client.send(command);
        
        if (response.Body) {
            const tmpDir = os.tmpdir();
            const file_name = path.join(tmpDir, `pdf-${Date.now()}.pdf`);
            const body = await response.Body.transformToByteArray();
            fs.writeFileSync(file_name, Buffer.from(body));
            return file_name;
        } else {
            throw new Error('Empty response body');
        }
    } catch (error) {
        console.error('Error downloading file from S3:', error);
        return null;
    }
}