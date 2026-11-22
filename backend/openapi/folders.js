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
        description: access.developer,
        parameters: [pathParam('folderId')],
        requestBody: jsonBody(
          object({ name: string, detail: nullable(string), projectId: integer, parentFolderId: nullable(integer) }, [
            'name',
            'projectId',
          ])
        ),
        responses: {
          200: json('The updated folder.', ref('Folder')),
          401: unauthorized,
          403: forbidden,
          404: folderNotFound,
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
        description: `Copies the folder, its subfolders, and their cases and steps under the target folder. ${access.developer} The role is checked on the project of the source folder.`,
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
          404: text('The source or target folder does not exist.', 'Folder or target folder not found'),
          500: internalServerError,
        },
      },
    },
  },
};
