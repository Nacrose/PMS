const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET all BOQ items with tags
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                b.*,
                u.symbol as unit,
                array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
            FROM boq_master b
            LEFT JOIN units u ON u.id = b.unit_id
            LEFT JOIN boq_tags bt ON bt.boq_master_id = b.id
            LEFT JOIN tags t ON t.id = bt.tag_id
            GROUP BY b.id, u.symbol
            ORDER BY b.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create new BOQ item
router.post('/', async (req, res) => {
    try {
        const { item_code, description, unit_id, quantity, rate } = req.body;
        const result = await pool.query(
            `INSERT INTO boq_master (item_code, description, unit_id, quantity, rate)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [item_code, description, unit_id, quantity, rate]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT update BOQ item
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { description, unit_id, quantity, rate } = req.body;
        const result = await pool.query(
            `UPDATE boq_master 
             SET description = COALESCE($1, description),
                 unit_id = COALESCE($2, unit_id),
                 quantity = COALESCE($3, quantity),
                 rate = COALESCE($4, rate),
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [description, unit_id, quantity, rate, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE archive BOQ item
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM boq_master WHERE id = $1', [id]);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET stats
router.get('/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_items,
                SUM(quantity) as total_quantity,
                SUM(total) as total_value
            FROM boq_master
        `);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;