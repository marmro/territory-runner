import express from 'express';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';

const { Pool } = pg;
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS territories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      schedule TEXT NOT NULL
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) as count FROM territories');
  if (parseInt(rows[0].count) === 0) {
    const dummyData = [
      ['Western Slope', 'Grand Junction, CO', 'Monday, Thursday'],
      ['Collegiate Peaks', 'Buena Vista, CO', 'Tuesday, Friday'],
      ['Clear Creek', 'Idaho Springs, CO', 'Monday, Wednesday, Friday'],
      ['Royal Gorge', 'Canon City, CO', 'Tuesday, Thursday'],
      ['Southern Plains', 'Pueblo, CO', 'Tuesday, Thursday'],
      ['Pikes Peak', 'Colorado Springs, CO', 'Monday, Wednesday, Friday'],
      ['Lower Arkansas', 'Arkansas Valley, CO', 'Wednesday'],
      ['Ute Pass', 'Woodland Park, CO', 'Tuesday, Friday'],
      ['High Plains', 'Greeley, CO', 'Monday, Thursday'],
      ['Northern Front Range', 'Fort Collins, CO', 'Monday, Wednesday, Friday'],
      ['Flatirons', 'Boulder, CO', 'Tuesday, Thursday'],
      ['Twin Peaks', 'Longmont, CO', 'Monday, Wednesday'],
      ['Gateway', 'DIA, CO', 'Every Day'],
      ['Northeast Plains', 'Ft. Morgan / Sterling, CO', 'Wednesday'],
      ['High Plains North', 'Cheyenne, WY', 'Tuesday, Friday'],
      ['Central Wyoming', 'Casper, WY', 'Wednesday'],
      ['East Metro', 'Aurora, CO', 'Monday, Wednesday, Friday'],
      ['West Metro', 'Lakewood/Golden/Arvada, CO', 'Every Day'],
      ['South Metro', 'Highlands Ranch, CO', 'Tuesday, Thursday'],
      ['Palmer Divide', 'Lone Tree / Castle Rock, CO', 'Monday, Thursday'],
      ['City Center', 'Downtown, CO', 'Every Day'],
      ['Yampa Valley', 'Steamboat Springs, CO', 'Thursday'],
    ];

    for (const [name, city, schedule] of dummyData) {
      await pool.query(
        'INSERT INTO territories (name, city, schedule) VALUES ($1, $2, $3)',
        [name, city, schedule]
      );
    }
    console.log('Database seeded with dummy data.');
  } else {
    console.log('Database already contains data, skipping seed.');
  }
}

async function startServer() {
  await initDb();

  const app = express();
  app.use(express.json());

  // Search territories
  app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') return res.json([]);

    const { rows } = await pool.query(
      `SELECT * FROM territories 
       WHERE name ILIKE $1 OR city ILIKE $1
       ORDER BY name ASC LIMIT 20`,
      [`%${q}%`]
    );
    res.json(rows);
  });

  // Get all territories
  app.get('/api/territories/all', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM territories ORDER BY name ASC');
    res.json(rows);
  });

  // Add a territory
  app.post('/api/territories', async (req, res) => {
    const { name, city, schedule } = req.body;
    if (!name || !city || !schedule) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const { rows } = await pool.query(
        'INSERT INTO territories (name, city, schedule) VALUES ($1, $2, $3) RETURNING *',
        [name, city, schedule]
      );
      res.json(rows[0]);
    } catch (error) {
      console.error('Error adding territory:', error);
      res.status(500).json({ error: 'Failed to add territory' });
    }
  });

  // Update a territory
  app.put('/api/territories/:id', async (req, res) => {
    const { id } = req.params;
    const { name, city, schedule } = req.body;
    try {
      await pool.query(
        'UPDATE territories SET name = $1, city = $2, schedule = $3 WHERE id = $4',
        [name, city, schedule, id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating territory:', error);
      res.status(500).json({ error: 'Failed to update territory' });
    }
  });

  // Delete a territory
  app.delete('/api/territories/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM territories WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting territory:', error);
      res.status(500).json({ error: 'Failed to delete territory' });
    }
  });

  // Vite dev middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
