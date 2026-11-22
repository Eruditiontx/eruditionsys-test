// routes/runs/*.js (mounted on /runs), routes/runcases/*.js (/runcases) and routes/home/*.js (/home).
import {
  access,
  arrayOf,
  forbidden,
  integer,
  internalServerError,
  internalServerErrorJson,
  json,
  jsonBody,
  jsonError,
  mixedError,
  noContent,
  nullable,
  object,
  pathParam,
  queryParam,
  ref,
  security,
  string,
  text,
  unauthorized,
} from './helpers.js';

const tags = ['runs'];
const runId = pathParam('runId');
const runIdQuery = queryParam('runId');
const runNotFound = text('The run does not exist.', 'failed to find projectId');
const missingProjectId = jsonError('`projectId` is missing.', 'projectId is required');
const runProperties = {
  name: string,
  configurations: nullable(string),
  description: nullable(string),
  state: nullable(integer),
};

const runCaseEdit = object(
  {
    id: { ...integer, description: 'Run case ID. Required when `editState` is `changed`.' },
    caseId: { ...integer, description: 'Required when `editState` is `new` or `deleted`.' },
    status: integer,
    editState: { type: 'string', enum: ['new', 'changed', 'deleted', 'notChanged'] },
  },
  ['editState']
);

export default {
  tags: [
    { name: 'runs', description: 'Test runs and the cases included in them' },
    { name: 'home', description: 'Project dashboard data' },
  ],
  paths: {
    '/runs': {
      get: {
        tags,
        security,
        operationId: 'listRuns',
        summary: 'List the runs of a project',
        description: access.visible,
        parameters: [queryParam('projectId')],
        responses: {
          200: json('The runs of the project.', arrayOf(ref('Run'))),
          400: missingProjectId,
          401: unauthorized,
          403: forbidden,
          500: internalServerError,
        },
      },
      post: {
        tags,
        security,
        operationId: 'createRun',
        summary: 'Create a run',
        description: access.reporter,
        parameters: [queryParam('projectId')],
        requestBody: jsonBody(object(runProperties, ['name'])),
        responses: {
          200: json('The created run. `projectId` is echoed from the query string as a string here.', ref('Run')),
          400: jsonError('`name` or `projectId` is missing.', 'Name and projectId are required'),
          401: unauthorized,
          403: forbidden,
          500: internalServerErrorJson,
        },
      },
    },
    '/runs/{runId}': {
      get: {
        tags,
        security,
        operationId: 'getRun',
        summary: 'Get a run with its result counts',
        description: access.visible,
        parameters: [runId],
        responses: {
          200: json(
            'The run, and how many of its cases have each status.',
            object(
              {
                run: ref('Run'),
                statusCounts: arrayOf(object({ status: integer, count: integer }, ['status', 'count'])),
              },
              ['run', 'statusCounts']
            )
          ),
          401: unauthorized,
          403: forbidden,
          404: runNotFound,
          500: internalServerError,
        },
      },
      put: {
        tags,
        security,
        operationId: 'updateRun',
        summary: 'Update a run',
        description: `Only the fields that are sent are changed. ${access.reporter}`,
        parameters: [runId],
        requestBody: jsonBody(object(runProperties)),
        responses: {
          200: json('The updated run.', ref('Run')),
          401: unauthorized,
          403: forbidden,
          404: runNotFound,
          500: internalServerError,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'deleteRun',
        summary: 'Delete a run',
        description: access.reporter,
        parameters: [runId],
        responses: {
          204: noContent('The run was deleted.'),
          401: unauthorized,
          403: forbidden,
          404: runNotFound,
          500: internalServerError,
        },
      },
    },
    '/runs/download/{runId}': {
      get: {
        tags,
        security,
        operationId: 'exportRun',
        summary: 'Export the results of a run',
        description: `Sent as a file download named after the run. \`xml\` is a JUnit report grouped by folder that only contains passed, failed and skipped cases. ${access.visible}`,
        parameters: [runId, queryParam('type', { schema: { type: 'string', enum: ['xml', 'json', 'csv'] } })],
        responses: {
          200: {
            description: 'The exported results.',
            headers: { 'Content-Disposition': { schema: string } },
            content: {
              'application/xml': { schema: { type: 'string', description: 'JUnit `testsuites` document.' } },
              'application/json': {
                schema: arrayOf({
                  allOf: [
                    ref('RunCase'),
                    object({
                      Case: { allOf: [ref('Case'), object({ Tags: arrayOf(ref('TagSummary')) })] },
                    }),
                  ],
                }),
              },
              'text/csv': {
                schema: { type: 'string', description: 'One row per case, with labels instead of indexes.' },
              },
            },
          },
          400: jsonError(
            'The type is missing or not supported.',
            'Unsupported type. Use ?type=xml or ?type=json or ?type=csv'
          ),
          401: unauthorized,
          403: forbidden,
          404: runNotFound,
          500: internalServerError,
        },
      },
    },
    '/runcases': {
      get: {
        tags,
        security,
        operationId: 'listRunCases',
        summary: 'List the cases included in a run',
        description: access.visible,
        parameters: [
          runIdQuery,
          queryParam('assigneeUserId', {
            required: false,
            schema: {
              oneOf: [
                { type: 'integer', minimum: 1 },
                { type: 'string', enum: ['null'] },
              ],
            },
            description: 'Only run cases assigned to this user. Send the text `null` for unassigned ones.',
          }),
        ],
        responses: {
          200: json('The run cases.', arrayOf(ref('RunCase'))),
          400: jsonError('`runId` is missing or `assigneeUserId` is invalid.', 'runId is required'),
          401: unauthorized,
          403: forbidden,
          404: runNotFound,
          500: internalServerError,
        },
      },
    },
    '/runcases/update': {
      post: {
        tags,
        security,
        operationId: 'updateRunCases',
        summary: 'Add cases to a run, remove them, and record results',
        description: `\`editState\` says what to do with each entry: \`new\` adds the case to the run, \`deleted\` removes it, \`changed\` stores the status. All changes are applied in one transaction. Added cases must belong to the project of the run, and changed run cases must be part of the run. ${access.reporter}`,
        parameters: [runIdQuery],
        requestBody: jsonBody(arrayOf(runCaseEdit)),
        responses: {
          200: json(
            'The remaining entries: added run cases as stored, the others as they were sent.',
            arrayOf({ type: 'object', additionalProperties: true })
          ),
          400: jsonError('`runId` is missing, or the body is not an array.', 'runId is required'),
          401: unauthorized,
          403: forbidden,
          404: mixedError(
            'The run does not exist, an added case is not in its project, or a changed run case is not part of it.',
            'Some cases not found',
            'failed to find projectId'
          ),
          500: internalServerError,
        },
      },
    },
    '/runcases/assignee': {
      post: {
        tags,
        security,
        operationId: 'assignRunCases',
        summary: 'Assign run cases to a user',
        description: `The assignee must be the project owner or a project member. ${access.manager}`,
        parameters: [runIdQuery],
        requestBody: jsonBody(
          object(
            {
              runCaseIds: { ...arrayOf(integer), minItems: 1, description: 'Run cases of this run.' },
              assigneeUserId: nullable({
                type: 'integer',
                minimum: 1,
                description: 'Send null to clear the assignee.',
              }),
            },
            ['runCaseIds', 'assigneeUserId']
          )
        ),
        responses: {
          200: json('The updated run cases.', arrayOf(ref('RunCase'))),
          400: jsonError(
            'A field is missing or invalid, the assignee is not in the project, or a run case is not part of the run.',
            'assigneeUserId is not a member of this project'
          ),
          401: unauthorized,
          403: forbidden,
          404: mixedError('The run does not exist.', 'Run not found', 'Run not found'),
          500: internalServerError,
        },
      },
    },
    '/home/{projectId}': {
      get: {
        tags: ['home'],
        security,
        operationId: 'getProjectOverview',
        summary: 'Get a project with all of its folders, cases and runs',
        description: `The data behind the project dashboard. ${access.visible}`,
        parameters: [pathParam('projectId')],
        responses: {
          200: json('The project and everything in it.', {
            allOf: [
              ref('Project'),
              object(
                {
                  Folders: arrayOf({ allOf: [ref('Folder'), object({ Cases: arrayOf(ref('Case')) }, ['Cases'])] }),
                  Runs: arrayOf({ allOf: [ref('Run'), object({ RunCases: arrayOf(ref('RunCase')) }, ['RunCases'])] }),
                },
                ['Folders', 'Runs']
              ),
            ],
          }),
          401: unauthorized,
          403: jsonError(
            'The project does not exist, or it is private and the signed-in user is neither its owner nor a member.',
            'Forbidden'
          ),
          500: internalServerError,
        },
      },
    },
  },
};
