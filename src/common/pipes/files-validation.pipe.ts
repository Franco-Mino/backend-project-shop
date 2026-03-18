import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png'];

@Injectable()
export class FilesValidationPipe implements PipeTransform {
  transform(files: Express.Multer.File[]): Express.Multer.File[] {
    if (!files || files.length === 0) return [];

    if (files.length > MAX_FILES) {
      throw new BadRequestException(
        `Maximum ${MAX_FILES} images allowed per product`,
      );
    }

    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        throw new BadRequestException(
          `File "${file.originalname}" is not allowed. Only JPG and PNG are accepted`,
        );
      }
      if (file.size > MAX_SIZE_BYTES) {
        throw new BadRequestException(
          `File "${file.originalname}" exceeds the 2 MB size limit`,
        );
      }
    }

    return files;
  }
}
