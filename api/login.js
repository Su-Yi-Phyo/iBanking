const express = require('express');
const router = express.Router();
const db = require('../db');

const loginRouter = express.Router();
// POST /api/login
router.post('/login', (req, res) => {
  const { username, password } = req.body; // ✅ match frontend input

  if (!username || !password) {
    return res.json({ status: 'fail', message: 'Missing username or password' });
  }

  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.json({ status: 'fail', message: 'Database error' });
    }

    console.log('Login attempt:', username, password);
    console.log('Query results:', results);

    if (results.length > 0) {
      res.json({
        status: 'success',
        dashboard: 'dashboard.html',
        user: results[0]
      });
    } else {
      res.json({ status: 'fail', message: 'Invalid username or password' });
    }
  });
});

module.exports = router;
