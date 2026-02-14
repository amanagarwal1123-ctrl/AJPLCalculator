import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Download, Users as UsersIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { toast } from 'sonner';

const GOLD_COLOR = 'hsl(44, 82%, 52%)';
const TEAL_COLOR = 'hsl(196, 70%, 52%)';
const EMERALD_COLOR = 'hsl(160, 52%, 46%)';
const CORAL_COLOR = 'hsl(14, 78%, 62%)';
const AMETHYST_COLOR = 'hsl(270, 35%, 66%)';
const PIE_COLORS = [GOLD_COLOR, TEAL_COLOR, EMERALD_COLOR, CORAL_COLOR, AMETHYST_COLOR];

export default function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [analyticsRes, customersRes] = await Promise.all([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/analytics/customers'),
      ]);
      setAnalytics(analyticsRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

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

  // Prepare chart data
  const ktData = analytics ? Object.entries(analytics.kt_analysis || {}).map(([k, v]) => ({ name: k, count: v.count, total: v.total })) : [];
  const goldVsDiamond = analytics ? [{ name: 'Gold', value: analytics.gold_total }, { name: 'Diamond', value: analytics.diamond_total }].filter(d => d.value > 0) : [];
  const referenceData = analytics ? Object.entries(analytics.reference_analysis || {}).map(([k, v]) => ({ name: k, customers: v.count, total: v.total })) : [];
  const dailySales = analytics?.daily_sales || [];
  const topItems = (analytics?.item_analysis || []).sort((a, b) => b.total - a.total).slice(0, 10);

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

  if (loading) return <AppLayout><p className="text-center py-12 text-muted-foreground">Loading analytics...</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">Comprehensive sales and customer analysis</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Customers</p>
              <p className="mono text-2xl font-bold text-primary mt-1">{analytics?.total_customers || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Bills</p>
              <p className="mono text-2xl font-bold text-[hsl(196,70%,52%)] mt-1">{analytics?.total_bills || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Gold Sales</p>
              <p className="mono text-xl font-bold text-primary mt-1">{formatCurrency(analytics?.gold_total)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Diamond Sales</p>
              <p className="mono text-xl font-bold text-[hsl(196,70%,52%)] mt-1">{formatCurrency(analytics?.diamond_total)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="kt" data-testid="tab-kt">KT Analysis</TabsTrigger>
            <TabsTrigger value="reference" data-testid="tab-reference">References</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items">Top Items</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Sales Trend */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Daily Sales Trend</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(dailySales, 'daily-sales')}>
                    <Download size={12} className="mr-1" /> CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailySales}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(226, 18%, 24%)" />
                        <XAxis dataKey="date" stroke="hsl(40, 10%, 78%)" fontSize={10} tickFormatter={v => v?.slice(5)} />
                        <YAxis stroke="hsl(40, 10%, 78%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="total" stroke={GOLD_COLOR} strokeWidth={2} dot={false} name="Sales" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Gold vs Diamond */}
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
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* KT Analysis */}
          <TabsContent value="kt">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Sales by KT Category</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(ktData, 'kt-analysis')}>
                  <Download size={12} className="mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {ktData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ktData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(226, 18%, 24%)" />
                        <XAxis dataKey="name" stroke="hsl(40, 10%, 78%)" fontSize={12} />
                        <YAxis stroke="hsl(40, 10%, 78%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} name="Total Sales" />
                        <Bar dataKey="count" fill={TEAL_COLOR} radius={[4, 4, 0, 0]} name="Items Sold" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* References */}
          <TabsContent value="reference">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Customer References</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(referenceData, 'references')}>
                  <Download size={12} className="mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {referenceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={referenceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(226, 18%, 24%)" />
                        <XAxis type="number" stroke="hsl(40, 10%, 78%)" fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke="hsl(40, 10%, 78%)" fontSize={11} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="customers" fill={TEAL_COLOR} radius={[0, 4, 4, 0]} name="Customers" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
                  )}
                </div>
                {referenceData.length > 0 && (
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Customers</TableHead>
                        <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referenceData.sort((a, b) => b.total - a.total).map((r, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell>{r.name}</TableCell>
                          <TableCell className="mono text-right">{r.customers}</TableCell>
                          <TableCell className="mono text-right font-medium">{formatCurrency(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Analytics */}
          <TabsContent value="customers">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Customer Visit Analytics</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(customers, 'customers')}>
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
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Reference</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Visits</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Spent</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Days Since Last Visit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).map((c, i) => (
                          <TableRow key={i} className="border-border">
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="mono text-sm">{c.phone}</TableCell>
                            <TableCell className="text-muted-foreground">{c.reference || '-'}</TableCell>
                            <TableCell className="mono text-right">{c.total_visits || 1}</TableCell>
                            <TableCell className="mono text-right font-medium">{formatCurrency(c.total_spent)}</TableCell>
                            <TableCell className="mono text-right">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                c.days_since_last_visit > 30 ? 'bg-red-500/20 text-red-400' :
                                c.days_since_last_visit > 14 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
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
          </TabsContent>

          {/* Top Items */}
          <TabsContent value="items">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top Selling Items</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => exportCSV(topItems, 'top-items')}>
                  <Download size={12} className="mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {topItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                ) : (
                  <>
                    <div className="h-72 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItems}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(226, 18%, 24%)" />
                          <XAxis dataKey="item_name" stroke="hsl(40, 10%, 78%)" fontSize={10} angle={-30} textAnchor="end" height={50} />
                          <YAxis stroke="hsl(40, 10%, 78%)" fontSize={10} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
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
        </Tabs>
      </div>
    </AppLayout>
  );
}
