import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import attendanceRoutes from './routes/attendanceRoutes.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import projectsRoutes from './routes/projectsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import filesRoutes from './routes/filesRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import { initDatabase, shutdownDatabase, getDatabaseHealth } from './data/database.js';

const app = express();
app.use(cors());
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'محاولات كثيرة، حاول لاحقاً' } });
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'HR Portal Starter API is running.' });
});

app.use('/auth', authLimiter, authRoutes);
app.use('/users', usersRoutes);
app.use('/projects', projectsRoutes);
app.use('/settings', settingsRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/reports', reportsRoutes);
app.use('/requests-center', leaveRoutes);
app.use('/files', filesRoutes);
app.use('/security', securityRoutes);
app.use('/payroll', payrollRoutes);
app.use('/system', systemRoutes);

app.get('/health/db', async (_req, res) => {
  try {
    const health = await getDatabaseHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

const PORT = process.env.PORT || 4000;

async function start() {
  await initDatabase();
  const server = app.listen(PORT, () => {
    console.log(`HR Portal Starter API listening on http://localhost:${PORT}`);
  });

  const graceful = async () => {
    console.log('Shutting down server...');
    server.close(async () => {
      await shutdownDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', graceful);
  process.on('SIGTERM', graceful);
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
