// routes/folders/*.js, mounted on /folders in server.ts.
import {
  access,
  arrayOf,
  forbidden,
  integer,
  internalServerError,
  json,
  jsonBody,
  jsonError,
  message,
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

const tags = ['folders'];
const folderNotFound = text('The folder does not exist.', 'failed to find projectId');

export default {
  tags: [{ name: 'folders', description: 'Folders that hold the test cases of a project' }],
  paths: {
    '/folders': {
      get: {
        tags,
        security,
        operationId: 'listFolders',
        summary: 'List the folders of a project',
        description: access.visible,
        parameters: [queryParam('projectId')],
        responses: {
          200: json('Every folder of the project, as a flat list.', arrayOf(ref('Folder'))),
          400: jsonError('`projectId` is missing.', 'projectId is required'),
          401: unauthorized,
          403: forbidden,
          500: internalServerError,
        },
      },
      post: {
        tags,
        security,
        operationId: 'createFolder',
        summary: 'Create a folder',
        description: access.developer,
        parameters: [queryParam('projectId')],
        requestBody: jsonBody(
          object(
            {
              name: string,
              detail: nullable(string),
              parentFolderId: nullable({ ...integer, description: 'Omit or send null for a top-level folder.' }),
            },
            ['name']
          )
        ),
        responses: {
          200: json('The created folder. `projectId` is echoed from the query string as a string here.', ref('Folder')),
          400: jsonError('`name` or `projectId` is missing.', 'Name and projectId are required'),
          401: unauthorized,
          403: forbidden,
          500: jsonError('Unexpected error.', 'Internal server error'),
        },
      },
    },
    '/folders/{folderId}': {
      put: {
        tags,
        security,
        operationId: 'updateFolder',
        summary: 'Update a folder',
        description: `A folder stays in its project: \`projectId\` must be the current one, and \`parentFolderId\` must be a folder of the same project that is neither the folder itself nor one of its subfolders. ${access.developer}`,
        parameters: [pathParam('folderId')],
        requestBody: jsonBody(
          object({ name: string, detail: nullable(string), projectId: integer, parentFolderId: nullable(integer) }, [
            'name',
            'projectId',
          ])
        ),
        responses: {
          200: json('The updated folder.', ref('Folder')),
          400: jsonError(
            'The folder would move to another project, or into itself or one of its subfolders.',
            'A folder cannot be moved to another project'
          ),
          401: unauthorized,
          403: forbidden,
          404: text(
            'The folder does not exist, or the parent folder is not in its project.',
            'Parent folder not found'
          ),
          500: internalServerError,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'deleteFolder',
        summary: 'Delete a folder',
        description: access.developer,
        parameters: [pathParam('folderId')],
        responses: {
          204: noContent('The folder was deleted.'),
          401: unauthorized,
          403: forbidden,
          404: folderNotFound,
          500: internalServerError,
        },
      },
    },
    '/folders/{folderId}/clone': {
      post: {
        tags,
        security,
        operationId: 'cloneFolder',
        summary: 'Clone a folder into another folder',
        description: `Copies the folder, its subfolders, and their cases and steps under the target folder. The target folder must be in the same project as the source. ${access.developer}`,
        parameters: [pathParam('folderId', 'ID of the folder to copy.')],
        requestBody: jsonBody(
          object({ targetFolderId: { ...integer, description: 'ID of the folder that receives the copy.' } }, [
            'targetFolderId',
          ])
        ),
        responses: {
          201: message('The folder was cloned.', 'Folder cloned successfully'),
          401: unauthorized,
          403: forbidden,
          404: text(
            'The source or target folder does not exist, or they are in different projects.',
            'Folder or target folder not found'
          ),
          500: internalServerError,
        },
      },
    },
  },
};
