import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ArrowLeft, Eye, Package, TrendingUp, Scale } from 'lucide-react';
import { toast } from 'sonner';

export default function ItemHistoryPage() {
  const { itemName } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [itemName]);

  const loadData = async () => {
    try {
      const res = await apiClient.get(`/item-names/${encodeURIComponent(itemName)}/sales`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load item history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  if (loading) return <AppLayout><p className="text-center py-12 text-muted-foreground">Loading...</p></AppLayout>;
  if (!data) return <AppLayout><p className="text-center py-12 text-muted-foreground">Item not found</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/items')} data-testid="back-to-items">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="heading text-3xl font-bold" data-testid="item-name-title">{data.item_name}</h1>
            <p className="text-muted-foreground mt-1">Complete Sales History</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package size={14} className="text-primary" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Sold</p>
              </div>
              <p className="mono text-2xl font-bold text-primary" data-testid="item-total-sold">{data.total_sold}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Scale size={14} className="text-[hsl(196,70%,52%)]" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Weight</p>
              </div>
              <p className="mono text-2xl font-bold text-[hsl(196,70%,52%)]" data-testid="item-total-weight">{data.total_weight.toFixed(3)}g</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-[hsl(160,52%,46%)]" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Revenue</p>
              </div>
              <p className="mono text-xl font-bold text-[hsl(160,52%,46%)]" data-testid="item-total-revenue">{formatCurrency(data.total_revenue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales Records ({data.sales.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.sales.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No sales recorded for this item</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Type</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">KT</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Gross(g)</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Net(g)</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Rate/10g</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Gold Val</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Making</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-center">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sales.map((sale, i) => (
                      <TableRow key={i} className="border-border" data-testid={`sale-row-${i}`}>
                        <TableCell className="mono text-sm">{sale.date}</TableCell>
                        <TableCell className="mono text-xs">{sale.bill_number}</TableCell>
                        <TableCell className="font-medium">{sale.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{sale.executive_name}</TableCell>
                        <TableCell>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            sale.item_type === 'diamond' ? 'bg-[hsl(196,70%,52%)]/20 text-[hsl(196,70%,52%)]' : 'bg-primary/20 text-primary'
                          }`}>{sale.item_type}</span>
                        </TableCell>
                        <TableCell className="text-primary font-medium">{sale.purity_name}</TableCell>
                        <TableCell className="mono text-right">{sale.gross_weight.toFixed(3)}</TableCell>
                        <TableCell className="mono text-right font-medium">{sale.net_weight.toFixed(3)}</TableCell>
                        <TableCell className="mono text-right">{formatCurrency(sale.rate_per_10g)}</TableCell>
                        <TableCell className="mono text-right">{formatCurrency(sale.gold_value)}</TableCell>
                        <TableCell className="mono text-right">{formatCurrency(sale.total_making)}</TableCell>
                        <TableCell className="mono text-right font-bold text-primary">{formatCurrency(sale.total_amount)}</TableCell>
                        <TableCell>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${sale.status === 'approved' ? 'bg-[hsl(160,52%,46%)]/20 text-[hsl(160,52%,46%)]' : 'bg-muted text-muted-foreground'}`}>{sale.status}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bill/${sale.bill_id}`)} data-testid={`view-sale-bill-${i}`}>
                            <Eye size={13} />
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
