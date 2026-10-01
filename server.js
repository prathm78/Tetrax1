import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import { helmetMiddleware, requestTimeout } from './src/middleware/security.js';
import aiRouter from './src/routes/ai.js';
import fetchPageRouter from './src/routes/fetch-page.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for Replit and container platforms
app.set('trust proxy', 1);

// Security & performance middlewares
app.use(helmetMiddleware);
app.use(compression());
app.use(requestTimeout(60000));

// Body parsers with 20MB payload limit
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Mount API routes
app.use('/api', aiRouter);
app.use('/api', fetchPageRouter);

// Serve static frontend files from /public
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // Never cache service worker or HTML
    if (filePath.endsWith('sw.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start server
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  Samavesh AI Server running at http://localhost:${config.port}`);
  console.log(`  Mode: ${config.isKeyConfigured ? 'LIVE AI (Gemini Connected)' : 'DEMO MODE'}`);
  if (!config.isKeyConfigured) {
    console.log(`  Notice: Add your GEMINI_API_KEY in .env and restart.`);
  }
  console.log(`======================================================\n`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] Closed remaining connections. Exiting.');
    process.exit(0);
  });
  // Force shutdown if still hanging after 5s
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
