import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineStep from '../../models/steps.js';
import defineCaseStep from '../../models/caseSteps.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const Step = defineStep(sequelize, DataTypes);
  const CaseStep = defineCaseStep(sequelize, DataTypes);
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromCaseId } = editableMiddleware(sequelize);

  router.post('/update', verifySignedIn, verifyProjectDeveloperFromCaseId, async (req, res) => {
    const caseId = req.query.caseId;
    const steps = req.body;
    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: 'steps[] is required' });
    }

    // The role was checked on the case; only its own steps may be changed or deleted.
    // A change to any other step rejects the request. A delete of any other step is
    // skipped instead: the editor sends one for a step that was added and removed
    // again before saving, with an ID that was never stored.
    const caseSteps = await CaseStep.findAll({ where: { caseId }, attributes: ['stepId'] });
    const ownStepIds = new Set(caseSteps.map((caseStep) => caseStep.stepId));
    const touchesOtherCase = steps
      .filter((step) => step.editState === 'changed')
      .some((step) => !ownStepIds.has(Number(step.id)));
    if (touchesOtherCase) {
      return res.status(404).send('Step not found');
    }

    const t = await sequelize.transaction();

    const createStep = async (step) => {
      const newStep = await Step.create(
        {
          step: step.step,
          result: step.result,
        },
        { transaction: t }
      );
      await CaseStep.create(
        {
          caseId: caseId,
          stepId: newStep.id,
          stepNo: step.caseSteps.stepNo,
        },
        { transaction: t }
      );
      return newStep;
    };

    const deleteStep = async (step) => {
      if (!ownStepIds.has(Number(step.id))) {
        return null;
      }
      await CaseStep.destroy({
        where: { stepId: step.id, caseId: caseId },
        transaction: t,
      });
      await Step.destroy({
        where: { id: step.id },
        transaction: t,
      });
      return null;
    };

    const updateStep = async (step) => {
      await Step.update(
        { step: step.step, result: step.result },
        {
          where: { id: step.id },
          transaction: t,
        }
      );
      await CaseStep.update(
        {
          stepNo: step.caseSteps.stepNo,
        },
        {
          where: { stepId: step.id, caseId: caseId },
          transaction: t,
        }
      );
      return step;
    };
    try {
      const results = await Promise.all(
        steps.map(async (step) => {
          if (step.editState === 'new') {
            return createStep(step);
          } else if (step.editState === 'deleted') {
            return deleteStep(step);
          } else if (step.editState === 'changed') {
            return updateStep(step);
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
