// seed.js — Populate the database with demo data
// Run: node seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/db');

async function seed() {
  console.log('Seeding database...');

  // Clear everything
  db.set('users', []).write();
  db.set('courses', []).write();
  db.set('students', []).write();
  db.set('assignments', []).write();
  db.set('activity', []).write();

  // ── Admin user ──────────────────────────────────────
  const hashedPw = await bcrypt.hash('Admin123!', 10);
  db.get('users').push({
    id:         uuidv4(),
    name:       'Ahmed Mehmood',
    email:      'admin@eduflow.io',
    password:   hashedPw,
    role:       'admin',
    created_at: new Date().toISOString()
  }).write();
  console.log('  ✓ Admin user created');

  // ── Courses ─────────────────────────────────────────
  const courseData = [
    {
      title: 'Web Development Basics', instructor: 'Sara Khan',
      category: 'Programming', level: 'Beginner',
      description: 'HTML, CSS, JavaScript foundations with real-world project exercises.',
      status: 'active', lessons: 24, duration: '6 Weeks',
      enrolledStudents: 142, completionRate: 82, avgScore: 85, rating: 4.7,
      created_at: new Date('2026-01-10').toISOString()
    },
    {
      title: 'Data Science Fundamentals', instructor: 'Usman Ali',
      category: 'Data Science', level: 'Intermediate',
      description: 'Statistics, Python pandas, and data visualization with Matplotlib.',
      status: 'active', lessons: 32, duration: '10 Weeks',
      enrolledStudents: 98, completionRate: 61, avgScore: 81, rating: 4.6,
      created_at: new Date('2026-02-05').toISOString()
    },
    {
      title: 'UI/UX Principles', instructor: 'Nida Rafiq',
      category: 'Design', level: 'Beginner',
      description: 'User research, wireframing, prototyping, and usability testing basics.',
      status: 'draft', lessons: 18, duration: '5 Weeks',
      enrolledStudents: 76, completionRate: 55, avgScore: 78, rating: 4.5,
      created_at: new Date('2026-03-15').toISOString()
    },
    {
      title: 'Python for Beginners', instructor: 'Bilal Rao',
      category: 'Programming', level: 'Beginner',
      description: 'Core Python syntax, data structures, functions, and file handling.',
      status: 'active', lessons: 28, duration: '8 Weeks',
      enrolledStudents: 210, completionRate: 74, avgScore: 88, rating: 4.8,
      created_at: new Date('2026-01-20').toISOString()
    },
    {
      title: 'Digital Marketing 101', instructor: 'Farah Naz',
      category: 'Marketing', level: 'Beginner',
      description: 'SEO, social media strategy, email marketing and paid advertising basics.',
      status: 'in-review', lessons: 20, duration: '4 Weeks',
      enrolledStudents: 54, completionRate: 38, avgScore: 72, rating: 4.3,
      created_at: new Date('2026-07-01').toISOString()
    },
    {
      title: 'Machine Learning A–Z', instructor: 'Kamran Sheikh',
      category: 'Data Science', level: 'Advanced',
      description: 'Supervised, unsupervised learning, neural networks, and model deployment.',
      status: 'active', lessons: 45, duration: '14 Weeks',
      enrolledStudents: 89, completionRate: 68, avgScore: 79, rating: 4.9,
      created_at: new Date('2026-02-28').toISOString()
    }
  ];
  courseData.forEach(c => db.get('courses').push({ id: uuidv4(), ...c }).write());
  console.log('  ✓ 6 courses created');

  // ── Students ────────────────────────────────────────
  const studentData = [
    { name: 'Ali Hassan',    email: 'ali.hassan@email.com',  enrolled_courses: 3, progress: 72, status: 'active',    joined_at: 'Mar 2026', created_at: new Date('2026-03-01') },
    { name: 'Maria Yousuf',  email: 'maria.y@email.com',     enrolled_courses: 1, progress: 18, status: 'active',    joined_at: 'Oct 2026', created_at: new Date('2026-10-05') },
    { name: 'Zara Khan',     email: 'zara.k@email.com',      enrolled_courses: 4, progress: 90, status: 'active',    joined_at: 'Jan 2026', created_at: new Date('2026-01-15') },
    { name: 'Omar Malik',    email: 'omar.m@email.com',      enrolled_courses: 2, progress: 45, status: 'inactive',  joined_at: 'Jun 2026', created_at: new Date('2026-06-10') },
    { name: 'Sara Baig',     email: 'sara.b@email.com',      enrolled_courses: 2, progress: 100,status: 'completed', joined_at: 'Feb 2026', created_at: new Date('2026-02-20') },
    { name: 'Faisal Raza',   email: 'faisal.r@email.com',    enrolled_courses: 5, progress: 60, status: 'active',    joined_at: 'Apr 2026', created_at: new Date('2026-04-01') },
    { name: 'Hina Iqbal',    email: 'hina.i@email.com',      enrolled_courses: 1, progress: 33, status: 'active',    joined_at: 'Sep 2026', created_at: new Date('2026-09-15') }
  ];
  studentData.forEach(s =>
    db.get('students').push({ id: uuidv4(), ...s, created_at: s.created_at.toISOString() }).write()
  );
  console.log('  ✓ 7 students created');

  // ── Assignments ─────────────────────────────────────
  const assignmentData = [
    {
      title: 'HTML Basics Quiz',           type: 'Quiz',       course_name: 'Web Development Basics',
      due_date: '2026-11-10', max_points: 50,  submitted: 34, pending: 8, avg_score: 87,
      created_at: new Date('2026-10-01').toISOString()
    },
    {
      title: 'Build a Personal Portfolio', type: 'Assignment', course_name: 'Web Development Basics',
      due_date: '2026-11-20', max_points: 100, submitted: 19, pending: 23, avg_score: 0,
      created_at: new Date('2026-10-15').toISOString()
    },
    {
      title: 'Data Analysis — Sales Dataset', type: 'Project',  course_name: 'Data Science Fundamentals',
      due_date: '2026-10-30', max_points: 100, submitted: 41, pending: 2, avg_score: 79,
      created_at: new Date('2026-09-20').toISOString()
    },
    {
      title: 'Python Functions Quiz',      type: 'Quiz',       course_name: 'Python for Beginners',
      due_date: '2026-11-05', max_points: 30,  submitted: 88, pending: 5, avg_score: 91,
      created_at: new Date('2026-10-10').toISOString()
    }
  ];
  assignmentData.forEach(a => db.get('assignments').push({ id: uuidv4(), ...a }).write());
  console.log('  ✓ 4 assignments created');

  // ── Activity ────────────────────────────────────────
  const activityData = [
    { text: 'Sara Khan uploaded a new lecture to Web Dev Basics',   time: '2 hours ago' },
    { text: 'Ali Hassan submitted Assignment 3 in Python Beginners', time: '4 hours ago' },
    { text: 'New student Maria Yousuf enrolled in Data Science',     time: 'Yesterday'   },
    { text: 'Nida Rafiq published a quiz in UI/UX Principles',       time: 'Yesterday'   },
    { text: 'Course Digital Marketing 101 submitted for review',     time: '2 days ago'  }
  ];
  const base = new Date('2026-10-30');
  activityData.forEach((a, i) =>
    db.get('activity').push({
      id: uuidv4(), ...a,
      created_at: new Date(base.getTime() - i * 3600000).toISOString()
    }).write()
  );
  console.log('  ✓ Activity log seeded');

  console.log('\n  Database seeded successfully!');
  console.log('  Login: admin@eduflow.io  /  Admin123!\n');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
