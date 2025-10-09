// api/validation.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../db');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// Generate 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

//generate OTP
router.post('/generateOTP', (req, res) => {
  const { userEmail, transactionID } = req.body || {};
  if (!userEmail || !transactionID) {
    return res.json({ status: 'fail', message: 'Missing parameters' });
  }

  const checkPayment = 'SELECT * FROM Payments WHERE payment_id = ? AND status = "pending"';
  db.query(checkPayment, [transactionID], (err, payments) => {
    if (err) return res.json({ status: 'fail', message: 'Database error' });
    if (payments.length === 0) {
      return res.json({ status: 'fail', message: 'Pending transaction not found' });
    }

    const checkOTP = 'SELECT * FROM OTP WHERE payment_id = ?';
    db.query(checkOTP, [transactionID], (cErr, existing) => {
      if (cErr) return res.json({ status: 'fail', message: 'Database error' });
      if (existing.length > 0) {
        return res.json({ status: 'fail', message: 'OTP already generated' });
      }

      const otp = generateOTP();
      const otp_id = uuidv4();
      const created_at = new Date();
      const expired_at = new Date(created_at.getTime() + 3 * 60 * 1000); // 3 mins

      const insertQuery = `
        INSERT INTO OTP (otp_id, payment_id, otp_code, created_at, expired_at, is_used)
        VALUES (?, ?, ?, ?, ?, 0)
      `;
      db.query(insertQuery, [otp_id, transactionID, otp, created_at, expired_at], (iErr) => {
        if (iErr) return res.json({ status: 'fail', message: 'Error saving OTP' });

        transporter.sendMail({
          from: 'suyiphyo110@gmail.com',
          to: userEmail,
          subject: 'Your TDT iBanking OTP Code',
          text: `Your OTP code is ${otp}. It is valid for 3 minutes.`
        }, (mErr) => {
          if (mErr) return res.json({ status: 'fail', message: 'Failed to send email' });
          return res.json({ status: 'success', message: 'OTP sent successfully' });
        });
      });
    });
  });
});

// resend otp
router.post('/resendOTP', (req, res) => {
  const { userEmail, transactionID } = req.body || {};
  if (!userEmail || !transactionID) {
    return res.json({ status: 'fail', message: 'Missing parameters' });
  }

  const otp = generateOTP();
  const expired_at = new Date(Date.now() + 3 * 60 * 1000);

  const updateQuery = `
    UPDATE OTP SET otp_code = ?, created_at = NOW(), expired_at = ?, is_used = 0
    WHERE payment_id = ?
  `;

  db.query(updateQuery, [otp, expired_at, transactionID], (uErr, result) => {
    if (uErr) return res.json({ status: 'fail', message: 'Database error updating OTP' });
    if (result.affectedRows === 0) return res.json({ status: 'fail', message: 'No OTP record found' });

    transporter.sendMail({
      from: 'suyiphyo110@gmail.com',
      to: userEmail,
      subject: 'Your New TDT iBanking OTP Code',
      text: `Your new OTP code is ${otp}. It is valid for 3 minutes.`
    }, (mErr) => {
      if (mErr) return res.json({ status: 'fail', message: 'Failed to resend OTP' });
      return res.json({ status: 'success', message: 'OTP resent successfully' });
    });
  });
});

// verify otp
router.post('/verifyOTP', (req, res) => {
  const { transactionID, enteredOTP } = req.body || {};
  if (!transactionID || !enteredOTP) {
    return res.json({ status: 'fail', message: 'Missing parameters' });
  }

  const query = 'SELECT * FROM OTP WHERE payment_id = ?';
  db.query(query, [transactionID], (qErr, results) => {
    if (qErr) return res.json({ status: 'fail', message: 'Database error' });
    if (results.length === 0) return res.json({ status: 'fail', message: 'OTP not found' });

    const otpRecord = results[0];
    const now = new Date();
    const expiresAt = new Date(otpRecord.expired_at);
    const isUsed = Number(otpRecord.is_used) === 1;   

    if (isUsed) return res.json({ status: 'fail', message: 'OTP already used' });
    if (now > expiresAt) return res.json({ status: 'fail', message: 'OTP expired' });
    if (otpRecord.otp_code !== enteredOTP) return res.json({ status: 'fail', message: 'Invalid OTP' });

    // Mark OTP as used
    db.query('UPDATE OTP SET is_used = 1 WHERE otp_id = ?', [otpRecord.otp_id], (uErr) => {
      if (uErr) return res.json({ status: 'fail', message: 'Database error updating OTP' });

      // Update payment status
      db.query('UPDATE Payments SET status = "success" WHERE payment_id = ?', [transactionID], (pErr) => {
        if (pErr) return res.json({ status: 'fail', message: 'Error updating payment status' });

        return res.json({ status: 'success', message: 'Payment verified successfully' });
      });
    });
  });
});

module.exports = router;
