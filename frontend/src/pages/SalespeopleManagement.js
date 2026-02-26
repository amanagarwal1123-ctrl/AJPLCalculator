import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, UserCheck, Building, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function SalespeopleManagement() {
  const [people, setPeople] = useState([]);
  const [branches, setBranches] = useState([]);
  const [newName, setNewName] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); loadBranches(); }, []);

  const load = async () => {
    try {
      const res = await apiClient.get('/salespeople');
      setPeople(res.data);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const loadBranches = async () => {
    try {
      const res = await apiClient.get('/branches');
      setBranches(res.data);
    } catch (err) {}
  };

  const add = async () => {
    if (!newName.trim()) { toast.error('Enter a name'); return; }
    try {
      await apiClient.post('/salespeople', { name: newName.trim(), branch_id: newBranch || '' });
      setNewName('');
      setNewBranch('');
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

  const filtered = filterBranch === 'all' ? people : people.filter(p => p.branch_id === filterBranch);

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
            <div className="flex gap-3 flex-wrap">
              <Input placeholder="Salesperson name" value={newName} onChange={e => setNewName(e.target.value)} className="h-11 bg-secondary/50 flex-1 min-w-[180px]" data-testid="salesperson-name-input" onKeyDown={e => e.key === 'Enter' && add()} />
              <Select value={newBranch || undefined} onValueChange={setNewBranch}>
                <SelectTrigger className="h-11 bg-secondary/50 w-48" data-testid="salesperson-branch-select">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={add} className="h-11 px-6" data-testid="add-salesperson-btn"><Plus size={16} className="mr-1" /> Add</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Active Salespeople ({filtered.length})</CardTitle>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="h-9 w-48 bg-secondary/50 text-sm" data-testid="filter-branch-select">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground py-4 text-center">Loading...</p> :
              filtered.length === 0 ? <p className="text-muted-foreground py-4 text-center">No salespeople found</p> :
                <div className="space-y-2">
                  {filtered.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border" data-testid={`salesperson-${p.id}`}>
                      <div className="flex items-center gap-3">
                        <UserCheck size={16} className="text-primary" />
                        <span className="font-medium">{p.name}</span>
                        {p.branch_name && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-0.5 rounded bg-secondary/50 border border-border">
                            <Building size={10} /> {p.branch_name}
                          </span>
                        )}
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
