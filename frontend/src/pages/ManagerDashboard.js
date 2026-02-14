import { useState, useEffect } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Eye, Trash2, FileText, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [billsRes, analyticsRes] = await Promise.all([
        apiClient.get('/bills'),
        apiClient.get('/analytics/dashboard'),
      ]);
      setBills(billsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const sentBills = bills.filter(b => b.status === 'sent');
  const draftBills = bills.filter(b => b.status === 'draft');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome, {user?.full_name}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Today's Sales</p>
              <p className="mono text-2xl font-bold text-primary mt-1">{formatCurrency(analytics?.today_sales)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Pending Review</p>
              <p className="mono text-2xl font-bold text-[hsl(38,85%,55%)] mt-1">{sentBills.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Bills</p>
              <p className="mono text-2xl font-bold text-[hsl(196,70%,52%)] mt-1">{bills.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="heading text-xl">Bills for Review</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : bills.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bills available</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map(bill => (
                      <TableRow key={bill.id} className="border-border hover:bg-secondary/50">
                        <TableCell className="mono text-sm">{bill.bill_number}</TableCell>
                        <TableCell>{bill.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{bill.executive_name}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            bill.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                            bill.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>{bill.status}</span>
                        </TableCell>
                        <TableCell className="mono text-right font-medium">{formatCurrency(bill.grand_total)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`manager-view-bill-${bill.id}`}>
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
      </div>
    </AppLayout>
  );
}
