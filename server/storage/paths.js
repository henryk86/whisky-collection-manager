import path from 'node:path';
import { DATA_ROOT } from '../config.js';
export const ROOT = DATA_ROOT;
export const DATA_DIR = path.join(ROOT, 'data');
export const IMAGE_DIR = path.join(ROOT, 'images');
export const DOCUMENT_DIR = path.join(ROOT, 'documents');
export const BACKUP_DIR = path.join(ROOT, 'backups');
export const DATA_FILE = path.join(DATA_DIR, 'collection.json');
