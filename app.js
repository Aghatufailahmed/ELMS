/* ─────────────────────────────────────────────────────
   EduFlow LMS — JavaScript
───────────────────────────────────────────────────── */

// ── Navigation ──────────────────────────────────────
function navigate(pageId) {
  // Deactivate all nav items + pages
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

  // Activate selected
  const navEl = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  const pageEl = document.getElementById(`page-${pageId}`);

  if (navEl) navEl.classList.add('active');
  if (pageEl) pageEl.classList.add('active');

  // Update title & breadcrumb
  const labels = {
    dashboard:   'Dashboard',
    courses:     'Courses',
    content:     'Content Editor',
    students:    'Students',
    assignments: 'Assignments',
    analytics:   'Analytics',
    settings:    'Settings',
  };
  document.getElementById('pageTitle').textContent = labels[pageId] || pageId;
  document.getElementById('breadcrumb-current').textContent = labels[pageId] || pageId;

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 900) closeSidebar();
}

// Wire up nav-item clicks
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// ── Sidebar mobile toggle ────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ── Content Editor: module toggle ───────────────────
function toggleModule(el) {
  const lessonList = el.nextElementSibling;
  const arrow = el.querySelector('.mod-arrow');

  const isOpen = lessonList.classList.contains('open');
  lessonList.classList.toggle('open', !isOpen);
  arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
  el.classList.toggle('active-module', !isOpen);
}

// ── Content Editor: load lesson ──────────────────────
function loadLesson(el, name) {
  document.querySelectorAll('.lesson-item').forEach(li => li.classList.remove('active-lesson'));
  el.classList.add('active-lesson');
  document.getElementById('lessonName').textContent = name;
  document.getElementById('lessonTitle').value = name;
}

// ── Modals ───────────────────────────────────────────
const modalTemplates = {
  addCourse: {
    title: 'New Course',
    html: `
      <div class="modal-field">
        <label>Course Title</label>
        <input class="glass-input full-w" type="text" placeholder="e.g. Advanced JavaScript" />
      </div>
      <div class="modal-field">
        <label>Instructor</label>
        <input class="glass-input full-w" type="text" placeholder="Instructor name" />
      </div>
      <div class="modal-field">
        <label>Category</label>
        <select class="glass-select full-w">
          <option>Programming</option>
          <option>Design</option>
          <option>Marketing</option>
          <option>Data Science</option>
          <option>Business</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Level</label>
        <select class="glass-select full-w">
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Short Description</label>
        <textarea class="glass-textarea" rows="3" placeholder="Brief overview of the course…"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="closeModal()">Create Course</button>
      </div>
    `
  },
  addStudent: {
    title: 'Add Student',
    html: `
      <div class="modal-field">
        <label>Full Name</label>
        <input class="glass-input full-w" type="text" placeholder="Student full name" />
      </div>
      <div class="modal-field">
        <label>Email Address</label>
        <input class="glass-input full-w" type="email" placeholder="student@email.com" />
      </div>
      <div class="modal-field">
        <label>Enroll in Course</label>
        <select class="glass-select full-w">
          <option>Web Development Basics</option>
          <option>Data Science Fundamentals</option>
          <option>Python for Beginners</option>
          <option>Machine Learning A–Z</option>
          <option>UI/UX Principles</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Send Welcome Email</label>
        <select class="glass-select full-w">
          <option>Yes — send immediately</option>
          <option>No — skip</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="closeModal()">Add Student</button>
      </div>
    `
  },
  addAssignment: {
    title: 'New Assignment',
    html: `
      <div class="modal-field">
        <label>Title</label>
        <input class="glass-input full-w" type="text" placeholder="Assignment title" />
      </div>
      <div class="modal-field">
        <label>Type</label>
        <select class="glass-select full-w">
          <option>Assignment</option>
          <option>Quiz</option>
          <option>Project</option>
          <option>Live Session</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Course</label>
        <select class="glass-select full-w">
          <option>Web Development Basics</option>
          <option>Data Science Fundamentals</option>
          <option>Python for Beginners</option>
          <option>Machine Learning A–Z</option>
        </select>
      </div>
      <div class="modal-field">
        <label>Due Date</label>
        <input class="glass-input full-w" type="date" />
      </div>
      <div class="modal-field">
        <label>Max Points</label>
        <input class="glass-input full-w" type="number" value="100" />
      </div>
      <div class="modal-actions">
        <button class="btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="closeModal()">Create</button>
      </div>
    `
  }
};

function openModal(type) {
  const tmpl = modalTemplates[type];
  if (!tmpl) return;
  document.getElementById('modalTitle').textContent = tmpl.title;
  document.getElementById('modalBody').innerHTML = tmpl.html;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── Rich editor — button formatting ─────────────────
document.querySelectorAll('.rich-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const label = btn.textContent.trim();
    const cmds = {
      'B': ['bold'],
      'I': ['italic'],
      'U': ['underline'],
      'H1': ['formatBlock', 'h1'],
      'H2': ['formatBlock', 'h2'],
      '— List': ['insertUnorderedList'],
    };
    const cmd = cmds[label];
    if (cmd) {
      document.execCommand(cmd[0], false, cmd[1] || null);
    }
  });
});

// ── Bar chart tooltip (simple hover label) ───────────
document.querySelectorAll('.bar').forEach(bar => {
  const val = bar.title;
  bar.addEventListener('mouseenter', () => {
    bar.setAttribute('data-tip', val);
  });
});

// ── Init ─────────────────────────────────────────────
navigate('dashboard');
