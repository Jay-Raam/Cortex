import path from 'node:path';
import fs from 'node:fs';
import { Workspace } from '../types';
import { workspaceManager } from './workspace-manager';

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'systems';
  language: string;
  framework: string;
  tags: string[];
  entryFile: string;
}

export interface ScaffoldResult {
  success: boolean;
  templateId: string;
  projectName: string;
  targetDirectory: string;
  filesCreated: string[];
  instructions: string[];
}

export class ScaffoldEngine {
  private templates: Map<string, TemplateMetadata> = new Map([
    [
      'react-vite-tailwind',
      {
        id: 'react-vite-tailwind',
        name: 'React 19 + Vite 6 + Tailwind CSS',
        description: 'Next-generation modern SPA template with TypeScript, Lucide icons, and Tailwind styling.',
        category: 'frontend',
        language: 'TypeScript',
        framework: 'React 19 + Vite',
        tags: ['react', 'vite', 'tailwind', 'typescript', 'frontend'],
        entryFile: 'src/App.tsx',
      },
    ],
    [
      'fastapi-python',
      {
        id: 'fastapi-python',
        name: 'Python FastAPI + Pydantic v2',
        description: 'High-performance async REST API with automatic OpenAPI docs, Pydantic validation, and Pytest.',
        category: 'backend',
        language: 'Python',
        framework: 'FastAPI',
        tags: ['python', 'fastapi', 'pydantic', 'api', 'backend'],
        entryFile: 'main.py',
      },
    ],
    [
      'express-node',
      {
        id: 'express-node',
        name: 'Express 5 + TypeScript + Zod',
        description: 'Production-ready Node.js REST API with TypeScript, Zod schema validation, and Vitest suite.',
        category: 'backend',
        language: 'TypeScript',
        framework: 'Express',
        tags: ['node', 'express', 'typescript', 'zod', 'backend'],
        entryFile: 'src/server.ts',
      },
    ],
    [
      'go-gin',
      {
        id: 'go-gin',
        name: 'Go 1.23 + Gin Framework',
        description: 'Lightweight, ultra-fast Go REST microservice utilizing Gin router and clean architecture.',
        category: 'backend',
        language: 'Go',
        framework: 'Gin',
        tags: ['go', 'golang', 'gin', 'microservice', 'backend'],
        entryFile: 'main.go',
      },
    ],
    [
      'rust-axum',
      {
        id: 'rust-axum',
        name: 'Rust + Axum + Tokio',
        description: 'Blazing fast, memory-safe async web service with Axum, Tokio runtime, and Serde JSON.',
        category: 'systems',
        language: 'Rust',
        framework: 'Axum',
        tags: ['rust', 'axum', 'tokio', 'systems', 'backend'],
        entryFile: 'src/main.rs',
      },
    ],
  ]);

  /**
   * Returns list of all available scaffolding templates.
   */
  getTemplates(): TemplateMetadata[] {
    return Array.from(this.templates.values());
  }

  /**
   * Retrieves a template's metadata by ID.
   */
  getTemplateById(id: string): TemplateMetadata | undefined {
    return this.templates.get(id.toLowerCase().trim());
  }

  /**
   * Scaffolds the specified template into a target workspace directory.
   */
  async scaffoldProject(
    targetDir: string,
    templateId: string,
    projectName: string = 'cortex-app'
  ): Promise<ScaffoldResult> {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Unknown project template: "${templateId}". Run "cortex templates" to view available templates.`);
    }

    const cleanProjectName = projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');

    const resolvedTarget = path.resolve(targetDir);
    fs.mkdirSync(resolvedTarget, { recursive: true });

    const filesToGenerate = this.generateTemplateFiles(template.id, cleanProjectName);
    const filesCreated: string[] = [];

    for (const [relPath, content] of Object.entries(filesToGenerate)) {
      // Security: Strictly enforce that relPath cannot escape resolvedTarget
      const safeFilePath = path.resolve(resolvedTarget, relPath);
      if (!safeFilePath.startsWith(resolvedTarget + path.sep) && safeFilePath !== resolvedTarget) {
        throw new Error(`Security Violation: Path traversal attempt detected with relative path: ${relPath}`);
      }

      const dir = path.dirname(safeFilePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(safeFilePath, content, 'utf8');
      filesCreated.push(relPath.replace(/\\/g, '/'));
    }

    const instructions = this.getPostScaffoldInstructions(template.id, cleanProjectName);

    return {
      success: true,
      templateId: template.id,
      projectName: cleanProjectName,
      targetDirectory: resolvedTarget,
      filesCreated: filesCreated.sort(),
      instructions,
    };
  }

  /**
   * Returns file map [relativePath -> stringContent] for a given template.
   */
  private generateTemplateFiles(templateId: string, projectName: string): Record<string, string> {
    switch (templateId) {
      case 'react-vite-tailwind':
        return {
          'package.json': JSON.stringify(
            {
              name: projectName,
              private: true,
              version: '0.1.0',
              type: 'module',
              scripts: {
                dev: 'vite',
                build: 'tsc && vite build',
                preview: 'vite preview',
              },
              dependencies: {
                react: '^19.0.0',
                'react-dom': '^19.0.0',
                'lucide-react': '^0.475.0',
              },
              devDependencies: {
                '@types/react': '^19.0.0',
                '@types/react-dom': '^19.0.0',
                '@vitejs/plugin-react': '^4.3.4',
                autoprefixer: '^10.4.20',
                postcss: '^8.5.1',
                tailwindcss: '^3.4.17',
                typescript: '^5.7.2',
                vite: '^6.1.0',
              },
            },
            null,
            2
          ),
          'tsconfig.json': JSON.stringify(
            {
              compilerOptions: {
                target: 'ES2022',
                useDefineForClassFields: true,
                lib: ['ES2022', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                skipLibCheck: true,
                moduleResolution: 'bundler',
                allowImportingTsExtensions: false,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: 'react-jsx',
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true,
              },
              include: ['src'],
            },
            null,
            2
          ),
          'vite.config.ts': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 3000,\n  },\n});\n`,
          'tailwind.config.js': `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n`,
          'postcss.config.js': `module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`,
          'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${projectName}</title>\n  </head>\n  <body class="bg-slate-900 text-slate-100 antialiased">\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
          'src/index.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
          'src/main.tsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
          'src/App.tsx': `import React, { useState } from 'react';\nimport { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-white">\n      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">\n        <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-xl mb-4">\n          <Sparkles className="w-8 h-8 animate-pulse" />\n        </div>\n        <h1 className="text-2xl font-bold tracking-tight mb-2">${projectName}</h1>\n        <p className="text-sm text-slate-400 mb-6">Scaffolded with React 19, Vite 6, Tailwind CSS & Cortex AI.</p>\n        <button\n          onClick={() => setCount((c) => c + 1)}\n          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition flex items-center justify-center gap-2"\n        >\n          Count is {count}\n          <ArrowRight className="w-4 h-4" />\n        </button>\n        <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-emerald-400">\n          <ShieldCheck className="w-4 h-4" /> Ready for development\n        </div>\n      </div>\n    </main>\n  );\n}\n`,
          'README.md': `# ${projectName}\n\nProduction-ready React 19 application scaffolded via Cortex AI.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
          '.gitignore': `node_modules\ndist\n.env\n.env.local\n*.log\n`,
        };

      case 'fastapi-python':
        return {
          'requirements.txt': `fastapi>=0.115.0\nuvicorn[standard]>=0.32.0\npydantic>=2.10.0\npytest>=8.3.0\nhttpx>=0.28.0\n`,
          'main.py': `from fastapi import FastAPI, HTTPException\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom models import Item, ItemCreate\n\napp = FastAPI(\n    title="${projectName}",\n    description="High-performance async REST API scaffolded via Cortex AI",\n    version="0.1.0"\n)\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["*"],\n    allow_credentials=True,\n    allow_methods=["*"],\n    allow_headers=["*"],\n)\n\nitems_db: dict[int, Item] = {}\n\n@app.get("/health")\nasync def health_check():\n    return {"status": "healthy", "service": "${projectName}"}\n\n@app.get("/items", response_model=list[Item])\nasync def list_items():\n    return list(items_db.values())\n\n@app.post("/items", response_model=Item, status_code=201)\nasync def create_item(payload: ItemCreate):\n    item_id = len(items_db) + 1\n    item = Item(id=item_id, **payload.model_dump())\n    items_db[item_id] = item\n    return item\n\nif __name__ == "__main__":\n    import uvicorn\n    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)\n`,
          'models.py': `from pydantic import BaseModel, Field\nfrom typing import Optional\n\nclass ItemBase(BaseModel):\n    name: str = Field(..., min_length=1, max_length=100)\n    description: Optional[str] = None\n    price: float = Field(..., gt=0)\n\nclass ItemCreate(ItemBase):\n    pass\n\nclass Item(ItemBase):\n    id: int\n`,
          'test_main.py': `from fastapi.testclient import TestClient\nfrom main import app\n\nclient = TestClient(app)\n\ndef test_health():\n    res = client.get("/health")\n    assert res.status_code == 200\n    assert res.json()["status"] == "healthy"\n\ndef test_create_and_list_item():\n    res = client.post("/items", json={"name": "Widget", "price": 19.99})\n    assert res.status_code == 201\n    data = res.json()\n    assert data["name"] == "Widget"\n    assert data["id"] == 1\n\n    list_res = client.get("/items")\n    assert list_res.status_code == 200\n    assert len(list_res.json()) >= 1\n`,
          'README.md': `# ${projectName}\n\nFastAPI async backend service scaffolded via Cortex AI.\n\n## Running the API\n\`\`\`bash\npip install -r requirements.txt\nuvicorn main:app --reload\n\`\`\`\nInteractive API docs: http://localhost:8000/docs\n`,
          '.gitignore': `__pycache__/\n*.py[cod]\n*$py.class\n.venv/\nenv/\nvenv/\n.pytest_cache/\n.env\n`,
        };

      case 'express-node':
        return {
          'package.json': JSON.stringify(
            {
              name: projectName,
              version: '0.1.0',
              description: 'Express 5 TypeScript REST API scaffolded via Cortex AI',
              main: 'dist/server.js',
              scripts: {
                build: 'tsc',
                start: 'node dist/server.js',
                dev: 'tsx watch src/server.ts',
                test: 'vitest run',
              },
              dependencies: {
                express: '^5.0.0',
                cors: '^2.8.5',
                dotenv: '^16.4.7',
                zod: '^3.24.1',
              },
              devDependencies: {
                '@types/express': '^5.0.0',
                '@types/cors': '^2.8.17',
                '@types/node': '^22.10.2',
                tsx: '^4.19.2',
                typescript: '^5.7.2',
                vitest: '^3.0.4',
              },
            },
            null,
            2
          ),
          'tsconfig.json': JSON.stringify(
            {
              compilerOptions: {
                target: 'ES2022',
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                outDir: './dist',
                rootDir: './src',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
              },
              include: ['src/**/*'],
            },
            null,
            2
          ),
          'src/server.ts': `import express from 'express';\nimport cors from 'cors';\nimport dotenv from 'dotenv';\nimport { apiRouter } from './routes/api';\n\ndotenv.config();\n\nexport const app = express();\nconst port = process.env.PORT || 3001;\n\napp.use(cors());\napp.use(express.json());\napp.use('/api', apiRouter);\n\nif (process.env.NODE_ENV !== 'test') {\n  app.listen(port, () => {\n    console.log(\`Server running at http://localhost:\${port}\`);\n  });\n}\n`,
          'src/routes/api.ts': `import { Router, Request, Response } from 'express';\nimport { z } from 'zod';\nimport { validateBody } from '../middleware/validate';\n\nexport const apiRouter = Router();\n\nconst CreateMessageSchema = z.object({\n  content: z.string().min(1).max(500),\n  sender: z.string().min(1),\n});\n\napiRouter.get('/health', (_req: Request, res: Response) => {\n  res.json({ status: 'ok', timestamp: new Date().toISOString() });\n});\n\napiRouter.post('/messages', validateBody(CreateMessageSchema), (req: Request, res: Response) => {\n  const message = { id: \`msg_\${Date.now()}\`, ...req.body, createdAt: new Date().toISOString() };\n  res.status(201).json({ success: true, message });\n});\n`,
          'src/middleware/validate.ts': `import { Request, Response, NextFunction } from 'express';\nimport { ZodSchema, ZodError } from 'zod';\n\nexport function validateBody(schema: ZodSchema) {\n  return (req: Request, res: Response, next: NextFunction) => {\n    try {\n      req.body = schema.parse(req.body);\n      next();\n    } catch (err) {\n      if (err instanceof ZodError) {\n        return res.status(400).json({ error: 'Validation failed', details: err.errors });\n      }\n      next(err);\n    }\n  };\n}\n`,
          'test/server.test.ts': `import { describe, it, expect } from 'vitest';\nimport { app } from '../src/server';\n\ndescribe('Express API Server', () => {\n  it('responds with health check', async () => {\n    const res = await app.request('/api/health');\n    expect(res.status).toBe(200);\n  });\n});\n`,
          'README.md': `# ${projectName}\n\nExpress 5 + TypeScript + Zod microservice scaffolded via Cortex AI.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
          '.gitignore': `node_modules/\ndist/\n.env\n*.log\n`,
        };

      case 'go-gin':
        return {
          'go.mod': `module ${projectName}\n\ngo 1.23\n\nrequire github.com/gin-gonic/gin v1.10.0\n`,
          'main.go': `package main\n\nimport (\n\t"net/http"\n\t"github.com/gin-gonic/gin"\n)\n\ntype Item struct {\n\tID   string \`json:"id"\`\n\tName string \`json:"name" binding:"required"\`\n}\n\nfunc SetupRouter() *gin.Engine {\n\tr := gin.Default()\n\n\tr.GET("/health", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "${projectName}"})\n\t})\n\n\tr.POST("/items", func(c *gin.Context) {\n\t\tvar input Item\n\t\tif err := c.ShouldBindJSON(&input); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})\n\t\t\treturn\n\t\t}\n\t\tinput.ID = "item_1"\n\t\tc.JSON(http.StatusCreated, input)\n\t})\n\n\treturn r\n}\n\nfunc main() {\n\tr := SetupRouter()\n\tr.Run(":8080")\n}\n`,
          'main_test.go': `package main\n\nimport (\n\t"net/http"\n\t"net/http/httptest"\n\t"testing"\n)\n\nfunc TestHealthCheck(t *testing.T) {\n\tr := SetupRouter()\n\tw := httptest.NewRecorder()\n\treq, _ := http.NewRequest("GET", "/health", nil)\n\tr.ServeHTTP(w, req)\n\n\tif w.Code != http.StatusOK {\n\t\tt.Errorf("Expected status 200, got %d", w.Code)\n\t}\n}\n`,
          'README.md': `# ${projectName}\n\nGo 1.23 Gin REST API scaffolded via Cortex AI.\n\n## Running\n\`\`\`bash\ngo run main.go\n\`\`\`\n`,
          '.gitignore': `bin/\n*.exe\n*.out\n.env\n`,
        };

      case 'rust-axum':
        return {
          'Cargo.toml': `[package]\nname = "${projectName}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\naxum = "0.7"\ntokio = { version = "1", features = ["full"] }\nserde = { version = "1.0", features = ["derive"] }\nserde_json = "1.0"\ntower-http = { version = "0.5", features = ["cors"] }\n`,
          'src/main.rs': `use axum::{\n    routing::get,\n    Json,\n    Router,\n};\nuse serde::Serialize;\nuse std::net::SocketAddr;\n\n#[derive(Serialize)]\nstruct HealthResponse {\n    status: &'static str,\n    service: &'static str,\n}\n\nasync fn health() -> Json<HealthResponse> {\n    Json(HealthResponse {\n        status: "ok",\n        service: "${projectName}",\n    })\n}\n\n#[tokio::main]\nasync fn main() {\n    let app = Router::new().route("/health", get(health));\n    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));\n    println!("Listening on http://{}", addr);\n    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();\n    axum::serve(listener, app).await.unwrap();\n}\n`,
          'README.md': `# ${projectName}\n\nRust Axum async service scaffolded via Cortex AI.\n\n## Running\n\`\`\`bash\ncargo run\n\`\`\`\n`,
          '.gitignore': `/target\n**/*.rs.bk\nCargo.lock\n.env\n`,
        };

      default:
        throw new Error(`Unhandled template id: ${templateId}`);
    }
  }

  private getPostScaffoldInstructions(templateId: string, projectName: string): string[] {
    switch (templateId) {
      case 'react-vite-tailwind':
        return [
          `cd ${projectName}`,
          'npm install',
          'npm run dev (starts Vite server on http://localhost:3000)',
        ];
      case 'fastapi-python':
        return [
          `cd ${projectName}`,
          'python -m venv .venv',
          'source .venv/bin/activate (or .venv\\Scripts\\activate on Windows)',
          'pip install -r requirements.txt',
          'uvicorn main:app --reload (API running on http://localhost:8000)',
        ];
      case 'express-node':
        return [
          `cd ${projectName}`,
          'npm install',
          'npm run dev (TypeScript live reload on http://localhost:3001)',
        ];
      case 'go-gin':
        return [
          `cd ${projectName}`,
          'go mod tidy',
          'go run main.go (Server running on http://localhost:8080)',
        ];
      case 'rust-axum':
        return [
          `cd ${projectName}`,
          'cargo run (Server running on http://localhost:3000)',
        ];
      default:
        return [`cd ${projectName}`];
    }
  }
}

export const scaffoldEngine = new ScaffoldEngine();
