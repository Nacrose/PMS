const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET all tags
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tags ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create new tag
router.post('/', async (req, res) => {
    try {
        const { name, color, description } = req.body;
        const result = await pool.query(
            'INSERT INTO tags (name, color, description) VALUES ($1, $2, $3) RETURNING *',
            [name, color || '#808080', description || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST assign tag to BOQ item
router.post('/assign', async (req, res) => {
    try {
        const { boq_id, tag_id } = req.body;
        const result = await pool.query(
            'INSERT INTO boq_tags (boq_master_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
            [boq_id, tag_id]
        );
        res.status(201).json(result.rows[0] || { message: 'Already assigned' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE remove tag from BOQ item
router.delete('/remove/:boq_id/:tag_id', async (req, res) => {
    try {
        const { boq_id, tag_id } = req.params;
        await pool.query('DELETE FROM boq_tags WHERE boq_master_id = $1 AND tag_id = $2', [boq_id, tag_id]);
        res.json({ message: 'Tag removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE tag (if not used)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const used = await pool.query('SELECT id FROM boq_tags WHERE tag_id = $1 LIMIT 1', [id]);
        if (used.rows.length > 0) {
            return res.status(400).json({ error: 'Tag is used in BOQ items' });
        }
        await pool.query('DELETE FROM tags WHERE id = $1', [id]);
        res.json({ message: 'Tag deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;