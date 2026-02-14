import { useState, useEffect, useCallback } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, TrendingUp, Receipt, Eye, Trash2, Settings, Users, GitBranch, Tag, BarChart3, KeyRound, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingOtps, setPendingOtps] = useState([]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(null);

  useEffect(() => {
    loadData();
    loadOtps();
    // Auto-refresh OTPs every 10 seconds
    const interval = setInterval(loadOtps, 10000);
    return () => clearInterval(interval);
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

  const loadOtps = async () => {
    try {
      const res = await apiClient.get('/admin/pending-otps');
      setPendingOtps(res.data);
    } catch (err) {
      // Silent fail for OTP loading
    }
  };

  const copyOtp = (otp) => {
    navigator.clipboard.writeText(otp).then(() => {
      setCopiedOtp(otp);
      toast.success('OTP copied to clipboard');
      setTimeout(() => setCopiedOtp(null), 3000);
    }).catch(() => {
      toast.error('Failed to copy');
    });
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

  // Filter active (non-expired, non-verified) OTPs
  const now = new Date().toISOString();
  const activeOtps = pendingOtps.filter(o => !o.verified && o.expires_at > now);
  const recentOtps = pendingOtps.slice(0, 10);

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="heading text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back, {user?.full_name}</p>
        </div>

        {/* Pending OTPs Panel - shown prominently at top */}
        {activeOtps.length > 0 && (
          <Card className="bg-card border-primary/30 shadow-[var(--shadow-elev-1)]" data-testid="pending-otps-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-primary" />
                  <CardTitle className="heading text-lg">Login OTPs</CardTitle>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary font-bold animate-pulse">{activeOtps.length} active</span>
                </div>
                <Button variant="ghost" size="sm" onClick={loadOtps} data-testid="refresh-otps-button">
                  <RefreshCw size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeOtps.map(o => {
                  const createdAt = new Date(o.created_at);
                  const expiresAt = new Date(o.expires_at);
                  const timeLeft = Math.max(0, Math.round((expiresAt - new Date()) / 1000));
                  const minutes = Math.floor(timeLeft / 60);
                  const seconds = timeLeft % 60;

                  return (
                    <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border" data-testid={`otp-item-${o.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{o.full_name || o.username}</span>
                          <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-secondary">{o.role}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          @{o.username} &middot; {minutes}:{seconds.toString().padStart(2, '0')} left
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="mono text-2xl font-bold text-primary tracking-[0.15em]" data-testid={`otp-code-${o.id}`}>
                          {o.otp}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => copyOtp(o.otp)}
                          data-testid={`copy-otp-${o.id}`}
                        >
                          {copiedOtp === o.otp ? <CheckCircle size={16} className="text-[hsl(160,52%,46%)]" /> : <Copy size={16} />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All recent OTPs (collapsed view) */}
        {activeOtps.length === 0 && recentOtps.length > 0 && (
          <Card className="bg-card border-border" data-testid="recent-otps-panel">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound size={14} />
                <span>No active OTP requests</span>
                <span className="text-xs">&middot; Last {recentOtps.length} requests all verified or expired</span>
                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={loadOtps}>
                  <RefreshCw size={12} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {kpiCards.map((kpi, i) => (
            <Card key={i} className="bg-card border-border shadow-[var(--shadow-elev-1)]">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                    <p className={`mono text-lg sm:text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-secondary flex items-center justify-center ${kpi.color}`}>
                    <kpi.icon size={18} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="secondary"
              className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2 border border-border hover:border-primary/30"
              onClick={() => navigate(action.to)}
              data-testid={`admin-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <action.icon size={18} className="text-primary" />
              <span className="text-[10px] sm:text-xs text-center leading-tight">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Recent Bills */}
        <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
          <CardHeader className="pb-3">
            <CardTitle className="heading text-lg sm:text-xl">Recent Bills</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : bills.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bills yet</p>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {bills.slice(0, 10).map(bill => (
                    <div key={bill.id} className="p-3 rounded-lg bg-secondary/20 border border-border" data-testid={`admin-bill-card-${bill.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{bill.customer_name}</p>
                          <p className="text-[10px] text-muted-foreground mono">{bill.bill_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">by {bill.executive_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            bill.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                            bill.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>{bill.status}</span>
                          <p className="mono text-sm font-bold text-primary mt-1">{formatCurrency(bill.grand_total)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button variant="secondary" size="sm" className="flex-1 h-9" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`view-bill-${bill.id}`}>
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                        <Button variant="secondary" size="sm" className="h-9 text-destructive" onClick={() => deleteBill(bill.id)} data-testid={`delete-bill-${bill.id}`}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
