// api/payment.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// mail setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'suyiphyo110@gmail.com',
    pass: 'mcfa ribo voli hvpj' // App Password
  }
});

// Generate 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

router.post('/submitPayment', (req, res) => {
  const { payer_id, student_id, amount } = req.body || {};
  if (!payer_id || !student_id || amount == null) {
    return res.json({ status: 'fail', message: 'Missing parameters' });
  }

  // 1) Find unpaid/partial tuition rows for this student
  const tuitionSql = `
    SELECT tuition_id, student_id, semester, amount_due, amount_paid, status
    FROM Tuition
    WHERE student_id = ? AND status IN ('unpaid', 'partial')
    ORDER BY semester DESC
  `;
  db.query(tuitionSql, [student_id], (err, tuitionRows) => {
    if (err) {
      console.error('Tuition query error:', err);
      return res.json({ status: 'fail', message: 'Database error' });
    }
    if (!tuitionRows.length) {
      return res.json({ status: 'fail', message: 'No tuition due for this student' });
    }

    // Enforce paying one semester at a time.
    if (tuitionRows.length > 1) {
      return res.json({
        status: 'fail',
        message: 'Multiple unpaid semesters found. Please pay per semester.'
      });
    }

    const tuition = tuitionRows[0];
    const remainingDue = Number(tuition.amount_due) - Number(tuition.amount_paid);
    if (Number(amount) !== remainingDue) {
      return res.json({
        status: 'fail',
        message: `Payment must cover full tuition amount (${remainingDue.toFixed(2)}).`
      });
    }

    // 2) Check payer balance & email
    const userSql = 'SELECT user_id, balance, email FROM Users WHERE user_id = ? LIMIT 1';
    db.query(userSql, [payer_id], (uErr, uRows) => {
      if (uErr) {
        console.error('User query error:', uErr);
        return res.json({ status: 'fail', message: 'Database error' });
      }
      if (!uRows.length) {
        return res.json({ status: 'fail', message: 'Payer not found' });
      }
      const payer = uRows[0];
      if (Number(payer.balance) < Number(amount)) {
        return res.json({ status: 'fail', message: 'Insufficient balance.' });
      }
      if (!payer.email) {
        return res.json({ status: 'fail', message: 'Payer email not found.' });
      }

      // 3) Create pending payment (status = 'pending')
      const payment_id = uuidv4();
      const insertPaymentSql = `
        INSERT INTO Payments (payment_id, user_id, tuition_id, amount, status)
        VALUES (?, ?, ?, ?, 'pending')
      `;
      db.query(
        insertPaymentSql,
        [payment_id, payer_id, tuition.tuition_id, amount],
        (pErr) => {
          if (pErr) {
            console.error('Insert payment error:', pErr);
            return res.json({ status: 'fail', message: 'Database error creating payment' });
          }

          // 4) Generate OTP and save (or upsert) to OTP table
          const otpCode = generateOTP();
          const created_at = new Date();
          const expired_at = new Date(created_at.getTime() + 3 * 60 * 1000); // 3 minutes

          // If an OTP row already exists for this payment_id (shouldn't, but just in case),
          // update it; otherwise insert a new row.
          const upsertOtpSql = `
            INSERT INTO OTP (otp_id, payment_id, otp_code, created_at, expired_at, is_used)
            VALUES (?, ?, ?, ?, ?, 0)
            ON DUPLICATE KEY UPDATE
              otp_code = VALUES(otp_code),
              created_at = VALUES(created_at),
              expired_at = VALUES(expired_at),
              is_used = 0
          `;
          const otp_id = uuidv4();

          db.query(
            upsertOtpSql,
            [otp_id, payment_id, otpCode, created_at, expired_at],
            (oErr) => {
              if (oErr) {
                console.error('Save OTP error:', oErr);
                return res.json({ status: 'fail', message: 'Error saving OTP' });
              }

              // 5) Send OTP email
              transporter.sendMail(
                {
                  from: 'suyiphyo110@gmail.com',
                  to: payer.email,
                  subject: 'Your TDT iBanking OTP Code',
                  text: `Your OTP code is ${otpCode}. It is valid for 3 minutes.`
                },
                (mErr) => {
                  if (mErr) {
                    console.error('Email send error:', mErr);
                    return res.json({ status: 'fail', message: 'Failed to send OTP email' });
                  }

                  // 6) Return transactionID to the browser
                  return res.json({
                    status: 'pending',
                    transactionID: payment_id,
                    message: 'OTP sent to your email. Please verify to complete the transaction.'
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

module.exports = router;
