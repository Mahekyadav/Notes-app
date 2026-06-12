const express = require('express');
const db = require('../db/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

async function getNoteTags(noteId) {
  const [tags] = await db.execute(
    'SELECT t.* FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?',
    [noteId]
  );
  return tags;
}

router.get('/', async (req, res) => {
  const { q, tag } = req.query;
  const userId = req.user.id;

  try {
    let rows;
    if (tag) {
      [rows] = await db.execute(`
        SELECT DISTINCT n.* FROM notes n
        JOIN note_tags nt ON n.id = nt.note_id
        JOIN tags t ON nt.tag_id = t.id
        WHERE n.user_id = ? AND t.name = ?
        ORDER BY n.is_pinned DESC, n.updated_at DESC
      `, [userId, tag]);
    } else if (q) {
      [rows] = await db.execute(`
        SELECT * FROM notes
        WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
        ORDER BY is_pinned DESC, updated_at DESC
      `, [userId, `%${q}%`, `%${q}%`]);
    } else {
      [rows] = await db.execute(
        'SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC',
        [userId]
      );
    }

    const notesWithTags = await Promise.all(
      rows.map(async note => ({ ...note, tags: await getNoteTags(note.id) }))
    );
    res.json(notesWithTags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    const tags = await getNoteTags(rows[0].id);
    res.json({ ...rows[0], tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

router.post('/', async (req, res) => {
  const { title, content, tagIds } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const [result] = await db.execute(
      'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
      [req.user.id, title, content || '']
    );
    const noteId = result.insertId;

    const ids = Array.isArray(tagIds) ? tagIds : [];
    if (ids.length > 0) {
      const placeholders = ids.map(() => '(?, ?)').join(', ');
      const values = ids.flatMap(tid => [noteId, tid]);
      await db.query(`INSERT INTO note_tags (note_id, tag_id) VALUES ${placeholders}`, values);
    }

    const [noteRows] = await db.execute('SELECT * FROM notes WHERE id = ?', [noteId]);
    const tags = await getNoteTags(noteId);
    res.status(201).json({ ...noteRows[0], tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.put('/:id', async (req, res) => {
  const { title, content, tagIds } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const [result] = await db.execute(
      'UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [title, content || '', req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Note not found' });

    const noteId = req.params.id;
    const ids = Array.isArray(tagIds) ? tagIds : [];

    await db.execute('DELETE FROM note_tags WHERE note_id = ?', [noteId]);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '(?, ?)').join(', ');
      const values = ids.flatMap(tid => [noteId, tid]);
      await db.query(`INSERT INTO note_tags (note_id, tag_id) VALUES ${placeholders}`, values);
    }

    const [noteRows] = await db.execute('SELECT * FROM notes WHERE id = ?', [noteId]);
    const tags = await getNoteTags(noteId);
    res.json({ ...noteRows[0], tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.execute(
      'DELETE FROM notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.put('/:id/pin', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT is_pinned FROM notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Note not found' });

    const newPin = rows[0].is_pinned ? 0 : 1;
    await db.execute(
      'UPDATE notes SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [newPin, req.params.id, req.user.id]
    );

    const [noteRows] = await db.execute('SELECT * FROM notes WHERE id = ?', [req.params.id]);
    const tags = await getNoteTags(req.params.id);
    res.json({ ...noteRows[0], tags });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

module.exports = router;
