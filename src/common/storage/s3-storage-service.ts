import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class S3StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(configService: ConfigService) {
    this.region = configService.getOrThrow<string>('AWS_BUCKET_REGION');
    this.bucket = configService.getOrThrow<string>('AWS_BUCKET_NAME');
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: configService.getOrThrow<string>('AWS_PUBLIC_KEY'),
        secretAccessKey: configService.getOrThrow<string>('AWS_SECRET_KEY'),
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    const ext = extname(file.originalname).toLowerCase();
    const key = `${folder}/${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async uploadFiles(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<string[]> {
    return Promise.all(files.map((f) => this.uploadFile(f, folder)));
  }

  async deleteFileByUrl(url: string): Promise<void> {
    const key = url.split('.amazonaws.com/')[1];
    if (!key) return;
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
