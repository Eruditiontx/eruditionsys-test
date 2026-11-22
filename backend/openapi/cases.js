// routes/cases/*.js (mounted on /cases), routes/steps/*.js (/steps) and routes/attachments/*.js (/attachments).
import {
  access,
  arrayOf,
  binary,
  forbidden,
  integer,
  internalServerError,
  internalServerErrorJson,
  json,
  jsonBody,
  jsonError,
  message,
  mixedError,
  multipartBody,
  noContent,
  object,
  pathParam,
  queryParam,
  ref,
  security,
  string,
  text,
  unauthorized,
} from './helpers.js';

const tags = ['cases'];
const attachmentTags = ['attachments'];

const caseProperties = {
  title: string,
  state: integer,
  priority: integer,
  type: integer,
  automationStatus: integer,
  description: { type: 'string', nullable: true },
  template: integer,
  preConditions: { type: 'string', nullable: true },
  expectedResults: { type: 'string', nullable: true },
};
const caseWith = (properties) => ({ allOf: [ref('Case'), object(properties)] });
const tagSummaries = arrayOf(ref('TagSummary'));
const csvIndexes = (name, description) => queryParam(name, { required: false, schema: string, description });
const searchParam = queryParam('search', {
  required: false,
  schema: { type: 'string', maxLength: 100 },
  description: 'Text to look for in the title or description.',
});
const tagFilter = csvIndexes(
  'tag',
  'Comma-separated tag IDs. Only cases with at least one of these tags are returned.'
);
const assigneeFilter = queryParam('assigneeUserId', {
  required: false,
  schema: {
    oneOf: [
      { type: 'integer', minimum: 1 },
      { type: 'string', enum: ['null'] },
    ],
  },
  description: 'Only run cases assigned to this user. Send the text `null` for unassigned ones.',
});
const folderId = queryParam('folderId');
const projectId = queryParam('projectId', {
  description: 'ID of the project. Every case, and the target folder, must belong to it.',
});
const caseIdsBody = (properties, required) =>
  jsonBody(object({ caseIds: { ...arrayOf(integer), minItems: 1 }, ...properties }, ['caseIds', ...required]));
const folderNotFound = text('The folder does not exist.', 'failed to find projectId');
const caseNotFound = text('The case does not exist.', 'failed to find projectId');
const someCasesNotFound = jsonError(
  'At least one of the cases does not exist in this project.',
  'Some cases not found'
);
const casesOrFolderNotFound = jsonError(
  'At least one of the cases, or the target folder, does not exist in this project.',
  'Some cases not found'
);
const attachmentNotFound = text('The attachment does not exist.', 'Attachment not found');

const stepEdit = object(
  {
    id: { ...integer, description: 'Required unless `editState` is `new`.' },
    step: string,
    result: string,
    editState: { type: 'string', enum: ['new', 'changed', 'deleted', 'notChanged'] },
    caseSteps: object({ stepNo: { ...integer, description: 'Position of the step in the case.' } }, ['stepNo']),
  },
  ['editState']
);

export default {
  tags: [
    { name: 'cases', description: 'Test cases and their steps' },
    { name: 'attachments', description: 'Files attached to a test case' },
  ],
  paths: {
    '/cases': {
      get: {
        tags,
        security,
        operationId: 'listCases',
        summary: 'List the cases in a folder',
        description: access.visible,
        parameters: [
          folderId,
          searchParam,
          csvIndexes('priority', 'Comma-separated priority indexes, for example `0,1`.'),
          csvIndexes('type', 'Comma-separated test type indexes.'),
          tagFilter,
        ],
        responses: {
          200: json('The matching cases with their tags.', arrayOf(caseWith({ Tags: tagSummaries }))),
          400: jsonError(
            '`folderId` is missing, or the search text is longer than 100 characters.',
            'folderId is required'
          ),
          401: unauthorized,
          403: forbidden,
          404: folderNotFound,
          500: internalServerError,
        },
      },
      post: {
        tags,
        security,
        operationId: 'createCase',
        summary: 'Create a case',
        description: access.developer,
        parameters: [folderId],
        requestBody: jsonBody(
          object(caseProperties, ['title', 'state', 'priority', 'type', 'automationStatus', 'template'])
        ),
        responses: {
          200: json('The created case. `folderId` is echoed from the query string as a string here.', ref('Case')),
          400: jsonError(
            '`folderId` or a required field is missing.',
            'Title, state, priority, type, automationStatus, and template are required'
          ),
          401: unauthorized,
          403: forbidden,
          404: folderNotFound,
          500: internalServerErrorJson,
        },
      },
    },
    '/cases/byproject': {
      get: {
        tags,
        security,
        operationId: 'listCasesForRun',
        summary: 'List the cases of a project with their result in a run',
        description: `Returns the cases of the project. Each case carries its run case for the given run, if it is part of that run. Filtering by status or assignee leaves out cases that are not part of the run. ${access.visible}`,
        parameters: [
          queryParam('projectId'),
          queryParam('runId'),
          csvIndexes('status', 'Comma-separated run case status indexes.'),
          assigneeFilter,
          tagFilter,
          searchParam,
        ],
        responses: {
          200: json(
            'The matching cases.',
            arrayOf(
              caseWith({
                RunCases: arrayOf(
                  object(
                    {
                      id: integer,
                      runId: integer,
                      status: integer,
                      assigneeUserId: { type: 'integer', nullable: true },
                      commentCount: { ...integer, description: 'Number of comments on the run case.' },
                    },
                    ['id', 'runId', 'status', 'commentCount']
                  )
                ),
                Tags: tagSummaries,
              })
            )
          ),
          400: jsonError('`projectId` or `runId` is missing, or a filter is invalid.', 'runId is required'),
          401: unauthorized,
          403: forbidden,
          404: text('The run does not exist.', 'failed to find projectId'),
          500: internalServerError,
        },
      },
    },
    '/cases/{caseId}': {
      get: {
        tags,
        security,
        operationId: 'getCase',
        summary: 'Get a case with its steps, attachments, tags and run cases',
        description: access.visible,
        parameters: [pathParam('caseId')],
        responses: {
          200: json(
            'The case.',
            caseWith({
              Steps: arrayOf({
                allOf: [ref('Step'), object({ caseSteps: object({ stepNo: integer }, ['stepNo']) })],
              }),
              Attachments: arrayOf(ref('Attachment')),
              Tags: tagSummaries,
              RunCases: arrayOf(ref('RunCase')),
            })
          ),
          401: unauthorized,
          403: forbidden,
          404: caseNotFound,
          500: internalServerError,
        },
      },
      put: {
        tags,
        security,
        operationId: 'updateCase',
        summary: 'Update a case',
        description: `Only the fields that are sent are changed, and other properties in the body are ignored. A new \`folderId\` must be a folder of the same project. Steps are edited through \`POST /steps/update\`. ${access.developer}`,
        parameters: [pathParam('caseId')],
        requestBody: jsonBody(object({ ...caseProperties, folderId: integer })),
        responses: {
          200: json('The updated case.', ref('Case')),
          401: unauthorized,
          403: forbidden,
          404: text('The case does not exist, or the new folder is not in its project.', 'Folder not found'),
          500: internalServerError,
        },
      },
    },
    '/cases/move': {
      put: {
        tags,
        security,
        operationId: 'moveCases',
        summary: 'Move cases to another folder',
        description: access.developer,
        parameters: [projectId],
        requestBody: caseIdsBody({ targetFolderId: integer }, ['targetFolderId']),
        responses: {
          200: json(
            'The cases were moved.',
            object(
              {
                message: { type: 'string', example: 'Cases moved successfully' },
                movedCaseIds: arrayOf(integer),
                targetFolderId: integer,
              },
              ['message', 'movedCaseIds', 'targetFolderId']
            )
          ),
          400: jsonError(
            '`projectId`, `caseIds` or `targetFolderId` is missing.',
            'caseIds(array) and targetFolderId are required'
          ),
          401: unauthorized,
          403: forbidden,
          404: casesOrFolderNotFound,
          500: internalServerError,
        },
      },
    },
    '/cases/clone': {
      post: {
        tags,
        security,
        operationId: 'cloneCases',
        summary: 'Copy cases into a folder',
        description: `Copies the cases with their steps. ${access.developer}`,
        parameters: [projectId],
        requestBody: caseIdsBody({ targetFolderId: integer }, ['targetFolderId']),
        responses: {
          200: message('The cases were cloned.', 'Cases cloned successfully'),
          400: jsonError(
            '`projectId`, `caseIds` or `targetFolderId` is missing.',
            'caseIds(array) and targetFolderId are required'
          ),
          401: unauthorized,
          403: forbidden,
          404: casesOrFolderNotFound,
          500: internalServerError,
        },
      },
    },
    '/cases/bulkdelete': {
      post: {
        tags,
        security,
        operationId: 'deleteCases',
        summary: 'Delete cases',
        description: `Nothing is deleted unless every case belongs to the project. ${access.developer}`,
        parameters: [projectId],
        requestBody: jsonBody(object({ caseIds: arrayOf(integer) }, ['caseIds'])),
        responses: {
          204: noContent('The cases were deleted.'),
          400: mixedError('`projectId` or `caseIds` is missing.', 'projectId is required', 'Invalid caseIds array'),
          401: unauthorized,
          403: forbidden,
          404: someCasesNotFound,
          500: internalServerError,
        },
      },
    },
    '/cases/download': {
      get: {
        tags,
        security,
        operationId: 'exportCases',
        summary: 'Export the cases of a folder',
        description: `Sent as a file download named after the folder. Numeric fields are replaced by their labels. ${access.visible}`,
        parameters: [folderId, queryParam('type', { schema: { type: 'string', enum: ['json', 'csv'] } })],
        responses: {
          200: {
            description: 'The exported cases.',
            headers: { 'Content-Disposition': { schema: string } },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'Cases keyed by case ID.',
                  additionalProperties: object({
                    id: integer,
                    folderId: integer,
                    folder: { type: 'string', description: 'Folder name.' },
                    title: string,
                    state: string,
                    priority: string,
                    type: string,
                    automationStatus: string,
                    description: { type: 'string', nullable: true },
                    template: string,
                    preConditions: { type: 'string', nullable: true },
                    expectedResults: { type: 'string', nullable: true },
                    Steps: arrayOf(object({ step: string, expectedStepResult: string })),
                  }),
                },
              },
              'text/csv': {
                schema: { type: 'string', description: 'One row per step; cases without steps get one row.' },
              },
            },
          },
          400: jsonError('`folderId` or `type` is missing, or the type is not supported.', 'download type is required'),
          401: unauthorized,
          403: forbidden,
          404: text('The folder does not exist or has no cases.', 'No cases found'),
          500: internalServerError,
        },
      },
    },
    '/cases/import': {
      post: {
        tags,
        security,
        operationId: 'importCases',
        summary: 'Import cases from an Excel file',
        description: `Reads the first sheet of an \`.xlsx\` or \`.xls\` file of at most 50 MB. Columns: \`title\`, \`priority\`, \`type\` and \`template\` (required, as labels), plus \`description\`, \`preConditions\`, \`expectedResults\`, \`automationStatus\`, \`step\` and \`expectedStepResult\`. Consecutive rows with the same title become the steps of one case. Nothing is imported when a row is invalid. ${access.developer}`,
        parameters: [folderId],
        requestBody: multipartBody({ file: binary }, ['file']),
        responses: {
          200: json('The created cases.', arrayOf(ref('Case'))),
          400: jsonError(
            'The file is missing, not an Excel file or too large, `folderId` is missing, or a row is invalid.',
            'Row 2 is missing required field: title'
          ),
          401: unauthorized,
          403: forbidden,
          404: folderNotFound,
          500: internalServerErrorJson,
        },
      },
    },
    '/steps/update': {
      post: {
        tags,
        security,
        operationId: 'updateSteps',
        summary: 'Create, change and delete the steps of a case',
        description: `Send the full list of steps; \`editState\` says what to do with each one. All changes are applied in one transaction. Changing a step that does not belong to the case rejects the request; deleting one is skipped. ${access.developer}`,
        parameters: [queryParam('caseId')],
        requestBody: jsonBody(arrayOf(stepEdit)),
        responses: {
          200: json(
            'The remaining steps: created steps as stored, the others as they were sent.',
            arrayOf({ type: 'object', additionalProperties: true })
          ),
          400: jsonError('`caseId` is missing, or the body is not an array.', 'caseId is required'),
          401: unauthorized,
          403: forbidden,
          404: text('The case does not exist, or a changed step does not belong to it.', 'Step not found'),
          500: internalServerError,
        },
      },
    },
    '/attachments': {
      post: {
        tags: attachmentTags,
        security,
        operationId: 'uploadAttachments',
        summary: 'Attach files to a case',
        description: `Up to 10 files per request. ${access.developer}`,
        parameters: [queryParam('parentCaseId', { description: 'ID of the case the files are attached to.' })],
        requestBody: multipartBody({ files: { ...arrayOf(binary), maxItems: 10 } }, ['files']),
        responses: {
          200: json('The created attachments.', arrayOf(ref('Attachment'))),
          400: jsonError('`parentCaseId` is missing, or the request has no files.', 'No files uploaded'),
          401: unauthorized,
          403: forbidden,
          404: caseNotFound,
          500: internalServerErrorJson,
        },
      },
    },
    '/attachments/{attachmentId}': {
      delete: {
        tags: attachmentTags,
        security,
        operationId: 'deleteAttachment',
        summary: 'Delete an attachment and its file',
        description: access.developer,
        parameters: [pathParam('attachmentId')],
        responses: {
          204: noContent('The attachment was deleted.'),
          401: unauthorized,
          403: forbidden,
          404: attachmentNotFound,
          500: internalServerError,
        },
      },
    },
    '/attachments/download/{attachmentId}': {
      get: {
        tags: attachmentTags,
        security,
        operationId: 'downloadAttachment',
        summary: 'Download an attachment',
        description: access.visible,
        parameters: [pathParam('attachmentId')],
        responses: {
          200: {
            description: 'The file.',
            headers: { 'Content-Disposition': { schema: string } },
            content: { 'application/octet-stream': { schema: binary } },
          },
          401: unauthorized,
          403: forbidden,
          404: mixedError('The attachment or its file does not exist.', 'File not found', 'Attachment not found'),
          500: internalServerError,
        },
      },
    },
  },
};
