// public/app.js — EduFlow LMS SPA Frontend Engine

// ── Auth Guard ──────────────────────────────────────
const token = localStorage.getItem('eduflow_token');
if (!token) {
  window.location.href = '/';
}

let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('eduflow_user')) || {};
} catch (_) {
  currentUser = {};
}

// ── Init user display ───────────────────────────────
function initUser() {
  const name = currentUser.name || 'Admin User';
  const role = (currentUser.role || 'administrator').toUpperCase();
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
  const setNameInput = document.getElementById('settings-name-input');
  const setEmailInput = document.getElementById('settings-email-input');

  if (sName) sName.textContent = name;
  if (sRole) sRole.textContent = role;
  if (sAvatar) sAvatar.textContent = initials;
  if (tAvatar) tAvatar.textContent = initials;
  if (setAvatar) setAvatar.textContent = initials;
  if (setName) setName.textContent = name;
  if (setRole) setRole.textContent = role;
  if (setNameInput) setNameInput.value = name;
  if (setEmailInput) setEmailInput.value = currentUser.email || 'admin@eduflow.io';
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
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// ── Loaders: Dashboard ──────────────────────────────
async function loadDashboard() {
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
              <td><span class="badge ${statusClass}">${statusLabel}</span></td>
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
        <div class="course-actions">
          <button class="btn-outline btn-sm" onclick="navigate('content')">Edit Content</button>
          <button class="btn-danger btn-sm" onclick="deleteCourse('${c.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
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
          <button class="btn-danger btn-sm" onclick="deleteInstructor('${inst.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
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
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td><button class="btn-danger btn-sm" onclick="deleteStudent('${s.id}')">Delete</button></td>
      </tr>
    `;
  }).join('');
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
            <span class="asgn-stat-val">${a.submitted || 0}</span>
            <span class="asgn-stat-label">Submitted</span>
          </div>
          <div class="asgn-stat">
            <span class="asgn-stat-val">${a.pending || 0}</span>
            <span class="asgn-stat-label">Pending</span>
          </div>
          <div class="asgn-stat">
            <span class="asgn-stat-val">${a.avg_score ? a.avg_score + '%' : '—'}</span>
            <span class="asgn-stat-label">Avg Score</span>
          </div>
        </div>
        <div class="asgn-due">
          <span class="due-label">Due Date</span>
          <span class="due-date">${a.due_date || 'Flexible'}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn-outline btn-sm" onclick="showToast('Review view opened')">Review</button>
          <button class="btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
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

    if (revEl) revEl.textContent = '$' + (data.revenue || 0).toLocaleString();
    if (timeEl) timeEl.textContent = data.avgTime || '2h 14m';
    if (passEl) passEl.textContent = (data.quizPassRate || 84) + '%';
    if (dropEl) dropEl.textContent = (data.dropoffRate || 11) + '%';

    // Bar chart
    const chartEl = document.getElementById('bar-chart');
    if (chartEl && data.monthlyEnrollments) {
      const counts = data.monthlyEnrollments.map(m => m.count);
      const max = Math.max(...counts, 1);

      chartEl.innerHTML = data.monthlyEnrollments.map((m, idx) => {
        const heightPct = Math.max(Math.round((m.count / max) * 100), 12);
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
    if (legendEl && data.categoryBreakdown) {
      const opacities = ['0.85', '0.55', '0.32', '0.16'];
      legendEl.innerHTML = data.categoryBreakdown.map((cat, i) => {
        const op = opacities[i % opacities.length];
        return `
          <div class="legend-row">
            <span class="legend-dot" style="background:rgba(15,23,42,${op})"></span>
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
            <td>${c.avgScore ? c.avgScore + '%' : '—'}</td>
            <td>$${(c.revenue || 0).toLocaleString()}</td>
            <td>${c.rating ? c.rating + ' / 5' : '—'}</td>
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
          <label>Duration &amp; Lessons</label>
          <div style="display:flex;gap:10px;">
            <input class="glass-input full-w" id="nc-duration" type="text" placeholder="e.g. 6 Weeks" />
            <input class="glass-input full-w" id="nc-lessons" type="number" placeholder="Number of lessons" value="12" />
          </div>
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
          <label>Department / Specialization</label>
          <input class="glass-input full-w" id="ni-department" type="text" placeholder="e.g. Computer Science, AI, Design" />
        </div>
        <div class="modal-field">
          <label>Bio / Profile Summary</label>
          <textarea class="glass-textarea" id="ni-bio" rows="3" placeholder="Brief background, certifications, or teaching focus…"></textarea>
        </div>
        <div class="modal-field">
          <label>Status</label>
          <select class="glass-select full-w" id="ni-status">
            <option value="active">Active</option>
            <option value="on-leave">On Leave</option>
          </select>
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
          <label>Initial Enrolled Courses</label>
          <input class="glass-input full-w" id="ns-courses" type="number" value="1" min="1" />
        </div>
        <div class="modal-field">
          <label>Status</label>
          <select class="glass-select full-w" id="ns-status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="completed">Completed</option>
          </select>
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
          <label>Associated Course Name</label>
          <input class="glass-input full-w" id="na-course" type="text" placeholder="e.g. Web Development Basics" />
        </div>
        <div class="modal-field">
          <label>Due Date</label>
          <input class="glass-input full-w" id="na-due" type="date" />
        </div>
        <div class="modal-field">
          <label>Max Points</label>
          <input class="glass-input full-w" id="na-points" type="number" value="100" />
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

  if (type === 'addCourse') {
    try {
      if (!allInstructors || allInstructors.length === 0) {
        allInstructors = await api('/instructors');
      }
      const dl = document.getElementById('instructor-datalist');
      if (dl && allInstructors && allInstructors.length > 0) {
        dl.innerHTML = allInstructors.map(i => `<option value="${escapeHtml(i.name)}">${escapeHtml(i.department || '')}</option>`).join('');
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
    lessons: parseInt(document.getElementById('nc-lessons').value) || 0,
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
    department: document.getElementById('ni-department').value.trim(),
    bio: document.getElementById('ni-bio').value.trim(),
    status: document.getElementById('ni-status').value
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
    enrolled_courses: parseInt(document.getElementById('ns-courses').value) || 1,
    status: document.getElementById('ns-status').value
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
    course_name: document.getElementById('na-course').value.trim(),
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
function toggleModule(el) {
  const lessonList = el.nextElementSibling;
  const arrow = el.querySelector('.mod-arrow');
  if (!lessonList) return;

  const isOpen = lessonList.classList.contains('open');
  lessonList.classList.toggle('open', !isOpen);
  if (arrow) arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
  el.classList.toggle('active-module', !isOpen);
}

function loadLesson(el, name) {
  document.querySelectorAll('.lesson-item').forEach(li => li.classList.remove('active-lesson'));
  el.classList.add('active-lesson');
  const lName = document.getElementById('lessonName');
  const lTitle = document.getElementById('lessonTitle');
  if (lName) lName.textContent = name;
  if (lTitle) lTitle.value = name;
}

// Rich editor formatting
document.querySelectorAll('.rich-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const label = btn.textContent.trim();
    const cmds = {
      'B': ['bold'],
      'I': ['italic'],
      'U': ['underline'],
      'H1': ['formatBlock', 'h1'],
      'H2': ['formatBlock', 'h2'],
      '— List': ['insertUnorderedList']
    };
    const cmd = cmds[label];
    if (cmd) {
      document.execCommand(cmd[0], false, cmd[1] || null);
    }
  });
});

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
initUser();
navigate('dashboard');
