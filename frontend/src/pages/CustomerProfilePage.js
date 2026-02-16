import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, User, Phone, MapPin, Calendar, Heart, Mail, FileText, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerProfilePage() {
  const { customerId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [tier, setTier] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [customerId]);

  const loadData = async () => {
    try {
      const [custRes, billsRes, tiersRes] = await Promise.all([
        apiClient.get(`/customers/${customerId}`),
        apiClient.get(`/customers/${customerId}/bills`),
        apiClient.get('/settings/tiers'),
      ]);
      setCustomer(custRes.data);
      setBills(billsRes.data.bills || []);
      setForm(custRes.data);
      // Determine tier
      const spent = billsRes.data.total_spent || 0;
      const tiers = tiersRes.data.tiers || [];
      for (const t of [...tiers].sort((a, b) => b.min_amount - a.min_amount)) {
        if (spent >= t.min_amount) { setTier(t.name); break; }
      }
    } catch (err) { toast.error('Failed to load customer'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/customers/${customerId}`, {
        name: form.name,
        email: form.email,
        location: form.location,
        reference: form.reference,
        dob: form.dob,
        anniversary: form.anniversary,
        address: form.address,
        notes: form.notes,
      });
      toast.success('Customer details saved');
      setEditing(false);
      loadData();
    } catch (err) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const tierColors = {
    'Diamond': 'bg-blue-500/20 text-blue-300',
    'Platinum': 'bg-purple-500/20 text-purple-300',
    'Gold': 'bg-primary/20 text-primary',
    'Silver': 'bg-gray-400/20 text-gray-300',
    'Bronze': 'bg-orange-500/20 text-orange-300',
  };

  if (loading) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading...</p></div>;

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="back-btn"><ArrowLeft size={18} /></Button>
              <div>
                <h1 className="heading text-base sm:text-lg font-bold text-primary">{customer?.name || 'Customer'}</h1>
                <p className="text-xs text-muted-foreground">{customer?.phone}</p>
              </div>
            </div>
            {tier && <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierColors[tier] || 'bg-secondary text-muted-foreground'}`} data-testid="customer-tier">{tier}</span>}
          </div>
        </header>

        <main className="px-3 sm:px-4 py-4 sm:py-6 max-w-5xl mx-auto space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card border-border"><CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Spent</p>
              <p className="mono text-lg font-bold text-primary">{formatCurrency(bills.reduce((s, b) => s + (b.grand_total || 0), 0))}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Bills</p>
              <p className="mono text-lg font-bold">{bills.length}</p>
            </CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Visits</p>
              <p className="mono text-lg font-bold">{customer?.total_visits || 0}</p>
            </CardContent></Card>
          </div>

          {/* Customer Details Form */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Customer Details</CardTitle>
              {!editing ? (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)} data-testid="edit-customer-btn">Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(customer); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} data-testid="save-customer-btn"><Save size={14} className="mr-1" /> Save</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><User size={12} /> Name</Label>
                  <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} data-testid="customer-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Phone size={12} /> Phone</Label>
                  <Input value={form.phone || ''} readOnly className="h-10 bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Mail size={12} /> Email</Label>
                  <Input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} data-testid="customer-email" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><MapPin size={12} /> Location</Label>
                  <Input value={form.location || ''} onChange={e => setForm({...form, location: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Calendar size={12} /> Date of Birth</Label>
                  <Input type="date" value={form.dob || ''} onChange={e => setForm({...form, dob: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} data-testid="customer-dob" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Heart size={12} /> Anniversary</Label>
                  <Input type="date" value={form.anniversary || ''} onChange={e => setForm({...form, anniversary: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} data-testid="customer-anniversary" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Input value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Input value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} readOnly={!editing} className={`h-10 ${!editing ? 'bg-muted/50' : 'bg-secondary/50'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase History */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Purchase History ({bills.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {bills.length === 0 ? <p className="text-muted-foreground text-center py-6">No purchases yet</p> :
                <div className="space-y-2">
                  {bills.map(b => (
                    <div key={b.id} className="p-3 rounded-lg bg-secondary/20 border border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(`/bill/${b.id}`)} data-testid={`customer-bill-${b.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs mono text-muted-foreground">{b.bill_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.created_at?.slice(0, 10)} &middot; {b.items?.length || 0} items</p>
                        </div>
                        <div className="text-right">
                          <p className="mono font-bold text-primary">{formatCurrency(b.grand_total)}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{b.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
