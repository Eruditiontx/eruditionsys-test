import { DataTypes } from 'sequelize';
import defineCaseAttachment from '../models/caseAttachments.js';
import verifyVisibleMiddleware from './verifyVisible.js';
import verifyEditableMiddleware from './verifyEditable.js';

/**
 * Permission checks for attachment routes. An attachment belongs to a case,
 * so these find the case and apply the case-level project checks.
 * (have to be called after verifySignedIn() middleware)
 */
export default function verifyAttachmentMiddleware(sequelize) {
  const { verifyProjectVisibleFromCaseId } = verifyVisibleMiddleware(sequelize);
  const { verifyProjectDeveloperFromCaseId } = verifyEditableMiddleware(sequelize);

  // Resolve the case from req.params.attachmentId, then run the case-level check.
  function fromAttachmentId(verifyFromCaseId) {
    return async function (req, res, next) {
      const CaseAttachment = defineCaseAttachment(sequelize, DataTypes);

      const attachmentId = req.params.attachmentId;
      if (!attachmentId) {
        return res.status(400).json({ error: 'attachmentId is required' });
      }

      const caseAttachment = await CaseAttachment.findOne({ where: { attachmentId } });
      if (!caseAttachment) {
        return res.status(404).send('Attachment not found');
      }

      req.params.caseId = caseAttachment.caseId;
      return verifyFromCaseId(req, res, next);
    };
  }

  /**
   * Verify user is developer of the project of the case named by the
   * parentCaseId query parameter (used when uploading).
   */
  function verifyProjectDeveloperFromParentCaseId(req, res, next) {
    req.params.caseId = req.query.parentCaseId;
    return verifyProjectDeveloperFromCaseId(req, res, next);
  }

  return {
    verifyProjectVisibleFromAttachmentId: fromAttachmentId(verifyProjectVisibleFromCaseId),
    verifyProjectDeveloperFromAttachmentId: fromAttachmentId(verifyProjectDeveloperFromCaseId),
    verifyProjectDeveloperFromParentCaseId,
  };
}
