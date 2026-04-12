/**
 * Tổng hợp các API routes
 * Các module config, service, diagnostics, update, skills sẽ mount tại đây
 */
const express = require('express');
const configRoutes = require('./config');
const serviceRoutes = require('./service');
const diagnosticsRoutes = require('./diagnostics');
const updateRoutes = require('./update');
const skillsRoutes = require('./skills');
const agentRoutes = require('./agent');
const memoryRoutes = require('./memory');
const channelRoutes = require('./channel');
const cronRoutes = require('./cron');
const authRoutes = require('./auth');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ message: 'ZeroClaw Manager API', version: '0.1.0' });
});

router.use('/config', configRoutes);
router.use('/service', serviceRoutes);
router.use('/diagnostics', diagnosticsRoutes);
router.use('/update', updateRoutes);
router.use('/skills', skillsRoutes);
router.use('/agent', agentRoutes);
router.use('/memory', memoryRoutes);
router.use('/channel', channelRoutes);
router.use('/cron', cronRoutes);
router.use('/auth', authRoutes);

module.exports = router;
