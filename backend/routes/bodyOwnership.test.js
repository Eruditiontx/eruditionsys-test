import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, bearerFor } from '../testUtils/database.js';
import { defineModels, createUser, createProject, createCase } from '../testUtils/fixtures.js';
import casesEditRoute from './cases/edit.js';
import foldersEditRoute from './folders/edit.js';
import foldersCloneRoute from './folders/clone.js';
import stepsEditRoute from './steps/edit.js';
import runCasesEditRoute from './runcases/edit.js';
import caseTagsEditRoute from './casetags/edit.js';

// The project role is checked on the record named in the URL or query string.
// IDs and fields in the request body must not reach into another project.
describe('request bodies stay inside the project', () => {
  let app;
  let models;
  let attacker;
  let own;
  let victim;

  // One app and database for the whole file: the route modules keep a single
  // router, so building the routes twice would leave the first handlers in place.
  beforeAll(async () => {
    const sequelize = await createTestDatabase();
    models = defineModels(sequelize);
    app = express();
    app.use(express.json());
    app.use('/cases', casesEditRoute(sequelize));
    app.use('/folders', foldersEditRoute(sequelize));
    app.use('/folders', foldersCloneRoute(sequelize));
    app.use('/steps', stepsEditRoute(sequelize));
    app.use('/runcases', runCasesEditRoute(sequelize));
    app.use('/casetags', caseTagsEditRoute(sequelize));
  });

  beforeEach(async () => {
    attacker = await createUser(models, 'attacker');
    own = await createProject(models, attacker);
    victim = await createProject(models, await createUser(models, 'victim'));
  });

  const send = (method, url, body, query = {}) =>
    request(app)[method](url).query(query).set('Authorization', bearerFor(attacker.id)).send(body);
  const reload = (record) => record.reload();

  describe('PUT /cases/:caseId', () => {
    it('does not move the case into a folder of another project', async () => {
      const res = await send('put', `/cases/${own.testCase.id}`, { folderId: victim.folder.id });
      expect(res.status).toBe(404);
      expect((await reload(own.testCase)).folderId).toBe(own.folder.id);
    });

    it('ignores fields that are not editable', async () => {
      const res = await send('put', `/cases/${own.testCase.id}`, {
        title: 'renamed',
        id: 987654,
        createdAt: '2000-01-01',
      });
      expect(res.status).toBe(200);
      const updated = await models.Case.findByPk(own.testCase.id);
      expect(updated.title).toBe('renamed');
      expect(updated.createdAt.getFullYear()).not.toBe(2000);
      expect(await models.Case.findByPk(987654)).toBeNull();
    });

    it('updates the case and moves it inside the project', async () => {
      const res = await send('put', `/cases/${own.testCase.id}`, {
        ...own.testCase.toJSON(),
        title: 'renamed',
        priority: 2,
        folderId: own.otherFolder.id,
        Steps: [{ id: 1 }],
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: 'renamed', priority: 2, folderId: own.otherFolder.id });
    });
  });

  describe('PUT /folders/:folderId', () => {
    const body = (overrides) => ({
      name: 'folder',
      detail: '',
      projectId: String(own.project.id),
      parentFolderId: null,
      ...overrides,
    });

    it('does not move the folder to another project', async () => {
      const res = await send('put', `/folders/${own.folder.id}`, body({ projectId: victim.project.id }));
      expect(res.status).toBe(400);
      expect((await reload(own.folder)).projectId).toBe(own.project.id);
    });

    it('does not put the folder under a folder of another project', async () => {
      const res = await send('put', `/folders/${own.folder.id}`, body({ parentFolderId: victim.folder.id }));
      expect(res.status).toBe(404);
      expect((await reload(own.folder)).parentFolderId).toBeNull();
    });

    it('does not put the folder under itself or one of its descendants', async () => {
      const child = await models.Folder.create({
        name: 'child',
        projectId: own.project.id,
        parentFolderId: own.folder.id,
      });
      const grandchild = await models.Folder.create({
        name: 'grandchild',
        projectId: own.project.id,
        parentFolderId: child.id,
      });

      for (const parentFolderId of [own.folder.id, child.id, grandchild.id]) {
        const res = await send('put', `/folders/${own.folder.id}`, body({ parentFolderId }));
        expect(res.status).toBe(400);
      }
      expect((await reload(own.folder)).parentFolderId).toBeNull();
    });

    it('renames the folder and moves it inside the project', async () => {
      const res = await send(
        'put',
        `/folders/${own.folder.id}`,
        body({ name: 'renamed', parentFolderId: own.otherFolder.id })
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'renamed',
        parentFolderId: own.otherFolder.id,
        projectId: own.project.id,
      });
    });
  });

  describe('POST /folders/:folderId/clone', () => {
    it('does not clone into a folder of another project', async () => {
      const res = await send('post', `/folders/${own.folder.id}/clone`, { targetFolderId: victim.folder.id });
      expect(res.status).toBe(404);
      expect(await models.Folder.count({ where: { projectId: victim.project.id } })).toBe(2);
    });

    it('clones inside the project', async () => {
      const res = await send('post', `/folders/${own.folder.id}/clone`, { targetFolderId: own.otherFolder.id });
      expect(res.status).toBe(201);
      const clone = await models.Folder.findOne({ where: { parentFolderId: own.otherFolder.id } });
      expect(clone.projectId).toBe(own.project.id);
      expect(await models.Case.count({ where: { folderId: clone.id } })).toBe(1);
    });
  });

  describe('POST /steps/update', () => {
    const edit = (step, editState, overrides = {}) => ({
      id: step.id,
      step: step.step,
      result: step.result,
      editState,
      caseSteps: { stepNo: 1 },
      ...overrides,
    });
    const update = (steps) => send('post', '/steps/update', steps, { caseId: own.testCase.id });

    it('does not change a step of another case', async () => {
      const res = await update([edit(victim.step, 'changed', { step: 'hacked' })]);
      expect(res.status).toBe(404);
      expect((await reload(victim.step)).step).toBe('do');
    });

    it('skips the delete of a step that is not in the case', async () => {
      // the editor sends this for a step that was added and removed before saving
      const res = await update([edit(victim.step, 'deleted'), edit({ id: 987654, step: '', result: '' }, 'deleted')]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(await models.Step.findByPk(victim.step.id)).not.toBeNull();
      expect(await models.CaseStep.count({ where: { stepId: victim.step.id } })).toBe(1);
    });

    it('applies nothing when one entry is outside the case', async () => {
      const res = await update([edit(own.step, 'changed', { step: 'edited' }), edit(victim.step, 'changed')]);
      expect(res.status).toBe(404);
      expect((await reload(own.step)).step).toBe('do');
    });

    it('creates, changes and deletes steps of the case', async () => {
      const second = await models.Step.create({ step: 'second', result: 'r' });
      await models.CaseStep.create({ caseId: own.testCase.id, stepId: second.id, stepNo: 2 });

      const res = await update([
        edit(own.step, 'changed', { step: 'edited', caseSteps: { stepNo: 2 }, createdAt: '2000-01-01' }),
        edit(second, 'deleted'),
        { step: 'new', result: 'new result', editState: 'new', caseSteps: { stepNo: 1 } },
      ]);
      expect(res.status).toBe(200);

      const edited = await models.Step.findByPk(own.step.id);
      expect(edited.step).toBe('edited');
      expect(edited.createdAt.getFullYear()).not.toBe(2000);
      expect(await models.Step.findByPk(second.id)).toBeNull();
      const links = await models.CaseStep.findAll({ where: { caseId: own.testCase.id }, order: [['stepNo', 'ASC']] });
      expect(links.map((link) => link.stepNo)).toEqual([1, 2]);
      expect(links[1].stepId).toBe(own.step.id);
    });
  });

  describe('POST /runcases/update', () => {
    const update = (runCases) => send('post', '/runcases/update', runCases, { runId: own.run.id });

    it('does not change a run case of another run', async () => {
      const res = await update([
        { id: victim.runCase.id, caseId: victim.testCase.id, status: 2, editState: 'changed' },
      ]);
      expect(res.status).toBe(404);
      expect((await reload(victim.runCase)).status).toBe(0);
    });

    it('does not add a case of another project to the run', async () => {
      const res = await update([{ caseId: victim.testCase.id, status: 0, editState: 'new' }]);
      expect(res.status).toBe(404);
      expect(await models.RunCase.count({ where: { runId: own.run.id } })).toBe(1);
    });

    it('adds, changes and removes cases of the project', async () => {
      const second = await createCase(models, own.otherFolder, 'second');
      const third = await createCase(models, own.otherFolder, 'third');
      const thirdRunCase = await models.RunCase.create({ runId: own.run.id, caseId: third.id, status: 0 });

      const res = await update([
        { id: own.runCase.id, caseId: own.testCase.id, status: 1, editState: 'changed' },
        { caseId: second.id, status: 0, editState: 'new' },
        { id: thirdRunCase.id, caseId: third.id, status: 0, editState: 'deleted' },
      ]);
      expect(res.status).toBe(200);
      expect((await reload(own.runCase)).status).toBe(1);
      const caseIds = (await models.RunCase.findAll({ where: { runId: own.run.id } })).map((rc) => rc.caseId).sort();
      expect(caseIds).toEqual([own.testCase.id, second.id].sort());
    });
  });

  describe('POST /casetags/update', () => {
    const update = (tagIds) => send('post', '/casetags/update', { tagIds }, { caseId: own.testCase.id });
    const tagIdsOfCase = async () =>
      (await models.CaseTag.findAll({ where: { caseId: own.testCase.id } })).map((link) => link.tagId);

    it('does not attach a tag of another project', async () => {
      const res = await update([victim.tag.id]);
      expect(res.status).toBe(200);
      expect(await tagIdsOfCase()).toEqual([]);
    });

    it('attaches the tags of the project and ignores the others', async () => {
      const res = await update([own.tag.id, victim.tag.id]);
      expect(res.status).toBe(200);
      expect(await tagIdsOfCase()).toEqual([own.tag.id]);
    });
  });
});
