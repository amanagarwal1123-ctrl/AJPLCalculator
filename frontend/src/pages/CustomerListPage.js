import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Users, Search, Eye, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const res = await apiClient.get('/analytics/customers');
      setCustomers(res.data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const filtered = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground mt-1">View customer profiles and bill history</p>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <Users size={16} className="text-primary" />
            <span className="mono text-lg font-bold text-primary" data-testid="total-customers">{customers.length}</span>
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 bg-card border-border"
            data-testid="customer-search"
          />
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Loading customers...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No customers found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Phone</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Location</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Visits</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Spent</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Last Visit</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).map((c, i) => (
                      <TableRow key={i} className="border-border hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/admin/customers/${c.id}`)} data-testid={`customer-row-${i}`}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="mono text-sm">{c.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{c.location || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.reference || '-'}</TableCell>
                        <TableCell className="mono text-right">{c.total_visits || 1}</TableCell>
                        <TableCell className="mono text-right font-medium text-primary">{formatCurrency(c.total_spent)}</TableCell>
                        <TableCell className="mono text-right">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            c.days_since_last_visit > 30 ? 'bg-destructive/20 text-[hsl(0,72%,60%)]' :
                            c.days_since_last_visit > 14 ? 'bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]' :
                            'bg-[hsl(160,52%,46%)]/20 text-[hsl(160,52%,46%)]'
                          }`}>{c.days_since_last_visit ?? '-'}d ago</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`view-customer-${i}`}>
                            <Eye size={14} />
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
      </div>
    </AppLayout>
  );
}
