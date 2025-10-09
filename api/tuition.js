const express = require('express');
const router = express.Router();
const db = require('../db');

const tuitionRouter = express.Router();
// GET /api/tuition?student_id=xxx
router.get('/getTuition', (req, res) => {
    const { student_id } = req.query;

    if (!student_id) {
        return res.status(400).json({ status: 'fail', message: 'Missing student_id' });
    }

    const query = 'SELECT * FROM Tuition WHERE student_id = ?';
    db.query(query, [student_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ status: 'fail', message: 'Database error' });
        }

        res.json({ status: 'success', tuition: results });
    });
});

module.exports = router;
