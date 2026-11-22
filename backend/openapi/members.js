// routes/members/*.js, mounted on /members in server.ts.
import { memberRoles } from '../routes/users/authSettings.js';
import {
  access,
  arrayOf,
  forbidden,
  indexEnum,
  integer,
  internalServerError,
  json,
  jsonError,
  mixedError,
  noContent,
  object,
  queryParam,
  ref,
  security,
  text,
  unauthorized,
} from './helpers.js';

const tags = ['members'];
const roleSchema = indexEnum(
  memberRoles.map((entry) => entry.uid),
  'Project role'
);
const projectNotFound = text('The project does not exist.', 'Project not found');
const memberNotFound = text('The project does not exist, or the user is not a member of it.', 'Member not found');
const userId = queryParam('userId', { description: 'ID of the user the membership belongs to.' });
const projectId = queryParam('projectId');

export default {
  tags: [{ name: 'members', description: 'Project membership and project roles' }],
  paths: {
    '/members': {
      get: {
        tags,
        security,
        operationId: 'listMembers',
        summary: 'List the members of a project',
        description: access.visible,
        parameters: [
          projectId,
          queryParam('includeOwner', {
            required: false,
            schema: { type: 'string', enum: ['true', 'false'] },
            description:
              'Set to `true` to put the project owner first in the list, as a manager with the string id `owner-<userId>`, unless the owner is already a member.',
          }),
        ],
        responses: {
          200: json(
            'The members, each with its user account.',
            arrayOf({
              allOf: [
                ref('Member'),
                object({
                  id: {
                    oneOf: [integer, { type: 'string', example: 'owner-1' }],
                    description: 'Membership ID, or `owner-<userId>` for the project owner entry.',
                  },
                  User: ref('User'),
                }),
              ],
            })
          ),
          400: jsonError('`projectId` is missing.', 'projectId is required'),
          401: unauthorized,
          403: forbidden,
          500: internalServerError,
        },
      },
      post: {
        tags,
        security,
        operationId: 'addMember',
        summary: 'Add a user to a project',
        description: `The new member starts with the reporter role. ${access.manager}`,
        parameters: [userId, projectId],
        responses: {
          200: json('The created membership.', ref('Member')),
          400: mixedError(
            '`projectId` is missing, or the user is already a member.',
            'projectId is required',
            'Record already exists'
          ),
          401: unauthorized,
          403: forbidden,
          404: projectNotFound,
          500: internalServerError,
        },
      },
      put: {
        tags,
        security,
        operationId: 'updateMemberRole',
        summary: 'Change the project role of a member',
        description: access.manager,
        parameters: [userId, projectId, queryParam('role', { schema: roleSchema })],
        responses: {
          200: json('The updated membership.', ref('Member')),
          400: jsonError('`projectId` is missing.', 'projectId is required'),
          401: unauthorized,
          403: forbidden,
          404: memberNotFound,
          500: internalServerError,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'removeMember',
        summary: 'Remove a user from a project',
        description: `Run cases assigned to the user in this project become unassigned. ${access.manager}`,
        parameters: [userId, projectId],
        responses: {
          204: noContent('The membership was removed.'),
          400: jsonError('`userId` or `projectId` is missing or not a positive integer.', 'userId is required'),
          401: unauthorized,
          403: forbidden,
          404: memberNotFound,
          500: internalServerError,
        },
      },
    },
    '/members/check': {
      get: {
        tags,
        security,
        operationId: 'listOwnProjectRoles',
        summary: 'List the project roles of the signed-in user',
        description:
          'One entry per project the user owns or is a member of. Owned projects are reported with the manager role.',
        responses: {
          200: json(
            'The roles of the signed-in user.',
            arrayOf(
              object(
                {
                  projectId: integer,
                  isOwner: { type: 'boolean' },
                  isMember: { type: 'boolean' },
                  role: roleSchema,
                },
                ['projectId', 'isOwner', 'isMember', 'role']
              )
            )
          ),
          401: unauthorized,
          500: internalServerError,
        },
      },
    },
  },
};
