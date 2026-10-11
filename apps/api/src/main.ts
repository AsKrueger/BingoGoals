import 'reflect-metadata';
import { createApp } from './app.setup.js';

const app = await createApp();
await app.listen(process.env.PORT ?? 3000);
