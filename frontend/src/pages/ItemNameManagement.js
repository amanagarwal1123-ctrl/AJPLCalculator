import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, BarChart3, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function ItemNameManagement() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const res = await apiClient.get('/item-names');
      setItems(res.data);
    } catch (err) { toast.error('Failed to load item names'); }
  };

  const createItem = async () => {
    if (!name.trim()) { toast.error('Enter item name'); return; }
    try {
      await apiClient.post('/item-names', { name });
      setName('');
      toast.success('Item name added!');
      loadItems();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add item'); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this item name?')) return;
    try {
      await apiClient.delete(`/item-names/${id}`);
      toast.success('Item name deleted');
      loadItems();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) { toast.error('Name cannot be empty'); return; }
    try {
      await apiClient.put(`/item-names/${id}`, { name: editName.trim() });
      toast.success('Item name updated!');
      setEditingId(null);
      loadItems();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-3xl font-bold">Item Name Management</h1>
          <p className="text-muted-foreground mt-1">Manage the list of allowed item names for billing</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Add New Item Name</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Necklace, Ring, Bangle..." className="h-11 bg-secondary/50" onKeyDown={e => e.key === 'Enter' && createItem()} data-testid="item-name-input" />
              </div>
              <Button className="h-11" onClick={createItem} data-testid="add-item-name-button"><Plus size={16} className="mr-2" /> Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-lg">All Item Names ({items.length})</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No item names yet. Add some above!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1 flex-1 mr-1">
                        <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm bg-secondary/50" onKeyDown={e => e.key === 'Enter' && saveEdit(item.id)} autoFocus data-testid={`edit-input-${item.id}`} />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-400" onClick={() => saveEdit(item.id)} data-testid={`save-edit-${item.id}`}><Check size={14} /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingId(null)}><X size={14} /></Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium cursor-pointer hover:text-primary transition-colors truncate" onClick={() => navigate(`/admin/items/${encodeURIComponent(item.name)}`)}>{item.name}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={() => startEdit(item)} data-testid={`edit-item-${item.name}`}><Pencil size={12} /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={() => navigate(`/admin/items/${encodeURIComponent(item.name)}`)} data-testid={`history-item-${item.name}`}><BarChart3 size={14} /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteItem(item.id)} data-testid={`delete-item-${item.name}`}><Trash2 size={14} /></Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
