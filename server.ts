import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { schema } from './src/server/graphql/schema';
import { apiRouter } from './src/server/routes/api';
import { authenticateRequest } from './src/server/auth/auth';
import { db } from './src/server/db/database';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Static uploads directory
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // REST API routes
  app.use('/api', apiRouter);

  // GraphQL Yoga endpoint
  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    context: async ({ request }) => {
      // Extract Bearer token from headers
      const authHeader = request.headers.get('authorization');
      let user = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        // Extract userId if present
        const reqObj = { headers: { authorization: authHeader } } as any;
        user = authenticateRequest(reqObj);
      }
      if (!user) {
        // Fallback to dev user in local dev mode
        user = db.getUserById('usr_dev_primary');
      }
      return { user };
    },
  });

  app.use('/graphql', yoga);

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/uploads/**', '**/*.json'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Cortex AI] Server listening on port ${PORT} (http://localhost:${PORT})`);
    console.log(`[Cortex AI] GraphQL Yoga endpoint: http://localhost:${PORT}/graphql`);
    console.log(`[Cortex AI] REST / SSE API: http://localhost:${PORT}/api`);
  });
}

startServer().catch((err) => {
  console.error('[Cortex AI] Failed to start server:', err);
  process.exit(1);
});
