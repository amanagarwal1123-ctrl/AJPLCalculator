import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, Filter, Calendar, Users, UserX, TrendingUp, AlertTriangle, MessageSquare, Star, ChevronDown, ChevronUp, ExternalLink, ShoppingBag, UserCheck, UserMinus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { toast } from 'sonner';

const GOLD_COLOR = 'hsl(44, 82%, 52%)';
const TEAL_COLOR = 'hsl(196, 70%, 52%)';
const EMERALD_COLOR = 'hsl(160, 52%, 46%)';
const CORAL_COLOR = 'hsl(14, 78%, 62%)';
const AMETHYST_COLOR = 'hsl(270, 35%, 66%)';
const PIE_COLORS = [GOLD_COLOR, TEAL_COLOR, EMERALD_COLOR, CORAL_COLOR, AMETHYST_COLOR];

export default function Reports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analytics, setAnalytics] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  
  // Feedback state
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackSort, setFeedbackSort] = useState('value'); // 'value'
  const [feedbackOrder, setFeedbackOrder] = useState('desc'); // 'asc' or 'desc'
  const [feedbackDateFrom, setFeedbackDateFrom] = useState('');
  const [feedbackDateTo, setFeedbackDateTo] = useState('');
  const [showOnlyWithComments, setShowOnlyWithComments] = useState(false);
  
  // Customer analytics state
  const [customerFrequency, setCustomerFrequency] = useState(null);
  const [inactiveCustomers, setInactiveCustomers] = useState(null);
  const [inactiveDays, setInactiveDays] = useState(30);
  const [loadingInactive, setLoadingInactive] = useState(false);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterExecutive, setFilterExecutive] = useState('all');
  
  // Reference breakdown state
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [refBreakdown, setRefBreakdown] = useState(null);
  const [loadingRefBreakdown, setLoadingRefBreakdown] = useState(false);
  
  // Reference report state
  const [refReport, setRefReport] = useState(null);
  const [loadingRefReport, setLoadingRefReport] = useState(false);
  const [refSubTab, setRefSubTab] = useState('total');
  const [expandedRef, setExpandedRef] = useState(null);

  useEffect(() => { loadInitialData(); loadFeedbacks(); }, []);

  const loadInitialData = async () => {
    try {
      const [analyticsRes, customersRes, branchesRes, usersRes, frequencyRes, inactiveRes] = await Promise.all([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/analytics/customers'),
        apiClient.get('/branches'),
        apiClient.get('/users').catch(() => ({ data: [] })),
        apiClient.get('/analytics/customers/frequency').catch(() => ({ data: null })),
        apiClient.get(`/analytics/customers/inactive?days=${inactiveDays}`).catch(() => ({ data: null })),
      ]);
      setAnalytics(analyticsRes.data);
      setCustomers(customersRes.data);
      setBranches(branchesRes.data);
      setUsers(usersRes.data);
      setCustomerFrequency(frequencyRes.data);
      setInactiveCustomers(inactiveRes.data);
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async () => {
    try {
      const res = await apiClient.get('/feedbacks');
      setFeedbacks(res.data);
    } catch (err) { console.error('Failed to load feedbacks'); }
  };

  const applyFilters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (filterBranch && filterBranch !== 'all') params.append('branch_id', filterBranch);
      if (filterExecutive && filterExecutive !== 'all') params.append('executive_id', filterExecutive);
      
      const res = await apiClient.get(`/analytics/dashboard?${params.toString()}`);
      setAnalytics(res.data);
      if (activeTab === 'reference') fetchRefReport();
      toast.success('Filters applied');
    } catch (err) {
      toast.error('Failed to apply filters');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterBranch('all');
    setFilterExecutive('all');
    loadInitialData();
    if (activeTab === 'reference') setTimeout(() => fetchRefReport(), 100);
  };

  const fetchInactiveCustomers = async (days) => {
    try {
      setLoadingInactive(true);
      const res = await apiClient.get(`/analytics/customers/inactive?days=${days}`);
      setInactiveCustomers(res.data);
    } catch (err) {
      toast.error('Failed to load inactive customers');
    } finally {
      setLoadingInactive(false);
    }
  };

  const handleInactiveDaysChange = (val) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setInactiveDays(num);
      fetchInactiveCustomers(num);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const toggleRef = (refName) => {
    setSelectedRefs(prev => prev.includes(refName) ? prev.filter(r => r !== refName) : [...prev, refName]);
  };

  const fetchRefBreakdown = async () => {
    if (selectedRefs.length === 0) { setRefBreakdown(null); return; }
    try {
      setLoadingRefBreakdown(true);
      const params = new URLSearchParams({ references: selectedRefs.join(',') });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await apiClient.get(`/analytics/reference-breakdown?${params.toString()}`);
      setRefBreakdown(res.data);
    } catch (err) { toast.error('Failed to load breakdown'); }
    finally { setLoadingRefBreakdown(false); }
  };

  useEffect(() => { fetchRefBreakdown(); }, [selectedRefs]);

  const fetchRefReport = async () => {
    try {
      setLoadingRefReport(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await apiClient.get(`/analytics/reference-report?${params.toString()}`);
      setRefReport(res.data);
    } catch (err) { toast.error('Failed to load reference report'); }
    finally { setLoadingRefReport(false); }
  };

  useEffect(() => { if (activeTab === 'reference') fetchRefReport(); }, [activeTab]);

  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const filtersActive = dateFrom || dateTo || (filterBranch && filterBranch !== 'all') || (filterExecutive && filterExecutive !== 'all');

  // Prepare chart data
  const ktData = analytics ? Object.entries(analytics.kt_analysis || {}).map(([k, v]) => ({ name: k, count: v.count, total: Math.round(v.total) })) : [];
  const goldVsDiamond = analytics ? [{ name: 'Gold', value: Math.round(analytics.gold_total) }, { name: 'Diamond', value: Math.round(analytics.diamond_total) }].filter(d => d.value > 0) : [];
  const referenceData = analytics ? Object.entries(analytics.reference_analysis || {}).map(([k, v]) => ({ name: k, customers: v.customers || v.count, bills: v.count, total: Math.round(v.total) })) : [];
  const dailySales = analytics?.daily_sales || [];
  const topItems = [...(analytics?.item_analysis || [])].sort((a, b) => b.total - a.total).slice(0, 10);
  const branchSales = [...(analytics?.branch_sales || [])];
  const execSales = [...(analytics?.executive_sales || [])];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm mono" style={{ color: p.color }}>
              {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading && !analytics) return <AppLayout><p className="text-center py-12 text-muted-foreground">Loading analytics...</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">Comprehensive sales and customer analysis</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-primary" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Date From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 bg-secondary/50 mono text-sm" data-testid="filter-date-from" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 bg-secondary/50 mono text-sm" data-testid="filter-date-to" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Branch</Label>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-9 bg-secondary/50 text-sm" data-testid="filter-branch">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Executive</Label>
                <Select value={filterExecutive} onValueChange={setFilterExecutive}>
                  <SelectTrigger className="h-9 bg-secondary/50 text-sm" data-testid="filter-executive">
                    <SelectValue placeholder="All Executives" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Executives</SelectItem>
                    {users.filter(u => u.role === 'executive').map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-9" onClick={applyFilters} data-testid="apply-filters">Apply</Button>
                <Button size="sm" variant="secondary" className="h-9" onClick={clearFilters} data-testid="clear-filters">Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {filtersActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary w-fit" data-testid="filters-active-badge">
            <Filter size={12} /> Showing filtered results
            {dateFrom && <span className="mono">from {dateFrom}</span>}
            {dateTo && <span className="mono">to {dateTo}</span>}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border" data-testid="total-sales-summary">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Sales</p>
              <p className="mono text-xl font-bold text-primary mt-1">{formatCurrency(analytics?.all_time_total)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="total-customers-summary">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{filtersActive ? 'Unique Customers' : 'Total Customers'}</p>
              <p className="mono text-2xl font-bold text-[hsl(196,70%,52%)] mt-1">{analytics?.total_customers || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="total-bills-summary">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Bills</p>
              <p className="mono text-2xl font-bold text-[hsl(160,52%,46%)] mt-1">{analytics?.total_bills || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="gold-sales-summary">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Gold Sales</p>
              <p className="mono text-lg font-bold text-primary mt-1">{formatCurrency(analytics?.gold_total)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="diamond-sales-summary">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Diamond Sales</p>
              <p className="mono text-lg font-bold text-[hsl(196,70%,52%)] mt-1">{formatCurrency(analytics?.diamond_total)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); setSearchParams({ tab }, { replace: true }); }}>
          <TabsList className="bg-secondary flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="kt" data-testid="tab-kt">KT Analysis</TabsTrigger>
            <TabsTrigger value="branches" data-testid="tab-branches">Branches</TabsTrigger>
            <TabsTrigger value="executives" data-testid="tab-executives">Executives</TabsTrigger>
            <TabsTrigger value="reference" data-testid="tab-reference">References</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items">Top Items</TabsTrigger>
            <TabsTrigger value="feedbacks" data-testid="tab-feedbacks">Feedbacks</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" data-testid="tab-content-overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Daily Sales Trend</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(dailySales, 'daily-sales')}>
                    <Download size={12} className="mr-1" /> CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {dailySales.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailySales}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                          <XAxis dataKey="date" stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => v?.slice(5)} />
                          <YAxis stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="total" stroke={GOLD_COLOR} strokeWidth={2} dot={false} name="Sales" />
                          <Line type="monotone" dataKey="count" stroke={TEAL_COLOR} strokeWidth={1.5} dot={false} name="Bills" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Gold vs Diamond Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {goldVsDiamond.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={goldVsDiamond} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                            {goldVsDiamond.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* KT Analysis */}
          <TabsContent value="kt" data-testid="tab-content-kt">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Sales by KT Category</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(ktData, 'kt-analysis')}><Download size={12} className="mr-1" /> CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {ktData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ktData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                        <XAxis dataKey="name" stroke="hsl(220, 15%, 75%)" fontSize={12} />
                        <YAxis stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} name="Total Sales" />
                        <Bar dataKey="count" fill={TEAL_COLOR} radius={[4, 4, 0, 0]} name="Items Sold" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                </div>
                {ktData.length > 0 && (
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">KT</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Items Sold</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Sales</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Avg Per Item</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...ktData].sort((a, b) => b.total - a.total).map((kt, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-medium text-primary">{kt.name}</TableCell>
                          <TableCell className="mono text-right">{kt.count}</TableCell>
                          <TableCell className="mono text-right font-medium text-primary">{formatCurrency(kt.total)}</TableCell>
                          <TableCell className="mono text-right text-muted-foreground">{formatCurrency(kt.count > 0 ? kt.total / kt.count : 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branch Sales */}
          <TabsContent value="branches" data-testid="tab-content-branches">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Branch-wise Sales</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(branchSales, 'branch-sales')}><Download size={12} className="mr-1" /> CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="h-72 mb-4">
                  {branchSales.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchSales}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                        <XAxis dataKey="branch_name" stroke="hsl(220, 15%, 75%)" fontSize={11} />
                        <YAxis stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} name="Total Sales" />
                        <Bar dataKey="count" fill={EMERALD_COLOR} radius={[4, 4, 0, 0]} name="Bills" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                </div>
                {branchSales.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Branch</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Bills</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...branchSales].sort((a, b) => b.total - a.total).map((bs, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-medium">{bs.branch_name}</TableCell>
                          <TableCell className="mono text-right">{bs.count}</TableCell>
                          <TableCell className="mono text-right font-medium text-primary">{formatCurrency(bs.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executive Sales */}
          <TabsContent value="executives" data-testid="tab-content-executives">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Executive Performance</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(execSales, 'executive-sales')}><Download size={12} className="mr-1" /> CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="h-72 mb-4">
                  {execSales.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={execSales} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                        <XAxis type="number" stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <YAxis dataKey="executive_name" type="category" stroke="hsl(220, 15%, 75%)" fontSize={11} width={100} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill={GOLD_COLOR} radius={[0, 4, 4, 0]} name="Total Sales" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                </div>
                {execSales.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Bills</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Sales</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Avg Ticket</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {execSales.map((es, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-medium">{es.executive_name}</TableCell>
                          <TableCell className="mono text-right">{es.count}</TableCell>
                          <TableCell className="mono text-right font-medium text-primary">{formatCurrency(es.total)}</TableCell>
                          <TableCell className="mono text-right text-muted-foreground">{formatCurrency(es.count > 0 ? es.total / es.count : 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* References */}
          <TabsContent value="reference" data-testid="tab-content-reference">
            <div className="space-y-4">
              {/* Summary Cards */}
              {refReport?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="ref-summary-cards">
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1"><ShoppingBag size={13} className="text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Bills</p></div>
                      <p className="mono text-xl font-bold text-primary">{refReport.summary.total_bills}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1"><Users size={13} className="text-[hsl(196,70%,52%)]" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Visitors</p></div>
                      <p className="mono text-xl font-bold text-[hsl(196,70%,52%)]">{refReport.summary.total_customers}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1"><UserCheck size={13} className="text-[hsl(160,52%,46%)]" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Purchased</p></div>
                      <p className="mono text-xl font-bold text-[hsl(160,52%,46%)]">{refReport.summary.approved_customers}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1"><UserMinus size={13} className="text-[hsl(14,78%,62%)]" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Non-Purchasers</p></div>
                      <p className="mono text-xl font-bold text-[hsl(14,78%,62%)]">{refReport.summary.np_customers}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1"><TrendingUp size={13} className="text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Conversion</p></div>
                      <p className="mono text-xl font-bold text-primary">
                        {refReport.summary.total_customers > 0 ? Math.round((refReport.summary.approved_customers / refReport.summary.total_customers) * 100) : 0}%
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sub-tabs */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => { setRefSubTab('total'); setExpandedRef(null); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${refSubTab === 'total' ? 'bg-primary text-primary-foreground' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'}`}
                      data-testid="ref-subtab-total"
                    >
                      <ShoppingBag size={14} className="inline mr-1.5 -mt-0.5" />Total
                    </button>
                    <button
                      onClick={() => { setRefSubTab('approved'); setExpandedRef(null); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${refSubTab === 'approved' ? 'bg-[hsl(160,52%,46%)] text-white' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'}`}
                      data-testid="ref-subtab-approved"
                    >
                      <UserCheck size={14} className="inline mr-1.5 -mt-0.5" />Approved
                    </button>
                    <button
                      onClick={() => { setRefSubTab('np'); setExpandedRef(null); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${refSubTab === 'np' ? 'bg-[hsl(14,78%,62%)] text-white' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'}`}
                      data-testid="ref-subtab-np"
                    >
                      <UserMinus size={14} className="inline mr-1.5 -mt-0.5" />NP
                    </button>
                    <div className="ml-auto">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => fetchRefReport()} data-testid="ref-refresh">
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {loadingRefReport ? (
                    <p className="text-muted-foreground text-center py-8">Loading reference report...</p>
                  ) : !refReport ? (
                    <p className="text-muted-foreground text-center py-8">No data available</p>
                  ) : (
                    <>
                      {/* TOTAL Sub-tab */}
                      {refSubTab === 'total' && (
                        <div className="space-y-3" data-testid="ref-total-view">
                          {refReport.total.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No bills found</p>
                          ) : (
                            <>
                              <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={refReport.total} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                                    <XAxis type="number" stroke="hsl(220, 15%, 75%)" fontSize={10} />
                                    <YAxis dataKey="reference" type="category" stroke="hsl(220, 15%, 75%)" fontSize={11} width={90} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="bills" fill={GOLD_COLOR} radius={[0, 4, 4, 0]} name="Bills" />
                                    <Bar dataKey="customers" fill={TEAL_COLOR} radius={[0, 4, 4, 0]} name="Customers" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-border">
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Customers</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Bills</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {refReport.total.map((r) => (
                                    <Fragment key={`total-${r.reference}`}>
                                      <TableRow className="border-border cursor-pointer hover:bg-secondary/20" onClick={() => setExpandedRef(expandedRef === `total-${r.reference}` ? null : `total-${r.reference}`)}>
                                        <TableCell className="font-medium">{r.reference}</TableCell>
                                        <TableCell className="mono text-right">{r.customers}</TableCell>
                                        <TableCell className="mono text-right">{r.bills}</TableCell>
                                        <TableCell className="mono text-right font-medium text-primary">{formatCurrency(r.total)}</TableCell>
                                        <TableCell className="text-right">
                                          {expandedRef === `total-${r.reference}` ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </TableCell>
                                      </TableRow>
                                      {expandedRef === `total-${r.reference}` && (
                                        <TableRow className="border-border">
                                          <TableCell colSpan={5} className="p-0">
                                            <div className="bg-secondary/10 p-3 space-y-1 max-h-64 overflow-y-auto">
                                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Bills for {r.reference}</p>
                                              {r.bill_list.map((b) => (
                                                <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/20 cursor-pointer" onClick={() => navigate(`/bill/${b.id}`)}>
                                                  <div className="flex items-center gap-3">
                                                    <span className="mono text-xs text-muted-foreground">{b.bill_number}</span>
                                                    <span className="text-sm">{b.customer_name}</span>
                                                    <Badge variant={b.status === 'approved' ? 'default' : b.status === 'sent' ? 'secondary' : 'outline'} className="text-[10px]">{b.status}</Badge>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                    <span className="mono text-sm font-medium text-primary">{formatCurrency(b.grand_total)}</span>
                                                    <span className="text-xs text-muted-foreground">{b.created_at?.slice(0, 10)}</span>
                                                    <ExternalLink size={12} className="text-muted-foreground" />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </Fragment>
                                  ))}
                                </TableBody>
                              </Table>
                            </>
                          )}
                        </div>
                      )}

                      {/* APPROVED Sub-tab */}
                      {refSubTab === 'approved' && (
                        <div className="space-y-3" data-testid="ref-approved-view">
                          {refReport.approved.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No approved bills found</p>
                          ) : (
                            <>
                              <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={refReport.approved} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                                    <XAxis type="number" stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                    <YAxis dataKey="reference" type="category" stroke="hsl(220, 15%, 75%)" fontSize={11} width={90} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="total" fill={GOLD_COLOR} radius={[0, 4, 4, 0]} name="Total Sales" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-border">
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Customers</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Bills</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Sales</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {refReport.approved.map((r) => (
                                    <Fragment key={`approved-${r.reference}`}>
                                      <TableRow className="border-border cursor-pointer hover:bg-secondary/20" onClick={() => setExpandedRef(expandedRef === `approved-${r.reference}` ? null : `approved-${r.reference}`)}>
                                        <TableCell className="font-medium">{r.reference}</TableCell>
                                        <TableCell className="mono text-right">{r.customers}</TableCell>
                                        <TableCell className="mono text-right">{r.bills}</TableCell>
                                        <TableCell className="mono text-right font-medium text-primary">{formatCurrency(r.total)}</TableCell>
                                        <TableCell className="text-right">
                                          {expandedRef === `approved-${r.reference}` ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </TableCell>
                                      </TableRow>
                                      {expandedRef === `approved-${r.reference}` && (
                                        <TableRow className="border-border">
                                          <TableCell colSpan={5} className="p-0">
                                            <div className="bg-secondary/10 p-3 space-y-1 max-h-64 overflow-y-auto">
                                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Approved bills for {r.reference}</p>
                                              {r.bill_list.map((b) => (
                                                <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/20 cursor-pointer" onClick={() => navigate(`/bill/${b.id}`)}>
                                                  <div className="flex items-center gap-3">
                                                    <span className="mono text-xs text-muted-foreground">{b.bill_number}</span>
                                                    <span className="text-sm">{b.customer_name}</span>
                                                    <Badge variant="default" className="text-[10px] bg-[hsl(160,52%,46%)]">{b.status}</Badge>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                    <span className="mono text-sm font-medium text-primary">{formatCurrency(b.grand_total)}</span>
                                                    <span className="text-xs text-muted-foreground">{b.created_at?.slice(0, 10)}</span>
                                                    <ExternalLink size={12} className="text-muted-foreground" />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </Fragment>
                                  ))}
                                </TableBody>
                              </Table>
                            </>
                          )}
                        </div>
                      )}

                      {/* NP (Non-Purchasers) Sub-tab */}
                      {refSubTab === 'np' && (
                        <div className="space-y-3" data-testid="ref-np-view">
                          {refReport.np.length === 0 ? (
                            <div className="text-center py-8">
                              <UserCheck size={36} className="mx-auto mb-3 text-[hsl(160,52%,46%)] opacity-60" />
                              <p className="text-muted-foreground">All visitors made a purchase</p>
                              <p className="text-xs text-muted-foreground mt-1">No non-purchasers found for this period</p>
                            </div>
                          ) : (
                            <>
                              <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={refReport.np} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                                    <XAxis type="number" stroke="hsl(220, 15%, 75%)" fontSize={10} />
                                    <YAxis dataKey="reference" type="category" stroke="hsl(220, 15%, 75%)" fontSize={11} width={90} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="customers" fill={CORAL_COLOR} radius={[0, 4, 4, 0]} name="Non-Purchasers" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-border">
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Non-Purchasers</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {refReport.np.map((r) => (
                                    <Fragment key={`np-${r.reference}`}>
                                      <TableRow className="border-border cursor-pointer hover:bg-secondary/20" onClick={() => setExpandedRef(expandedRef === `np-${r.reference}` ? null : `np-${r.reference}`)}>
                                        <TableCell className="font-medium">{r.reference}</TableCell>
                                        <TableCell className="mono text-right font-medium text-[hsl(14,78%,62%)]">{r.customers}</TableCell>
                                        <TableCell className="text-right">
                                          {expandedRef === `np-${r.reference}` ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </TableCell>
                                      </TableRow>
                                      {expandedRef === `np-${r.reference}` && (
                                        <TableRow className="border-border">
                                          <TableCell colSpan={3} className="p-0">
                                            <div className="bg-secondary/10 p-3 space-y-2 max-h-64 overflow-y-auto">
                                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Non-purchasers from {r.reference}</p>
                                              {r.customer_list.map((c, ci) => (
                                                <div key={ci} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/10 border border-border/50">
                                                  <div className="flex items-center gap-3">
                                                    <UserMinus size={14} className="text-[hsl(14,78%,62%)]" />
                                                    <div>
                                                      <span className="text-sm font-medium">{c.customer_name}</span>
                                                      <span className="text-xs text-muted-foreground ml-2 mono">{c.customer_phone}</span>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-right">
                                                    <div>
                                                      <span className="text-xs text-muted-foreground">{c.inquiry_count} inquir{c.inquiry_count > 1 ? 'ies' : 'y'}</span>
                                                      <span className="text-xs text-muted-foreground ml-2">Last: {c.last_inquiry?.slice(0, 10)}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </Fragment>
                                  ))}
                                </TableBody>
                              </Table>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Gold vs Diamond Breakdown by Reference (keep existing) */}
              <Card className="bg-card border-border" data-testid="ref-breakdown-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Gold vs Diamond Sales by Reference</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Select references to compare their gold and diamond sales</p>
                </CardHeader>
                <CardContent>
                  {referenceData.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2 mb-4" data-testid="ref-selector">
                        {referenceData.map(r => (
                          <button
                            key={r.name}
                            onClick={() => toggleRef(r.name)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              selectedRefs.includes(r.name)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary/30 text-muted-foreground border-border hover:border-primary/50'
                            }`}
                            data-testid={`ref-chip-${r.name}`}
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>

                      {selectedRefs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6 text-sm">Select one or more references above to see gold vs diamond breakdown</p>
                      ) : loadingRefBreakdown ? (
                        <p className="text-muted-foreground text-center py-6">Loading...</p>
                      ) : refBreakdown ? (
                        <div className="space-y-4">
                          {selectedRefs.length > 1 && (
                            <div className="p-4 rounded-lg bg-secondary/20 border border-border" data-testid="ref-combined-summary">
                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Combined ({selectedRefs.join(' + ')})</p>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Gold Sales</p>
                                  <p className="mono text-lg font-bold text-primary">{formatCurrency(refBreakdown.combined.gold_total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Diamond Sales</p>
                                  <p className="mono text-lg font-bold text-[hsl(196,70%,52%)]">{formatCurrency(refBreakdown.combined.diamond_total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                                  <p className="mono text-lg font-bold">{formatCurrency(refBreakdown.combined.total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Bills</p>
                                  <p className="mono text-lg font-bold">{refBreakdown.combined.bills}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Customers</p>
                                  <p className="mono text-lg font-bold">{refBreakdown.combined.customers}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {refBreakdown.references.length > 0 && (
                            <>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={refBreakdown.references}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                                    <XAxis dataKey="reference" stroke="hsl(220, 15%, 75%)" fontSize={11} />
                                    <YAxis stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="gold_total" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} name="Gold Sales" />
                                    <Bar dataKey="diamond_total" fill={TEAL_COLOR} radius={[4, 4, 0, 0]} name="Diamond Sales" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-border">
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Gold Sales</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Diamond Sales</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Bills</TableHead>
                                    <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Customers</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {refBreakdown.references.map((r, i) => (
                                    <TableRow key={i} className="border-border">
                                      <TableCell className="font-medium">{r.reference}</TableCell>
                                      <TableCell className="mono text-right text-primary font-medium">{formatCurrency(r.gold_total)}</TableCell>
                                      <TableCell className="mono text-right text-[hsl(196,70%,52%)] font-medium">{formatCurrency(r.diamond_total)}</TableCell>
                                      <TableCell className="mono text-right font-medium">{formatCurrency(r.total)}</TableCell>
                                      <TableCell className="mono text-right">{r.bills}</TableCell>
                                      <TableCell className="mono text-right">{r.customers}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-6">No reference data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Customer Analytics */}
          <TabsContent value="customers" data-testid="tab-content-customers">
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="customer-kpi-cards">
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} className="text-primary" />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Customers</p>
                    </div>
                    <p className="mono text-2xl font-bold text-primary" data-testid="total-customers-count">{customerFrequency?.total_customers || customers.length || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={14} className="text-[hsl(160,52%,46%)]" />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Avg Visits</p>
                    </div>
                    <p className="mono text-2xl font-bold text-[hsl(160,52%,46%)]" data-testid="avg-visits">{customerFrequency?.avg_visits || '-'}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={14} className="text-[hsl(196,70%,52%)]" />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Avg Spending</p>
                    </div>
                    <p className="mono text-xl font-bold text-[hsl(196,70%,52%)]" data-testid="avg-spending">{formatCurrency(customerFrequency?.avg_spending)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <UserX size={14} className="text-[hsl(14,78%,62%)]" />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Inactive ({inactiveDays}d)</p>
                    </div>
                    <p className="mono text-2xl font-bold text-[hsl(14,78%,62%)]" data-testid="inactive-count">{inactiveCustomers?.inactive_count || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row: Visit Frequency + Spending Tiers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visit Frequency Cohorts */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Visit Frequency Cohorts</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(customerFrequency?.frequency_cohorts || [], 'visit-frequency')} data-testid="export-frequency-csv">
                      <Download size={12} className="mr-1" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64" data-testid="frequency-chart">
                      {customerFrequency?.frequency_cohorts?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={customerFrequency.frequency_cohorts}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                            <XAxis dataKey="name" stroke="hsl(220, 15%, 75%)" fontSize={11} />
                            <YAxis stroke="hsl(220, 15%, 75%)" fontSize={10} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} name="Customers" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                    </div>
                    {customerFrequency?.frequency_cohorts?.length > 0 && (
                      <Table className="mt-3">
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Cohort</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Customers</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Spent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerFrequency.frequency_cohorts.map((c, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="mono text-right">{c.count}</TableCell>
                              <TableCell className="mono text-right text-primary font-medium">{formatCurrency(c.total_spent)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Spending Tiers */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Customer Spending Tiers</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(customerFrequency?.spending_tiers || [], 'spending-tiers')} data-testid="export-spending-csv">
                      <Download size={12} className="mr-1" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64" data-testid="spending-chart">
                      {customerFrequency?.spending_tiers?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={customerFrequency.spending_tiers.filter(t => t.count > 0)} 
                              cx="50%" cy="50%" 
                              innerRadius={55} outerRadius={85} 
                              paddingAngle={4} 
                              dataKey="count"
                              label={({ name, count }) => count > 0 ? `${name}: ${count}` : ''}
                              labelLine={false}
                            >
                              {customerFrequency.spending_tiers.filter(t => t.count > 0).map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>}
                    </div>
                    {customerFrequency?.spending_tiers?.length > 0 && (
                      <Table className="mt-3">
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Tier</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Customers</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Spent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerFrequency.spending_tiers.map((t, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="font-medium">{t.name}</TableCell>
                              <TableCell className="mono text-right">{t.count}</TableCell>
                              <TableCell className="mono text-right text-primary font-medium">{formatCurrency(t.total_spent)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Inactive Customers Section */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle size={16} className="text-[hsl(14,78%,62%)]" />
                        Inactive Customers
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Not visited in</Label>
                        <Input 
                          type="number" 
                          value={inactiveDays} 
                          onChange={e => handleInactiveDaysChange(e.target.value)}
                          className="h-8 w-20 bg-secondary/50 mono text-sm text-center" 
                          min="1"
                          data-testid="inactive-days-input"
                        />
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">days</Label>
                      </div>
                      {inactiveCustomers && (
                        <span className="text-sm font-medium text-[hsl(14,78%,62%)]" data-testid="inactive-ratio">
                          {inactiveCustomers.inactive_count} out of {inactiveCustomers.total_customers} customers
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(inactiveCustomers?.inactive_customers || [], 'inactive-customers')} data-testid="export-inactive-csv">
                      <Download size={12} className="mr-1" /> CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingInactive ? (
                    <p className="text-muted-foreground text-center py-6">Loading...</p>
                  ) : (!inactiveCustomers || inactiveCustomers.inactive_count === 0) ? (
                    <div className="text-center py-8" data-testid="inactive-empty-state">
                      <Users size={36} className="mx-auto mb-3 text-[hsl(160,52%,46%)] opacity-60" />
                      <p className="text-muted-foreground">All customers have visited within the last {inactiveDays} days</p>
                      <p className="text-xs text-muted-foreground mt-1">Try increasing the threshold to find less active customers</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto" data-testid="inactive-customers-table">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Name</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Phone</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Location</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Visits</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Spent</TableHead>
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Days Inactive</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inactiveCustomers.inactive_customers.map((c, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="mono text-sm">{c.phone}</TableCell>
                              <TableCell className="text-muted-foreground">{c.location || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{c.reference || '-'}</TableCell>
                              <TableCell className="mono text-right">{c.total_visits || 1}</TableCell>
                              <TableCell className="mono text-right font-medium text-primary">{formatCurrency(c.total_spent)}</TableCell>
                              <TableCell className="mono text-right">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  c.days_since_last_visit > 60 ? 'bg-destructive/20 text-[hsl(0,72%,60%)]' :
                                  c.days_since_last_visit > 30 ? 'bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]' :
                                  'bg-[hsl(196,70%,52%)]/20 text-[hsl(196,70%,52%)]'
                                }`}>{c.days_since_last_visit} days</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Full Customer Directory */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">All Customers</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(customers, 'all-customers')} data-testid="export-all-customers-csv">
                    <Download size={12} className="mr-1" /> CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {customers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No customer data yet</p>
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
                            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Days Since Last Visit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...customers].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).map((c, i) => (
                            <TableRow key={i} className="border-border">
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
                                }`}>{c.days_since_last_visit ?? '-'} days</span>
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
          </TabsContent>

          {/* Top Items */}
          <TabsContent value="items" data-testid="tab-content-items">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top Selling Items</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(topItems, 'top-items')}><Download size={12} className="mr-1" /> CSV</Button>
              </CardHeader>
              <CardContent>
                {topItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                ) : (
                  <>
                    <div className="h-72 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItems}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 30%, 30%)" />
                          <XAxis dataKey="item_name" stroke="hsl(220, 15%, 75%)" fontSize={10} angle={-30} textAnchor="end" height={50} />
                          <YAxis stroke="hsl(220, 15%, 75%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="total" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} name="Total Sales" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Item</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">KT</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Sold</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topItems.map((item, i) => (
                          <TableRow key={i} className="border-border">
                            <TableCell className="font-medium">{item.item_name}</TableCell>
                            <TableCell className="text-primary">{item.purity}</TableCell>
                            <TableCell className="mono text-right">{item.count}</TableCell>
                            <TableCell className="mono text-right font-medium">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedbacks */}
          <TabsContent value="feedbacks" data-testid="tab-content-feedbacks">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><MessageSquare size={16} className="text-primary" /> All Feedbacks ({feedbacks.length})</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(feedbacks.map(f => ({customer: f.customer_name, bill: f.bill_number, date: f.bill_date, total: f.grand_total, avg_rating: f.avg_rating, comments: f.additional_comments})), 'feedbacks')} data-testid="export-feedbacks-csv"><Download size={12} className="mr-1" /> CSV</Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">From Date</Label>
                      <Input type="date" value={feedbackDateFrom} onChange={e => setFeedbackDateFrom(e.target.value)} className="h-8 w-36 bg-secondary/50 mono text-xs" data-testid="feedback-date-from" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To Date</Label>
                      <Input type="date" value={feedbackDateTo} onChange={e => setFeedbackDateTo(e.target.value)} className="h-8 w-36 bg-secondary/50 mono text-xs" data-testid="feedback-date-to" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Sort:</span>
                      <Button variant={feedbackOrder === 'desc' ? 'default' : 'secondary'} size="sm" className="h-7 text-xs" onClick={() => setFeedbackOrder('desc')} data-testid="sort-feedback-desc">High to Low</Button>
                      <Button variant={feedbackOrder === 'asc' ? 'default' : 'secondary'} size="sm" className="h-7 text-xs" onClick={() => setFeedbackOrder('asc')} data-testid="sort-feedback-asc">Low to High</Button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="show-only-comments-label">
                      <input
                        type="checkbox"
                        checked={showOnlyWithComments}
                        onChange={e => setShowOnlyWithComments(e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-primary"
                        data-testid="show-only-comments-checkbox"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Only with comments</span>
                    </label>
                    {(feedbackDateFrom || feedbackDateTo) && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setFeedbackDateFrom(''); setFeedbackDateTo(''); }} data-testid="clear-feedback-filters">Clear Dates</Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {feedbacks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No feedbacks submitted yet</p>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      let filtered = [...feedbacks];
                      if (feedbackDateFrom) filtered = filtered.filter(f => (f.bill_date || f.submitted_at?.slice(0, 10) || '') >= feedbackDateFrom);
                      if (feedbackDateTo) filtered = filtered.filter(f => (f.bill_date || f.submitted_at?.slice(0, 10) || '') <= feedbackDateTo);
                      if (showOnlyWithComments) filtered = filtered.filter(f => f.additional_comments && f.additional_comments.trim());
                      filtered.sort((a, b) => feedbackOrder === 'asc' ? (a.grand_total || 0) - (b.grand_total || 0) : (b.grand_total || 0) - (a.grand_total || 0));
                      if (filtered.length === 0) return <p className="text-muted-foreground text-center py-8">{showOnlyWithComments ? 'No feedbacks with comments found' : 'No feedbacks found for the selected date range'}</p>;
                      return filtered.map((f, i) => (
                      <div key={f.id || i} className="p-3 sm:p-4 rounded-lg bg-secondary/20 border border-border" data-testid={`feedback-item-${i}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{f.customer_name || 'Anonymous'}</span>
                              <span className="mono text-[10px] text-muted-foreground">{f.bill_number}</span>
                              <span className="text-[10px] text-muted-foreground">{f.bill_date}</span>
                            </div>
                            {f.executive_name && <p className="text-xs text-muted-foreground mt-0.5">Exec: {f.executive_name}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1">
                              <Star size={12} className="text-primary fill-primary" />
                              <span className="mono text-sm font-bold text-primary">{f.avg_rating}</span>
                            </div>
                            <span className="mono text-sm font-medium text-primary">{formatCurrency(f.grand_total)}</span>
                          </div>
                        </div>
                        {f.ratings?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {f.ratings.map((r, ri) => (
                              <div key={ri} className="text-xs px-2 py-1 rounded bg-secondary/50 border border-border">
                                <span className="text-muted-foreground">{r.question?.substring(0, 30)}{r.question?.length > 30 ? '...' : ''}:</span>
                                <span className="mono font-bold ml-1 text-primary">{r.rating}/10</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {f.additional_comments && (
                          <div className="mt-2 border-l-2 border-primary/30 pl-3 py-1.5 bg-primary/5 rounded-r" data-testid={`feedback-comment-${i}`}>
                            <p className="text-sm text-foreground/90" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", lineHeight: '1.5' }}>"{f.additional_comments}"</p>
                          </div>
                        )}
                      </div>
                    ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
