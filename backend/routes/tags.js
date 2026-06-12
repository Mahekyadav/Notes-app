const express = require('express');
const db = require('../db/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM tags WHERE user_id = ? ORDER BY name',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [result] = await db.execute(
      'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
      [req.user.id, name, color || '#888888']
    );
    res.status(201).json({ id: result.insertId, user_id: req.user.id, name, color: color || '#888888' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.execute(
      'DELETE FROM tags WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ message: 'Tag deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

module.exports = router;
