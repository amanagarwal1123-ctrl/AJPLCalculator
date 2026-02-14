import { useState, useEffect } from 'react';
import { useAuth, apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Plus, FileText, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function SalesExecDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [myBills, setMyBills] = useState([]);
  const [creating, setCreating] = useState(false);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    loadBills();
    loadBranches();
  }, []);

  const loadBills = async () => {
    try {
      const res = await apiClient.get('/bills');
      setMyBills(res.data);
    } catch (err) { console.error(err); }
  };

  const loadBranches = async () => {
    try {
      const res = await apiClient.get('/branches');
      setBranches(res.data);
    } catch (err) { console.error(err); }
  };

  const userBranch = branches.find(b => b.id === user?.branch_id);

  const handleMakeBill = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Please enter customer name and phone number');
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient.post('/bills', {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_location: customerLocation,
        customer_reference: customerReference,
        items: [],
        external_charges: [],
      });
      toast.success('Bill created! Add items now.');
      navigate(`/bill/${res.data.id}`);
    } catch (err) {
      toast.error('Failed to create bill');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const references = ['Instagram', 'Facebook', 'Friends', 'Family', 'Repeat Customer', 'Walk-in', 'Google', 'Newspaper', 'TV', 'Other'];

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
            <h1 className="heading text-lg font-bold text-primary tracking-wider">Gold Suite</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{user?.full_name}</span>
              <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }} data-testid="logout-button">
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
          {/* Branch and user info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Branch: <strong className="text-foreground">{userBranch?.name || 'Not Assigned'}</strong></span>
            <span>Executive: <strong className="text-foreground">{user?.full_name}</strong></span>
          </div>

          {/* Customer Capture */}
          <Card className="bg-card/90 backdrop-blur-sm border-border shadow-[var(--shadow-elev-1)]">
            <CardHeader className="pb-3">
              <CardTitle className="heading text-2xl">New Bill</CardTitle>
              <p className="text-sm text-muted-foreground">Enter customer details to start a bill</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cname">Customer Name *</Label>
                  <Input id="cname" placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-11 bg-secondary/50" data-testid="customer-name-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cphone">Phone Number *</Label>
                  <Input id="cphone" placeholder="Phone number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-11 bg-secondary/50" data-testid="customer-phone-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cloc">Location</Label>
                  <Input id="cloc" placeholder="City / Area" value={customerLocation} onChange={e => setCustomerLocation(e.target.value)} className="h-11 bg-secondary/50" data-testid="customer-location-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cref">Reference</Label>
                  <Select value={customerReference} onValueChange={setCustomerReference}>
                    <SelectTrigger className="h-11 bg-secondary/50" data-testid="customer-reference-select">
                      <SelectValue placeholder="How did they find us?" />
                    </SelectTrigger>
                    <SelectContent>
                      {references.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="mt-6 h-12 px-8 text-base font-semibold rounded-xl"
                onClick={handleMakeBill}
                disabled={creating}
                data-testid="make-bill-button"
              >
                <Plus size={18} className="mr-2" />
                {creating ? 'Creating...' : 'Make Bill'}
              </Button>
            </CardContent>
          </Card>

          {/* My Bills */}
          <Card className="bg-card/90 backdrop-blur-sm border-border shadow-[var(--shadow-elev-1)]">
            <CardHeader className="pb-3">
              <CardTitle className="heading text-xl">My Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {myBills.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bills yet. Create your first bill above!</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myBills.map(bill => (
                        <TableRow key={bill.id} className="border-border hover:bg-secondary/50">
                          <TableCell className="mono text-sm">{bill.bill_number}</TableCell>
                          <TableCell>{bill.customer_name}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              bill.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                              bill.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>{bill.status}</span>
                          </TableCell>
                          <TableCell className="mono text-right font-medium">{formatCurrency(bill.grand_total)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{bill.created_at?.slice(0, 10)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`exec-view-bill-${bill.id}`}>
                              <Eye size={14} className="mr-1" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
