import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => { loadBranches(); }, []);

  const loadBranches = async () => {
    try {
      const res = await apiClient.get('/branches');
      setBranches(res.data);
    } catch (err) {
      toast.error('Failed to load branches');
    }
  };

  const createBranch = async () => {
    if (!name.trim()) { toast.error('Enter branch name'); return; }
    try {
      await apiClient.post('/branches', { name, address, phone });
      setName(''); setAddress(''); setPhone('');
      toast.success('Branch created!');
      loadBranches();
    } catch (err) {
      toast.error('Failed to create branch');
    }
  };

  const deleteBranch = async (id) => {
    if (!window.confirm('Delete this branch?')) return;
    try {
      await apiClient.delete(`/branches/${id}`);
      toast.success('Branch deleted');
      loadBranches();
    } catch (err) {
      toast.error('Failed to delete branch');
    }
  };

  const startEdit = (branch) => {
    setEditingId(branch.id);
    setEditData({ name: branch.name, address: branch.address, phone: branch.phone });
  };

  const saveEdit = async () => {
    try {
      await apiClient.put(`/branches/${editingId}`, editData);
      setEditingId(null);
      toast.success('Branch updated');
      loadBranches();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-3xl font-bold">Branch Management</h1>
          <p className="text-muted-foreground mt-1">Manage your showroom branches</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add New Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Branch Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Branch name" className="h-10 bg-secondary/50" data-testid="branch-name-input" />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="h-10 bg-secondary/50" data-testid="branch-address-input" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="h-10 bg-secondary/50" data-testid="branch-phone-input" />
              </div>
            </div>
            <Button className="mt-4" onClick={createBranch} data-testid="create-branch-button">
              <Plus size={16} className="mr-2" /> Create Branch
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Branches ({branches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No branches yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Address</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map(b => (
                    <TableRow key={b.id} className="border-border">
                      <TableCell>
                        {editingId === b.id ? <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-8 bg-secondary/50" /> : b.name}
                      </TableCell>
                      <TableCell>
                        {editingId === b.id ? <Input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="h-8 bg-secondary/50" /> : b.address || '-'}
                      </TableCell>
                      <TableCell>
                        {editingId === b.id ? <Input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="h-8 bg-secondary/50" /> : b.phone || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingId === b.id ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={saveEdit}><Save size={14} /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X size={14} /></Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(b)}><Edit size={14} /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteBranch(b.id)}><Trash2 size={14} /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
