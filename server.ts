import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { overlayHubService } from './server/services/overlayHubService.ts';
import { TikLiveApiError, tikLiveApiClient } from './server/services/tikLiveApiClient.ts';
import type { LiveEventPayload } from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // ---------- REST API ROUTES (Backend Proxy — API Key stays strictly on server) ----------

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      apiKeyConfigured: tikLiveApiClient.isConfigured(),
      apiBase: tikLiveApiClient.apiBase,
    });
  });

  app.get('/api/tiklive/live/:username', async (req, res) => {
    try {
      const info = await tikLiveApiClient.getLiveInfo(req.params.username);
      res.json({ ok: true, data: info });
    } catch (err) {
      const status = err instanceof TikLiveApiError ? err.status : 500;
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to query TikLive API',
        code: err instanceof TikLiveApiError ? err.code : 'unknown_error',
      });
    }
  });

  app.post('/api/tiklive/live/:username/session', async (req, res) => {
    try {
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined;
      const result = await tikLiveApiClient.openOrRenewSession(req.params.username, sessionId);
      res.status(result.status).json({ ok: true, data: result.data });
    } catch (err) {
      const status = err instanceof TikLiveApiError ? err.status : 500;
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to open/renew session',
        code: err instanceof TikLiveApiError ? err.code : 'unknown_error',
      });
    }
  });

  app.delete('/api/tiklive/live/:username/session', async (req, res) => {
    try {
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
      if (!sessionId) {
        res.status(400).json({ ok: false, error: 'sessionId is required', code: 'missing_session_id' });
        return;
      }
      await tikLiveApiClient.closeSession(req.params.username, sessionId);
      res.json({ ok: true });
    } catch (err) {
      const status = err instanceof TikLiveApiError ? err.status : 500;
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to close session',
        code: err instanceof TikLiveApiError ? err.code : 'unknown_error',
      });
    }
  });

  app.get('/api/tiklive/usage', async (_req, res) => {
    const usage = await tikLiveApiClient.getUsage();
    res.json(usage);
  });

  app.get('/api/tiklive/plans', async (_req, res) => {
    const plans = await tikLiveApiClient.getPlans();
    res.json(plans);
  });

  app.get('/api/rooms/:overlayId', (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    res.json({ ok: true, snapshot: room.getSnapshot() });
  });

  app.post('/api/rooms/:overlayId/connect', async (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    try {
      const state = await room.connectionService.connect(username);
      res.json({ ok: true, connection: state });
    } catch (err) {
      const status = err instanceof TikLiveApiError ? err.status : 400;
      res.status(status).json({
        ok: false,
        code: err instanceof TikLiveApiError ? err.code : 'connect_failed',
        error: err instanceof Error ? err.message : 'Failed to connect',
        connection: room.connectionService.state,
      });
    }
  });

  app.post('/api/rooms/:overlayId/disconnect', async (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    const state = await room.connectionService.disconnect();
    res.json({ ok: true, connection: state });
  });

  app.put('/api/rooms/:overlayId/config', (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    const body = req.body || {};
    room.updateConfig({
      giftMappings: Array.isArray(body.giftMappings) ? body.giftMappings : undefined,
      alertStyle: body.alertStyle && typeof body.alertStyle === 'object' ? body.alertStyle : undefined,
      overlayLayout:
        body.overlayLayout && typeof body.overlayLayout === 'object' ? body.overlayLayout : undefined,
      audioSettings:
        body.audioSettings && typeof body.audioSettings === 'object' ? body.audioSettings : undefined,
      templates: Array.isArray(body.templates) ? body.templates : undefined,
    });
    res.json({ ok: true, snapshot: room.getSnapshot() });
  });

  app.post('/api/rooms/:overlayId/test-event', (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    const payload = req.body as Omit<LiveEventPayload, 'id' | 'timestamp'>;
    if (!payload || !payload.type || !payload.user) {
      res.status(400).json({ ok: false, error: 'Invalid test event payload' });
      return;
    }
    // Strictly enforce source: 'test' so test events never pollute real live metrics
    const emitted = room.ingestEvent({
      ...payload,
      source: 'test',
    });
    res.json({ ok: true, events: emitted });
  });

  app.post('/api/rooms/:overlayId/reset-test', (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    room.resetTestSession();
    res.json({ ok: true });
  });

  app.post('/api/rooms/:overlayId/reset-live', (req, res) => {
    const room = overlayHubService.getOrCreateRoom(req.params.overlayId);
    room.resetLiveSession();
    res.json({ ok: true });
  });

  // ---------- HTTP + WEBSOCKET SERVER ----------

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const overlayId = reqUrl.searchParams.get('overlayId') || 'main-studio';
    const role = reqUrl.searchParams.get('role') === 'overlay' ? 'overlay' : 'control';
    const room = overlayHubService.getOrCreateRoom(overlayId);
    room.addClient(ws, role);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type === 'ping' && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        } else if (msg.type === 'request:snapshot' && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'room:snapshot', snapshot: room.getSnapshot() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  // ---------- VITE DEV MIDDLEWARE / PRODUCTION STATIC ----------

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[LIVE EFFECTS PRO] Server listening on http://0.0.0.0:${PORT}`);
  });

  const gracefulExit = async () => {
    await overlayHubService.shutdownAll();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', gracefulExit);
  process.on('SIGTERM', gracefulExit);
}

startServer().catch((err) => {
  console.error('[LIVE EFFECTS PRO] Fatal startup error:', err);
  process.exit(1);
});
