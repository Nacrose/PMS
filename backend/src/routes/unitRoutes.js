const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM units ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, symbol, category } = req.body;
        const result = await pool.query(
            'INSERT INTO units (name, symbol, category) VALUES ($1, $2, $3) RETURNING *',
            [name, symbol, category || 'Custom']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const used = await pool.query('SELECT id FROM boq_master WHERE unit_id = $1 LIMIT 1', [id]);
        if (used.rows.length > 0) {
            return res.status(400).json({ error: 'Unit is used in BOQ items' });
        }
        await pool.query('DELETE FROM units WHERE id = $1', [id]);
        res.json({ message: 'Unit deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;