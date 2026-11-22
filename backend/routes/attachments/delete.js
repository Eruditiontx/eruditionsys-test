import fs from 'fs';
import path from 'path';
import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineAttachment from '../../models/attachments.js';
import authMiddleware from '../../middleware/auth.js';
import attachmentMiddleware from '../../middleware/verifyAttachment.js';
import { getAttachmentsDir } from '../../config/storage.js';

export default function (sequelize) {
  const Attachment = defineAttachment(sequelize, DataTypes);
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromAttachmentId } = attachmentMiddleware(sequelize);

  router.delete('/:attachmentId', verifySignedIn, verifyProjectDeveloperFromAttachmentId, async (req, res) => {
    const attachmentId = req.params.attachmentId;
    const t = await sequelize.transaction();

    try {
      const attachment = await Attachment.findByPk(attachmentId);
      if (!attachment) {
        await t.rollback();
        return res.status(404).send('Attachment not found');
      }

      await attachment.destroy({ transaction: t });
      await t.commit();

      // The record is gone; a file that is already missing is not an error.
      const filePath = path.join(getAttachmentsDir(), path.basename(attachment.filename));
      try {
        await fs.promises.rm(filePath, { force: true });
      } catch (error) {
        console.error('Error deleting file:', error);
      }
      return res.status(204).send();
    } catch (error) {
      console.error(error);
      await t.rollback();
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
