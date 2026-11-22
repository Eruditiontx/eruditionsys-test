import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import caseOwnership from '../../middleware/caseOwnership.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromFolderId } = editableMiddleware(sequelize);
  const Folder = defineFolder(sequelize, DataTypes);
  const { folderBelongsToProject } = caseOwnership(sequelize);

  // True when candidateId is the folder itself or one of its descendants.
  async function isSameOrDescendant(candidateId, folderId) {
    const visited = new Set();
    let currentId = Number(candidateId);
    while (currentId && !visited.has(currentId)) {
      if (currentId === Number(folderId)) {
        return true;
      }
      visited.add(currentId);
      const current = await Folder.findByPk(currentId, { attributes: ['id', 'parentFolderId'] });
      currentId = current && current.parentFolderId;
    }
    return false;
  }

  router.put('/:folderId', verifySignedIn, verifyProjectDeveloperFromFolderId, async (req, res) => {
    const folderId = req.params.folderId;
    const { name, detail, projectId, parentFolderId } = req.body;
    try {
      const folder = await Folder.findByPk(folderId);
      if (!folder) {
        return res.status(404).send('Folder not found');
      }
      // the role was checked on the project of the folder; it must stay in that project
      if (projectId !== undefined && projectId !== null && Number(projectId) !== folder.projectId) {
        return res.status(400).json({ error: 'A folder cannot be moved to another project' });
      }
      if (parentFolderId !== undefined && parentFolderId !== null) {
        if (!(await folderBelongsToProject(parentFolderId, folder.projectId))) {
          return res.status(404).send('Parent folder not found');
        }
        if (await isSameOrDescendant(parentFolderId, folder.id)) {
          return res.status(400).json({ error: 'A folder cannot be moved into itself or one of its subfolders' });
        }
      }

      await folder.update({
        name,
        detail,
        parentFolderId,
      });
      res.json(folder);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
