import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ArrowLeft, TrendingUp, TrendingDown, IndianRupee, FileText, Building, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';

const GOLD = 'hsl(44, 82%, 52%)';
const TEAL = 'hsl(196, 70%, 52%)';

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export default function SalespersonPerformance() {
  const { spName } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get(`/salespeople/${encodeURIComponent(spName)}/performance`);
        setData(res.data);
      } catch (err) { toast.error('Failed to load performance data'); }
      finally { setLoading(false); }
    };
    load();
  }, [spName]);

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div></AppLayout>;
  if (!data) return <AppLayout><p className="text-muted-foreground text-center py-20">No data found</p></AppLayout>;

  const dailySales = data.daily_sales || [];
  const avgDaily = dailySales.length > 0 ? data.total_sales / dailySales.length : 0;

  // Compute trend: compare last 7 days avg vs previous 7 days avg
  let trendDirection = 'neutral';
  let trendPercent = 0;
  if (dailySales.length >= 4) {
    const mid = Math.floor(dailySales.length / 2);
    const recentHalf = dailySales.slice(mid);
    const olderHalf = dailySales.slice(0, mid);
    const recentAvg = recentHalf.reduce((s, d) => s + d.amount, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((s, d) => s + d.amount, 0) / olderHalf.length;
    if (olderAvg > 0) {
      trendPercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
      trendDirection = trendPercent >= 0 ? 'up' : 'down';
    }
  }

  // Format chart data - show last 30 entries max for readability
  const chartData = dailySales.slice(-30).map(d => ({
    date: d.date.slice(5), // MM-DD format
    fullDate: d.date,
    amount: d.amount,
    bills: d.bill_count,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{d.fullDate}</p>
        <p className="font-bold text-primary">{formatCurrency(d.amount)}</p>
        <p className="text-xs text-muted-foreground">{d.bills} bill{d.bills !== 1 ? 's' : ''}</p>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/salespeople')} data-testid="back-btn">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="heading text-2xl sm:text-3xl font-bold" data-testid="sp-name">{data.name}</h1>
            {data.branch_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1" data-testid="sp-branch">
                <Building size={13} /> {data.branch_name}
              </p>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border" data-testid="total-sales-card">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Sales</p>
              <p className="mono text-xl font-bold text-primary mt-1">{formatCurrency(data.total_sales)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="total-bills-card">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Bills</p>
              <p className="mono text-xl font-bold mt-1">{data.total_bills}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="avg-daily-card">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Avg. Daily Sale</p>
              <p className="mono text-xl font-bold text-[hsl(196,70%,52%)] mt-1">{formatCurrency(avgDaily)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="trend-card">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Performance Trend</p>
              <div className="flex items-center gap-2 mt-1">
                {trendDirection === 'up' ? (
                  <TrendingUp size={20} className="text-[hsl(160,52%,46%)]" />
                ) : trendDirection === 'down' ? (
                  <TrendingDown size={20} className="text-[hsl(0,72%,60%)]" />
                ) : (
                  <TrendingUp size={20} className="text-muted-foreground" />
                )}
                <span className={`mono text-xl font-bold ${
                  trendDirection === 'up' ? 'text-[hsl(160,52%,46%)]' : 
                  trendDirection === 'down' ? 'text-[hsl(0,72%,60%)]' : 'text-muted-foreground'
                }`}>
                  {trendPercent > 0 ? '+' : ''}{trendPercent}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Trend Chart */}
        {chartData.length > 0 && (
          <Card className="bg-card border-border" data-testid="sales-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" /> Daily Sales Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="amount" stroke={GOLD} fill="url(#salesGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bills per Day Bar Chart */}
        {chartData.length > 0 && (
          <Card className="bg-card border-border" data-testid="bills-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} className="text-[hsl(196,70%,52%)]" /> Bills Per Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="bills" fill={TEAL} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Day-wise Sales Table */}
        <Card className="bg-card border-border" data-testid="daily-sales-table">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar size={16} /> Day-wise Sales Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailySales.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No sales data available</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Bills</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...dailySales].reverse().map((d, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="mono text-sm">{d.date}</TableCell>
                        <TableCell className="mono text-sm text-right">{d.bill_count}</TableCell>
                        <TableCell className="mono text-sm text-right font-medium text-primary">{formatCurrency(d.amount)}</TableCell>
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
