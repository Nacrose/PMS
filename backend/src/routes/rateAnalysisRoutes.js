const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET all rate analyses with BOQ item info
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ra.*,
                b.item_code,
                b.description as item_description,
                u.symbol as base_unit,
                COUNT(rac.id) as component_count
            FROM rate_analysis ra
            JOIN boq_master b ON b.id = ra.boq_master_id
            LEFT JOIN units u ON u.id = ra.base_unit_id
            LEFT JOIN rate_analysis_components rac ON rac.rate_analysis_id = ra.id
            WHERE ra.is_active = true
            GROUP BY ra.id, b.item_code, b.description, u.symbol
            ORDER BY b.item_code
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET analysis for a specific BOQ item
router.get('/boq/:boq_id', async (req, res) => {
    try {
        const { boq_id } = req.params;
        const analysis = await pool.query(
            'SELECT * FROM rate_analysis WHERE boq_master_id = $1 AND is_active = true',
            [boq_id]
        );
        if (analysis.rows.length === 0) {
            return res.status(404).json({ error: 'No analysis found' });
        }
        const components = await pool.query(
            `SELECT rac.*, u.symbol as unit_symbol 
             FROM rate_analysis_components rac
             LEFT JOIN units u ON u.id = rac.unit_id
             WHERE rac.rate_analysis_id = $1
             ORDER BY rac.group_name, rac.id`,
            [analysis.rows[0].id]
        );
        res.json({ ...analysis.rows[0], components: components.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST create new analysis
router.post('/boq/:boq_id', async (req, res) => {
    try {
        const { boq_id } = req.params;
        const { name, description, overhead_percent, profit_percent, vat_percent } = req.body;
        const existing = await pool.query('SELECT id FROM rate_analysis WHERE boq_master_id = $1', [boq_id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Analysis already exists' });
        }
        const boq = await pool.query('SELECT unit_id FROM boq_master WHERE id = $1', [boq_id]);
        if (boq.rows.length === 0) return res.status(404).json({ error: 'BOQ item not found' });
        const base_unit_id = boq.rows[0].unit_id;
        const result = await pool.query(
            `INSERT INTO rate_analysis (boq_master_id, name, description, base_unit_id, overhead_percent, profit_percent, vat_percent)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [boq_id, name || '', description || '', base_unit_id, overhead_percent || 5, profit_percent || 5, vat_percent || 13]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT update analysis settings
router.put('/:analysis_id', async (req, res) => {
    try {
        const { analysis_id } = req.params;
        const { name, description, overhead_percent, profit_percent, vat_percent } = req.body;
        const result = await pool.query(
            `UPDATE rate_analysis 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 overhead_percent = COALESCE($3, overhead_percent),
                 profit_percent = COALESCE($4, profit_percent),
                 vat_percent = COALESCE($5, vat_percent),
                 updated_at = NOW()
             WHERE id = $6 AND is_active = true
             RETURNING *`,
            [name, description, overhead_percent, profit_percent, vat_percent, analysis_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Analysis not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET calculate total rate
router.get('/:analysis_id/calculate', async (req, res) => {
    try {
        const { analysis_id } = req.params;
        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(rac.total), 0) as subtotal,
                ra.overhead_percent,
                ra.profit_percent,
                ra.vat_percent
            FROM rate_analysis ra
            LEFT JOIN rate_analysis_components rac ON rac.rate_analysis_id = ra.id AND rac.is_optional = false
            WHERE ra.id = $1 AND ra.is_active = true
            GROUP BY ra.overhead_percent, ra.profit_percent, ra.vat_percent
        `, [analysis_id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Analysis not found' });
        const subtotal = parseFloat(result.rows[0].subtotal) || 0;
        const overhead = parseFloat(result.rows[0].overhead_percent) || 0;
        const profit = parseFloat(result.rows[0].profit_percent) || 0;
        const vat = parseFloat(result.rows[0].vat_percent) || 0;
        const withOverheadProfit = subtotal * (1 + overhead/100) * (1 + profit/100);
        const total_rate = withOverheadProfit * (1 + vat/100);
        res.json({
            subtotal: Math.round(subtotal * 100) / 100,
            overhead: overhead,
            profit: profit,
            vat: vat,
            with_overhead_profit: Math.round(withOverheadProfit * 100) / 100,
            total_rate: Math.round(total_rate * 100) / 100
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST add component to analysis
router.post('/:analysis_id/components', async (req, res) => {
    try {
        const { analysis_id } = req.params;
        const { component_type, name, unit_id, quantity_per_unit, rate, is_optional, group_name, source, transport_distance, royalty_percent } = req.body;
        const royalty_amount = (parseFloat(royalty_percent) || 0) / 100 * (parseFloat(quantity_per_unit) * parseFloat(rate));
        const result = await pool.query(
            `INSERT INTO rate_analysis_components 
             (rate_analysis_id, component_type, name, unit_id, quantity_per_unit, rate, is_optional, group_name, source, transport_distance, royalty_percent, royalty_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [analysis_id, component_type, name, unit_id, quantity_per_unit, rate, is_optional || false, group_name || 'General', source || '', transport_distance || 0, royalty_percent || 0, royalty_amount]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT update component
router.put('/components/:component_id', async (req, res) => {
    try {
        const { component_id } = req.params;
        const { component_type, name, unit_id, quantity_per_unit, rate, is_optional, group_name, source, transport_distance, royalty_percent } = req.body;
        const royalty_amount = (parseFloat(royalty_percent) || 0) / 100 * (parseFloat(quantity_per_unit) * parseFloat(rate));
        const result = await pool.query(
            `UPDATE rate_analysis_components 
             SET component_type = COALESCE($1, component_type),
                 name = COALESCE($2, name),
                 unit_id = COALESCE($3, unit_id),
                 quantity_per_unit = COALESCE($4, quantity_per_unit),
                 rate = COALESCE($5, rate),
                 is_optional = COALESCE($6, is_optional),
                 group_name = COALESCE($7, group_name),
                 source = COALESCE($8, source),
                 transport_distance = COALESCE($9, transport_distance),
                 royalty_percent = COALESCE($10, royalty_percent),
                 royalty_amount = $11,
                 updated_at = NOW()
             WHERE id = $12
             RETURNING *`,
            [component_type, name, unit_id, quantity_per_unit, rate, is_optional, group_name, source, transport_distance, royalty_percent, royalty_amount, component_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Component not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE component
router.delete('/components/:component_id', async (req, res) => {
    try {
        const { component_id } = req.params;
        await pool.query('DELETE FROM rate_analysis_components WHERE id = $1', [component_id]);
        res.json({ message: 'Component deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST copy analysis from one BOQ item to another
router.post('/copy/:source_boq_id/to/:target_boq_id', async (req, res) => {
    try {
        const { source_boq_id, target_boq_id } = req.params;
        const { copy_components = true, copy_overhead = true, copy_profit = true, copy_vat = true } = req.body;

        // Get source analysis
        const source = await pool.query('SELECT * FROM rate_analysis WHERE boq_master_id = $1 AND is_active = true', [source_boq_id]);
        if (source.rows.length === 0) {
            return res.status(404).json({ error: 'Source analysis not found' });
        }

        // Check if target already has analysis
        const existing = await pool.query('SELECT id FROM rate_analysis WHERE boq_master_id = $1', [target_boq_id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Target already has an analysis. Delete it first or edit manually.' });
        }

        // Get base unit from target BOQ
        const boq = await pool.query('SELECT unit_id FROM boq_master WHERE id = $1', [target_boq_id]);
        if (boq.rows.length === 0) return res.status(404).json({ error: 'Target BOQ item not found' });

        // Create new analysis for target
        const sourceData = source.rows[0];
        const newAnalysis = await pool.query(
            `INSERT INTO rate_analysis (boq_master_id, name, description, base_unit_id, overhead_percent, profit_percent, vat_percent)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                target_boq_id,
                sourceData.name,
                sourceData.description,
                boq.rows[0].unit_id,
                copy_overhead ? sourceData.overhead_percent : 5,
                copy_profit ? sourceData.profit_percent : 5,
                copy_vat ? sourceData.vat_percent : 13
            ]
        );

        // Copy components if requested
        if (copy_components) {
            const components = await pool.query(
                'SELECT * FROM rate_analysis_components WHERE rate_analysis_id = $1',
                [sourceData.id]
            );
            for (const comp of components.rows) {
                await pool.query(
                    `INSERT INTO rate_analysis_components 
                     (rate_analysis_id, component_type, name, unit_id, quantity_per_unit, rate, is_optional, group_name, source, transport_distance, royalty_percent, royalty_amount)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        newAnalysis.rows[0].id,
                        comp.component_type,
                        comp.name,
                        comp.unit_id,
                        comp.quantity_per_unit,
                        comp.rate,
                        comp.is_optional,
                        comp.group_name,
                        comp.source,
                        comp.transport_distance,
                        comp.royalty_percent,
                        comp.royalty_amount
                    ]
                );
            }
        }

        // Get the complete new analysis with components
        const result = await pool.query(
            `SELECT ra.*, 
                    json_agg(rac.*) as components
             FROM rate_analysis ra
             LEFT JOIN rate_analysis_components rac ON rac.rate_analysis_id = ra.id
             WHERE ra.id = $1
             GROUP BY ra.id`,
            [newAnalysis.rows[0].id]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;