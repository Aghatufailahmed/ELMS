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
  activity:    []
}).write();

module.exports = db;
