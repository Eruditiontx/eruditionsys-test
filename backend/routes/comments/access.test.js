import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataTypes } from 'sequelize';
import defineUser from '../../models/users.js';
import defineProject from '../../models/projects.js';
import defineMember from '../../models/members.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';
import { createTestDatabase, bearerFor } from '../../testUtils/database.js';
import commentsNewRoute from './new.js';
import commentsIndexRoute from './index.js';

describe('comment access by project', () => {
  let app;
  const users = {};
  // commentable IDs per project, keyed by commentableType
  const privateIds = {};
  const publicIds = {};

  beforeAll(async () => {
    const sequelize = await createTestDatabase();
    app = express();
    app.use(express.json());
    app.use('/comments', commentsIndexRoute(sequelize));
    app.use('/comments', commentsNewRoute(sequelize));

    const User = defineUser(sequelize, DataTypes);
    const Project = defineProject(sequelize, DataTypes);
    const Member = defineMember(sequelize, DataTypes);
    const Folder = defineFolder(sequelize, DataTypes);
    const Case = defineCase(sequelize, DataTypes);
    const Run = defineRun(sequelize, DataTypes);
    const RunCase = defineRunCase(sequelize, DataTypes);

    for (const name of ['owner', 'reporter', 'outsider']) {
      users[name] = await User.create({ email: `${name}@example.com`, password: 'hash', username: name, role: 1 });
    }

    const createProject = async (isPublic, ids) => {
      const project = await Project.create({ name: 'project', isPublic, userId: users.owner.id });
      const folder = await Folder.create({ name: 'folder', projectId: project.id });
      const testCase = await Case.create({
        title: 'case',
        state: 0,
        priority: 0,
        type: 0,
        automationStatus: 0,
        template: 0,
        folderId: folder.id,
      });
      const run = await Run.create({ name: 'run', projectId: project.id });
      const runCase = await RunCase.create({ runId: run.id, caseId: testCase.id, status: 0 });
      Object.assign(ids, { Run: run.id, Case: testCase.id, RunCase: runCase.id });
      return project;
    };

    const privateProject = await createProject(false, privateIds);
    await createProject(true, publicIds);
    await Member.create({ userId: users.reporter.id, projectId: privateProject.id, role: 2 });
  });

  const list = (user, commentableType, commentableId) =>
    request(app)
      .get('/comments')
      .query({ commentableType, commentableId })
      .set('Authorization', bearerFor(users[user].id));

  const create = (user, commentableType, commentableId) =>
    request(app)
      .post('/comments')
      .query({ commentableType, commentableId })
      .set('Authorization', bearerFor(users[user].id))
      .send({ content: 'hello' });

  describe.each(['Run', 'Case', 'RunCase'])('on a %s', (type) => {
    it('answers 403 to a user outside a private project', async () => {
      expect((await list('outsider', type, privateIds[type])).status).toBe(403);
      expect((await create('outsider', type, privateIds[type])).status).toBe(403);
    });

    it('lets the owner and a member comment and read', async () => {
      expect((await create('owner', type, privateIds[type])).status).toBe(200);
      expect((await create('reporter', type, privateIds[type])).status).toBe(200);

      const res = await list('reporter', type, privateIds[type]);
      expect(res.status).toBe(200);
      expect(res.body.map((comment) => comment.User.username)).toEqual(['owner', 'reporter']);
    });

    it('lets everyone read a public project but only members comment', async () => {
      expect((await list('outsider', type, publicIds[type])).status).toBe(200);
      expect((await create('outsider', type, publicIds[type])).status).toBe(403);
    });

    it('answers 404 when the record does not exist', async () => {
      expect((await list('owner', type, 9999)).status).toBe(404);
      expect((await create('owner', type, 9999)).status).toBe(404);
    });
  });

  it('answers 400 for an unsupported type', async () => {
    expect((await list('owner', 'Project', 1)).status).toBe(400);
    expect((await create('owner', 'Project', 1)).status).toBe(400);
  });
});
