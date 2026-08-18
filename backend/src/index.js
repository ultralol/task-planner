require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const templateRoutes = require('./routes/templates');
const dayRoutes = require('./routes/days');
const taskRoutes = require('./routes/tasks');
const analyticsRoutes = require('./routes/analytics');
const noteRoutes = require('./routes/notes');
const userRoutes = require('./routes/users');
const telegramRoutes = require('./routes/telegram');
const telegram = require('./services/telegram');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/days', dayRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/telegram', telegramRoutes);

app.use((req, res) => res.status(404).json({ error: 'Не найдено' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Task planner API listening on port ${PORT}`);
  telegram.init();
});
