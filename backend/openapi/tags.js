// routes/tags/*.js (mounted on /tags) and routes/casetags/*.js (mounted on /casetags).
import {
  access,
  arrayOf,
  forbidden,
  integer,
  internalServerErrorJson,
  json,
  jsonBody,
  jsonError,
  message,
  mixedError,
  noContent,
  object,
  pathParam,
  queryParam,
  ref,
  security,
  unauthorized,
} from './helpers.js';

const tags = ['tags'];
const projectId = queryParam('projectId', { description: 'ID of the project the tag belongs to.' });
const tagId = pathParam('tagId');
const tagBody = jsonBody(
  object({ name: { type: 'string', minLength: 3, maxLength: 20, description: 'Surrounding spaces are trimmed.' } }, [
    'name',
  ])
);
const tagNotFound = jsonError('The project has no tag with this ID.', 'Tag not found');
const duplicateName = jsonError('The project already has a tag with this name.', 'Tag name must be unique');
const missingProjectId = jsonError('`projectId` is missing.', 'projectId is required');

export default {
  tags: [{ name: 'tags', description: 'Project tags and the tags attached to a case' }],
  paths: {
    '/tags': {
      get: {
        tags,
        security,
        operationId: 'listTags',
        summary: 'List the tags of a project',
        description: `Sorted by name. ${access.visible}`,
        parameters: [projectId],
        responses: {
          200: json('The tags of the project.', arrayOf(ref('Tag'))),
          400: missingProjectId,
          401: unauthorized,
          403: forbidden,
          500: internalServerErrorJson,
        },
      },
      post: {
        tags,
        security,
        operationId: 'createTag',
        summary: 'Create a tag',
        description: access.developer,
        parameters: [projectId],
        requestBody: tagBody,
        responses: {
          201: json('The created tag. `projectId` is echoed from the query string as a string here.', ref('Tag')),
          400: jsonError(
            '`projectId` or `name` is missing, or the name is not 3 to 20 characters long.',
            'name must be between 3 and 20 characters long'
          ),
          401: unauthorized,
          403: forbidden,
          409: duplicateName,
          500: internalServerErrorJson,
        },
      },
    },
    '/tags/{tagId}': {
      get: {
        tags,
        security,
        operationId: 'getTag',
        summary: 'Get a tag',
        description: access.visible,
        parameters: [tagId, projectId],
        responses: {
          200: json('The tag.', ref('Tag')),
          400: missingProjectId,
          401: unauthorized,
          403: forbidden,
          404: tagNotFound,
          500: internalServerErrorJson,
        },
      },
      put: {
        tags,
        security,
        operationId: 'updateTag',
        summary: 'Rename a tag',
        description: access.developer,
        parameters: [tagId, projectId],
        requestBody: tagBody,
        responses: {
          200: json('The updated tag.', ref('Tag')),
          400: jsonError(
            '`projectId` or `name` is missing, or the name is not 3 to 20 characters long.',
            'name must be between 3 and 20 characters long'
          ),
          401: unauthorized,
          403: forbidden,
          404: tagNotFound,
          409: duplicateName,
          500: internalServerErrorJson,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'deleteTag',
        summary: 'Delete a tag',
        description: access.developer,
        parameters: [tagId, projectId],
        responses: {
          204: noContent('The tag was deleted.'),
          400: missingProjectId,
          401: unauthorized,
          403: forbidden,
          404: tagNotFound,
          500: internalServerErrorJson,
        },
      },
    },
    '/casetags/update': {
      post: {
        tags,
        security,
        operationId: 'setCaseTags',
        summary: 'Set the tags of a case',
        description: `Replaces the tags of the case with the given list: missing tags are attached and the others are detached. Unknown tag IDs are ignored. ${access.developer}`,
        parameters: [queryParam('caseId')],
        requestBody: jsonBody(object({ tagIds: { ...arrayOf(integer), maxItems: 5 } }, ['tagIds'])),
        responses: {
          200: message('The tags were updated.', 'Tags updated successfully'),
          400: jsonError(
            '`caseId` or `tagIds` is missing, or more than 5 tags were given.',
            'Maximum of 5 tags allowed'
          ),
          401: unauthorized,
          403: forbidden,
          404: mixedError('The case does not exist.', 'Case not found', 'failed to find projectId'),
          500: internalServerErrorJson,
        },
      },
    },
  },
};
