import {
  BackupCreatedResponse,
  BackupListResponse,
  RestoreBackupResponse,
  RestorePreviewResponse,
} from '../../../contracts/backup.js';
import { apiRequest } from '../../platform/api/client.js';

const one = (id: string) => `/api/backups/${encodeURIComponent(id)}`;

export const fetchBackups = () => apiRequest('GET', '/api/backups', BackupListResponse);
export const backUpNow = () => apiRequest('POST', '/api/backups', BackupCreatedResponse);
export const previewRestore = (id: string) =>
  apiRequest('GET', `${one(id)}/preview`, RestorePreviewResponse);
export const restoreBackup = (id: string) =>
  apiRequest('POST', `${one(id)}/restore`, RestoreBackupResponse, { confirm: true });
