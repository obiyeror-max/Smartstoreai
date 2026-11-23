import serverless from 'serverless-http';
import { createApiApp } from '../../server/app.ts';

const app = createApiApp();
export const handler = serverless(app);
