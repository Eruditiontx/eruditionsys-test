// Data builders for tests that run against createTestDatabase().
import { DataTypes } from 'sequelize';
import defineUser from '../models/users.js';
import defineProject from '../models/projects.js';
import defineMember from '../models/members.js';
import defineFolder from '../models/folders.js';
import defineCase from '../models/cases.js';
import defineStep from '../models/steps.js';
import defineCaseStep from '../models/caseSteps.js';
import defineTag from '../models/tags.js';
import defineCaseTag from '../models/caseTags.js';
import defineRun from '../models/runs.js';
import defineRunCase from '../models/runCases.js';

let userCount = 0;

export function defineModels(sequelize) {
  return {
    User: defineUser(sequelize, DataTypes),
    Project: defineProject(sequelize, DataTypes),
    Member: defineMember(sequelize, DataTypes),
    Folder: defineFolder(sequelize, DataTypes),
    Case: defineCase(sequelize, DataTypes),
    Step: defineStep(sequelize, DataTypes),
    CaseStep: defineCaseStep(sequelize, DataTypes),
    Tag: defineTag(sequelize, DataTypes),
    CaseTag: defineCaseTag(sequelize, DataTypes),
    Run: defineRun(sequelize, DataTypes),
    RunCase: defineRunCase(sequelize, DataTypes),
  };
}

export function createUser(models, name = 'user') {
  userCount += 1;
  return models.User.create({ email: `${name}-${userCount}@example.com`, password: 'hash', username: name, role: 1 });
}

export function createCase(models, folder, title = 'case') {
  return models.Case.create({
    title,
    state: 0,
    priority: 0,
    type: 0,
    automationStatus: 0,
    template: 0,
    folderId: folder.id,
  });
}

/**
 * A private project owned by `owner`, with a folder holding one case that has
 * one step, a second empty folder, a tag, and a run that includes the case.
 */
export async function createProject(models, owner) {
  const project = await models.Project.create({ name: 'project', isPublic: false, userId: owner.id });
  const folder = await models.Folder.create({ name: 'folder', projectId: project.id });
  const otherFolder = await models.Folder.create({ name: 'other folder', projectId: project.id });
  const testCase = await createCase(models, folder);
  const step = await models.Step.create({ step: 'do', result: 'done' });
  await models.CaseStep.create({ caseId: testCase.id, stepId: step.id, stepNo: 1 });
  const tag = await models.Tag.create({ name: `tag-${project.id}`, projectId: project.id });
  const run = await models.Run.create({ name: 'run', projectId: project.id });
  const runCase = await models.RunCase.create({ runId: run.id, caseId: testCase.id, status: 0 });
  return { project, folder, otherFolder, testCase, step, tag, run, runCase };
}
