import { useState, useEffect } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { DollarSign, FileText, TrendingUp, Receipt, Eye, Trash2, Settings, Users, GitBranch, Tag, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsRes, billsRes] = await Promise.all([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/bills'),
      ]);
      setAnalytics(analyticsRes.data);
      setBills(billsRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const deleteBill = async (billId) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await apiClient.delete(`/bills/${billId}`);
      toast.success('Bill deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete bill');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
  };

  const kpiCards = [
    { label: "Today's Sales", value: formatCurrency(analytics?.today_sales), icon: DollarSign, color: 'text-primary' },
    { label: 'Bills Today', value: analytics?.today_count || 0, icon: FileText, color: 'text-[hsl(196,70%,52%)]' },
    { label: 'Avg Ticket', value: formatCurrency(analytics?.avg_ticket), icon: TrendingUp, color: 'text-[hsl(160,52%,46%)]' },
    { label: 'GST Collected', value: formatCurrency(analytics?.today_gst), icon: Receipt, color: 'text-[hsl(270,35%,66%)]' },
  ];

  const quickActions = [
    { label: 'Rate Management', icon: Settings, to: '/admin/rates' },
    { label: 'Branches', icon: GitBranch, to: '/admin/branches' },
    { label: 'Users', icon: Users, to: '/admin/users' },
    { label: 'Item Names', icon: Tag, to: '/admin/items' },
    { label: 'Reports', icon: BarChart3, to: '/admin/reports' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.full_name}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiCards.map((kpi, i) => (
            <Card key={i} className="bg-card border-border shadow-[var(--shadow-elev-1)]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                    <p className={`mono text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${kpi.color}`}>
                    <kpi.icon size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="secondary"
              className="h-auto py-4 flex-col gap-2 border border-border hover:border-primary/30"
              onClick={() => navigate(action.to)}
              data-testid={`admin-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <action.icon size={20} className="text-primary" />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Recent Bills */}
        <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
          <CardHeader className="pb-3">
            <CardTitle className="heading text-xl">Recent Bills</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : bills.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bills yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Grand Total</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.slice(0, 20).map(bill => (
                      <TableRow key={bill.id} className="border-border hover:bg-secondary/50 cursor-pointer">
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
                        <TableCell className="text-muted-foreground text-sm">{bill.created_at?.slice(0, 10)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`view-bill-${bill.id}`}>
                              <Eye size={14} />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteBill(bill.id)} data-testid={`delete-bill-${bill.id}`}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
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
