import { DataTypes } from 'sequelize';
import defineFolder from '../models/folders.js';
import defineCase from '../models/cases.js';

/**
 * Checks that records named in a request body belong to the project the
 * caller's role was verified on. The project-level middleware only looks at
 * the projectId of the request, so routes that take IDs in the body have to
 * relate them to that project themselves.
 */
export default function caseOwnership(sequelize) {
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);

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

  return { folderBelongsToProject, casesBelongToProject };
}
