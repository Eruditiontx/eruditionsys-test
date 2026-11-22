import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataTypes } from 'sequelize';
import defineUser from '../../models/users.js';
import defineProject from '../../models/projects.js';
import defineMember from '../../models/members.js';
import { createTestDatabase, bearerFor } from '../../testUtils/database.js';
import membersIndexRoute from '../members/index.js';
import signUpRoute from './signup.js';
import signInRoute from './signin.js';
import updatePasswordRoute from './updatePassword.js';
import updateRoleRoute from './updateRole.js';
import usersIndexRoute from './index.js';

// These tests use a real database: the point is what Sequelize actually
// serializes, which mocked models cannot show.
describe('password hash exposure', () => {
  let app;
  let admin;
  let member;
  let projectId;

  beforeAll(async () => {
    const sequelize = await createTestDatabase();
    app = express();
    app.use(express.json());
    app.use('/users', usersIndexRoute(sequelize));
    app.use('/users', updatePasswordRoute(sequelize));
    app.use('/users', updateRoleRoute(sequelize));
    app.use('/users', signUpRoute(sequelize));
    app.use('/users', signInRoute(sequelize));
    app.use('/members', membersIndexRoute(sequelize));

    // the first account becomes the administrator
    const signUp = (email) =>
      request(app).post('/users/signup').send({ email, password: 'password-1', username: email });
    admin = (await signUp('admin@example.com')).body.user;
    member = (await signUp('member@example.com')).body.user;

    const Project = defineProject(sequelize, DataTypes);
    const Member = defineMember(sequelize, DataTypes);
    const project = await Project.create({ name: 'project', isPublic: true, userId: admin.id });
    projectId = project.id;
    await Member.create({ userId: member.id, projectId, role: 2 });
  });

  it('stores a hash that the default scope does not load', async () => {
    const sequelize = await createTestDatabase();
    const User = defineUser(sequelize, DataTypes);
    await User.create({ email: 'a@example.com', password: 'hash', username: 'a', role: 1 });

    expect((await User.findOne()).toJSON()).not.toHaveProperty('password');
    expect((await User.scope('withPassword').findOne()).password).toBe('hash');
  });

  it('does not return the hash on sign up or sign in', async () => {
    expect(admin).not.toHaveProperty('password');

    const res = await request(app).post('/users/signin').send({ email: 'member@example.com', password: 'password-1' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('still rejects a wrong password on sign in', async () => {
    const res = await request(app).post('/users/signin').send({ email: 'member@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it.each(['true', 'false'])('does not return the hash in GET /members (includeOwner=%s)', async (includeOwner) => {
    const res = await request(app)
      .get('/members')
      .query({ projectId, includeOwner })
      .set('Authorization', bearerFor(member.id));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(includeOwner === 'true' ? 2 : 1);
    expect(res.text).not.toContain('password');
    for (const entry of res.body) {
      expect(Object.keys(entry.User).sort()).toEqual(['avatarPath', 'email', 'id', 'role', 'username']);
    }
  });

  it('does not return the hash in PUT /users/:userId/role', async () => {
    const res = await request(app)
      .put(`/users/${member.id}/role`)
      .set('Authorization', bearerFor(admin.id))
      .send({ newRole: 0 });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(member.id);
    expect(res.text).not.toContain('password');
  });

  it('does not return the hash in GET /users', async () => {
    const res = await request(app).get('/users').set('Authorization', bearerFor(admin.id));
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('password');
  });

  it('can still verify and change the current password', async () => {
    const change = (currentPassword) =>
      request(app)
        .put('/users/password')
        .set('Authorization', bearerFor(member.id))
        .send({ currentPassword, newPassword: 'password-2' });

    expect((await change('wrong')).status).toBe(401);
    expect((await change('password-1')).status).toBe(200);

    const res = await request(app).post('/users/signin').send({ email: 'member@example.com', password: 'password-2' });
    expect(res.status).toBe(200);
  });
});
