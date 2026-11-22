import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAttachmentsDir, getLegacyAttachmentsDirs, moveAttachmentFiles } from './storage.js';

describe('attachment storage', () => {
  let root;
  let fromDir;
  let toDir;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-'));
    fromDir = path.join(root, 'public/uploads');
    toDir = path.join(root, 'storage/attachments');
    fs.mkdirSync(fromDir, { recursive: true });
  });

  afterEach(() => {
    delete process.env.ATTACHMENTS_DIR;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps attachments outside the statically served public directory', () => {
    const publicDir = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../public');
    expect(getAttachmentsDir().startsWith(publicDir + path.sep)).toBe(false);
    expect(getLegacyAttachmentsDirs()[0]).toBe(path.join(publicDir, 'uploads'));
  });

  it('can be overridden with ATTACHMENTS_DIR', () => {
    process.env.ATTACHMENTS_DIR = toDir;
    expect(getAttachmentsDir()).toBe(toDir);
  });

  it('moves the named files and leaves everything else in place', () => {
    fs.writeFileSync(path.join(fromDir, 'a.png'), 'a');
    fs.writeFileSync(path.join(fromDir, 'unrelated.txt'), 'x');
    fs.mkdirSync(path.join(fromDir, 'avatars'));
    fs.writeFileSync(path.join(fromDir, 'avatars/avatar_1.png'), 'avatar');

    const moved = moveAttachmentFiles(
      ['a.png', 'missing.png', '../escape.txt', 'avatars/avatar_1.png'],
      fromDir,
      toDir
    );

    expect(moved).toEqual(['a.png']);
    expect(fs.readFileSync(path.join(toDir, 'a.png'), 'utf8')).toBe('a');
    expect(fs.existsSync(path.join(fromDir, 'a.png'))).toBe(false);
    expect(fs.existsSync(path.join(fromDir, 'unrelated.txt'))).toBe(true);
    expect(fs.existsSync(path.join(fromDir, 'avatars/avatar_1.png'))).toBe(true);
  });

  it('does not overwrite a file that is already in the target, and can run twice', () => {
    fs.writeFileSync(path.join(fromDir, 'a.png'), 'old');
    fs.mkdirSync(toDir, { recursive: true });
    fs.writeFileSync(path.join(toDir, 'a.png'), 'new');

    expect(moveAttachmentFiles(['a.png'], fromDir, toDir)).toEqual([]);
    expect(fs.readFileSync(path.join(toDir, 'a.png'), 'utf8')).toBe('new');
    expect(fs.existsSync(path.join(fromDir, 'a.png'))).toBe(true);
    expect(moveAttachmentFiles(['a.png'], fromDir, toDir)).toEqual([]);
  });
});
