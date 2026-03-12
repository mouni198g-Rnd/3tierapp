const express = require('express');
const cors    = require('cors');
const sql     = require('mssql');

const app  = express();
const PORT = process.env.PORT || 8080;

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin:       process.env.FRONTEND_URL || 'https://3tierapp-fe.azurewebsites.net',
  methods:      ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ─── AZURE SQL CONFIG ─────────────────────────────────────────
const sqlConfig = {
  user:     process.env.SQL_USER     || 'sqladmin',
  password: process.env.SQL_PASSWORD || 'P@ssw0rd1234!',
  server:   process.env.SQL_SERVER   || '3tierapp-sql.database.windows.net',
  database: process.env.SQL_DATABASE || '3tierapp-db',
  options: {
    encrypt:                true,
    trustServerCertificate: false,
    connectTimeout:         0,
    requestTimeout:         0
  }
};

// ─── DB HELPER ────────────────────────────────────────────────
async function getPool() {
  return await sql.connect(sqlConfig);
}

// ─── INIT DB TABLE ────────────────────────────────────────────
// Creates tasks table if it doesn't exist on first run
async function initDB() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sysobjects WHERE name='tasks' AND xtype='U'
      )
      CREATE TABLE tasks (
        id        INT IDENTITY(1,1) PRIMARY KEY,
        text      NVARCHAR(500)     NOT NULL,
        done      BIT               NOT NULL DEFAULT 0,
        createdAt DATETIME          NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log('✅ Database table ready');
  } catch (err) {
    console.error('⚠️  DB init error (will retry on request):', err.message);
  }
}

// ─── ROOT ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app:    '3-Tier Todo API',
    tier:   'Tier 2 - Node.js Express',
    status: 'running'
  });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── GET ALL TASKS ────────────────────────────────────────────
// GET /api/tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request().query(
      'SELECT id, text, done FROM tasks ORDER BY createdAt ASC'
    );
    // Convert SQL BIT (0/1) to boolean
    const tasks = result.recordset.map(t => ({
      id:   t.id,
      text: t.text,
      done: t.done === true || t.done === 1
    }));
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/tasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks', detail: err.message });
  }
});

// ─── ADD TASK ─────────────────────────────────────────────────
// POST /api/tasks   body: { text: "..." }
app.post('/api/tasks', async (req, res) => {
  const text = req.body && req.body.text ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Task text is required' });
  }
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('text', sql.NVarChar, text)
      .query('INSERT INTO tasks (text) OUTPUT INSERTED.id, INSERTED.text, INSERTED.done VALUES (@text)');
    const task = result.recordset[0];
    res.status(201).json({ id: task.id, text: task.text, done: false });
  } catch (err) {
    console.error('POST /api/tasks error:', err.message);
    res.status(500).json({ error: 'Failed to add task', detail: err.message });
  }
});

// ─── TOGGLE TASK ──────────────────────────────────────────────
// POST /api/tasks/:id/toggle
app.post('/api/tasks/:id/toggle', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid task id' });
  try {
    const pool = await getPool();
    // Flip the done bit
    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE tasks SET done = CASE WHEN done = 1 THEN 0 ELSE 1 END WHERE id = @id');
    // Fetch updated task
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id, text, done FROM tasks WHERE id = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Task not found' });
    const task = result.recordset[0];
    res.json({ id: task.id, text: task.text, done: task.done === true || task.done === 1 });
  } catch (err) {
    console.error('POST /api/tasks/:id/toggle error:', err.message);
    res.status(500).json({ error: 'Failed to toggle task', detail: err.message });
  }
});

// ─── DELETE TASK ──────────────────────────────────────────────
// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid task id' });
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM tasks OUTPUT DELETED.id WHERE id = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/tasks/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete task', detail: err.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n✅ Todo Backend API running on port ${PORT}`);
  console.log(`   Health : http://localhost:${PORT}/api/health`);
  console.log(`   Tasks  : http://localhost:${PORT}/api/tasks\n`);
  await initDB();
});

module.exports = app;
