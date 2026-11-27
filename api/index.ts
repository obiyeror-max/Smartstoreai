import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url) {
    const parsed = new URL(req.url, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__vercel_path');
    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__vercel_path');
      const qs = parsed.searchParams.toString();
      const cleanPath = rewrittenPath.replace(/^\/+/, '');
      req.url = `/api/${cleanPath}${qs ? `?${qs}` : ''}`;
    }
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
