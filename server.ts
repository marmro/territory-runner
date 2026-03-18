import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';

const PORT = 3000;

// Initialize SQLite Database
const db = new Database('territories.sqlite');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS territories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    schedule TEXT NOT NULL
  );
`);

// Check if table is empty before inserting dummy data
const count = db.prepare('SELECT COUNT(*) as count FROM territories').get() as { count: number };

if (count.count === 0) {
  const insertStmt = db.prepare('INSERT INTO territories (name, city, schedule) VALUES (?, ?, ?)');
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

  dummyData.forEach(row => insertStmt.run(...row));
  console.log('Database initialized with dummy data.');
} else {
  console.log('Database already contains data, skipping initialization.');
}

async function startServer() {
  const app = express();
  
  app.use(express.json());

  // API Routes
  app.get('/api/search', (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;
    const stmt = db.prepare(`
      SELECT * FROM territories 
      WHERE name LIKE ? OR city LIKE ?
      ORDER BY name ASC
      LIMIT 20
    `);
    
    const results = stmt.all(searchTerm, searchTerm);
    res.json(results);
  });

  app.get('/api/territories/all', (req, res) => {
    const results = db.prepare('SELECT * FROM territories').all();
    res.json(results);
  });

  app.post('/api/territories', (req, res) => {
    const { name, city, schedule } = req.body;
    if (!name || !city || !schedule) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const stmt = db.prepare('INSERT INTO territories (name, city, schedule) VALUES (?, ?, ?)');
      const info = stmt.run(name, city, schedule);
      res.json({ id: info.lastInsertRowid, name, city, schedule });
    } catch (error) {
      console.error('Error adding territory:', error);
      res.status(500).json({ error: 'Failed to add territory' });
    }
  });

  app.put('/api/territories/:id', (req, res) => {
    const { id } = req.params;
    const { name, city, schedule } = req.body;
    
    try {
      const stmt = db.prepare('UPDATE territories SET name = ?, city = ?, schedule = ? WHERE id = ?');
      stmt.run(name, city, schedule, id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating territory:', error);
      res.status(500).json({ error: 'Failed to update territory' });
    }
  });

  app.delete('/api/territories/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM territories WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting territory:', error);
      res.status(500).json({ error: 'Failed to delete territory' });
    }
  });

  // Vite middleware for development
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
