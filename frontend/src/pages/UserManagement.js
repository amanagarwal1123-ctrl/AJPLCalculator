import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'executive', branch_id: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, branchesRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/branches'),
      ]);
      setUsers(usersRes.data);
      setBranches(branchesRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  const createUser = async () => {
    if (!form.username || !form.full_name) {
      toast.error('Fill in username and full name');
      return;
    }
    try {
      await apiClient.post('/users', form);
      setForm({ username: '', password: '', full_name: '', role: 'executive', branch_id: '' });
      toast.success('User created!');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await apiClient.delete(`/users/${id}`);
      toast.success('User deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditData({ full_name: u.full_name, role: u.role, branch_id: u.branch_id || '', is_active: u.is_active });
  };

  const saveEdit = async () => {
    try {
      await apiClient.put(`/users/${editingId}`, editData);
      setEditingId(null);
      toast.success('User updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const getBranchName = (id) => branches.find(b => b.id === id)?.name || '-';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage admins, managers, and sales executives</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add New User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Username *</Label>
                <Input value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="Username" className="h-10 bg-secondary/50" data-testid="user-username-input" />
              </div>
              <div className="space-y-1">
                <Label>Password <span className="text-muted-foreground text-xs">(optional, OTP login used)</span></Label>
                <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Optional legacy password" className="h-10 bg-secondary/50" data-testid="user-password-input" />
              </div>
              <div className="space-y-1">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Full name" className="h-10 bg-secondary/50" data-testid="user-fullname-input" />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger className="h-10 bg-secondary/50" data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="executive">Sales Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={v => setForm({...form, branch_id: v})}>
                  <SelectTrigger className="h-10 bg-secondary/50" data-testid="user-branch-select">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Branch</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4" onClick={createUser} data-testid="create-user-button">
              <Plus size={16} className="mr-2" /> Create User
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Username</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Full Name</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Role</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Branch</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="mono text-sm">{u.username}</TableCell>
                      <TableCell>
                        {editingId === u.id ? <Input value={editData.full_name} onChange={e => setEditData({...editData, full_name: e.target.value})} className="h-8 bg-secondary/50" /> : u.full_name}
                      </TableCell>
                      <TableCell>
                        {editingId === u.id ? (
                          <Select value={editData.role} onValueChange={v => setEditData({...editData, role: v})}>
                            <SelectTrigger className="h-8 bg-secondary/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="executive">Executive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            u.role === 'admin' ? 'bg-primary/20 text-primary' :
                            u.role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>{u.role}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === u.id ? (
                          <Select value={editData.branch_id || 'none'} onValueChange={v => setEditData({...editData, branch_id: v === 'none' ? '' : v})}>
                            <SelectTrigger className="h-8 bg-secondary/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Branch</SelectItem>
                              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : getBranchName(u.branch_id)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingId === u.id ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={saveEdit}><Save size={14} /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X size={14} /></Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(u)}><Edit size={14} /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteUser(u.id)}><Trash2 size={14} /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
