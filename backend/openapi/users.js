// routes/users/*.js, mounted on /users in server.ts.
import { SUPPORTED_LOCALES } from '../config/locale.js';
import { roles } from '../routes/users/authSettings.js';
import {
  access,
  arrayOf,
  binary,
  forbidden,
  indexEnum,
  integer,
  internalServerError,
  internalServerErrorJson,
  json,
  jsonBody,
  jsonError,
  message,
  mixedError,
  multipartBody,
  object,
  pathParam,
  queryParam,
  ref,
  security,
  string,
  text,
  unauthorized,
} from './helpers.js';

const tags = ['users'];
const authTags = ['auth'];

const userNotFound = text('The user does not exist.', 'User not found');
const userEnvelope = (description) => json(description, object({ user: ref('User') }, ['user']));
const roleSchema = indexEnum(
  roles.map((entry) => entry.uid),
  'Global role'
);
// verifyAdmin answers 404 when the account behind the token no longer exists.
const adminErrors = { 401: unauthorized, 403: forbidden, 404: userNotFound };
const redirect = (description) => ({
  description,
  headers: { Location: { schema: { type: 'string', format: 'uri' } } },
});

export default {
  tags: [
    { name: 'auth', description: 'Sign up, sign in and single sign-on' },
    { name: 'users', description: 'User accounts and the signed-in user profile' },
  ],
  paths: {
    '/users/signup': {
      post: {
        tags: authTags,
        operationId: 'signUp',
        summary: 'Create an account',
        description:
          'The first account created becomes an administrator; later accounts get the user role. Any failure, including an email that is already registered, is reported as 500.',
        requestBody: jsonBody(
          object(
            {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', format: 'password' },
              username: string,
            },
            ['email', 'password', 'username']
          )
        ),
        responses: {
          200: json('The new account and an access token.', ref('AuthResult')),
          500: text('The account could not be created.', 'Sign up failed'),
        },
      },
    },
    '/users/signin': {
      post: {
        tags: authTags,
        operationId: 'signIn',
        summary: 'Sign in with email and password',
        requestBody: jsonBody(
          object({ email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } }, [
            'email',
            'password',
          ])
        ),
        responses: {
          200: json('The account and an access token.', ref('AuthResult')),
          401: jsonError('Unknown email or wrong password.', 'Authentication failed'),
          500: text('Unexpected error.', 'Sign up failed'),
        },
      },
    },
    '/users/oidc/enabled': {
      get: {
        tags: authTags,
        operationId: 'getOidcEnabled',
        summary: 'Check whether single sign-on is configured',
        description: 'True when `OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` are all set on the server.',
        responses: {
          200: json('Whether OIDC sign-in is available.', object({ enabled: { type: 'boolean' } }, ['enabled'])),
        },
      },
    },
    '/users/oidc/login': {
      get: {
        tags: authTags,
        'x-conditional': 'Only mounted when OIDC is configured.',
        operationId: 'oidcLogin',
        summary: 'Start single sign-on',
        description: 'Browser redirect to the OIDC provider. Only available when OIDC is configured.',
        responses: { 302: redirect('Redirect to the OIDC provider.') },
      },
    },
    '/users/oidc/afterCallback': {
      get: {
        tags: authTags,
        'x-conditional': 'Only mounted when OIDC is configured.',
        operationId: 'oidcAfterCallback',
        summary: 'Finish single sign-on',
        description:
          'Reached by the browser after the provider callback. Creates the account on first sign-in, then redirects to the frontend page `/account/sso-callback?token=...`, where `token` is a URL-encoded JSON object with the same fields as the sign-in response. On failure it redirects to the sign-in page. Only available when OIDC is configured.',
        responses: { 302: redirect('Redirect to the frontend.') },
      },
    },
    '/users': {
      get: {
        tags,
        security,
        operationId: 'listUsers',
        summary: 'List all users',
        description: access.admin,
        responses: {
          200: json('Every user account.', arrayOf(ref('User'))),
          ...adminErrors,
          500: internalServerError,
        },
      },
    },
    '/users/find/{userId}': {
      get: {
        tags,
        security,
        operationId: 'getUser',
        summary: 'Get a user',
        parameters: [pathParam('userId')],
        responses: {
          200: json('The user.', ref('User')),
          401: unauthorized,
          404: userNotFound,
          500: internalServerError,
        },
      },
    },
    '/users/search': {
      get: {
        tags,
        security,
        operationId: 'searchUsers',
        summary: 'Search users to add to a project',
        description:
          'Matches the text against email and username. Leaves out the signed-in user and the existing members of the project, and returns at most 7 users.',
        parameters: [
          queryParam('projectId'),
          queryParam('search', { schema: string, description: 'Text to look for in the email or username.' }),
        ],
        responses: {
          200: json('The matching users.', arrayOf(ref('User'))),
          400: jsonError('A parameter is missing.', 'projectId and search text are required'),
          401: unauthorized,
          500: internalServerError,
        },
      },
    },
    '/users/username': {
      put: {
        tags,
        security,
        operationId: 'updateOwnUsername',
        summary: 'Change the signed-in user name',
        requestBody: jsonBody(object({ username: string }, ['username'])),
        responses: {
          200: userEnvelope('The updated user.'),
          400: text('The username is empty.', 'Username is required'),
          401: unauthorized,
          404: userNotFound,
          500: internalServerError,
        },
      },
    },
    '/users/password': {
      put: {
        tags,
        security,
        operationId: 'updateOwnPassword',
        summary: 'Change the signed-in user password',
        requestBody: jsonBody(
          object(
            {
              currentPassword: { type: 'string', format: 'password' },
              newPassword: { type: 'string', format: 'password', minLength: 8 },
            },
            ['currentPassword', 'newPassword']
          )
        ),
        responses: {
          200: message('The password was changed.', 'Password updated successfully'),
          400: text('A password is missing or the new one is too short.', 'New password must be at least 8 characters'),
          401: mixedError(
            'The bearer token is missing or invalid, or the current password is wrong.',
            'Access denied',
            'Current password is incorrect'
          ),
          404: userNotFound,
          500: internalServerError,
        },
      },
    },
    '/users/locale': {
      put: {
        tags,
        security,
        operationId: 'updateOwnLocale',
        summary: 'Change the signed-in user language',
        requestBody: jsonBody(object({ locale: { type: 'string', enum: SUPPORTED_LOCALES } }, ['locale'])),
        responses: {
          200: userEnvelope('The updated user.'),
          400: text('The locale is missing or not supported.', 'Invalid locale'),
          401: unauthorized,
          404: userNotFound,
          500: internalServerError,
        },
      },
    },
    '/users/avatar': {
      post: {
        tags,
        security,
        operationId: 'uploadOwnAvatar',
        summary: 'Upload an avatar for the signed-in user',
        description:
          'Replaces the previous avatar. The file must be an image of at most 5 MB; any other file is rejected with a 500 error page.',
        requestBody: multipartBody({ avatar: binary }, ['avatar']),
        responses: {
          200: userEnvelope('The updated user.'),
          400: jsonError('The request has no file.', 'No file uploaded'),
          401: unauthorized,
          404: userNotFound,
          500: internalServerErrorJson,
        },
      },
      delete: {
        tags,
        security,
        operationId: 'deleteOwnAvatar',
        summary: 'Remove the avatar of the signed-in user',
        responses: {
          200: userEnvelope('The updated user.'),
          401: unauthorized,
          404: userNotFound,
          500: internalServerErrorJson,
        },
      },
    },
    '/users/{id}/password': {
      put: {
        tags,
        security,
        operationId: 'resetUserPassword',
        summary: 'Reset the password of a user',
        description: access.admin,
        parameters: [pathParam('id', 'ID of the user whose password is reset.')],
        requestBody: jsonBody(
          object({ newPassword: { type: 'string', format: 'password', minLength: 8 } }, ['newPassword'])
        ),
        responses: {
          200: json('The password was reset.', object({ user: object({ id: integer }, ['id']) }, ['user'])),
          400: text('The new password is missing or too short.', 'New password must be at least 8 characters'),
          ...adminErrors,
          500: internalServerError,
        },
      },
    },
    '/users/{userId}/role': {
      put: {
        tags,
        security,
        operationId: 'updateUserRole',
        summary: 'Change the global role of a user',
        description: `${access.admin} The last administrator cannot be demoted.`,
        parameters: [pathParam('userId')],
        requestBody: jsonBody(object({ newRole: roleSchema }, ['newRole'])),
        responses: {
          200: userEnvelope('The updated user.'),
          400: text('The role is missing, or this would remove the last administrator.', 'newRole is required'),
          ...adminErrors,
          500: internalServerError,
        },
      },
    },
  },
};
