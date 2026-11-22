import { DataTypes } from 'sequelize';
import defineFolder from '../models/folders.js';
import defineCase from '../models/cases.js';
import defineRun from '../models/runs.js';

/**
 * Checks that records named in a request body belong to the project the
 * caller's role was verified on. The project-level middleware only looks at
 * the projectId of the request, so routes that take IDs in the body have to
 * relate them to that project themselves.
 */
export default function caseOwnership(sequelize) {
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);

  /** ID of the project the case belongs to, or null when the case or its folder is missing. */
  async function findProjectIdOfCase(caseId) {
    const testCase = await Case.findByPk(caseId, { attributes: ['id', 'folderId'] });
    const folder = testCase && (await Folder.findByPk(testCase.folderId));
    return folder ? folder.projectId : null;
  }

  /** ID of the project the run belongs to, or null when the run is missing. */
  async function findProjectIdOfRun(runId) {
    const run = await Run.findByPk(runId);
    return run ? run.projectId : null;
  }

  /** True when the folder exists and belongs to the project. */
  async function folderBelongsToProject(folderId, projectId) {
    const folder = await Folder.findByPk(folderId);
    return Boolean(folder) && folder.projectId === Number(projectId);
  }

  /** True when every case exists and is in a folder of the project. */
  async function casesBelongToProject(caseIds, projectId) {
    // IDs may arrive as numbers or numeric strings
    const ids = [...new Set(caseIds.map((id) => Number(id)))];
    if (!ids.every((id) => Number.isInteger(id))) {
      return false;
    }

    const cases = await Case.findAll({ where: { id: ids }, attributes: ['id', 'folderId'] });
    if (cases.length !== ids.length) {
      return false;
    }

    const folderIds = [...new Set(cases.map((c) => c.folderId))];
    const folderCount = await Folder.count({ where: { id: folderIds, projectId: Number(projectId) } });
    return folderCount === folderIds.length;
  }

  return { findProjectIdOfCase, findProjectIdOfRun, folderBelongsToProject, casesBelongToProject };
}
