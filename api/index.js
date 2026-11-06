import { handle } from 'hono/vercel';
import { app } from '../src/worker/index.js';

export const config = {
  runtime: 'edge',
};

export default handle(app);
