// public/app.js — EduFlow LMS SPA Frontend Engine

// ── Auth Guard ──────────────────────────────────────
const token = localStorage.getItem('eduflow_token');

let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('eduflow_user')) || {}; } catch (_) { currentUser = {}; }

let rolePages = {
  admin: ['dashboard', 'courses', 'instructors', 'content', 'students', 'assignments', 'analytics', 'settings'],
  instructor: ['dashboard', 'courses', 'content', 'students', 'assignments', 'settings'],
  student: ['dashboard', 'courses', 'assignments', 'settings']
};
let allowedPages = rolePages[currentUser.role] || rolePages.student;

// ── Init user display ───────────────────────────────
function initUser() {
  const name = currentUser.name || 'User';
  const role = (currentUser.role || 'student').toUpperCase();
  const initials = name
    .split(' ')
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AD';

  const sName = document.getElementById('sidebar-user-name');
  const sRole = document.getElementById('sidebar-user-role');
  const sAvatar = document.getElementById('sidebar-user-avatar');
  const tAvatar = document.getElementById('topbar-user-avatar');
  const setAvatar = document.getElementById('settings-avatar');
  const setName = document.getElementById('settings-name');
  const setRole = document.getElementById('settings-role');
  const setEmail = document.getElementById('settings-email-display');

  if (sName) sName.textContent = name;
  if (sRole) sRole.textContent = role;
  if (sAvatar) sAvatar.textContent = initials;
  if (tAvatar) tAvatar.textContent = initials;
  if (setAvatar) setAvatar.textContent = initials;
  if (setName) setName.textContent = name;
  if (setRole) setRole.textContent = role;
  if (setEmail) setEmail.textContent = currentUser.email || '';

  document.querySelectorAll('.nav-item').forEach(item => {
    item.hidden = !allowedPages.includes(item.dataset.page);
  });
  document.querySelectorAll('.page').forEach(page => {
    page.hidden = !allowedPages.includes(page.id.replace('page-', ''));
  });
  const addInstructorButton = document.querySelector('#page-instructors .page-toolbar > button');
  if (addInstructorButton) addInstructorButton.hidden = currentUser.role !== 'admin';
  const addStudentButton = document.querySelector('#page-students .page-toolbar > button');
  if (addStudentButton) addStudentButton.hidden = !['admin', 'instructor'].includes(currentUser.role);
  const addCourseButton = document.querySelector('#page-courses .page-toolbar > button');
  if (addCourseButton) addCourseButton.hidden = currentUser.role !== 'admin';
  const studentStatusFilter = document.getElementById('student-filter-status');
  if (studentStatusFilter) studentStatusFilter.hidden = currentUser.role !== 'admin';
  const studentStatusHeader = document.querySelector('#page-students th:nth-child(6)');
  if (studentStatusHeader) studentStatusHeader.hidden = currentUser.role !== 'admin';
  const instructorStatusFilter = document.getElementById('instructor-filter-status');
  if (instructorStatusFilter) instructorStatusFilter.hidden = currentUser.role !== 'admin';
  const instructorBioHeader = document.querySelector('#page-instructors th:nth-child(4)');
  const instructorStatusHeader = document.querySelector('#page-instructors th:nth-child(6)');
  const instructorJoinedHeader = document.querySelector('#page-instructors th:nth-child(7)');
  if (instructorBioHeader) instructorBioHeader.hidden = currentUser.role !== 'admin';
  if (instructorStatusHeader) instructorStatusHeader.hidden = currentUser.role !== 'admin';
  if (instructorJoinedHeader) instructorJoinedHeader.hidden = currentUser.role !== 'admin';
  const addAssignmentButton = document.querySelector('#page-assignments .page-toolbar > button');
  if (addAssignmentButton) addAssignmentButton.hidden = currentUser.role === 'student';
  const courseStatusFilter = document.getElementById('course-filter-status');
  if (courseStatusFilter) courseStatusFilter.hidden = currentUser.role !== 'admin';
}

// ── API Helper ──────────────────────────────────────
async function api(path, options = {}) {
  const currentToken = localStorage.getItem('eduflow_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { Authorization: 'Bearer ' + currentToken } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  };

  const res = await fetch('/api' + path, config);
  if (res.status === 401) {
    localStorage.removeItem('eduflow_token');
    localStorage.removeItem('eduflow_user');
    window.location.href = '/';
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'API request failed');
  }
  return data;
}

// ── Toast notification ───────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + (type === 'error' ? 'error' : '');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// ── Logout ───────────────────────────────────────────
function logout() {
  localStorage.removeItem('eduflow_token');
  localStorage.removeItem('eduflow_user');
  window.location.href = '/';
}

// ── Sidebar Mobile Toggle ────────────────────────────
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  if (s) s.classList.toggle('open');
}
function closeSidebar() {
  const s = document.getElementById('sidebar');
  if (s) s.classList.remove('open');
}

// ── Navigation ──────────────────────────────────────
function navigate(pageId) {
  if (!allowedPages.includes(pageId)) return;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

  const navEl = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  const pageEl = document.getElementById(`page-${pageId}`);

  if (navEl) navEl.classList.add('active');
  if (pageEl) pageEl.classList.add('active');

  const titles = {
    dashboard:   'Dashboard',
    courses:     'Courses',
    instructors: 'Faculty & Instructors',
    content:     'Content Editor',
    students:    'Students',
    assignments: 'Assignments',
    analytics:   'Analytics',
    settings:    'Settings'
  };

  const titleText = titles[pageId] || 'Dashboard';
  const pTitle = document.getElementById('pageTitle');
  const bCurrent = document.getElementById('breadcrumb-current');
  if (pTitle) pTitle.textContent = titleText;
  if (bCurrent) bCurrent.textContent = titleText;

  if (window.innerWidth <= 900) closeSidebar();

  // Trigger page load
  if (pageId === 'dashboard')   loadDashboard();
  if (pageId === 'courses')     loadCourses();
  if (pageId === 'instructors') loadInstructors();
  if (pageId === 'students')    loadStudents();
  if (pageId === 'assignments') loadAssignments();
  if (pageId === 'analytics')   loadAnalytics();
  if (pageId === 'content')     loadContentEditor();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// ── Loaders: Dashboard ──────────────────────────────
async function loadDashboard() {
  if (currentUser.role === 'student') return loadStudentDashboard();
  if (currentUser.role === 'instructor') return loadInstructorDashboard();

  try {
    const [analytics, courses] = await Promise.all([
      api('/analytics'),
      api('/courses')
    ]);

    // Stats
    const totalCoursesEl = document.getElementById('stat-total-courses');
    const totalStudentsEl = document.getElementById('stat-total-students');
    const completionEl = document.getElementById('stat-completion-rate');
    const pendingEl = document.getElementById('stat-pending-reviews');
    const subCoursesEl = document.getElementById('stat-courses-sub');

    if (totalCoursesEl) totalCoursesEl.textContent = analytics.totalCourses;
    if (totalStudentsEl) totalStudentsEl.textContent = analytics.totalStudents;
    if (completionEl) completionEl.textContent = analytics.completionRate + '%';
    if (pendingEl) pendingEl.textContent = analytics.pendingReviews;
    if (subCoursesEl) subCoursesEl.textContent = `${courses.filter(c => c.status === 'active').length} active now`;

    // Recent Courses Table (top 5)
    const tbody = document.getElementById('recent-courses-tbody');
    if (tbody) {
      if (!courses || courses.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No courses created yet.</td></tr>';
      } else {
        tbody.innerHTML = courses.slice(0, 5).map(c => {
          const statusClass = c.status === 'active' ? 'badge-active' : (c.status === 'in-review' ? 'badge-review' : 'badge-draft');
          const statusLabel = c.status === 'in-review' ? 'In Review' : (c.status.charAt(0).toUpperCase() + c.status.slice(1));
          return `
            <tr>
              <td><strong>${escapeHtml(c.title)}</strong></td>
              <td>${escapeHtml(c.instructor || 'Unassigned')}</td>
              <td>${c.lessons || 0} Lessons</td>
              <td${currentUser.role === 'admin' ? '' : ' hidden'}><span class="badge ${statusClass}">${statusLabel}</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // Activity feed
    const actList = document.getElementById('activity-list');
    if (actList) {
      if (!analytics.recentActivity || analytics.recentActivity.length === 0) {
        actList.innerHTML = '<li class="activity-item"><div class="activity-text">No recent activity.</div></li>';
      } else {
        actList.innerHTML = analytics.recentActivity.map(a => `
          <li class="activity-item">
            <div class="activity-dot"></div>
            <div>
              <p class="activity-text">${renderActivity(a.text)}</p>
              <span class="activity-time">${escapeHtml(a.time)}</span>
            </div>
          </li>
        `).join('');
      }
    }

    // Progress list
    const progList = document.getElementById('progress-list');
    if (progList) {
      const activeCourses = courses.filter(c => c.status === 'active');
      if (activeCourses.length === 0) {
        progList.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">No active courses to display.</p>';
      } else {
        progList.innerHTML = activeCourses.slice(0, 5).map(c => {
          const pct = Number(c.completionRate) || 0;
          return `
            <div class="progress-row">
              <span class="progress-label">${escapeHtml(c.title)}</span>
              <div class="progress-bar-wrap">
                <div class="progress-bar" style="width: ${pct}%"></div>
              </div>
              <span class="progress-pct">${pct}%</span>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadStudentDashboard() {
  try {
    const [student, courses, assignments] = await Promise.all([
      api('/students/me'),
      api('/courses'),
      api('/assignments')
    ]);
    const enrolledCourses = courses.filter(course => course.isEnrolled);
    const progress = student.progress || 0;
    setDashboardStat(1, 'Available Courses', courses.length, 'Explore active courses');
    setDashboardStat(2, 'My Courses', enrolledCourses.length, 'Courses you joined');
    setDashboardStat(3, 'My Progress', `${progress}%`, 'Your learning progress');
    setDashboardStat(4, 'My Assignments', assignments.length, 'For your enrolled courses');
    renderDashboardCourses(enrolledCourses);
    renderDashboardMessage(`Welcome, ${student.name}. Browse courses to continue learning.`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadInstructorDashboard() {
  try {
    const [courses, students, assignments] = await Promise.all([
      api('/courses'),
      api('/students'),
      api('/assignments')
    ]);
    const averageProgress = courses.length
      ? Math.round(courses.reduce((total, course) => total + (course.completionRate || 0), 0) / courses.length)
      : 0;
    const pending = assignments.reduce((total, assignment) => total + (assignment.pending || 0), 0);
    setDashboardStat(1, 'My Courses', courses.length, 'Courses assigned to you');
    setDashboardStat(2, 'My Students', students.length, 'Enrolled in your courses');
    setDashboardStat(3, 'Average Progress', `${averageProgress}%`, 'Across your courses');
    setDashboardStat(4, 'Pending Submissions', pending, 'Awaiting review');
    renderDashboardCourses(courses);
    renderDashboardMessage(`Welcome, ${currentUser.name}. Manage your courses and students here.`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setDashboardStat(index, label, value, sub) {
  const card = document.querySelector(`#page-dashboard .stat-card:nth-child(${index})`);
  if (!card) return;
  card.querySelector('.stat-label').textContent = label;
  card.querySelector('.stat-value').textContent = value;
  card.querySelector('.stat-sub').textContent = sub;
}

function renderDashboardCourses(courses) {
  const tbody = document.getElementById('recent-courses-tbody');
  if (!tbody) return;
  tbody.innerHTML = courses.length ? courses.slice(0, 5).map(course => `
    <tr>
      <td><strong>${escapeHtml(course.title)}</strong></td>
      <td>${escapeHtml(course.instructor || 'Unassigned')}</td>
      <td>${course.lessons || 0} Lessons</td>
      <td>${course.isEnrolled ? 'Enrolled' : escapeHtml(course.status || 'active')}</td>
    </tr>
  `).join('') : '<tr class="empty-row"><td colspan="4">No courses yet.</td></tr>';
}

function renderDashboardMessage(message) {
  const activity = document.getElementById('activity-list');
  const progress = document.getElementById('progress-list');
  if (activity) activity.innerHTML = `<li class="activity-item"><div class="activity-text">${escapeHtml(message)}</div></li>`;
  if (progress) progress.innerHTML = '<p style="color:var(--text-dim);font-size:13px;">Your course progress will appear here.</p>';
}

// ── Loaders: Courses ────────────────────────────────
let allCourses = [];
async function loadCourses() {
  try {
    allCourses = await api('/courses');
    renderCourses(allCourses);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterCourses() {
  const cat = document.getElementById('course-filter-cat')?.value || '';
  const status = document.getElementById('course-filter-status')?.value || '';

  let filtered = allCourses;
  if (cat) filtered = filtered.filter(c => c.category === cat);
  if (status) filtered = filtered.filter(c => c.status === status);

  renderCourses(filtered);
}

function renderCourses(courses) {
  const grid = document.getElementById('courses-grid');
  if (!grid) return;

  if (courses.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-dim);">No courses found.</div>';
    return;
  }

  grid.innerHTML = courses.map(c => {
    const statusClass = c.status === 'active' ? 'badge-active' : (c.status === 'in-review' ? 'badge-review' : 'badge-draft');
    const statusLabel = c.status === 'in-review' ? 'In Review' : (c.status.charAt(0).toUpperCase() + c.status.slice(1));
    return `
      <div class="course-card glass" data-id="${c.id}">
        <div class="course-card-top">
          <span class="badge ${statusClass}">${statusLabel}</span>
          <span class="course-level">${escapeHtml(c.level || 'Beginner')}</span>
        </div>
        <h3 class="course-title">${escapeHtml(c.title)}</h3>
        <p class="course-instructor">${escapeHtml(c.instructor || 'Unassigned')}</p>
        <p class="course-desc">${escapeHtml(c.description || 'No description provided.')}</p>
        <div class="course-meta">
          <span>${c.lessons || 0} Lessons</span>
          <span>${c.enrolledStudents || 0} Students</span>
          <span>${escapeHtml(c.duration || 'Self-paced')}</span>
        </div>
        ${currentUser.role === 'student' && c.isEnrolled ? `
          <div class="mini-progress"><div class="mini-bar" style="width:${Math.max(0, Math.min(100, Number(c.progress) || 0))}%"></div></div>
          <small>${Math.max(0, Math.min(100, Number(c.progress) || 0))}% complete</small>` : ''}
        <div class="course-actions">
          ${currentUser.role === 'student'
            ? (c.isEnrolled
              ? `<button class="btn-outline btn-sm" onclick="openStudentCourse('${c.id}')">View Lessons</button>`
              : `<button class="btn-primary btn-sm" onclick="enrollCourse('${c.id}')">Enroll</button>`)
            : currentUser.role === 'admin'
              ? `<button class="btn-outline btn-sm" onclick="toggleCourseStatus('${c.id}')">${c.status === 'active' ? 'Unpublish' : 'Publish'}</button>
                 <button class="btn-outline btn-sm" onclick="openCourseEditor('${c.id}')">Edit Lessons</button>
                 <button class="btn-danger btn-sm" onclick="deleteCourse('${c.id}')">Delete</button>`
              : `<button class="btn-outline btn-sm" onclick="openCourseEditor('${c.id}')">Edit Lessons</button>`}
        </div>
      </div>
    `;
  }).join('');
}

async function openCourseEditor(id) {
  navigate('content');
  await loadContentEditor();
  const select = document.getElementById('content-course-select');
  select.value = id;
  await loadCourseContent();
}

async function openStudentCourse(id) {
  try {
    const course = await api(`/courses/${id}`);
    const completed = new Set(course.completedLessonIds || []);
    document.getElementById('modalTitle').textContent = course.title;
    document.getElementById('modalBody').innerHTML = course.lessons.length
      ? course.lessons.map(lesson => `
        <article class="glass panel" style="margin-bottom:12px;padding:16px;">
          <h3>${escapeHtml(lesson.title)}</h3>
          <p>${escapeHtml(lesson.description || '')}</p>
          <pre style="white-space:pre-wrap;margin:12px 0;">${escapeHtml(lesson.content || 'No lesson content yet.')}</pre>
          <button class="${completed.has(lesson.id) ? 'btn-outline' : 'btn-primary'} btn-sm"
            onclick="completeLesson('${course.id}','${lesson.id}')">${completed.has(lesson.id) ? 'Completed' : 'Mark Complete'}</button>
        </article>`).join('')
      : '<p>This course does not have any lessons yet.</p>';
    document.getElementById('modalOverlay').classList.add('open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function completeLesson(courseId, lessonId) {
  try {
    await api(`/courses/${courseId}/lessons/${lessonId}/complete`, { method: 'POST' });
    showToast('Lesson marked complete');
    await openStudentCourse(courseId);
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function enrollCourse(id) {
  try {
    await api(`/courses/${id}/enroll`, { method: 'POST' });
    showToast('You are enrolled in this course');
    await loadCourses();
    if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleCourseStatus(id) {
  const course = allCourses.find(item => item.id === id);
  if (!course) return;
  const status = course.status === 'active' ? 'draft' : 'active';
  try {
    await api(`/courses/${id}`, { method: 'PUT', body: { status } });
    showToast(status === 'active' ? 'Course published' : 'Course unpublished');
    await loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCourse(id) {
  if (!confirm('Are you sure you want to delete this course?')) return;
  try {
    await api('/courses/' + id, { method: 'DELETE' });
    showToast('Course deleted');
    loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Loaders: Instructors ────────────────────────────
let allInstructors = [];
async function loadInstructors() {
  try {
    allInstructors = await api('/instructors');
    renderInstructors(allInstructors);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterInstructors() {
  const status = document.getElementById('instructor-filter-status')?.value || '';
  const search = (document.getElementById('instructor-search-input')?.value || '').trim().toLowerCase();
  let filtered = allInstructors;
  if (status) {
    filtered = filtered.filter(i => i.status === status);
  }
  if (search) {
    filtered = filtered.filter(i =>
      (i.name && i.name.toLowerCase().includes(search)) ||
      (i.department && i.department.toLowerCase().includes(search)) ||
      (i.email && i.email.toLowerCase().includes(search))
    );
  }
  renderInstructors(filtered);
}

function renderInstructors(instructors) {
  const tbody = document.getElementById('instructors-tbody');
  if (!tbody) return;

  if (instructors.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8" style="text-align:center;padding:36px;color:var(--text-dim);">No instructors found. Click "+ Add Instructor" to add faculty members.</td></tr>';
    return;
  }

  tbody.innerHTML = instructors.map(inst => {
    const initials = (inst.name || 'IN').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const statusClass = inst.status === 'active' ? 'badge-active' : 'badge-draft';
    const statusLabel = inst.status === 'on-leave' ? 'On Leave' : 'Active';
    const joinedDate = inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'Recently';

    return `
      <tr>
        <td>
          <div class="avatar-name">
            <div class="mini-avatar">${initials}</div>
            <div>
              <strong>${escapeHtml(inst.name)}</strong>
            </div>
          </div>
        </td>
        <td><a href="mailto:${escapeHtml(inst.email)}" style="color:var(--text-primary);text-decoration:none;">${escapeHtml(inst.email)}</a></td>
        <td><span class="badge" style="background:rgba(15,23,42,0.06);color:var(--text-primary);">${escapeHtml(inst.department || 'General Faculty')}</span></td>
        <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-muted);font-size:12px;" title="${escapeHtml(inst.bio || '')}">${escapeHtml(inst.bio || '—')}</td>
        <td><strong>${inst.coursesCount || 0}</strong> Course(s)</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td style="color:var(--text-muted);font-size:12px;">${joinedDate}</td>
        <td>
          <button class="btn-outline btn-sm" onclick="toggleInstructorStatus('${inst.id}')">${inst.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
          <button class="btn-danger btn-sm" onclick="deleteInstructor('${inst.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleInstructorStatus(id) {
  const instructor = allInstructors.find(item => item.id === id);
  if (!instructor) return;
  const status = instructor.status === 'active' ? 'on-leave' : 'active';
  try {
    await api(`/instructors/${id}`, { method: 'PUT', body: { status } });
    showToast(status === 'active' ? 'Instructor access restored' : 'Instructor access suspended');
    await loadInstructors();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteInstructor(id) {
  if (!confirm('Are you sure you want to remove this instructor?')) return;
  try {
    await api('/instructors/' + id, { method: 'DELETE' });
    showToast('Instructor removed successfully');
    loadInstructors();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Loaders: Students ───────────────────────────────
let allStudents = [];
async function loadStudents() {
  try {
    allStudents = await api('/students');
    renderStudents(allStudents);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterStudents() {
  const status = document.getElementById('student-filter-status')?.value || '';
  let filtered = allStudents;
  if (status) filtered = filtered.filter(s => s.status === status);
  renderStudents(filtered);
}

function renderStudents(students) {
  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No students registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(s => {
    const initials = s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
    const statusClass = s.status === 'active' ? 'badge-active' : (s.status === 'completed' ? 'badge-draft' : 'badge-review');
    const statusLabel = s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Active';
    return `
      <tr>
        <td>
          <div class="avatar-name">
            <div class="mini-avatar">${initials}</div>
            ${escapeHtml(s.name)}
          </div>
        </td>
        <td>${escapeHtml(s.email)}</td>
        <td>${s.enrolled_courses || 1}</td>
        <td>
          <div class="mini-progress">
            <div class="mini-bar" style="width: ${s.progress || 0}%"></div>
          </div>
        </td>
        <td>${s.joined_at || 'Recently'}</td>
        <td${currentUser.role === 'admin' ? '' : ' hidden'}><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>${currentUser.role === 'admin' ? `
          <button class="btn-outline btn-sm" onclick="toggleStudentStatus('${s.id}')">${s.status === 'inactive' ? 'Activate' : 'Suspend'}</button>
          <button class="btn-danger btn-sm" onclick="deleteStudent('${s.id}')">Delete</button>` : ''}</td>
      </tr>
    `;
  }).join('');
}

async function toggleStudentStatus(id) {
  const student = allStudents.find(item => item.id === id);
  if (!student) return;
  const status = student.status === 'inactive' ? 'active' : 'inactive';
  try {
    await api(`/students/${id}`, { method: 'PUT', body: { status } });
    showToast(status === 'active' ? 'Student account activated' : 'Student account suspended');
    await loadStudents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteStudent(id) {
  if (!confirm('Are you sure you want to remove this student?')) return;
  try {
    await api('/students/' + id, { method: 'DELETE' });
    showToast('Student removed');
    loadStudents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Loaders: Assignments ────────────────────────────
let allAssignments = [];
async function loadAssignments() {
  try {
    allAssignments = await api('/assignments');
    renderAssignments(allAssignments);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterAssignments() {
  const type = document.getElementById('asgn-filter-type')?.value || '';
  let filtered = allAssignments;
  if (type) filtered = filtered.filter(a => a.type === type);
  renderAssignments(filtered);
}

function renderAssignments(assignments) {
  const list = document.getElementById('assignments-list');
  if (!list) return;

  if (assignments.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-dim);">No assignments scheduled.</div>';
    return;
  }

  list.innerHTML = assignments.map(a => {
    let typeClass = '';
    if (a.type === 'Assignment') typeClass = 'asgn-assignment';
    else if (a.type === 'Project') typeClass = 'asgn-project';
    const submission = a.mySubmission;
    const action = currentUser.role === 'student'
      ? `<div><span class="badge ${submission && submission.score !== undefined ? 'badge-active' : 'badge-review'}">${
          submission && submission.score !== undefined ? `Graded: ${submission.score}/${a.max_points}` : submission ? 'Submitted' : 'Not submitted'
        }</span>
        ${submission && submission.score !== undefined ? `<p>${escapeHtml(submission.feedback || '')}</p>` : ''}
        ${!submission || submission.score === undefined ? `<button class="btn-primary btn-sm" onclick="openSubmissionForm('${a.id}')">${submission ? 'Update Submission' : 'Submit'}</button>` : ''}
      </div>`
      : currentUser.role === 'instructor'
        ? `<button class="btn-outline btn-sm" onclick="openAssignmentReview('${a.id}')">Review (${(a.submissions || []).filter(item => item.score === undefined).length})</button>`
        : `<button class="btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">Delete</button>`;

    return `
      <div class="glass assignment-row" data-id="${a.id}">
        <div class="asgn-info">
          <span class="asgn-type-tag ${typeClass}">${escapeHtml(a.type)}</span>
          <div>
            <h3 class="asgn-title">${escapeHtml(a.title)}</h3>
            <p class="asgn-course">${escapeHtml(a.course_name || 'General Course')}</p>
          </div>
        </div>
        <div class="asgn-stats">
          <div class="asgn-stat">
            <span class="asgn-stat-val">${currentUser.role === 'student' ? a.max_points : (a.submitted || 0)}</span>
            <span class="asgn-stat-label">${currentUser.role === 'student' ? 'Points possible' : 'Submitted'}</span>
          </div>
          <div class="asgn-stat">
            <span class="asgn-stat-val">${currentUser.role === 'student'
              ? (submission && submission.score !== undefined ? submission.score : '—')
              : (a.pending || 0)}</span>
            <span class="asgn-stat-label">${currentUser.role === 'student' ? 'My score' : 'Awaiting review'}</span>
          </div>
          <div class="asgn-stat">
            <span class="asgn-stat-val">${currentUser.role === 'student'
              ? (submission && submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : '—')
              : (a.submissions || []).filter(item => item.score !== undefined).length}</span>
            <span class="asgn-stat-label">${currentUser.role === 'student' ? 'Submitted' : 'Graded'}</span>
          </div>
        </div>
        <div class="asgn-due">
          <span class="due-label">Due Date</span>
          <span class="due-date">${a.due_date || 'Flexible'}</span>
        </div>
        ${action}
      </div>
    `;
  }).join('');
}

function openSubmissionForm(id) {
  const assignment = allAssignments.find(item => item.id === id);
  if (!assignment) return;
  document.getElementById('modalTitle').textContent = `Submit: ${assignment.title}`;
  document.getElementById('modalBody').innerHTML = `
    <form onsubmit="submitAssignment(event,'${assignment.id}')">
      <div class="modal-field">
        <label for="submission-answer">Your answer *</label>
        <textarea class="glass-textarea" id="submission-answer" rows="10" maxlength="20000" required>${escapeHtml(assignment.mySubmission?.answer || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Submit Assignment</button>
      </div>
    </form>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function submitAssignment(event, id) {
  event.preventDefault();
  try {
    await api(`/assignments/${id}/submissions`, {
      method: 'POST',
      body: { answer: document.getElementById('submission-answer').value }
    });
    closeModal();
    showToast('Assignment submitted');
    await loadAssignments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAssignmentReview(id) {
  const assignment = allAssignments.find(item => item.id === id);
  if (!assignment) return;
  document.getElementById('modalTitle').textContent = `Submissions: ${assignment.title}`;
  const submissions = assignment.submissions || [];
  document.getElementById('modalBody').innerHTML = submissions.length
    ? submissions.map(item => `
      <form class="glass panel" style="padding:16px;margin-bottom:12px;" onsubmit="gradeSubmission(event,'${assignment.id}','${item.studentId}')">
        <strong>${escapeHtml(item.studentName)}</strong>
        <p style="white-space:pre-wrap;margin:10px 0;">${escapeHtml(item.answer)}</p>
        <div class="modal-field">
          <label>Score (out of ${assignment.max_points})</label>
          <input class="glass-input full-w" type="number" name="score" min="0" max="${assignment.max_points}" value="${item.score ?? ''}" required />
        </div>
        <div class="modal-field">
          <label>Feedback</label>
          <textarea class="glass-textarea" name="feedback" rows="2">${escapeHtml(item.feedback || '')}</textarea>
        </div>
        <button class="btn-primary btn-sm" type="submit">Save Grade</button>
      </form>`).join('')
    : '<p>No submissions yet.</p>';
  document.getElementById('modalOverlay').classList.add('open');
}

async function gradeSubmission(event, assignmentId, studentId) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api(`/assignments/${assignmentId}/submissions/${studentId}`, {
      method: 'PUT',
      body: {
        score: Number(form.elements.score.value),
        feedback: form.elements.feedback.value
      }
    });
    showToast('Grade saved');
    await loadAssignments();
    openAssignmentReview(assignmentId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAssignment(id) {
  if (!confirm('Are you sure you want to delete this assignment?')) return;
  try {
    await api('/assignments/' + id, { method: 'DELETE' });
    showToast('Assignment deleted');
    loadAssignments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Loaders: Analytics ──────────────────────────────
async function loadAnalytics() {
  try {
    const data = await api('/analytics');

    // Stats
    const revEl = document.getElementById('stat-revenue');
    const timeEl = document.getElementById('stat-avg-time');
    const passEl = document.getElementById('stat-quiz-pass');
    const dropEl = document.getElementById('stat-dropoff');

    if (revEl) revEl.textContent = data.revenue === null ? '—' : '$' + Number(data.revenue || 0).toLocaleString();
    if (timeEl) timeEl.textContent = data.avgTime || '—';
    if (passEl) passEl.textContent = `${data.quizPassRate}%`;
    if (dropEl) dropEl.textContent = `${data.dropoffRate}%`;

    // Bar chart
    const chartEl = document.getElementById('bar-chart');
    if (chartEl && data.monthlyEnrollments) {
      const counts = data.monthlyEnrollments.map(m => m.count);
      const max = Math.max(...counts, 1);

      chartEl.innerHTML = data.monthlyEnrollments.map((m, idx) => {
        const heightPct = m.count ? Math.round((m.count / max) * 100) : 0;
        const isLast = idx === data.monthlyEnrollments.length - 1;
        return `
          <div class="bar-group">
            <div class="bar ${isLast ? 'bar-active' : ''}" style="height:${heightPct}%" title="${m.month}: ${m.count}"></div>
            <span class="bar-label">${m.month}</span>
          </div>
        `;
      }).join('');
    }

    // Donut Legend
    const legendEl = document.getElementById('donut-legend');
    const segmentsEl = document.getElementById('donut-segments');
    if (legendEl && data.categoryBreakdown) {
      const colors = ['#0f172a', '#2563eb', '#0d9488', '#d97706', '#9333ea', '#dc2626'];
      const circumference = 2 * Math.PI * 45;
      let offset = 0;
      if (segmentsEl) {
        segmentsEl.innerHTML = data.categoryBreakdown.map((cat, i) => {
          const length = circumference * cat.pct / 100;
          const segment = `<circle cx="60" cy="60" r="45" fill="none" stroke="${colors[i % colors.length]}" stroke-width="20" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"/>`;
          offset += length;
          return segment;
        }).join('');
      }
      legendEl.innerHTML = data.categoryBreakdown.map((cat, i) => {
        return `
          <div class="legend-row">
            <span class="legend-dot" style="background:${colors[i % colors.length]}"></span>
            ${escapeHtml(cat.category)} — ${cat.pct}%
          </div>
        `;
      }).join('');
    }

    // Top Courses Table
    const topTbody = document.getElementById('top-courses-tbody');
    if (topTbody && data.topCourses) {
      if (data.topCourses.length === 0) {
        topTbody.innerHTML = '<tr class="empty-row"><td colspan="6">No top courses recorded yet.</td></tr>';
      } else {
        topTbody.innerHTML = data.topCourses.map(c => `
          <tr>
            <td><strong>${escapeHtml(c.title)}</strong></td>
            <td>${c.students}</td>
            <td>
              <div class="mini-progress">
                <div class="mini-bar" style="width: ${c.completion}%"></div>
              </div>
            </td>
            <td>${c.avgScore == null ? '—' : c.avgScore + '%'}</td>
            <td>${c.revenue == null ? '—' : '$' + Number(c.revenue).toLocaleString()}</td>
            <td>${c.rating == null ? '—' : c.rating + ' / 5'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Modals & Creation ────────────────────────────────
const modalTemplates = {
  addCourse: {
    title: 'New Course',
    html: `
      <form id="formAddCourse" onsubmit="handleCreateCourse(event)">
        <div class="modal-field">
          <label>Course Title *</label>
          <input class="glass-input full-w" id="nc-title" type="text" placeholder="e.g. Modern Fullstack Web Development" required />
        </div>
        <div class="modal-field">
          <label>Instructor *</label>
          <input class="glass-input full-w" id="nc-instructor" list="instructor-datalist" type="text" placeholder="Select or type instructor name" required />
          <datalist id="instructor-datalist"></datalist>
        </div>
        <div class="modal-field">
          <label>Category</label>
          <select class="glass-select full-w" id="nc-category">
            <option>Programming</option>
            <option>Design</option>
            <option>Marketing</option>
            <option>Data Science</option>
            <option>Business</option>
          </select>
        </div>
        <div class="modal-field">
          <label>Level</label>
          <select class="glass-select full-w" id="nc-level">
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
        <div class="modal-field">
          <label>Duration</label>
          <input class="glass-input full-w" id="nc-duration" type="text" placeholder="e.g. 6 Weeks" />
        </div>
        <div class="modal-field">
          <label>Short Description</label>
          <textarea class="glass-textarea" id="nc-description" rows="3" placeholder="Brief overview of course curriculum…"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Create Course</button>
        </div>
      </form>
    `
  },
  addInstructor: {
    title: 'Add Instructor',
    html: `
      <form id="formAddInstructor" onsubmit="handleCreateInstructor(event)">
        <div class="modal-field">
          <label>Full Name *</label>
          <input class="glass-input full-w" id="ni-name" type="text" placeholder="e.g. Dr. Sarah Jenkins" required />
        </div>
        <div class="modal-field">
          <label>Email Address *</label>
          <input class="glass-input full-w" id="ni-email" type="email" placeholder="e.g. s.jenkins@eduflow.io" required />
        </div>
        <div class="modal-field">
          <label>Initial Password * (at least 8 characters)</label>
          <input class="glass-input full-w" id="ni-password" type="password" minlength="8" autocomplete="new-password" required />
        </div>
        <div class="modal-field">
          <label>Department / Specialization</label>
          <input class="glass-input full-w" id="ni-department" type="text" placeholder="e.g. Computer Science, AI, Design" />
        </div>
        <div class="modal-field">
          <label>Bio / Profile Summary</label>
          <textarea class="glass-textarea" id="ni-bio" rows="3" placeholder="Brief background, certifications, or teaching focus…"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Add Instructor</button>
        </div>
      </form>
    `
  },
  addStudent: {
    title: 'Add Student',
    html: `
      <form id="formAddStudent" onsubmit="handleCreateStudent(event)">
        <div class="modal-field">
          <label>Full Name *</label>
          <input class="glass-input full-w" id="ns-name" type="text" placeholder="Student name" required />
        </div>
        <div class="modal-field">
          <label>Email Address *</label>
          <input class="glass-input full-w" id="ns-email" type="email" placeholder="student@example.com" required />
        </div>
        <div class="modal-field">
          <label>Initial Password * (at least 8 characters)</label>
          <input class="glass-input full-w" id="ns-password" type="password" minlength="8" autocomplete="new-password" required />
        </div>
        <div class="modal-field">
          <label>Enroll in Courses (optional)</label>
          <select class="glass-select full-w" id="ns-courseIds" multiple size="4"></select>
          <small>Select multiple courses with Ctrl (Windows) or Command (Mac).</small>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Add Student</button>
        </div>
      </form>
    `
  },
  addAssignment: {
    title: 'New Assignment',
    html: `
      <form id="formAddAssignment" onsubmit="handleCreateAssignment(event)">
        <div class="modal-field">
          <label>Title *</label>
          <input class="glass-input full-w" id="na-title" type="text" placeholder="e.g. Midterm Project" required />
        </div>
        <div class="modal-field">
          <label>Type</label>
          <select class="glass-select full-w" id="na-type">
            <option>Assignment</option>
            <option>Quiz</option>
            <option>Project</option>
          </select>
        </div>
        <div class="modal-field">
          <label>Course *</label>
          <select class="glass-select full-w" id="na-courseId" required></select>
        </div>
        <div class="modal-field">
          <label>Due Date</label>
          <input class="glass-input full-w" id="na-due" type="date" />
        </div>
        <div class="modal-field">
          <label>Max Points</label>
          <input class="glass-input full-w" id="na-points" type="number" min="1" max="10000" value="100" required />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Create Assignment</button>
        </div>
      </form>
    `
  }
};

async function openModal(type) {
  const tmpl = modalTemplates[type];
  if (!tmpl) return;
  document.getElementById('modalTitle').textContent = tmpl.title;
  document.getElementById('modalBody').innerHTML = tmpl.html;
  document.getElementById('modalOverlay').classList.add('open');

  if (type === 'addCourse' || type === 'addStudent' || type === 'addAssignment') {
    try {
      if (type === 'addCourse' && (!allInstructors || allInstructors.length === 0)) {
        allInstructors = await api('/instructors');
      }
      if (type === 'addCourse') {
        const dl = document.getElementById('instructor-datalist');
        if (dl && allInstructors && allInstructors.length > 0) {
          dl.innerHTML = allInstructors.filter(i => i.status === 'active')
            .map(i => `<option value="${escapeHtml(i.name)}">${escapeHtml(i.department || '')}</option>`).join('');
        }
      } else if (type === 'addStudent') {
        const courses = await api('/courses');
        const courseSelect = document.getElementById('ns-courseIds');
        if (courseSelect) {
          courseSelect.required = currentUser.role === 'instructor';
          courseSelect.previousElementSibling.textContent = currentUser.role === 'instructor'
            ? 'Enroll in one of Your Active Courses *'
            : 'Enroll in Courses (optional)';
          courseSelect.innerHTML = courses
            .filter(course => course.status === 'active')
            .map(course => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.title)}</option>`)
            .join('');
        }
      } else {
        const courses = await api('/courses');
        const courseSelect = document.getElementById('na-courseId');
        courseSelect.innerHTML = courses.map(course =>
          `<option value="${escapeHtml(course.id)}">${escapeHtml(course.title)}</option>`
        ).join('');
        if (!courses.length) {
          courseSelect.innerHTML = '<option value="">No courses available</option>';
          courseSelect.disabled = true;
        }
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Modal submit handlers
async function handleCreateCourse(e) {
  e.preventDefault();
  const body = {
    title: document.getElementById('nc-title').value.trim(),
    instructor: document.getElementById('nc-instructor').value.trim(),
    category: document.getElementById('nc-category').value,
    level: document.getElementById('nc-level').value,
    duration: document.getElementById('nc-duration').value.trim(),
    description: document.getElementById('nc-description').value.trim()
  };

  try {
    await api('/courses', { method: 'POST', body });
    closeModal();
    showToast('Course created successfully');
    loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCreateInstructor(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById('ni-name').value.trim(),
    email: document.getElementById('ni-email').value.trim(),
    password: document.getElementById('ni-password').value,
    department: document.getElementById('ni-department').value.trim(),
    bio: document.getElementById('ni-bio').value.trim()
  };

  try {
    await api('/instructors', { method: 'POST', body });
    closeModal();
    showToast('Instructor added successfully');
    loadInstructors();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCreateStudent(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById('ns-name').value.trim(),
    email: document.getElementById('ns-email').value.trim(),
    password: document.getElementById('ns-password').value,
    courseIds: Array.from(document.getElementById('ns-courseIds').selectedOptions, option => option.value)
  };

  try {
    await api('/students', { method: 'POST', body });
    closeModal();
    showToast('Student enrolled successfully');
    loadStudents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCreateAssignment(e) {
  e.preventDefault();
  const body = {
    title: document.getElementById('na-title').value.trim(),
    type: document.getElementById('na-type').value,
    courseId: document.getElementById('na-courseId').value,
    due_date: document.getElementById('na-due').value,
    max_points: parseInt(document.getElementById('na-points').value) || 100
  };

  try {
    await api('/assignments', { method: 'POST', body });
    closeModal();
    showToast('Assignment created successfully');
    loadAssignments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Content Editor Functions ────────────────────────
let currentLessonId = null;
let currentCourseLessons = [];

async function loadContentEditor() {
  const select = document.getElementById('content-course-select');
  if (!select) return;
  try {
    const courses = await api('/courses');
    const selectedId = select.value;
    select.innerHTML = '<option value="">Select a course</option>' + courses.map(course =>
      `<option value="${escapeHtml(course.id)}">${escapeHtml(course.title)}</option>`
    ).join('');
    if (courses.some(course => course.id === selectedId)) select.value = selectedId;
    if (select.value) await loadCourseContent();
    else resetLessonEditor('Select a course to manage its lessons.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadCourseContent() {
  const courseId = document.getElementById('content-course-select').value;
  const addButton = document.getElementById('add-lesson-button');
  if (!courseId) {
    currentCourseLessons = [];
    resetLessonEditor('Select a course to manage its lessons.');
    return;
  }
  try {
    const course = await api(`/courses/${courseId}`);
    currentCourseLessons = course.lessons || [];
    document.getElementById('content-lesson-list').innerHTML = currentCourseLessons.length
      ? currentCourseLessons.map(lesson => `
        <li class="lesson-item${lesson.id === currentLessonId ? ' active-lesson' : ''}">
          <button type="button" class="btn-outline btn-sm" onclick="selectLesson('${lesson.id}')">${escapeHtml(lesson.title)}</button>
        </li>`).join('')
      : '<li class="lesson-item">No lessons yet. Add the first lesson.</li>';
    addButton.disabled = false;
    if (currentLessonId && currentCourseLessons.some(lesson => lesson.id === currentLessonId)) {
      populateLessonEditor(currentCourseLessons.find(lesson => lesson.id === currentLessonId));
    } else {
      currentLessonId = null;
      resetLessonEditor('Select a lesson or add a new lesson.');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetLessonEditor(message) {
  currentLessonId = null;
  document.getElementById('content-lesson-list').innerHTML = `<li class="lesson-item">${escapeHtml(message)}</li>`;
  document.getElementById('lessonName').textContent = 'New lesson';
  document.getElementById('lesson-title').value = '';
  document.getElementById('lesson-description').value = '';
  document.getElementById('lesson-content').value = '';
  document.getElementById('lesson-type').value = 'Reading';
  document.getElementById('lesson-duration').value = '';
  document.getElementById('lesson-points').value = '0';
  document.getElementById('save-lesson-button').disabled = !document.getElementById('content-course-select').value;
  document.getElementById('delete-lesson-button').hidden = true;
  document.getElementById('add-lesson-button').disabled = !document.getElementById('content-course-select').value;
}

function populateLessonEditor(lesson) {
  currentLessonId = lesson.id;
  document.getElementById('lessonName').textContent = lesson.title;
  document.getElementById('lesson-title').value = lesson.title;
  document.getElementById('lesson-description').value = lesson.description || '';
  document.getElementById('lesson-content').value = lesson.content || '';
  document.getElementById('lesson-type').value = lesson.type || 'Reading';
  document.getElementById('lesson-duration').value = lesson.duration || '';
  document.getElementById('lesson-points').value = lesson.points || 0;
  document.getElementById('save-lesson-button').disabled = false;
  document.getElementById('delete-lesson-button').hidden = false;
}

function selectLesson(id) {
  const lesson = currentCourseLessons.find(item => item.id === id);
  if (!lesson) return;
  populateLessonEditor(lesson);
  loadCourseContent();
}

function newLesson() {
  currentLessonId = null;
  resetLessonEditor('New lesson');
  document.getElementById('lesson-title').focus();
}

async function saveLesson(event) {
  event.preventDefault();
  const courseId = document.getElementById('content-course-select').value;
  if (!courseId) return;
  const body = {
    title: document.getElementById('lesson-title').value.trim(),
    description: document.getElementById('lesson-description').value.trim(),
    content: document.getElementById('lesson-content').value,
    type: document.getElementById('lesson-type').value,
    duration: document.getElementById('lesson-duration').value.trim(),
    points: Number(document.getElementById('lesson-points').value) || 0
  };
  try {
    const path = `/courses/${courseId}/lessons${currentLessonId ? `/${currentLessonId}` : ''}`;
    await api(path, { method: currentLessonId ? 'PUT' : 'POST', body });
    showToast(currentLessonId ? 'Lesson updated' : 'Lesson added');
    currentLessonId = null;
    await loadCourseContent();
    await loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteLesson() {
  const courseId = document.getElementById('content-course-select').value;
  if (!courseId || !currentLessonId || !confirm('Delete this lesson?')) return;
  try {
    await api(`/courses/${courseId}/lessons/${currentLessonId}`, { method: 'DELETE' });
    currentLessonId = null;
    showToast('Lesson deleted');
    await loadCourseContent();
    await loadCourses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Escape HTML helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderActivity(text) {
  return escapeHtml(text).replace(/&lt;(\/?)(strong|em)&gt;/gi, '<$1$2>');
}

// ── Initialization ──────────────────────────────────
(async function initialize() {
  if (!token) {
    window.location.href = '/';
    return;
  }
  try {
    const session = await api('/auth/me');
    currentUser = session.user;
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    allowedPages = rolePages[currentUser.role] || [];
    initUser();
    navigate('dashboard');
  } catch (err) {
    showToast(err.message || 'Unable to verify your session', 'error');
    logout();
  }
})();
