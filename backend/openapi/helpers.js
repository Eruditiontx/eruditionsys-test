// Small builders shared by the OpenAPI fragments.

export const security = [{ jwt: [] }];

export const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
export const arrayOf = (schema) => ({ type: 'array', items: schema });
export const object = (properties, required) => ({
  type: 'object',
  ...(required && { required }),
  properties,
});
export const integer = { type: 'integer' };
export const string = { type: 'string' };
export const nullable = (schema) => ({ ...schema, nullable: true });

// Roles, states and similar values are stored as indexes into an array of labels.
export const indexEnum = (labels, description) => ({
  type: 'integer',
  enum: labels.map((_, index) => index),
  description: `${description}: ${labels.map((label, index) => `${index} = ${label}`).join(', ')}.`,
});

// Handlers report many errors with res.send('message'), which Express serves as text/html.
export const textMessage = (example) => ({
  'text/html': {
    schema: { type: 'string', example },
  },
});

const jsonErrorContent = (example) => ({
  'application/json': {
    schema: ref('ErrorResponse'),
    example: { error: example },
  },
});

// Responses
export const json = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});
export const text = (description, example) => ({ description, content: textMessage(example) });
export const jsonError = (description, example) => ({ description, content: jsonErrorContent(example) });
// For a status that some code paths answer as JSON and others as plain text.
export const mixedError = (description, jsonExample, textExample) => ({
  description,
  content: { ...jsonErrorContent(jsonExample), ...textMessage(textExample) },
});
export const noContent = (description) => ({ description });
export const message = (description, example) =>
  json(description, object({ message: { type: 'string', example } }, ['message']));

export const unauthorized = { $ref: '#/components/responses/Unauthorized' };
export const forbidden = { $ref: '#/components/responses/Forbidden' };
export const internalServerError = { $ref: '#/components/responses/InternalServerError' };
export const internalServerErrorJson = jsonError('Unexpected error.', 'Internal server error');

// Request bodies
export const jsonBody = (schema) => ({
  required: true,
  content: { 'application/json': { schema } },
});
export const multipartBody = (properties, required) => ({
  required: true,
  content: { 'multipart/form-data': { schema: object(properties, required) } },
});
export const binary = { type: 'string', format: 'binary' };

// Parameters
export const pathParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  schema: integer,
  ...(description && { description }),
});
export const queryParam = (name, { required = true, schema = integer, description } = {}) => ({
  name,
  in: 'query',
  ...(required && { required }),
  schema,
  ...(description && { description }),
});

// Permission wording, matching middleware/verifyVisible.js and middleware/verifyEditable.js.
export const access = {
  visible: 'Allowed when the project is public, or when the signed-in user owns it or is a member of it.',
  reporter: 'Requires the project owner or any project member (manager, developer or reporter).',
  developer: 'Requires the project owner, or a member with the manager or developer role.',
  manager: 'Requires the project owner, or a member with the manager role.',
  owner: 'Only the project owner can do this.',
  admin: 'Requires the global administrator role.',
};
