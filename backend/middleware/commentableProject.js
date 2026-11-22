import { DataTypes } from 'sequelize';
import defineFolder from '../models/folders.js';
import defineCase from '../models/cases.js';
import defineRun from '../models/runs.js';
import defineRunCase from '../models/runCases.js';

/**
 * Find the project that a commentable record (Run, Case or RunCase) belongs to.
 *
 * Returns { projectId } when found, { notFound: message } when the record or
 * one of its parents does not exist, and { unsupported: true } for any other type.
 */
export default async function findCommentableProjectId(sequelize, commentableType, commentableId) {
  const Run = defineRun(sequelize, DataTypes);
  const notFound = { notFound: 'failed to find projectId' };

  if (commentableType === 'Run') {
    const run = await Run.findByPk(commentableId);
    return run ? { projectId: run.projectId } : notFound;
  }

  if (commentableType === 'Case') {
    const Case = defineCase(sequelize, DataTypes);
    const Folder = defineFolder(sequelize, DataTypes);
    const testCase = await Case.findByPk(commentableId);
    const folder = testCase && (await Folder.findByPk(testCase.folderId));
    return folder ? { projectId: folder.projectId } : notFound;
  }

  if (commentableType === 'RunCase') {
    const RunCase = defineRunCase(sequelize, DataTypes);
    const runCase = await RunCase.findByPk(commentableId);
    if (!runCase) {
      return { notFound: 'failed to find runId' };
    }
    const run = await Run.findByPk(runCase.runId);
    return run ? { projectId: run.projectId } : notFound;
  }

  return { unsupported: true };
}
