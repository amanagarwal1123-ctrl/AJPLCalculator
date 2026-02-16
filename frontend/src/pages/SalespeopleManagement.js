import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function SalespeopleManagement() {
  const [people, setPeople] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await apiClient.get('/salespeople');
      setPeople(res.data);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const add = async () => {
    if (!newName.trim()) { toast.error('Enter a name'); return; }
    try {
      await apiClient.post('/salespeople', { name: newName.trim() });
      setNewName('');
      toast.success('Salesperson added');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this salesperson?')) return;
    try {
      await apiClient.delete(`/salespeople/${id}`);
      toast.success('Removed');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-2xl sm:text-3xl font-bold">Salespeople</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage active salesperson names</p>
        </div>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add Salesperson</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input placeholder="Salesperson name" value={newName} onChange={e => setNewName(e.target.value)} className="h-11 bg-secondary/50" data-testid="salesperson-name-input" onKeyDown={e => e.key === 'Enter' && add()} />
              <Button onClick={add} className="h-11 px-6" data-testid="add-salesperson-btn"><Plus size={16} className="mr-1" /> Add</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Salespeople ({people.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground py-4 text-center">Loading...</p> :
              people.length === 0 ? <p className="text-muted-foreground py-4 text-center">No salespeople added yet</p> :
                <div className="space-y-2">
                  {people.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border" data-testid={`salesperson-${p.id}`}>
                      <div className="flex items-center gap-3">
                        <UserCheck size={16} className="text-primary" />
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => remove(p.id)} data-testid={`delete-sp-${p.id}`}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
            }
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
