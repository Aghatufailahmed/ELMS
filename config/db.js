// config/db.js — lowdb JSON file database setup
const low  = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const databaseFile = process.env.EDUFLOW_DB_FILE || path.join(dataDir, 'db.json');
const adapter = new FileSync(path.resolve(databaseFile));
const db = low(adapter);

// Default schema
db.defaults({
  users:       [],
  courses:     [],
  students:    [],
  instructors: [],
  assignments: [],
  lecture_materials: [],
  grading_scales: [
    { id: 'default', name: 'University standard', ranges: [
      { grade: 'A', min: 90, max: 100 },
      { grade: 'B', min: 80, max: 89.99 },
      { grade: 'C', min: 70, max: 79.99 },
      { grade: 'D', min: 60, max: 69.99 },
      { grade: 'F', min: 0, max: 59.99 }
    ] }
  ],
  notifications: [],
  announcements: [],
  password_reset_tokens: [],
  activity: []
}).write();

module.exports = db;
