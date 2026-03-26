import { useState, useEffect, useCallback } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { DollarSign, FileText, TrendingUp, Receipt, Eye, Trash2, Settings, Users, GitBranch, Tag, BarChart3, KeyRound, RefreshCw, Copy, CheckCircle, Clock, Shield, LogOut, Check, X, ChevronDown, Monitor, Smartphone, Globe } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analytics, setAnalytics] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingOtps, setPendingOtps] = useState([]);
  const [copiedOtp, setCopiedOtp] = useState(null);
  const [billTab, setBillTab] = useState(searchParams.get('tab') || 'pending');
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [buybackRates, setBuybackRates] = useState(null);

  const handleSetBillTab = useCallback((tab) => {
    setBillTab(tab);
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    loadData();
    loadOtps();
    loadBuybackRates();
    const otpInterval = setInterval(loadOtps, 10000);
    const dataInterval = setInterval(loadData, 30000);
    return () => { clearInterval(otpInterval); clearInterval(dataInterval); };
  }, []);

  const loadBuybackRates = async () => {
    try { const res = await apiClient.get('/rates/buyback'); setBuybackRates(res.data); } catch (err) {}
  };

  const loadData = async () => {
    try {
      const [analyticsRes, billsRes] = await Promise.all([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/bills'),
      ]);
      setAnalytics(analyticsRes.data);
      setBills(billsRes.data);
    } catch (err) { toast.error('Failed to load dashboard data'); }
    finally { setLoading(false); }
  };

  const loadOtps = async () => {
    try { const res = await apiClient.get('/admin/pending-otps'); setPendingOtps(res.data); } catch (err) {}
  };

  const loadSessions = async () => {
    try { const res = await apiClient.get('/admin/sessions'); setSessions(res.data); } catch (err) { toast.error('Failed to load sessions'); }
  };

  const terminateSession = async (sessionId) => {
    try {
      await apiClient.delete(`/admin/sessions/${sessionId}`);
      toast.success('Session terminated');
      loadSessions();
    } catch (err) { toast.error('Failed to terminate session'); }
  };

  const endAllSessions = async () => {
    if (!window.confirm('End all sessions except your current one?')) return;
    try {
      const res = await apiClient.delete('/admin/sessions/end-all');
      toast.success(`${res.data.terminated} session(s) terminated`);
      loadSessions();
    } catch (err) { toast.error('Failed to end sessions'); }
  };

  const toggleUserExpand = (userId) => {
    setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const parseDevice = (ua) => {
    if (!ua || ua === 'unknown') return 'Unknown Device';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Browser';
  };

  const parseBrowser = (ua) => {
    if (!ua || ua === 'unknown') return '';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/Chrome/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua)) return 'Safari';
    if (/Firefox/i.test(ua)) return 'Firefox';
    return '';
  };

  const copyOtp = (otp) => {
    navigator.clipboard.writeText(otp).then(() => { setCopiedOtp(otp); toast.success('OTP copied'); setTimeout(() => setCopiedOtp(null), 3000); });
  };

  const deleteBill = async (billId) => {
    if (!window.confirm('Delete this bill?')) return;
    try { await apiClient.delete(`/bills/${billId}`); toast.success('Bill deleted'); loadData(); } catch (err) { toast.error('Failed to delete bill'); }
  };

  const approveBill = async (billId) => {
    try { await apiClient.put(`/bills/${billId}/approve`); toast.success('Bill approved!'); loadData(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed to approve'); }
  };

  const toggleMmi = async (billId) => {
    try { const res = await apiClient.put(`/bills/${billId}/mmi`); loadData(); } catch (err) { toast.error('Failed to toggle MMI'); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const now = new Date().toISOString();
  const activeOtps = pendingOtps.filter(o => !o.verified && o.expires_at > now);

  const pendingBills = bills.filter(b => b.status === 'sent' || b.status === 'edited');
  const approvedBills = bills.filter(b => b.status === 'approved');
  const draftBills = bills.filter(b => b.status === 'draft');
  const statusBadge = (s) => {
    const st = { draft: 'bg-yellow-500/20 text-yellow-400', sent: 'bg-blue-500/20 text-blue-400', edited: 'bg-orange-500/20 text-orange-400', approved: 'bg-green-500/20 text-green-400' };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st[s] || 'bg-gray-500/20 text-gray-400'}`}>{s}</span>;
  };

  const getTabBills = () => {
    switch (billTab) { case 'pending': return pendingBills; case 'approved': return approvedBills; case 'draft': return draftBills; default: return bills; }
  };
  const tabBills = getTabBills();

  // Group bills by date
  const groupedBills = {};
  tabBills.forEach(b => {
    const date = b.created_date || b.created_at?.slice(0, 10) || 'Unknown';
    if (!groupedBills[date]) groupedBills[date] = [];
    groupedBills[date].push(b);
  });
  const sortedDates = Object.keys(groupedBills).sort((a, b) => b.localeCompare(a));

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
    { label: 'Salespeople', icon: Users, to: '/admin/salespeople' },
    { label: 'Item Names', icon: Tag, to: '/admin/items' },
    { label: 'Feedback Qs', icon: FileText, to: '/admin/feedback' },
    { label: 'Reports', icon: BarChart3, to: '/admin/reports' },
    { label: 'Data Safety', icon: Shield, to: '/admin/data-safety' },
  ];

  // Total weight helper
  const getBillWeight = (bill) => {
    return (bill.items || []).reduce((sum, it) => sum + (it.gross_weight || 0), 0).toFixed(2);
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">Welcome back, {user?.full_name}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setShowSessions(!showSessions); if (!showSessions) loadSessions(); }} data-testid="toggle-sessions-btn">
            <Shield size={14} className="mr-1" /> Sessions
          </Button>
        </div>

        {/* Active Sessions Panel */}
        {showSessions && (
          <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]" data-testid="sessions-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="heading text-lg flex items-center gap-2">
                  <Shield size={16} className="text-primary" /> Active Sessions
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">{sessions.reduce((sum, g) => sum + g.session_count, 0)}</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={loadSessions}><RefreshCw size={14} /></Button>
                  <Button variant="destructive" size="sm" onClick={endAllSessions} data-testid="end-all-sessions-btn">
                    <LogOut size={14} className="mr-1" /> End All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">No active sessions</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map(group => (
                    <div key={group.user_id} className="rounded-lg border border-border overflow-hidden" data-testid={`session-group-${group.user_id}`}>
                      {/* User header row */}
                      <button
                        className="w-full flex items-center justify-between p-3 bg-secondary/20 hover:bg-secondary/30 transition-colors text-left"
                        onClick={() => toggleUserExpand(group.user_id)}
                        data-testid={`session-group-toggle-${group.user_id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs">
                            {(group.full_name || group.username || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{group.full_name || group.username}</p>
                            <p className="text-xs text-muted-foreground">@{group.username} &middot; <span className="capitalize">{group.role}</span></p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">{group.session_count} {group.session_count === 1 ? 'session' : 'sessions'}</span>
                        </div>
                        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${expandedUsers[group.user_id] ? 'rotate-180' : ''}`} />
                      </button>
                      {/* Expanded session details */}
                      {expandedUsers[group.user_id] && (
                        <div className="divide-y divide-border">
                          {group.sessions.map(s => {
                            const device = parseDevice(s.user_agent);
                            const browser = parseBrowser(s.user_agent);
                            const DeviceIcon = /iPhone|iPad|Android/i.test(device) ? Smartphone : Monitor;
                            return (
                              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 bg-card hover:bg-secondary/10" data-testid={`session-${s.id}`}>
                                <div className="flex items-center gap-3">
                                  <DeviceIcon size={14} className="text-muted-foreground flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium">{device}{browser ? ` · ${browser}` : ''}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1"><Globe size={10} /> {s.ip_address || 'N/A'}</span>
                                      <span>&middot;</span>
                                      <span className="flex items-center gap-1"><Clock size={10} /> {s.created_at?.slice(0, 16).replace('T', ' ')}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => terminateSession(s.id)} data-testid={`terminate-session-${s.id}`}>
                                  <LogOut size={12} className="mr-1" /> End
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* OTPs */}
        {activeOtps.length > 0 && (
          <Card className="bg-card border-primary/30 shadow-[var(--shadow-elev-1)]" data-testid="pending-otps-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-primary" />
                  <CardTitle className="heading text-lg">Login OTPs</CardTitle>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary font-bold animate-pulse">{activeOtps.length} active</span>
                </div>
                <Button variant="ghost" size="sm" onClick={loadOtps}><RefreshCw size={14} /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeOtps.map(o => (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border" data-testid={`otp-item-${o.id}`}>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{o.full_name || o.username}</span>
                      <span className="text-xs text-muted-foreground capitalize ml-2 px-1.5 py-0.5 rounded bg-secondary">{o.role}</span>
                    </div>
                    <span className="mono text-2xl font-bold text-primary tracking-[0.15em]" data-testid={`otp-code-${o.id}`}>{o.otp}</span>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => copyOtp(o.otp)}>
                      {copiedOtp === o.otp ? <CheckCircle size={16} className="text-[hsl(160,52%,46%)]" /> : <Copy size={16} />}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {kpiCards.map((kpi, i) => (
            <Card key={i} className="bg-card border-border shadow-[var(--shadow-elev-1)]">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                    <p className={`mono text-lg sm:text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-secondary flex items-center justify-center ${kpi.color}`}><kpi.icon size={18} /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {quickActions.map((action, i) => (
            <Button key={i} variant="secondary" className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2 border border-border hover:border-primary/30" onClick={() => navigate(action.to)} data-testid={`admin-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <action.icon size={18} className="text-primary" />
              <span className="text-[10px] sm:text-xs text-center leading-tight">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Buyback Rates Display */}
        {buybackRates?.purities?.some(p => p.rate_per_10g > 0) && (
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 sm:p-4" data-testid="buyback-rates-display">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">Buyback Rates <span className="text-[9px] opacity-60">(per 10g)</span></p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {buybackRates.purities.filter(p => p.rate_per_10g > 0).map(p => (
                <div key={p.purity_id} className="flex items-baseline gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/40 border border-border/50">
                  <span className="text-xs font-semibold text-primary">{p.purity_name}</span>
                  <span className="mono text-sm font-bold text-foreground">{formatCurrency(p.rate_per_10g)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bills - Date Grouped */}
        <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
          <CardHeader className="pb-3">
            <CardTitle className="heading text-lg sm:text-xl">Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" data-testid="admin-bill-tabs">
              {[
                { key: 'pending', label: 'Pending', count: pendingBills.length },
                { key: 'approved', label: 'Approved', count: approvedBills.length },
                { key: 'draft', label: 'Drafts', count: draftBills.length },
                { key: 'all', label: 'All', count: bills.length },
              ].map(t => (
                <button key={t.key} onClick={() => handleSetBillTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${billTab === t.key ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/50 text-muted-foreground border border-transparent hover:bg-secondary'}`} data-testid={`admin-tab-${t.key}`}>{t.label} ({t.count})</button>
              ))}
            </div>

            {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : sortedDates.length === 0 ? <p className="text-muted-foreground text-center py-8">No bills found</p> : (
              <div className="space-y-6">
                {sortedDates.map(date => (
                  <div key={date}>
                    {/* Date header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-bold uppercase tracking-widest text-primary bg-card px-3 py-1 rounded-full border border-primary/20">{date}</span>
                      <span className="text-xs text-muted-foreground">{groupedBills[date].length} bills</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {/* Bills for this date */}
                    <div className="space-y-2">
                      {groupedBills[date].map(bill => (
                        <div key={bill.id} className="p-3 rounded-lg bg-secondary/10 border border-border hover:border-primary/20 transition-colors" data-testid={`admin-bill-card-${bill.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Serial Number */}
                              <div className="flex flex-col items-center shrink-0">
                                <span className="mono text-lg font-bold text-primary leading-none">{bill.daily_serial || '-'}</span>
                                <span className="text-[8px] text-muted-foreground uppercase">S.No</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{bill.customer_name}</span>
                                  {statusBadge(bill.status)}
                                  <span className="text-[10px] text-muted-foreground mono">{bill.created_at?.slice(11, 16)}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mono mt-0.5">{bill.bill_number}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                  <span>Exec: <span className="text-foreground">{bill.executive_name}</span></span>
                                  {bill.salesperson_name && <span>SP: <span className="text-foreground">{bill.salesperson_name}</span></span>}
                                  {bill.customer_reference && <span>Ref: <span className="text-foreground">{bill.customer_reference}</span></span>}
                                  <span>Items: <span className="text-foreground">{bill.items?.length || 0}</span></span>
                                  <span>Wt: <span className="mono text-foreground">{getBillWeight(bill)}g</span></span>
                                  <span>Phone: <span className="mono text-foreground">{bill.customer_phone}</span></span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="mono text-base font-bold text-primary">{formatCurrency(bill.grand_total)}</span>
                              {/* MMI Toggle */}
                              <button onClick={() => toggleMmi(bill.id)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${bill.mmi_entered ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-secondary/50 text-muted-foreground border border-border hover:border-primary/30'}`} data-testid={`mmi-toggle-${bill.id}`}>
                                {bill.mmi_entered ? <Check size={10} /> : <X size={10} />} MMI
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`view-bill-${bill.id}`}><Eye size={12} className="mr-1" /> View</Button>
                            {(bill.status === 'sent' || bill.status === 'edited') && (
                              <Button size="sm" className="h-8 text-xs bg-[hsl(160,52%,46%)] hover:bg-[hsl(160,52%,40%)] text-white" onClick={() => approveBill(bill.id)} data-testid={`approve-bill-${bill.id}`}><CheckCircle size={12} className="mr-1" /> Approve</Button>
                            )}
                            <Button variant="secondary" size="sm" className="h-8 text-xs text-destructive ml-auto" onClick={() => deleteBill(bill.id)} data-testid={`delete-bill-${bill.id}`}><Trash2 size={12} /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
