// routes/projects/*.js, mounted on /projects in server.ts.
import { textMessage } from './helpers.js';

const tags = ['projects'];
const security = [{ jwt: [] }];

const projectIdParam = {
  name: 'projectId',
  in: 'path',
  required: true,
  schema: { type: 'integer' },
};

const projectBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['name', 'isPublic'],
        properties: {
          name: { type: 'string' },
          detail: { type: 'string', nullable: true },
          isPublic: { type: 'boolean' },
        },
      },
    },
  },
};

const project = {
  'application/json': {
    schema: { $ref: '#/components/schemas/Project' },
  },
};

const unauthorized = { $ref: '#/components/responses/Unauthorized' };
const forbidden = { $ref: '#/components/responses/Forbidden' };
const internalServerError = { $ref: '#/components/responses/InternalServerError' };
// verifyProjectVisibleFromProjectId answers 403 for a missing project too.
const projectNotVisible = {
  description: 'The project does not exist, or it is private and the signed-in user is neither its owner nor a member.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
      example: { error: 'Forbidden' },
    },
  },
};
const projectNotFound = {
  description: 'The project does not exist.',
  content: textMessage('Project not found'),
};

export default {
  tags: [{ name: 'projects', description: 'Projects and their visibility' }],
  paths: {
    '/projects': {
      get: {
        tags,
        security,
        operationId: 'listProjects',
        summary: 'List projects',
        description:
          'Returns every project the signed-in user can see: public projects, projects they own, and projects they are a member of.',
        parameters: [
          {
            name: 'onlyUserProjects',
            in: 'query',
            description: 'Set to `true` to return only the projects owned by the signed-in user.',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
        ],
        responses: {
          200: {
            description: 'The visible projects.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
              },
            },
          },
          401: unauthorized,
          500: internalServerError,
        },
      },
      post: {
        tags,
        security,
        operationId: 'createProject',
        summary: 'Create a project',
        description:
          'Any signed-in user can create a project and becomes its owner. A body without `name` or `isPublic` is rejected with 500, not 400.',
        requestBody: projectBody,
        responses: {
          200: { description: 'The created project.', content: project },
          401: unauthorized,
          500: internalServerError,
        },
      },
    },
    '/projects/{projectId}': {
      get: {
        tags,
        security,
        operationId: 'getProject',
        summary: 'Get a project with its folders',
        description: 'Allowed when the project is public, or when the signed-in user owns it or is a member of it.',
        parameters: [projectIdParam],
        responses: {
          200: {
            description: 'The project and all of its folders.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Project' },
                    {
                      type: 'object',
                      required: ['Folders'],
                      properties: {
                        Folders: { type: 'array', items: { $ref: '#/components/schemas/Folder' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: unauthorized,
          403: projectNotVisible,
          500: internalServerError,
        },
      },
      put: {
        tags,
        security,
        operationId: 'updateProject',
        summary: 'Update a project',
        description: 'Only the project owner can update a project.',
        parameters: [projectIdParam],
        requestBody: projectBody,
        responses: {
          200: { description: 'The updated project.', content: project },
          401: unauthorized,
          403: forbidden,
          404: projectNotFound,
          500: internalServerError,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'deleteProject',
        summary: 'Delete a project',
        description: 'Only the project owner can delete a project. Its folders and runs are deleted with it.',
        parameters: [projectIdParam],
        responses: {
          204: { description: 'The project was deleted.' },
          401: unauthorized,
          403: forbidden,
          404: projectNotFound,
          500: internalServerError,
        },
      },
    },
  },
};
