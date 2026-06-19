import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './RateAnalysisPage.css';

function RateAnalysisPage({ onBack }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [units, setUnits] = useState([]);
    const [types, setTypes] = useState(['Material', 'Labor', 'Equipment', 'Subcontract', 'Other']);
    const [expandedItem, setExpandedItem] = useState(null);
    const [analysisData, setAnalysisData] = useState({});
    const [calculatedRates, setCalculatedRates] = useState({});
    const [newComponent, setNewComponent] = useState({});
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [newUnit, setNewUnit] = useState({ name: '', symbol: '', category: 'Custom' });
    const [newType, setNewType] = useState('');
    const [editingComp, setEditingComp] = useState(null);
    const [editCompData, setEditCompData] = useState({});

    const API = 'https://pms-backend.onrender.com/api';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [boqRes, unitsRes, typesRes] = await Promise.all([
                axios.get(`${API}/boq`),
                axios.get(`${API}/units`),
                axios.get(`${API}/component-types`).catch(() => ({ data: [] }))
            ]);
            setItems(boqRes.data);
            setUnits(unitsRes.data);
            if (typesRes.data.length) setTypes(typesRes.data.map(t => t.name));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadAnalysis = async (itemId) => {
        try {
            const res = await axios.get(`${API}/rate-analysis/boq/${itemId}`);
            setAnalysisData(prev => ({ ...prev, [itemId]: res.data }));
            const calc = await axios.get(`${API}/rate-analysis/${res.data.id}/calculate`);
            setCalculatedRates(prev => ({ ...prev, [itemId]: calc.data }));
            return res.data;
        } catch (e) {
            setAnalysisData(prev => ({ ...prev, [itemId]: null }));
            return null;
        }
    };

    const createAnalysis = async (itemId) => {
        try {
            const item = items.find(i => i.id === itemId);
            await axios.post(`${API}/rate-analysis/boq/${itemId}`, {
                name: `${item.item_code} Rate Analysis`,
                description: `Rate analysis for ${item.description}`,
                overhead_percent: 5,
                profit_percent: 5,
                vat_percent: 13
            });
            await loadAnalysis(itemId);
            setExpandedItem(itemId);
            alert('Analysis created!');
        } catch (e) {
            alert('Failed to create analysis');
        }
    };

    const toggleExpand = async (itemId) => {
        if (expandedItem === itemId) {
            setExpandedItem(null);
            return;
        }
        if (!analysisData[itemId]) {
            await loadAnalysis(itemId);
        }
        setExpandedItem(itemId);
    };

    const getUnitSymbol = (id) => {
        const u = units.find(u => u.id === id);
        return u ? u.symbol : id;
    };

    const formatCurrency = (val) => {
        return parseFloat(val).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    };

    // ---- Component CRUD ----
    const addComponent = async (itemId, analysisId) => {
        const comp = newComponent[itemId] || {};
        if (!comp.name || !comp.unit_id || !comp.quantity_per_unit || !comp.rate) {
            alert('Please fill all fields');
            return;
        }
        try {
            await axios.post(`${API}/rate-analysis/${analysisId}/components`, {
                component_type: comp.component_type || 'Material',
                name: comp.name,
                unit_id: comp.unit_id,
                quantity_per_unit: parseFloat(comp.quantity_per_unit),
                rate: parseFloat(comp.rate),
                is_optional: false,
                group_name: 'General'
            });
            setNewComponent({ ...newComponent, [itemId]: {} });
            await loadAnalysis(itemId);
        } catch (e) {
            alert('Failed to add component');
        }
    };

    const deleteComponent = async (compId, itemId) => {
        if (!window.confirm('Delete this component?')) return;
        try {
            await axios.delete(`${API}/rate-analysis/components/${compId}`);
            await loadAnalysis(itemId);
        } catch (e) {
            alert('Failed to delete component');
        }
    };

    const updateComponent = async (compId, field, value, itemId) => {
        try {
            await axios.put(`${API}/rate-analysis/components/${compId}`, {
                [field]: field === 'quantity_per_unit' || field === 'rate' ? parseFloat(value) : value
            });
            await loadAnalysis(itemId);
        } catch (e) {
            alert('Failed to update');
        }
    };

    const updateAnalysisSetting = async (analysisId, field, value, itemId) => {
        try {
            await axios.put(`${API}/rate-analysis/${analysisId}`, { [field]: parseFloat(value) });
            await loadAnalysis(itemId);
        } catch (e) {
            alert('Failed to update');
        }
    };

    // ---- Unit Management ----
    const addUnit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/units`, newUnit);
            await loadData();
            setNewUnit({ name: '', symbol: '', category: 'Custom' });
            setShowUnitModal(false);
        } catch (e) { alert('Failed'); }
    };

    const deleteUnit = async (id) => {
        if (!window.confirm('Delete unit?')) return;
        try {
            await axios.delete(`${API}/units/${id}`);
            await loadData();
        } catch (e) { alert(e.response?.data?.error || 'Failed'); }
    };

    // ---- Type Management ----
    const addType = async (e) => {
        e.preventDefault();
        try {
            if (!newType || types.includes(newType)) { alert('Unique type name required'); return; }
            await axios.post(`${API}/component-types`, { name: newType });
            setTypes([...types, newType]);
            setNewType('');
            setShowTypeModal(false);
        } catch (e) { alert('Failed'); }
    };

    const deleteType = async (name) => {
        if (!window.confirm(`Delete type "${name}"?`)) return;
        try {
            await axios.delete(`${API}/component-types/${name}`);
            setTypes(types.filter(t => t !== name));
        } catch (e) { alert(e.response?.data?.error || 'Failed'); }
    };

    // ---- Copy Analysis ----
    const copyAnalysis = async (sourceId, targetId) => {
        if (!window.confirm(`Copy analysis from ${items.find(i => i.id === sourceId)?.item_code} to ${items.find(i => i.id === targetId)?.item_code}?`)) return;
        try {
            await axios.post(`${API}/rate-analysis/copy/${sourceId}/to/${targetId}`);
            await loadAnalysis(targetId);
            alert('Analysis copied successfully!');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to copy analysis');
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="rate-page">
            <div className="rate-header">
                <button className="back-btn" onClick={onBack}>← Back to BOQ</button>
                <h2>💰 Rate Analysis Dashboard</h2>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={() => setShowUnitModal(true)}>Units</button>
                    <button className="btn-secondary" onClick={() => setShowTypeModal(true)}>Types</button>
                </div>
            </div>

            {/* Unit Modal */}
            {showUnitModal && (
                <div className="modal-overlay" onClick={() => setShowUnitModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Manage Units</h3>
                        <form onSubmit={addUnit}>
                            <div className="form-group">
                                <label>Add New Unit</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={newUnit.name} onChange={e => setNewUnit({...newUnit, name: e.target.value})} placeholder="Name" required />
                                    <input type="text" value={newUnit.symbol} onChange={e => setNewUnit({...newUnit, symbol: e.target.value})} placeholder="Symbol" required />
                                    <select value={newUnit.category} onChange={e => setNewUnit({...newUnit, category: e.target.value})}>
                                        <option value="Volume">Volume</option><option value="Weight">Weight</option>
                                        <option value="Length">Length</option><option value="Area">Area</option>
                                        <option value="Count">Count</option><option value="Time">Time</option><option value="Custom">Custom</option>
                                    </select>
                                    <button type="submit" className="btn-primary">Add</button>
                                </div>
                            </div>
                        </form>
                        <hr />
                        <div><label>Existing Units</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {units.map(u => <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f3f4', padding: '4px 8px', borderRadius: '4px' }}>
                                {u.symbol} ({u.name})
                                <button onClick={() => deleteUnit(u.id)} style={{ background: 'none', border: 'none', color: '#ea4335', cursor: 'pointer' }}>×</button>
                            </span>)}
                        </div></div>
                        <button className="btn-secondary" onClick={() => setShowUnitModal(false)}>Close</button>
                    </div>
                </div>
            )}

            {/* Type Modal */}
            {showTypeModal && (
                <div className="modal-overlay" onClick={() => setShowTypeModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Manage Component Types</h3>
                        <form onSubmit={addType}>
                            <div className="form-group">
                                <label>Add New Type</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={newType} onChange={e => setNewType(e.target.value)} placeholder="Type name" required />
                                    <button type="submit" className="btn-primary">Add</button>
                                </div>
                            </div>
                        </form>
                        <hr />
                        <div><label>Existing Types</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {types.map(t => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f3f4', padding: '4px 8px', borderRadius: '4px' }}>
                                {t}
                                <button onClick={() => deleteType(t)} style={{ background: 'none', border: 'none', color: '#ea4335', cursor: 'pointer' }}>×</button>
                            </span>)}
                        </div></div>
                        <button className="btn-secondary" onClick={() => setShowTypeModal(false)}>Close</button>
                    </div>
                </div>
            )}

            {/* Main Table */}
            <div className="table-wrap">
                <table className="rate-table">
                    <thead>
                        <tr>
                            <th>Item Code</th>
                            <th>Description</th>
                            <th>Unit</th>
                            <th>Status</th>
                            <th>Components</th>
                            <th>Total Rate</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => {
                            const analysis = analysisData[item.id];
                            const comps = analysis?.components || [];
                            const calc = calculatedRates[item.id];
                            const isExpanded = expandedItem === item.id;
                            const hasAnalysis = !!analysis;

                            return (
                                <React.Fragment key={item.id}>
                                    <tr>
                                        <td><strong>{item.item_code}</strong></td>
                                        <td>{item.description}</td>
                                        <td>{item.unit}</td>
                                        <td>
                                            {hasAnalysis ? (
                                                <span className="status-done">✅ Done</span>
                                            ) : (
                                                <span className="status-none">🔴 None</span>
                                            )}
                                        </td>
                                        <td>{hasAnalysis ? comps.length : '-'}</td>
                                        <td>{calc ? `₹${formatCurrency(calc.total_rate)}` : '-'}</td>
                                        <td>
                                            {hasAnalysis ? (
                                                <button className="btn-primary" onClick={() => toggleExpand(item.id)}>
                                                    {isExpanded ? 'Hide' : 'View Components'}
                                                </button>
                                            ) : (
                                                <button className="btn-secondary" onClick={() => createAnalysis(item.id)}>
                                                    Create Analysis
                                                </button>
                                            )}
                                            {hasAnalysis && (
                                                <select className="copy-select" onChange={(e) => {
                                                    if (e.target.value) {
                                                        copyAnalysis(item.id, e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }} value="">
                                                    <option value="">📋 Copy to...</option>
                                                    {items.filter(i => i.id !== item.id && !analysisData[i.id]).map(i => (
                                                        <option key={i.id} value={i.id}>{i.item_code} - {i.description}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && hasAnalysis && (
                                        <tr>
                                            <td colSpan="7">
                                                <div className="components-section">
                                                    <div className="analysis-settings">
                                                        <label>Overhead: <input type="number" step="0.5" defaultValue={analysis.overhead_percent} onBlur={e => updateAnalysisSetting(analysis.id, 'overhead_percent', e.target.value, item.id)} /></label>
                                                        <label>Profit: <input type="number" step="0.5" defaultValue={analysis.profit_percent} onBlur={e => updateAnalysisSetting(analysis.id, 'profit_percent', e.target.value, item.id)} /></label>
                                                        <label>VAT: <input type="number" step="0.5" defaultValue={analysis.vat_percent} onBlur={e => updateAnalysisSetting(analysis.id, 'vat_percent', e.target.value, item.id)} /></label>
                                                        <span className="calc-total">Total: ₹{calc ? formatCurrency(calc.total_rate) : '0.00'}</span>
                                                    </div>

                                                    <table className="comp-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Type</th>
                                                                <th>Name</th>
                                                                <th>Unit</th>
                                                                <th>Qty/Unit</th>
                                                                <th>Rate</th>
                                                                <th>Total</th>
                                                                <th>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {comps.map(comp => (
                                                                <tr key={comp.id}>
                                                                    <td>
                                                                        <select defaultValue={comp.component_type} onChange={e => updateComponent(comp.id, 'component_type', e.target.value, item.id)}>
                                                                            {types.map(t => <option key={t} value={t}>{t}</option>)}
                                                                        </select>
                                                                    </td>
                                                                    <td><input type="text" defaultValue={comp.name} onBlur={e => updateComponent(comp.id, 'name', e.target.value, item.id)} /></td>
                                                                    <td>
                                                                        <select defaultValue={comp.unit_id} onChange={e => updateComponent(comp.id, 'unit_id', e.target.value, item.id)}>
                                                                            {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                                                                        </select>
                                                                    </td>
                                                                    <td><input type="number" step="0.01" defaultValue={comp.quantity_per_unit} onBlur={e => updateComponent(comp.id, 'quantity_per_unit', e.target.value, item.id)} /></td>
                                                                    <td><input type="number" step="0.01" defaultValue={comp.rate} onBlur={e => updateComponent(comp.id, 'rate', e.target.value, item.id)} /></td>
                                                                    <td>₹{comp.total}</td>
                                                                    <td><button className="btn-delete" onClick={() => deleteComponent(comp.id, item.id)}>Delete</button></td>
                                                                </tr>
                                                            ))}
                                                            <tr className="new-row">
                                                                <td>
                                                                    <select value={newComponent[item.id]?.component_type || 'Material'} onChange={e => setNewComponent({...newComponent, [item.id]: {...newComponent[item.id], component_type: e.target.value}})}>
                                                                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td><input type="text" placeholder="Name" value={newComponent[item.id]?.name || ''} onChange={e => setNewComponent({...newComponent, [item.id]: {...newComponent[item.id], name: e.target.value}})} /></td>
                                                                <td>
                                                                    <select value={newComponent[item.id]?.unit_id || ''} onChange={e => setNewComponent({...newComponent, [item.id]: {...newComponent[item.id], unit_id: e.target.value}})}>
                                                                        <option value="">Select</option>
                                                                        {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td><input type="number" step="0.01" placeholder="0.00" value={newComponent[item.id]?.quantity_per_unit || ''} onChange={e => setNewComponent({...newComponent, [item.id]: {...newComponent[item.id], quantity_per_unit: e.target.value}})} /></td>
                                                                <td><input type="number" step="0.01" placeholder="0.00" value={newComponent[item.id]?.rate || ''} onChange={e => setNewComponent({...newComponent, [item.id]: {...newComponent[item.id], rate: e.target.value}})} /></td>
                                                                <td>-</td>
                                                                <td><button className="btn-save" onClick={() => addComponent(item.id, analysis.id)}>Add</button></td>
                                                            </tr>
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="total-row">
                                                                <td colSpan="5" style={{ textAlign: 'right' }}><strong>Subtotal</strong></td>
                                                                <td><strong>₹{calc ? formatCurrency(calc.subtotal) : '0.00'}</strong></td>
                                                                <td></td>
                                                            </tr>
                                                            <tr className="grand-row">
                                                                <td colSpan="5" style={{ textAlign: 'right' }}><strong>Total Rate (with OH, Profit, VAT)</strong></td>
                                                                <td><strong>₹{calc ? formatCurrency(calc.total_rate) : '0.00'}</strong></td>
                                                                <td></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="rate-footer">
                <span>{items.length} items</span>
                <span>💡 Create analysis, add components, copy to other items</span>
            </div>
        </div>
    );
}

export default RateAnalysisPage;