import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { extname } from 'path';
import { randomUUID } from 'crypto';

import { IStorageService } from '../../domain/ports/storage.service.port';

/**
 * ADAPTER — S3StorageAdapter
 *
 * Implementación concreta del port IStorageService usando AWS S3.
 * Si mañana migrás a Google Cloud Storage o Cloudinary, solo se
 * reemplaza esta clase — el resto de la app no cambia.
 *
 * Clave S3: `{folder}/{uuid}{ext}` → ej: `products/abc-123.jpg`
 * URL pública: `https://{bucket}.s3.{region}.amazonaws.com/{key}`
 */
@Injectable()
export class S3StorageAdapter implements IStorageService {
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

  async uploadFiles(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<string[]> {
    return Promise.all(files.map((f) => this.uploadOne(f, folder)));
  }

  async deleteFileByUrl(url: string): Promise<void> {
    const key = url.split('.amazonaws.com/')[1];
    if (!key) return;
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private async uploadOne(
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
}
