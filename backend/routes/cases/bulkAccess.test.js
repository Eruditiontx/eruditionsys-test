import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataTypes } from 'sequelize';
import defineUser from '../../models/users.js';
import defineProject from '../../models/projects.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import { createTestDatabase, bearerFor } from '../../testUtils/database.js';
import casesMoveRoute from './move.js';
import casesCloneRoute from './clone.js';
import casesDeleteRoute from './delete.js';

// A developer of one project must not be able to reach the cases or folders
// of another project by naming their IDs in the request body.
describe('bulk case routes stay inside the project', () => {
  let app;
  let Case;
  let createUser;
  let createProject;
  let userCount = 0;
  let attacker;
  // { project, folder, otherFolder, cases: [a, b] } for each project
  let own;
  let victim;

  // One app and database for the whole file: the route modules keep a single
  // router, so building the routes twice would leave the first handlers in place.
  beforeAll(async () => {
    const sequelize = await createTestDatabase();
    app = express();
    app.use(express.json());
    app.use('/cases', casesMoveRoute(sequelize));
    app.use('/cases', casesCloneRoute(sequelize));
    app.use('/cases', casesDeleteRoute(sequelize));

    const User = defineUser(sequelize, DataTypes);
    const Project = defineProject(sequelize, DataTypes);
    const Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);

    createUser = (name) =>
      User.create({ email: `${name}-${++userCount}@example.com`, password: 'hash', username: name, role: 1 });
    createProject = async (owner) => {
      const project = await Project.create({ name: 'project', isPublic: false, userId: owner.id });
      const folder = await Folder.create({ name: 'folder', projectId: project.id });
      const otherFolder = await Folder.create({ name: 'other folder', projectId: project.id });
      const cases = [];
      for (const title of ['a', 'b']) {
        cases.push(
          await Case.create({
            title,
            state: 0,
            priority: 0,
            type: 0,
            automationStatus: 0,
            template: 0,
            folderId: folder.id,
          })
        );
      }
      return { project, folder, otherFolder, cases };
    };
  });

  beforeEach(async () => {
    attacker = await createUser('attacker');
    own = await createProject(attacker);
    victim = await createProject(await createUser('victim'));
  });

  const ids = (target) => target.cases.map((c) => c.id);
  const send = (method, route, body) =>
    request(app)
      [method](`/cases/${route}`)
      .query({ projectId: own.project.id })
      .set('Authorization', bearerFor(attacker.id))
      .send(body);
  const folderOf = async (caseId) => (await Case.findByPk(caseId)).folderId;

  describe('POST /cases/bulkdelete', () => {
    it('does not delete cases of another project', async () => {
      const res = await send('post', 'bulkdelete', { caseIds: ids(victim) });
      expect(res.status).toBe(404);
      expect(await Case.count({ where: { id: ids(victim) } })).toBe(2);
    });

    it('deletes nothing when only some of the cases are in the project', async () => {
      const res = await send('post', 'bulkdelete', { caseIds: [own.cases[0].id, victim.cases[0].id] });
      expect(res.status).toBe(404);
      expect(await Case.count({ where: { id: [...ids(own), ...ids(victim)] } })).toBe(4);
    });

    it('deletes cases of the project', async () => {
      const res = await send('post', 'bulkdelete', { caseIds: ids(own) });
      expect(res.status).toBe(204);
      expect(await Case.count({ where: { id: ids(own) } })).toBe(0);
      expect(await Case.count({ where: { id: ids(victim) } })).toBe(2);
    });
  });

  describe('PUT /cases/move', () => {
    it('does not move cases of another project', async () => {
      const res = await send('put', 'move', { caseIds: ids(victim), targetFolderId: own.folder.id });
      expect(res.status).toBe(404);
      expect(await folderOf(victim.cases[0].id)).toBe(victim.folder.id);
    });

    it('does not move cases into a folder of another project', async () => {
      const res = await send('put', 'move', { caseIds: ids(own), targetFolderId: victim.folder.id });
      expect(res.status).toBe(404);
      expect(await folderOf(own.cases[0].id)).toBe(own.folder.id);
    });

    it('moves cases inside the project', async () => {
      const res = await send('put', 'move', { caseIds: ids(own), targetFolderId: own.otherFolder.id });
      expect(res.status).toBe(200);
      expect(await folderOf(own.cases[0].id)).toBe(own.otherFolder.id);
      expect(await folderOf(own.cases[1].id)).toBe(own.otherFolder.id);
    });
  });

  describe('POST /cases/clone', () => {
    it('does not clone cases of another project', async () => {
      const res = await send('post', 'clone', { caseIds: ids(victim), targetFolderId: own.folder.id });
      expect(res.status).toBe(404);
      expect(await Case.count({ where: { folderId: own.folder.id } })).toBe(2);
    });

    it('does not clone cases into a folder of another project', async () => {
      const res = await send('post', 'clone', { caseIds: ids(own), targetFolderId: victim.folder.id });
      expect(res.status).toBe(404);
      expect(await Case.count({ where: { folderId: victim.folder.id } })).toBe(2);
    });

    it('clones cases inside the project', async () => {
      const res = await send('post', 'clone', { caseIds: ids(own), targetFolderId: own.otherFolder.id });
      expect(res.status).toBe(200);
      expect(await Case.count({ where: { folderId: own.otherFolder.id } })).toBe(2);
      expect(await Case.count({ where: { folderId: own.folder.id } })).toBe(2);
    });
  });
});
