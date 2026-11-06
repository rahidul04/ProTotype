import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(cors());
app.use(express.json());

let Run;
if (process.env.MONGODB_URI) {
  await mongoose.connect(process.env.MONGODB_URI);
  const runSchema = new mongoose.Schema({
    wpm: Number, accuracy: Number, correct: Number, errors: Number,
    duration: Number, level: String, createdAt: { type: Date, default: Date.now },
  });
  Run = mongoose.model('Run', runSchema);
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: Run ? 'connected' : 'local-only' }));
app.get('/api/runs', async (_req, res) => {
  if (!Run) return res.json({ runs: [], persistence: 'local-only' });
  res.json({ runs: await Run.find().sort({ createdAt: -1 }).limit(20), persistence: 'mongodb' });
});
app.post('/api/runs', async (req, res) => {
  if (!Run) return res.status(503).json({ message: 'MongoDB is not configured. The browser saves this run locally.' });
  res.status(201).json({ run: await Run.create(req.body) });
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(port, () => console.log(`ProTotype API listening on http://localhost:${port}`));
