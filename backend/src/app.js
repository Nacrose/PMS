const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const boqRoutes = require('./routes/boqRoutes');
const unitRoutes = require('./routes/unitRoutes');
const tagRoutes = require('./routes/tagRoutes');
const rateAnalysisRoutes = require('./routes/rateAnalysisRoutes');
const excelRoutes = require('./routes/excelRoutes');

// Use routes
app.use('/api/boq', boqRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/rate-analysis', rateAnalysisRoutes);
app.use('/api/excel', excelRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

module.exports = app;