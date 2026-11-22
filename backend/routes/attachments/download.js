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
  const { verifyProjectVisibleFromAttachmentId } = attachmentMiddleware(sequelize);

  // TODO middleware to verify user permission to get attachment
  router.get('/download/:attachmentId', verifySignedIn, verifyProjectVisibleFromAttachmentId, async (req, res) => {
    const attachmentId = req.params.attachmentId;

    try {
      const attachment = await Attachment.findByPk(attachmentId);
      if (!attachment) {
        return res.status(404).send('Attachment not found');
      }

      const filePath = path.join(getAttachmentsDir(), path.basename(attachment.filename));

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.download(filePath);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
