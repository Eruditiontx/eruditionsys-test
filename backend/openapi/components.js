// Schemas and responses shared by several resources.
import {
  testRunCaseStatus,
  testRunStatus,
  priorities,
  testTypes,
  automationStatus,
  templates,
} from '../config/enums.js';
import { roles, memberRoles } from '../routes/users/authSettings.js';
import { indexEnum, integer, nullable, object, ref, string, textMessage } from './helpers.js';

const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
};

const uids = (entries) => entries.map((entry) => entry.uid);

export default {
  components: {
    schemas: {
      ErrorResponse: object({ error: string }, ['error']),
      User: {
        type: 'object',
        description: 'A user account. Which of the optional fields are present depends on the endpoint.',
        required: ['id', 'email', 'username', 'role'],
        properties: {
          id: integer,
          email: { type: 'string', format: 'email' },
          username: string,
          role: indexEnum(uids(roles), 'Global role'),
          avatarPath: nullable({
            type: 'string',
            description: 'Path of the avatar image, relative to the API root.',
            example: '/uploads/avatars/avatar_1_1700000000000.png',
          }),
          locale: nullable(string),
          ...timestamps,
        },
      },
      UserSummary: object({ id: integer, username: string, email: { type: 'string', format: 'email' } }, [
        'id',
        'username',
        'email',
      ]),
      AuthResult: object(
        {
          access_token: { type: 'string', description: 'JWT, valid for 24 hours. Send it as a bearer token.' },
          expires_at: { type: 'integer', format: 'int64', description: 'Expiry time in milliseconds since the epoch.' },
          user: ref('User'),
        },
        ['access_token', 'expires_at', 'user']
      ),
      Project: {
        type: 'object',
        required: ['id', 'name', 'isPublic', 'userId', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          detail: { type: 'string', nullable: true },
          isPublic: {
            type: 'boolean',
            description: 'A public project can be read by every signed-in user.',
          },
          userId: { type: 'integer', description: 'ID of the user who owns the project.' },
          ...timestamps,
        },
      },
      Member: object(
        {
          id: integer,
          userId: integer,
          projectId: integer,
          role: indexEnum(uids(memberRoles), 'Project role'),
          ...timestamps,
        },
        ['id', 'userId', 'projectId', 'role']
      ),
      Folder: {
        type: 'object',
        required: ['id', 'name', 'projectId', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          detail: { type: 'string', nullable: true },
          parentFolderId: { type: 'integer', nullable: true },
          projectId: { type: 'integer' },
          ...timestamps,
        },
      },
      Case: object(
        {
          id: integer,
          title: string,
          state: { type: 'integer', description: 'Case state index.' },
          priority: indexEnum(priorities, 'Priority'),
          type: indexEnum(testTypes, 'Test type'),
          automationStatus: indexEnum(automationStatus, 'Automation status'),
          description: nullable(string),
          template: indexEnum(templates, 'Template'),
          preConditions: nullable(string),
          expectedResults: nullable(string),
          folderId: integer,
          ...timestamps,
        },
        ['id', 'title', 'state', 'priority', 'type', 'automationStatus', 'template', 'folderId']
      ),
      Step: object(
        {
          id: integer,
          step: { type: 'string', description: 'What to do.' },
          result: { type: 'string', description: 'The expected result of the step.' },
          ...timestamps,
        },
        ['id', 'step', 'result']
      ),
      Attachment: object(
        {
          id: integer,
          title: { type: 'string', description: 'Original file name.' },
          detail: nullable(string),
          filename: { type: 'string', description: 'Name of the stored file.' },
          ...timestamps,
        },
        ['id', 'title', 'filename']
      ),
      Tag: object(
        { id: integer, name: { type: 'string', minLength: 3, maxLength: 20 }, projectId: integer, ...timestamps },
        ['id', 'name', 'projectId']
      ),
      TagSummary: object({ id: integer, name: string }, ['id', 'name']),
      Run: object(
        {
          id: integer,
          name: string,
          configurations: nullable(string),
          description: nullable(string),
          state: nullable(indexEnum(testRunStatus, 'Run state')),
          projectId: integer,
          ...timestamps,
        },
        ['id', 'name', 'projectId']
      ),
      RunCase: object(
        {
          id: integer,
          runId: integer,
          caseId: integer,
          status: indexEnum(testRunCaseStatus, 'Result of the case in this run'),
          assigneeUserId: nullable(integer),
          ...timestamps,
        },
        ['id', 'runId', 'caseId', 'status']
      ),
      Comment: object(
        {
          id: integer,
          commentableType: { type: 'string', enum: ['Run', 'Case', 'RunCase'] },
          commentableId: integer,
          userId: nullable(integer),
          content: string,
          ...timestamps,
          User: nullable(ref('UserSummary')),
        },
        ['id', 'commentableType', 'commentableId', 'content']
      ),
    },
    responses: {
      Unauthorized: {
        description: 'The bearer token is missing or invalid.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { error: 'Access denied' },
          },
        },
      },
      Forbidden: {
        description: 'The signed-in user is not allowed to do this.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { error: 'Forbidden' },
          },
        },
      },
      InternalServerError: {
        description: 'Unexpected error.',
        content: textMessage('Internal Server Error'),
      },
    },
  },
};
