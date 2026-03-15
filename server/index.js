/**
 * ZeroClaw Manager - Entry point
 * Backend Express chạy trên Orange Pi Zero2
 */
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initBuildWebSocket } = require('./updateSocket');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes (sẽ mount từng module)
const routes = require('./routes');
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'zeroclaw-manager' });
});

const server = http.createServer(app);

// WebSocket cho build log
initBuildWebSocket(server);

server.listen(PORT, () => {
  console.log(`ZeroClaw Manager listening on port ${PORT}`);
});
