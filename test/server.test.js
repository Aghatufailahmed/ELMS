const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'eduflow-test-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'eduflow-test-secret-0123456789-abcdefgh';
process.env.EDUFLOW_DB_FILE = path.join(testDirectory, 'db.json');

const { app } = require('../server');
const db = require('../config/db');

let server;
let baseUrl;
let adminToken;

before(async () => {
  db.get('users').push({
    id: 'test-admin',
    name: 'Test Admin',
    email: 'admin@eduflow.io',
    password: await bcrypt.hash('test-password-123', 10),
    role: 'admin',
    created_at: new Date().toISOString()
  }).write();

  await new Promise(resolve => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('authentication, protected registration, and authenticated API requests work', async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const loginPage = await fetch(baseUrl);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /EduFlow — Sign In/);

  const unauthenticated = await fetch(`${baseUrl}/api/courses`);
  assert.equal(unauthenticated.status, 401);

  const publicRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unexpected Admin',
      email: 'unexpected@example.com',
      password: 'password-123'
    })
  });
  assert.equal(publicRegistration.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ' ADMIN@EDUFLOW.IO ', password: 'test-password-123' })
  });
  assert.equal(login.status, 200);
  const loginData = await login.json();
  assert.equal(loginData.user.email, 'admin@eduflow.io');
  assert.equal(Object.hasOwn(loginData.user, 'password'), false);
  adminToken = loginData.token;

  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, 'test-admin');

  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: ' New User ',
      email: 'New@Example.com',
      password: 'password-123',
      role: 'owner'
    })
  });
  assert.equal(registration.status, 201);
  const registeredUser = await registration.json();
  assert.equal(registeredUser.user.name, 'New User');
  assert.equal(registeredUser.user.email, 'new@example.com');
  assert.equal(registeredUser.user.role, 'admin');
  assert.equal(Object.hasOwn(registeredUser.user, 'password'), false);

  const duplicateRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Duplicate User',
      email: 'NEW@example.com',
      password: 'password-123'
    })
  });
  assert.equal(duplicateRegistration.status, 400);

  const createdCourse = await fetch(`${baseUrl}/api/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ title: '<img src=x onerror=alert(1)>' })
  });
  assert.equal(createdCourse.status, 201);

  const analytics = await fetch(`${baseUrl}/api/analytics`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(analytics.status, 200);
  const activity = (await analytics.json()).recentActivity[0].text;
  assert.equal(activity, 'New course <img src=x onerror=alert(1)> created');
});
