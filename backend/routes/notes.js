const express = require('express');
const db = require('../db/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

async function getNoteTags(noteId) {
  const result = await db.query(
    'SELECT t.* FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = $1',
    [noteId]
  );
  return result.rows;
}

router.get('/', async (req, res) => {
  const { q, tag } = req.query;
  const userId = req.user.id;

  try {
    let result;
    if (tag) {
      result = await db.query(`
        SELECT DISTINCT n.* FROM notes n
        JOIN note_tags nt ON n.id = nt.note_id
        JOIN tags t ON nt.tag_id = t.id
        WHERE n.user_id = $1 AND t.name = $2
        ORDER BY n.is_pinned DESC, n.updated_at DESC
      `, [userId, tag]);
    } else if (q) {
      result = await db.query(`
        SELECT * FROM notes
        WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $3)
        ORDER BY is_pinned DESC, updated_at DESC
      `, [userId, `%${q}%`, `%${q}%`]);
    } else {
      result = await db.query(
        'SELECT * FROM notes WHERE user_id = $1 ORDER BY is_pinned DESC, updated_at DESC',
        [userId]
      );
    }

    const notesWithTags = await Promise.all(
      result.rows.map(async note => ({ ...note, tags: await getNoteTags(note.id) }))
    );
    res.json(notesWithTags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    const tags = await getNoteTags(result.rows[0].id);
    res.json({ ...result.rows[0], tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

router.post('/', async (req, res) => {
  const { title, content, tagIds } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const result = await db.query(
      'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, title, content || '']
    );
    const note = result.rows[0];

    const ids = Array.isArray(tagIds) ? tagIds : [];
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const values = ids.flatMap(tid => [note.id, tid]);
      await db.query(`INSERT INTO note_tags (note_id, tag_id) VALUES ${placeholders}`, values);
    }

    const tags = await getNoteTags(note.id);
    res.status(201).json({ ...note, tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.put('/:id', async (req, res) => {
  const { title, content, tagIds } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const result = await db.query(
      'UPDATE notes SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
      [title, content || '', req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Note not found' });

    const note = result.rows[0];
    const ids = Array.isArray(tagIds) ? tagIds : [];

    await db.query('DELETE FROM note_tags WHERE note_id = $1', [note.id]);

    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const values = ids.flatMap(tid => [note.id, tid]);
      await db.query(`INSERT INTO note_tags (note_id, tag_id) VALUES ${placeholders}`, values);
    }

    const tags = await getNoteTags(note.id);
    res.json({ ...note, tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.put('/:id/pin', async (req, res) => {
  try {
    const check = await db.query(
      'SELECT is_pinned FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

    const newPin = check.rows[0].is_pinned ? 0 : 1;
    const result = await db.query(
      'UPDATE notes SET is_pinned = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [newPin, req.params.id, req.user.id]
    );

    const tags = await getNoteTags(req.params.id);
    res.json({ ...result.rows[0], tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

module.exports = router;
