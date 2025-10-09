// /api/notification.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../db');
const nodemailer = require('nodemailer');

// gmail
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

//confirm transaction
router.post('/confirm', (req, res) => {
  const { transactionID } = req.body || {};
  if (!transactionID) return res.json({ status: 'fail', message: 'Missing transactionID' });

  const sql = `
    SELECT 
      p.payment_id, p.amount, p.payment_date, p.status,
      u.user_id, u.full_name AS payer_name, u.email AS payer_email, u.balance AS payer_balance,
      t.tuition_id, t.student_id, t.amount_due, t.amount_paid, t.status AS tuition_status,
      s.full_name AS student_name
    FROM Payments p
    JOIN Users u   ON u.user_id = p.user_id
    JOIN Tuition t ON t.tuition_id = p.tuition_id
    JOIN Students s ON s.student_id = t.student_id
    WHERE p.payment_id = ?
    LIMIT 1
  `;

  db.query(sql, [transactionID], (err, rows) => {
    if (err) return res.json({ status: 'fail', message: 'Database error' });
    if (!rows.length) return res.json({ status: 'fail', message: 'Transaction not found' });

    const r = rows[0];
    if (r.status !== 'success') {
      return res.json({ status: 'fail', message: 'Payment not completed yet' });
    }

    const subject = `TDT iBanking Payment Receipt #${r.payment_id}`;
    const text = [
      `Hello ${r.payer_name},`,
      ``,
      `Your payment has been completed successfully.`,
      ``,
      `Transaction ID : ${r.payment_id}`,
      `Student        : ${r.student_name} (${r.student_id})`,
      `Tuition ID     : ${r.tuition_id}`,
      `Amount Paid    : ${Number(r.amount).toLocaleString()} VND`,
      `Date/Time      : ${new Date(r.payment_date).toLocaleString()}`,
      `Tuition Status : ${r.tuition_status.toUpperCase()}`,
      `Current Balance: ${Number(r.payer_balance).toLocaleString()} VND`,
      ``,
      `Thank you for using TDTU iBanking.`
    ].join('\n');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
        <h2>TDT iBanking – Payment Receipt</h2>
        <p>Hello <b>${r.payer_name}</b>,</p>
        <p>Your payment has been completed successfully.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><td><b>Transaction ID</b></td><td>${r.payment_id}</td></tr>
          <tr><td><b>Student</b></td><td>${r.student_name} (${r.student_id})</td></tr>
          <tr><td><b>Tuition ID</b></td><td>${r.tuition_id}</td></tr>
          <tr><td><b>Amount Paid</b></td><td>${Number(r.amount).toLocaleString()} VND</td></tr>
          <tr><td><b>Date/Time</b></td><td>${new Date(r.payment_date).toLocaleString()}</td></tr>
          <tr><td><b>Tuition Status</b></td><td>${String(r.tuition_status).toUpperCase()}</td></tr>
          <tr><td><b>Current Balance</b></td><td>${Number(r.payer_balance).toLocaleString()} VND</td></tr>
        </table>
        <p>Thank you for using <b>TDTU iBanking</b>.</p>
      </div>
    `;

    transporter.sendMail(
      {
        from: 'suyiphyo110@gmail.com',
        to: r.payer_email,
        subject,
        text,
        html
      },
      (mailErr) => {
        if (mailErr) {
          console.error('Notification email error:', mailErr);
          return res.json({ status: 'fail', message: 'Failed to send confirmation email' });
        }
        return res.json({ status: 'success', message: 'Confirmation email sent' });
      }
    );
  });
});

module.exports = router;
