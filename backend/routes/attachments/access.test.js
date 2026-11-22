import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataTypes } from 'sequelize';
import defineUser from '../../models/users.js';
import defineProject from '../../models/projects.js';
import defineMember from '../../models/members.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import { createTestDatabase, bearerFor } from '../../testUtils/database.js';
import attachmentsNewRoute from './new.js';
import attachmentsDeleteRoute from './delete.js';
import attachmentsDownloadRoute from './download.js';

const fileName = 'access-test.txt';
const rejectedFileName = `rejected-${fileName}`;

describe('attachment access by project', () => {
  let app;
  let uploadDir;
  let caseId;
  let attachmentId;
  const users = {};

  beforeAll(async () => {
    // the routes read the directory when they are created
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachments-'));
    process.env.ATTACHMENTS_DIR = uploadDir;

    const sequelize = await createTestDatabase();
    app = express();
    app.use(express.json());
    app.use('/attachments', attachmentsNewRoute(sequelize));
    app.use('/attachments', attachmentsDeleteRoute(sequelize));
    app.use('/attachments', attachmentsDownloadRoute(sequelize));

    const User = defineUser(sequelize, DataTypes);
    const Project = defineProject(sequelize, DataTypes);
    const Member = defineMember(sequelize, DataTypes);
    const Folder = defineFolder(sequelize, DataTypes);
    const Case = defineCase(sequelize, DataTypes);

    for (const name of ['owner', 'developer', 'reporter', 'outsider']) {
      users[name] = await User.create({ email: `${name}@example.com`, password: 'hash', username: name, role: 1 });
    }
    const project = await Project.create({ name: 'private', isPublic: false, userId: users.owner.id });
    await Member.create({ userId: users.developer.id, projectId: project.id, role: 1 });
    await Member.create({ userId: users.reporter.id, projectId: project.id, role: 2 });
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
    caseId = testCase.id;
  });

  afterAll(() => {
    delete process.env.ATTACHMENTS_DIR;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  const as = (req, user) => (user ? req.set('Authorization', bearerFor(users[user].id)) : req);
  const upload = (user, name = fileName, parentCaseId = caseId) =>
    as(request(app).post('/attachments').query({ parentCaseId }), user).attach('files', Buffer.from('hello'), name);
  const download = (user, id = attachmentId) => as(request(app).get(`/attachments/download/${id}`), user);
  const remove = (user, id = attachmentId) => as(request(app).delete(`/attachments/${id}`), user);

  it('rejects an upload without a token or without the developer role, and writes no file', async () => {
    expect((await upload(null, rejectedFileName)).status).toBe(401);
    expect((await upload('outsider', rejectedFileName)).status).toBe(403);
    expect((await upload('reporter', rejectedFileName)).status).toBe(403);
    expect(fs.existsSync(path.join(uploadDir, rejectedFileName))).toBe(false);
  });

  it('answers 404 or 400 when the case is unknown or missing', async () => {
    expect((await upload('owner', rejectedFileName, 9999)).status).toBe(404);
    expect((await upload('owner', rejectedFileName, '')).status).toBe(400);
    expect(fs.existsSync(path.join(uploadDir, rejectedFileName))).toBe(false);
  });

  it('lets a developer upload', async () => {
    const res = await upload('developer');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe(fileName);
    attachmentId = res.body[0].id;
    expect(fs.existsSync(path.join(uploadDir, fileName))).toBe(true);
  });

  it('only lets users who can see the project download', async () => {
    expect((await download(null)).status).toBe(401);
    expect((await download('outsider')).status).toBe(403);

    const res = await download('reporter');
    expect(res.status).toBe(200);
    expect(res.text ?? res.body.toString()).toBe('hello');
  });

  it('answers 404 for an unknown attachment', async () => {
    expect((await download('owner', 9999)).status).toBe(404);
    expect((await remove('owner', 9999)).status).toBe(404);
  });

  it('only lets a developer delete', async () => {
    expect((await remove(null)).status).toBe(401);
    expect((await remove('outsider')).status).toBe(403);
    expect((await remove('reporter')).status).toBe(403);
    expect((await download('reporter')).status).toBe(200);

    expect((await remove('owner')).status).toBe(204);
    expect(fs.existsSync(path.join(uploadDir, fileName))).toBe(false);
    expect((await download('owner')).status).toBe(404);
  });
});
