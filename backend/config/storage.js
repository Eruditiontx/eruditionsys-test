import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// This file is backend/config/storage.js in development and in the Docker image,
// and backend/dist/config/storage.js when the compiled backend is run directly.
const configDir = path.dirname(fileURLToPath(import.meta.url));
const parentDir = path.resolve(configDir, '..');
const backendDir = path.basename(parentDir) === 'dist' ? path.resolve(parentDir, '..') : parentDir;

/**
 * Directory that holds the files attached to test cases.
 *
 * It is deliberately outside public/, which express.static serves without any
 * permission check: attachments are only reachable through /attachments/download.
 */
export function getAttachmentsDir() {
  return process.env.ATTACHMENTS_DIR
    ? path.resolve(process.env.ATTACHMENTS_DIR)
    : path.join(backendDir, 'storage/attachments');
}

/** Directories where attachments were stored before they moved out of public/. */
export function getLegacyAttachmentsDirs() {
  return [path.join(backendDir, 'public/uploads'), path.join(backendDir, 'dist/public/uploads')];
}

/**
 * Move the named files from one directory to another and return the names that
 * were moved. Files that are missing, or already present in the target, are
 * left alone, so this can be run again safely.
 */
export function moveAttachmentFiles(filenames, fromDir, toDir) {
  const moved = [];
  for (const filename of filenames) {
    // a stored name is always a bare file name; never follow anything else
    if (!filename || path.basename(filename) !== filename) continue;

    const source = path.join(fromDir, filename);
    const target = path.join(toDir, filename);
    if (!fs.existsSync(source) || fs.existsSync(target)) continue;

    fs.mkdirSync(toDir, { recursive: true });
    // copy then delete: the two directories can be on different volumes
    fs.copyFileSync(source, target);
    fs.unlinkSync(source);
    moved.push(filename);
  }
  return moved;
}
