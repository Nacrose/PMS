const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const XLSX = require('xlsx');

// GET export BOQ to Excel
router.get('/export', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                b.item_code,
                b.description,
                u.symbol as unit,
                b.quantity,
                b.rate,
                b.total,
                array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
            FROM boq_master b
            LEFT JOIN units u ON u.id = b.unit_id
            LEFT JOIN boq_tags bt ON bt.boq_master_id = b.id
            LEFT JOIN tags t ON t.id = bt.tag_id
            GROUP BY b.id, u.symbol
            ORDER BY b.item_code
        `);
        
        const data = result.rows.map(row => ({
            'Item Code': row.item_code,
            'Description': row.description,
            'Unit': row.unit,
            'Quantity': row.quantity,
            'Rate': row.rate,
            'Total': row.total,
            'Tags': row.tags ? row.tags.join(', ') : ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', `attachment; filename=boq_${new Date().toISOString().split('T')[0]}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;