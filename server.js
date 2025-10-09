require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Serve static frontend files
app.use(express.static(__dirname)); 

// Import API routes
const loginRouter = require('./api/login');
const paymentRouter = require('./api/payment');
const tuitionRouter = require('./api/tuition');
const validationRouter = require('./api/validation');
const processingRouter = require('./api/processing');
const notificationRouter = require('./api/notification');


// Use API routes
app.use('/api/login', loginRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/tuition', tuitionRouter);
app.use('/api/validation', validationRouter);
app.use('/api/processing', processingRouter);
app.use('/api/notification', notificationRouter);


app.get('/healthz', (_, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
