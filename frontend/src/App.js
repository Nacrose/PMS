import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RateAnalysisPage from './RateAnalysisPage';
import './App.css';

function App() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [units, setUnits] = useState([]);
    const [tags, setTags] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editField, setEditField] = useState(null);
    const [editValue, setEditValue] = useState({});
    const [showRatePage, setShowRatePage] = useState(false);
    const [newRow, setNewRow] = useState({
        item_code: '',
        description: '',
        unit_id: '',
        quantity: '',
        rate: '',
        isNew: false
    });
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [newUnit, setNewUnit] = useState({ name: '', symbol: '', category: 'Custom' });
    const [showTagModal, setShowTagModal] = useState(false);
    const [newTag, setNewTag] = useState({ name: '', color: '#808080', description: '' });

    // Use your Render backend URL here
    const API = 'https://pms-backend.onrender.com/api';

    const fetchData = async () => {
        setLoading(true);
        try {
            const [itemsRes, unitsRes, tagsRes] = await Promise.all([
                axios.get(`${API}/boq`),
                axios.get(`${API}/units`),
                axios.get(`${API}/tags`).catch(() => ({ data: [] }))
            ]);
            setItems(itemsRes.data);
            setUnits(unitsRes.data);
            setTags(tagsRes.data);
        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ---- Edit Functions ----
    const startEdit = (id, field, value) => {
        setEditingId(id);
        setEditField(field);
        setEditValue({ ...editValue, [id]: { ...editValue[id], [field]: value } });
    };

    const updateEdit = (id, field, val) => {
        setEditValue({ ...editValue, [id]: { ...editValue[id], [field]: val } });
    };

    const saveEdit = async (id, field) => {
        const val = editValue[id]?.[field];
        if (val === undefined) return;
        try {
            await axios.put(`${API}/boq/${id}`, { [field]: val });
            setEditingId(null);
            await fetchData();
        } catch (e) {
            alert('Update failed');
        }
    };

    const handleKeyPress = (e, id, field) => {
        if (e.key === 'Enter') saveEdit(id, field);
        if (e.key === 'Escape') {
            setEditingId(null);
            setEditValue({});
        }
    };

    // ---- Delete ----
    const deleteItem = async (id) => {
        if (!window.confirm('Delete this item?')) return;
        try {
            await axios.delete(`${API}/boq/${id}`);
            await fetchData();
        } catch (e) {
            alert('Delete failed');
        }
    };

    // ---- New Row ----
    const showNewRow = () => {
        setNewRow({
            item_code: '',
            description: '',
            unit_id: units[0]?.id || '',
            quantity: '',
            rate: '',
            isNew: true
        });
    };

    const saveNewRow = async () => {
        try {
            if (!newRow.item_code || !newRow.description || !newRow.unit_id || !newRow.quantity || !newRow.rate) {
                alert('Please fill all fields');
                return;
            }
            await axios.post(`${API}/boq`, {
                item_code: newRow.item_code,
                description: newRow.description,
                unit_id: newRow.unit_id,
                quantity: parseFloat(newRow.quantity),
                rate: parseFloat(newRow.rate)
            });
            setNewRow({ item_code: '', description: '', unit_id: '', quantity: '', rate: '', isNew: false });
            await fetchData();
        } catch (e) {
            alert('Failed to add item');
        }
    };

    const cancelNewRow = () => {
        setNewRow({ item_code: '', description: '', unit_id: '', quantity: '', rate: '', isNew: false });
    };

    // ---- Unit CRUD ----
    const addUnit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/units`, newUnit);
            await fetchData();
            setNewUnit({ name: '', symbol: '', category: 'Custom' });
            setShowUnitModal(false);
            alert('Unit added');
        } catch (e) { alert('Failed to add unit'); }
    };

    const deleteUnit = async (id) => {
        if (!window.confirm('Delete this unit?')) return;
        try {
            await axios.delete(`${API}/units/${id}`);
            await fetchData();
        } catch (e) { alert(e.response?.data?.error || 'Failed to delete unit'); }
    };

    // ---- Tag CRUD ----
    const addTag = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/tags`, newTag);
            await fetchData();
            setNewTag({ name: '', color: '#808080', description: '' });
            setShowTagModal(false);
            alert('Tag added');
        } catch (e) { alert('Failed to add tag'); }
    };

    const deleteTag = async (id) => {
        if (!window.confirm('Delete this tag?')) return;
        try {
            await axios.delete(`${API}/tags/${id}`);
            await fetchData();
        } catch (e) { alert(e.response?.data?.error || 'Failed to delete tag'); }
    };

    // ---- Assign Tag to BOQ ----
    const assignTag = async (boqId, tagId) => {
        try {
            await axios.post(`${API}/tags/assign`, { boq_id: boqId, tag_id: tagId });
            await fetchData();
        } catch (e) {
            console.error('Assign tag failed:', e);
        }
    };

    const removeTag = async (boqId, tagId) => {
        try {
            await axios.delete(`${API}/tags/remove/${boqId}/${tagId}`);
            await fetchData();
        } catch (e) {
            console.error('Remove tag failed:', e);
        }
    };

    const formatCurrency = (val) => {
        return parseFloat(val).toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
    };

    // Render editable cell
    const renderCell = (item, field, displayValue, type = 'text') => {
        const isEditing = editingId === item.id && editField === field;
        if (isEditing) {
            if (field === 'unit_id') {
                return (
                    <select
                        value={editValue[item.id]?.[field] || item[field]}
                        onChange={(e) => updateEdit(item.id, field, e.target.value)}
                        onBlur={() => saveEdit(item.id, field)}
                        onKeyDown={(e) => handleKeyPress(e, item.id, field)}
                        className="edit-input"
                        autoFocus
                    >
                        {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                    </select>
                );
            }
            return (
                <input
                    type={type}
                    step={type === 'number' ? '0.01' : undefined}
                    value={editValue[item.id]?.[field] || ''}
                    onChange={(e) => updateEdit(item.id, field, e.target.value)}
                    onBlur={() => saveEdit(item.id, field)}
                    onKeyDown={(e) => handleKeyPress(e, item.id, field)}
                    className="edit-input"
                    autoFocus
                />
            );
        }
        const display = field === 'unit_id' ? units.find(u => u.id === displayValue)?.symbol || displayValue : displayValue;
        return (
            <span className="editable" onDoubleClick={() => startEdit(item.id, field, item[field])}>
                {display}
            </span>
        );
    };

    // ---- Render ----
    if (showRatePage) {
        return <RateAnalysisPage onBack={() => setShowRatePage(false)} />;
    }

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="app">
            {/* Header */}
            <div className="header">
                <div className="header-left">
                    <h1>📊 BOQ - Tower A Construction</h1>
                    <span className="badge">{items.length} items</span>
                </div>
                <div className="header-right">
                    <button className="btn btn-primary" onClick={() => setShowRatePage(true)}>
                        💰 Rate Analysis
                    </button>
                    <button className="btn btn-secondary" onClick={fetchData}>
                        🔄 Refresh
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowUnitModal(true)}>
                        📐 Units
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowTagModal(true)}>
                        🏷️ Tags
                    </button>
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
                        <div><label>Existing Units</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                {units.map(u => <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f3f4', padding: '4px 8px', borderRadius: '4px' }}>
                                    {u.symbol} ({u.name})
                                    <button onClick={() => deleteUnit(u.id)} style={{ background: 'none', border: 'none', color: '#ea4335', cursor: 'pointer' }}>×</button>
                                </span>)}
                            </div>
                        </div>
                        <button className="btn-secondary" onClick={() => setShowUnitModal(false)}>Close</button>
                    </div>
                </div>
            )}

            {/* Tag Modal */}
            {showTagModal && (
                <div className="modal-overlay" onClick={() => setShowTagModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Manage Tags</h3>
                        <form onSubmit={addTag}>
                            <div className="form-group">
                                <label>Add New Tag</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={newTag.name} onChange={e => setNewTag({...newTag, name: e.target.value})} placeholder="Tag name" required />
                                    <input type="color" value={newTag.color} onChange={e => setNewTag({...newTag, color: e.target.value})} style={{ width: '50px', padding: '0' }} />
                                    <button type="submit" className="btn-primary">Add</button>
                                </div>
                            </div>
                        </form>
                        <hr />
                        <div><label>Existing Tags</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                {tags.map(t => <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: t.color || '#808080', color: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                                    {t.name}
                                    <button onClick={() => deleteTag(t.id)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}>×</button>
                                </span>)}
                            </div>
                        </div>
                        <button className="btn-secondary" onClick={() => setShowTagModal(false)}>Close</button>
                    </div>
                </div>
            )}

            {/* BOQ Table */}
            <div className="table-container">
                <table className="boq-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Item Code</th>
                            <th>Description</th>
                            <th>Unit</th>
                            <th>Quantity</th>
                            <th>Rate (₹)</th>
                            <th>Total (₹)</th>
                            <th>Tags</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>{renderCell(item, 'item_code', item.item_code)}</td>
                                <td>{renderCell(item, 'description', item.description)}</td>
                                <td>{renderCell(item, 'unit_id', item.unit_id)}</td>
                                <td>{renderCell(item, 'quantity', item.quantity, 'number')}</td>
                                <td>{renderCell(item, 'rate', item.rate, 'number')}</td>
                                <td className="total-cell">₹{formatCurrency(item.total)}</td>
                                <td>
                                    <div className="tag-container">
                                        {item.tags?.map((tag, i) => {
                                            const tagObj = tags.find(t => t.name === tag);
                                            return (
                                                <span key={i} className="tag" style={{ backgroundColor: tagObj?.color || '#808080' }}>
                                                    {tag}
                                                    <button className="tag-remove" onClick={() => removeTag(item.id, tagObj?.id)}>×</button>
                                                </span>
                                            );
                                        })}
                                        <select className="tag-select" onChange={(e) => { if (e.target.value) { assignTag(item.id, e.target.value); e.target.value = ''; } }} value="">
                                            <option value="">+ Add Tag</option>
                                            {tags.filter(t => !item.tags?.includes(t.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </td>
                                <td>
                                    <button className="action-btn delete" onClick={() => deleteItem(item.id)}>🗑️</button>
                                </td>
                            </tr>
                        ))}

                        {/* New Row */}
                        {newRow.isNew ? (
                            <tr className="new-row">
                                <td>*</td>
                                <td><input type="text" value={newRow.item_code} onChange={e => setNewRow({...newRow, item_code: e.target.value.toUpperCase()})} placeholder="Code" className="new-input" autoFocus /></td>
                                <td><input type="text" value={newRow.description} onChange={e => setNewRow({...newRow, description: e.target.value})} placeholder="Description" className="new-input" /></td>
                                <td>
                                    <select value={newRow.unit_id} onChange={e => setNewRow({...newRow, unit_id: e.target.value})} className="new-input">
                                        {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                                    </select>
                                </td>
                                <td><input type="number" step="0.01" value={newRow.quantity} onChange={e => setNewRow({...newRow, quantity: e.target.value})} placeholder="0.00" className="new-input" /></td>
                                <td><input type="number" step="0.01" value={newRow.rate} onChange={e => setNewRow({...newRow, rate: e.target.value})} placeholder="0.00" className="new-input" /></td>
                                <td>{newRow.quantity && newRow.rate ? formatCurrency(parseFloat(newRow.quantity) * parseFloat(newRow.rate)) : '0.00'}</td>
                                <td>-</td>
                                <td>
                                    <button className="action-btn save" onClick={saveNewRow}>✅</button>
                                    <button className="action-btn cancel" onClick={cancelNewRow}>✖️</button>
                                </td>
                            </tr>
                        ) : (
                            <tr className="add-row" onClick={showNewRow}>
                                <td colSpan="9" className="add-row-cell">
                                    <span className="add-row-icon">➕</span>
                                    <span>Add new row</span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="total-row">
                            <td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
                            <td style={{ fontWeight: 'bold', color: '#1a73e8' }}>
                                ₹{formatCurrency(items.reduce((sum, i) => sum + parseFloat(i.total), 0))}
                            </td>
                            <td colSpan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Footer */}
            <div className="footer">
                <span>📊 {items.length} items | Total Value: ₹{formatCurrency(items.reduce((sum, i) => sum + parseFloat(i.total), 0))}</span>
                <span className="edit-mode">🔓 Double-click any cell to edit | 💰 Rate Analysis for detailed cost breakdown</span>
            </div>
        </div>
    );
}

export default App;