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

test('role provisioning, permissions, course enrollment, and assignment visibility work', async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const loginPage = await fetch(baseUrl);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /EduFlow — Sign In/);

  const unauthenticated = await fetch(`${baseUrl}/api/courses`);
  assert.equal(unauthenticated.status, 401);

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

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };
  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: adminHeaders
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, 'test-admin');

  const instructorResponse = await fetch(`${baseUrl}/api/instructors`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Test Instructor',
      email: 'instructor@example.com',
      password: 'instructor-password',
      department: 'Engineering'
    })
  });
  assert.equal(instructorResponse.status, 201);
  const instructorProfile = await instructorResponse.json();

  const instructorLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@example.com', password: 'instructor-password' })
  });
  assert.equal(instructorLogin.status, 200);
  const instructorData = await instructorLogin.json();
  assert.equal(instructorData.user.role, 'instructor');
  const instructorHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${instructorData.token}`
  };

  const forbiddenInstructorCreation = await fetch(`${baseUrl}/api/instructors`, {
    method: 'POST',
    headers: instructorHeaders,
    body: JSON.stringify({ name: 'Another Instructor', email: 'another@example.com', password: 'password-123' })
  });
  assert.equal(forbiddenInstructorCreation.status, 403);

  const forbiddenCourseCreation = await fetch(`${baseUrl}/api/courses`, {
    method: 'POST',
    headers: instructorHeaders,
    body: JSON.stringify({ title: 'Unauthorized Course' })
  });
  assert.equal(forbiddenCourseCreation.status, 403);

  const createdCourse = await fetch(`${baseUrl}/api/courses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Instructor Course', instructor: 'Test Instructor' })
  });
  assert.equal(createdCourse.status, 201);
  const course = await createdCourse.json();
  const publishedCourse = await fetch(`${baseUrl}/api/courses/${course.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'active' })
  });
  assert.equal(publishedCourse.status, 200);

  const secondCourseResponse = await fetch(`${baseUrl}/api/courses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Open Course' })
  });
  assert.equal(secondCourseResponse.status, 201);
  const secondCourse = await secondCourseResponse.json();
  const publishSecondCourse = await fetch(`${baseUrl}/api/courses/${secondCourse.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'active' })
  });
  assert.equal(publishSecondCourse.status, 200);

  const instructorCoursesResponse = await fetch(`${baseUrl}/api/courses`, { headers: instructorHeaders });
  assert.equal(instructorCoursesResponse.status, 200);
  assert.deepEqual((await instructorCoursesResponse.json()).map(item => item.id), [course.id]);

  const missingStudentCourse = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: instructorHeaders,
    body: JSON.stringify({
      name: 'Unassigned Student',
      email: 'unassigned@example.com',
      password: 'student-password'
    })
  });
  assert.equal(missingStudentCourse.status, 400);

  const createStudent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: instructorHeaders,
    body: JSON.stringify({
      name: 'Test Student',
      email: 'student@example.com',
      password: 'student-password',
      courseIds: [course.id]
    })
  });
  assert.equal(createStudent.status, 201);
  const student = await createStudent.json();
  assert.equal(student.enrolled_courses, 1);
  assert.equal(Object.hasOwn(student, 'password'), false);

  const studentLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@example.com', password: 'student-password' })
  });
  assert.equal(studentLogin.status, 200);
  const studentData = await studentLogin.json();
  assert.equal(studentData.user.role, 'student');
  const studentHeaders = { Authorization: `Bearer ${studentData.token}` };

  const studentProfile = await fetch(`${baseUrl}/api/students/me`, { headers: studentHeaders });
  assert.equal(studentProfile.status, 200);
  assert.equal((await studentProfile.json()).email, 'student@example.com');

  const studentCoursesResponse = await fetch(`${baseUrl}/api/courses`, { headers: studentHeaders });
  assert.equal(studentCoursesResponse.status, 200);
  const studentCourses = await studentCoursesResponse.json();
  assert.equal(studentCourses.length, 2);
  assert.equal(studentCourses.find(item => item.id === course.id).isEnrolled, true);
  assert.equal(studentCourses.find(item => item.id === secondCourse.id).isEnrolled, false);

  const selfEnrollment = await fetch(`${baseUrl}/api/courses/${secondCourse.id}/enroll`, {
    method: 'POST',
    headers: studentHeaders
  });
  assert.equal(selfEnrollment.status, 200);
  const duplicateSelfEnrollment = await fetch(`${baseUrl}/api/courses/${secondCourse.id}/enroll`, {
    method: 'POST',
    headers: studentHeaders
  });
  assert.equal(duplicateSelfEnrollment.status, 409);

  const instructorStudentsResponse = await fetch(`${baseUrl}/api/students`, { headers: instructorHeaders });
  assert.equal(instructorStudentsResponse.status, 200);
  assert.equal((await instructorStudentsResponse.json()).length, 1);
  const studentRosterResponse = await fetch(`${baseUrl}/api/students`, { headers: studentHeaders });
  assert.equal(studentRosterResponse.status, 403);

  const forbiddenAssignment = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: instructorHeaders,
    body: JSON.stringify({ title: 'Out of Scope Assignment', course_name: 'Open Course' })
  });
  assert.equal(forbiddenAssignment.status, 403);

  const createdAssignment = await fetch(`${baseUrl}/api/assignments`, {
    method: 'POST',
    headers: instructorHeaders,
    body: JSON.stringify({ title: 'First Assignment', course_name: 'Instructor Course' })
  });
  assert.equal(createdAssignment.status, 201);
  const studentAssignmentsResponse = await fetch(`${baseUrl}/api/assignments`, { headers: studentHeaders });
  assert.equal(studentAssignmentsResponse.status, 200);
  assert.equal((await studentAssignmentsResponse.json()).length, 1);

  const studentCreateAccount = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { ...studentHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Student',
      email: 'another-student@example.com',
      password: 'student-password'
    })
  });
  assert.equal(studentCreateAccount.status, 403);

  const studentAnalytics = await fetch(`${baseUrl}/api/analytics`, { headers: studentHeaders });
  assert.equal(studentAnalytics.status, 403);
  const adminAnalytics = await fetch(`${baseUrl}/api/analytics`, { headers: adminHeaders });
  assert.equal(adminAnalytics.status, 200);

  const disableInstructor = await fetch(`${baseUrl}/api/instructors/${instructorProfile.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'on-leave' })
  });
  assert.equal(disableInstructor.status, 200);
  const disabledInstructorLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@example.com', password: 'instructor-password' })
  });
  assert.equal(disabledInstructorLogin.status, 403);
  const disabledInstructorApi = await fetch(`${baseUrl}/api/courses`, { headers: instructorHeaders });
  assert.equal(disabledInstructorApi.status, 403);

  const unsafeTitleCourse = await fetch(`${baseUrl}/api/courses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: '<img src=x onerror=alert(1)>' })
  });
  assert.equal(unsafeTitleCourse.status, 201);
  const activityResponse = await fetch(`${baseUrl}/api/analytics`, { headers: adminHeaders });
  const activity = (await activityResponse.json()).recentActivity[0].text;
  assert.equal(activity, 'New course <img src=x onerror=alert(1)> created');
});
