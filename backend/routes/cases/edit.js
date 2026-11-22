import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineCase from '../../models/cases.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import caseOwnership from '../../middleware/caseOwnership.js';

// The fields a client may change. Everything else in the body is ignored.
const editableFields = [
  'title',
  'state',
  'priority',
  'type',
  'automationStatus',
  'description',
  'template',
  'preConditions',
  'expectedResults',
  'folderId',
];

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromCaseId } = editableMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const { findProjectIdOfCase, folderBelongsToProject } = caseOwnership(sequelize);

  router.put('/:caseId', verifySignedIn, verifyProjectDeveloperFromCaseId, async (req, res) => {
    const caseId = req.params.caseId;
    const updateCase = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        updateCase[field] = req.body[field];
      }
    }
    try {
      const testcase = await Case.findByPk(caseId);
      if (!testcase) {
        return res.status(404).send('Case not found');
      }

      // the role was checked on the project of the case; a new folder must be in that project
      if (updateCase.folderId !== undefined && Number(updateCase.folderId) !== testcase.folderId) {
        const projectId = await findProjectIdOfCase(caseId);
        if (!(await folderBelongsToProject(updateCase.folderId, projectId))) {
          return res.status(404).send('Folder not found');
        }
      }

      await testcase.update(updateCase);
      res.json(testcase);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
