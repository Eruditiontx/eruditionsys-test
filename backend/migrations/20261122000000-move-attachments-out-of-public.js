import { getAttachmentsDir, getLegacyAttachmentsDirs, moveAttachmentFiles } from '../config/storage.js';

// Attachment files used to live in public/uploads, where they were served to
// anyone who knew the file name. Move them to the private attachments directory.
// Avatars stay in public/uploads/avatars.

async function listFilenames(queryInterface) {
  const [rows] = await queryInterface.sequelize.query('SELECT filename FROM attachments');
  return rows.map((row) => row.filename);
}

export async function up(queryInterface) {
  const filenames = await listFilenames(queryInterface);
  for (const legacyDir of getLegacyAttachmentsDirs()) {
    const moved = moveAttachmentFiles(filenames, legacyDir, getAttachmentsDir());
    if (moved.length > 0) {
      console.log(`Moved ${moved.length} attachment file(s) from ${legacyDir} to ${getAttachmentsDir()}`);
    }
  }
}

export async function down(queryInterface) {
  const filenames = await listFilenames(queryInterface);
  moveAttachmentFiles(filenames, getAttachmentsDir(), getLegacyAttachmentsDirs()[0]);
}
