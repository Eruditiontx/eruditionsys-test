import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineRunCase from '../../models/runCases.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import caseOwnership from '../../middleware/caseOwnership.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectReporterFromRunId } = editableMiddleware(sequelize);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const { findProjectIdOfRun, casesBelongToProject } = caseOwnership(sequelize);

  router.post('/update', verifySignedIn, verifyProjectReporterFromRunId, async (req, res) => {
    const runId = req.query.runId;
    const runCases = req.body;
    if (!Array.isArray(runCases)) {
      return res.status(400).json({ error: 'runCases[] is required' });
    }

    // the role was checked on the run; added cases must be in its project and
    // changed run cases must be part of the run
    const newCaseIds = runCases.filter((runCase) => runCase.editState === 'new').map((runCase) => runCase.caseId);
    const projectId = await findProjectIdOfRun(runId);
    if (!(await casesBelongToProject(newCaseIds, projectId))) {
      return res.status(404).json({ error: 'Some cases not found' });
    }
    const changedIds = [
      ...new Set(runCases.filter((runCase) => runCase.editState === 'changed').map((runCase) => Number(runCase.id))),
    ];
    if (changedIds.some((id) => !Number.isInteger(id))) {
      return res.status(404).json({ error: 'Some run cases not found' });
    }
    const changedCount = await RunCase.count({ where: { id: changedIds, runId } });
    if (changedCount !== changedIds.length) {
      return res.status(404).json({ error: 'Some run cases not found' });
    }

    const t = await sequelize.transaction();

    const createRunCase = async (runCase) => {
      const newRunCase = await RunCase.create(
        {
          runId: runId,
          caseId: runCase.caseId,
          status: runCase.status,
        },
        { transaction: t }
      );
      return newRunCase;
    };

    const deleteRunCase = async (runCase) => {
      await RunCase.destroy({
        where: { runId: runId, caseId: runCase.caseId },
        transaction: t,
      });
      return null;
    };

    const updateRunCase = async (runCase) => {
      await RunCase.update(
        {
          status: runCase.status,
        },
        {
          where: { id: runCase.id, runId: runId },
          transaction: t,
        }
      );
      return runCase;
    };

    try {
      const results = await Promise.all(
        runCases.map(async (step) => {
          if (step.editState === 'new') {
            return createRunCase(step);
          } else if (step.editState === 'deleted') {
            return deleteRunCase(step);
          } else if (step.editState === 'changed') {
            return updateRunCase(step);
          } else if (step.editState === 'notChanged') {
            return step;
          }
        })
      );

      await t.commit();
      res.json(results.filter((result) => result !== null));
    } catch (error) {
      console.error(error);
      await t.rollback();
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
