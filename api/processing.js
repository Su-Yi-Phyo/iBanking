// /api/processing.js
const express = require('express');
const router = express.Router();
const db = require('../db');


//execute transaction
router.post('/execute', async (req, res) => {
  const { transactionID } = req.body || {};
  if (!transactionID) return res.json({ status: 'fail', message: 'Missing transactionID' });

  db.getConnection((err, conn) => {
    if (err) return res.json({ status: 'fail', message: 'DB connection error' });

    const rollback = (msg, extraErr) => {
      conn.rollback(() => {
        if (extraErr) console.error(extraErr);
        conn.release();
        res.json({ status: 'fail', message: msg || 'Processing failed' });
      });
    };

    conn.beginTransaction((tErr) => {
      if (tErr) return rollback('Could not start transaction', tErr);

      // 1) Lock payment row
      const lockPaymentSql = `
        SELECT p.payment_id, p.user_id, p.tuition_id, p.amount, p.status, p.payment_date,
               u.balance AS user_balance, u.email,
               t.student_id, t.amount_due, t.amount_paid, t.status AS tuition_status
        FROM Payments p
        JOIN Users u   ON u.user_id = p.user_id
        JOIN Tuition t ON t.tuition_id = p.tuition_id
        WHERE p.payment_id = ?
        FOR UPDATE
      `;
      conn.query(lockPaymentSql, [transactionID], (pErr, pRows) => {
        if (pErr) return rollback('Database error (payment lookup)', pErr);
        if (!pRows.length) return rollback('Payment not found');

        const row = pRows[0];

        // OTP verification must have set status='success'
        if (row.status !== 'success') {
          return rollback('Payment not verified (OTP step incomplete)');
        }

        // payment must equal remaining due
        const remainingDue = Number(row.amount_due) - Number(row.amount_paid);
        const payAmount   = Number(row.amount);
        if (payAmount !== remainingDue) {
          return rollback(`Invalid amount. Required full remaining: ${remainingDue.toFixed(2)}`);
        }

        // balance check
        const currentBal = Number(row.user_balance);
        if (currentBal < payAmount) {
          return rollback('Insufficient balance at processing time');
        }

        // If tuition already paid 
        if (remainingDue <= 0) {
          // Nothing to do; consider already processed
          conn.commit((cErr) => {
            conn.release();
            if (cErr) return res.json({ status: 'fail', message: 'Commit error' });
            return res.json({
              status: 'success',
              message: 'Already processed',
              transaction: {
                payment_id: row.payment_id,
                tuition_id: row.tuition_id,
                student_id: row.student_id,
                amount: payAmount,
                date: row.payment_date,
                new_balance: currentBal
              }
            });
          });
          return;
        }

        // 2) Deduct user balance
        const updateUserSql = `UPDATE Users SET balance = balance - ? WHERE user_id = ?`;
        conn.query(updateUserSql, [payAmount, row.user_id], (uErr, uRes) => {
          if (uErr || uRes.affectedRows === 0) return rollback('Failed to deduct balance', uErr);

          // 3) Update tuition (amount_paid and status)
          const updateTuitionSql = `
            UPDATE Tuition
            SET amount_paid = amount_paid + ?,
                status = CASE
                  WHEN amount_paid + ? >= amount_due THEN 'paid'
                  ELSE 'partial'
                END
            WHERE tuition_id = ?
          `;
          conn.query(updateTuitionSql, [payAmount, payAmount, row.tuition_id], (tErr, tRes) => {
            if (tErr || tRes.affectedRows === 0) return rollback('Failed to update tuition', tErr);

            // We keep Payments.status='success' (means verified+processed in current enum).

            conn.commit((cErr) => {
              if (cErr) return rollback('Commit error', cErr);
              // Fetch new balance to return
              const newBalance = currentBal - payAmount;
              conn.release();
              return res.json({
                status: 'success',
                message: 'Payment processed successfully',
                transaction: {
                  payment_id: row.payment_id,
                  tuition_id: row.tuition_id,
                  student_id: row.student_id,
                  amount: payAmount,
                  date: row.payment_date, 
                  new_balance: newBalance
                }
              });
            });
          });
        });
      });
    });
  });
});

//transactionhistory
router.get('/history', (req, res) => {
  const { user_id } = req.query || {};
  if (!user_id) return res.json({ status: 'fail', message: 'Missing user_id' });

  const sql = `
    SELECT p.payment_id, p.amount, p.payment_date, p.status,
           t.tuition_id, t.student_id,
           s.full_name AS student_name
    FROM Payments p
    JOIN Tuition  t ON t.tuition_id = p.tuition_id
    JOIN Students s ON s.student_id = t.student_id
    WHERE p.user_id = ? AND p.status = 'success'
    ORDER BY p.payment_date DESC
  `;
  db.query(sql, [user_id], (err, rows) => {
    if (err) return res.json({ status: 'fail', message: 'Database error' });
    res.json({ status: 'success', history: rows });
  });
});

module.exports = router;
