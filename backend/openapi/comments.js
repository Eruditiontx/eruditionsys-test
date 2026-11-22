// routes/comments/*.js, mounted on /comments in server.ts.
import {
  access,
  arrayOf,
  forbidden,
  internalServerError,
  json,
  jsonBody,
  jsonError,
  object,
  pathParam,
  queryParam,
  ref,
  security,
  string,
  text,
  unauthorized,
} from './helpers.js';

const tags = ['comments'];
const commentable = [
  queryParam('commentableType', {
    schema: { type: 'string', enum: ['Run', 'Case', 'RunCase'] },
    description: 'Kind of record the comment is attached to.',
  }),
  queryParam('commentableId', { description: 'ID of the run, case or run case.' }),
];
const commentBody = jsonBody(object({ content: string }, ['content']));
const commentNotFound = jsonError('The comment does not exist.', 'Comment not found');
const notAuthor = jsonError('The signed-in user did not write this comment.', 'Unauthorized');
const commentableNotFound = text('The run, case or run case does not exist.', 'failed to find projectId');

export default {
  tags: [{ name: 'comments', description: 'Comments on runs, cases and run cases' }],
  paths: {
    '/comments': {
      get: {
        tags,
        security,
        operationId: 'listComments',
        summary: 'List the comments on a record',
        description: `Oldest first. ${access.visible}`,
        parameters: commentable,
        responses: {
          200: json('The comments, each with its author.', arrayOf(ref('Comment'))),
          400: jsonError('A parameter is missing, or the type is not supported.', 'unsupported commentableType'),
          401: unauthorized,
          403: forbidden,
          404: commentableNotFound,
          500: internalServerError,
        },
      },
      post: {
        tags,
        security,
        operationId: 'createComment',
        summary: 'Comment on a record',
        description: access.reporter,
        parameters: commentable,
        requestBody: commentBody,
        responses: {
          200: json('The created comment with its author.', ref('Comment')),
          400: jsonError(
            'A parameter or the content is missing, or the type is not supported.',
            'commentableType, commentableId, and content are required'
          ),
          401: unauthorized,
          403: forbidden,
          404: commentableNotFound,
          500: internalServerError,
        },
      },
    },
    '/comments/{commentId}': {
      put: {
        tags,
        security,
        operationId: 'updateComment',
        summary: 'Edit a comment',
        description: 'Only the author of the comment can edit it.',
        parameters: [pathParam('commentId')],
        requestBody: commentBody,
        responses: {
          200: json('The updated comment with its author.', ref('Comment')),
          400: jsonError('The content is missing.', 'id and content are required'),
          401: unauthorized,
          403: notAuthor,
          404: commentNotFound,
          500: internalServerError,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'deleteComment',
        summary: 'Delete a comment',
        description: 'Only the author of the comment can delete it.',
        parameters: [pathParam('commentId')],
        responses: {
          200: json('The comment was deleted.', object({ success: { type: 'boolean', enum: [true] } }, ['success'])),
          401: unauthorized,
          403: notAuthor,
          404: commentNotFound,
          500: internalServerError,
        },
      },
    },
  },
};
