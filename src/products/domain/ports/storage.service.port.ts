/**
 * PORT (interfaz de salida) — IStorageService
 *
 * Regla: El dominio define QUÉ necesita del storage (subir archivos,
 * borrar por URL). No sabe si detrás hay AWS S3, GCP, o un disco local.
 *
 * La implementación concreta vive en:
 *   infrastructure/storage/s3-storage.adapter.ts
 */

export const STORAGE_SERVICE_PORT = 'STORAGE_SERVICE_PORT';

export interface IStorageService {
  uploadFiles(files: Express.Multer.File[], folder: string): Promise<string[]>;
  deleteFileByUrl(url: string): Promise<void>;
}
