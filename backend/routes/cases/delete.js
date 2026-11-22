import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineCase from '../../models/cases.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import caseOwnership from '../../middleware/caseOwnership.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const { casesBelongToProject } = caseOwnership(sequelize);

  router.post('/bulkdelete', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    const { caseIds } = req.body;
    if (!caseIds || !Array.isArray(caseIds)) {
      return res.status(400).send('Invalid caseIds array');
    }

    try {
      // the role was checked on req.query.projectId only; the cases must be in that project
      if (!(await casesBelongToProject(caseIds, req.query.projectId))) {
        return res.status(404).json({ error: 'Some cases not found' });
      }

      await Case.destroy({ where: { id: caseIds } });
      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
