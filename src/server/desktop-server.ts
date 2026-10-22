import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { schema } from './graphql/schema';
import { apiRouter } from './routes/api';
import { authenticateRequest } from './auth/auth';
import { db } from './db/database';

dotenv.config();

export interface DesktopServerOptions {
  port?: number;
  distPath?: string;
  uploadsDir?: string;
  dataDir?: string;
  workspacesDir?: string;
}

export function findAvailablePort(startPort = 3000): Promise<number> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        resolve(startPort);
      }
    });
    tester.once('listening', () => {
      const port = (tester.address() as net.AddressInfo).port;
      tester.close(() => resolve(port));
    });
    tester.listen(startPort, '127.0.0.1');
  });
}

export async function startDesktopServer(options: DesktopServerOptions = {}): Promise<{
  app: express.Express;
  server: http.Server;
  port: number;
  url: string;
}> {
  const app = express();
  const PORT = options.port || (await findAvailablePort(parseInt(process.env.PORT || '3000', 10)));

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // Static uploads directory
  const uploadsDir = options.uploadsDir || process.env.CORTEX_UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {}
  }
  app.use('/uploads', express.static(uploadsDir));

  // REST API routes
  app.use('/api', apiRouter);

  // GraphQL Yoga endpoint
  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    context: async ({ request }) => {
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie');
      const reqObj = {
        headers: {
          authorization: authHeader || undefined,
          cookie: cookieHeader || undefined,
        },
      } as any;
      const user = authenticateRequest(reqObj);
      return { user };
    },
  });
  app.use('/graphql', yoga);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: 'desktop-embedded',
      version: '1.0.0',
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  });

  // Production static distribution assets
  const distPath = options.distPath || process.env.CORTEX_DIST_DIR || path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Application bundle not found. Please run npm run build.');
      }
    });
  } else {
    app.get('*', (_req, res) => {
      res.send(`
        <html>
          <body style="font-family:sans-serif;padding:40px;background:#18181b;color:#f4f4f5;text-align:center;">
            <h2>Cortex Desktop Engine</h2>
            <p>API & Backend services running on port ${PORT}.</p>
            <p>Frontend static directory not found at: <code>${distPath}</code></p>
          </body>
        </html>
      `);
    });
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '127.0.0.1', () => {
      const actualPort = (server.address() as net.AddressInfo).port;
      const url = `http://127.0.0.1:${actualPort}`;
      console.log(`[Cortex Desktop Server] Online at: ${url}`);
      console.log(`[Cortex Desktop Server] GraphQL: ${url}/graphql`);
      console.log(`[Cortex Desktop Server] REST API: ${url}/api`);
      resolve({ app, server, port: actualPort, url });
    });
    server.on('error', (err) => {
      console.error('[Cortex Desktop Server] Listen error:', err);
      reject(err);
    });
  });
}

// Auto-run when executed directly via CLI
if (process.argv[1] && process.argv[1].includes('desktop-server')) {
  startDesktopServer().catch((err) => {
    console.error('Fatal desktop server startup error:', err);
    process.exit(1);
  });
}
