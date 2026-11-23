import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CachedEntry {
  expiresAt: number;
  payload: Record<string, unknown>;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CachedEntry>();

async function fetchJsonWithTimeout(url: string, timeoutMs = 9000): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ConsultaOptantesEmLote/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return null;
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/cnpj/:cnpj', async (req: Request, res: Response) => {
    const rawCnpj = String(req.params.cnpj || '').replace(/\D/g, '');

    if (rawCnpj.length !== 14) {
      res.status(400).json({
        sucesso: false,
        erro: 'CNPJ deve conter exatamente 14 dígitos numéricos.',
      });
      return;
    }

    const cached = cache.get(rawCnpj);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    const brasilApiData = await fetchJsonWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`);
    if (brasilApiData && brasilApiData.cnpj) {
      const payload = {
        sucesso: true,
        fonte: 'BrasilAPI',
        dados: brasilApiData,
      };
      cache.set(rawCnpj, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
      res.json(payload);
      return;
    }

    const minhaReceitaData = await fetchJsonWithTimeout(`https://minhareceita.org/${rawCnpj}`);
    if (minhaReceitaData && minhaReceitaData.cnpj) {
      const payload = {
        sucesso: true,
        fonte: 'Minha Receita',
        dados: minhaReceitaData,
      };
      cache.set(rawCnpj, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
      res.json(payload);
      return;
    }

    res.status(404).json({
      sucesso: false,
      erro: 'CNPJ não encontrado ou limite temporário das APIs públicas atingido.',
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
