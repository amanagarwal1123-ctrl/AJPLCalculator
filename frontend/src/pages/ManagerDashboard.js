import { useState, useEffect } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Eye, CheckCircle, FileText, DollarSign, Clock, AlertTriangle, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [summaryData, setSummaryData] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [billsRes, analyticsRes] = await Promise.all([
        apiClient.get('/bills'),
        apiClient.get('/analytics/dashboard'),
      ]);
      setBills(billsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const approveBill = async (billId) => {
    try {
      await apiClient.put(`/bills/${billId}/approve`);
      toast.success('Bill approved!');
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to approve'); }
  };

  const viewSummary = async (billId) => {
    try {
      const res = await apiClient.get(`/bills/${billId}/summary`);
      setSummaryData(res.data);
      setSummaryOpen(true);
    } catch (err) { toast.error('Failed to load summary'); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const sentBills = bills.filter(b => b.status === 'sent');
  const editedBills = bills.filter(b => b.status === 'edited');
  const approvedBills = bills.filter(b => b.status === 'approved');
  const draftBills = bills.filter(b => b.status === 'draft');
  const pendingBills = [...sentBills, ...editedBills];

  const statusBadge = (status) => {
    const styles = { draft: 'bg-yellow-500/20 text-yellow-400', sent: 'bg-blue-500/20 text-blue-400', edited: 'bg-orange-500/20 text-orange-400', approved: 'bg-green-500/20 text-green-400' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>{status}</span>;
  };

  const BillCard = ({ bill: b, showApprove = false }) => (
    <div className="p-3 rounded-lg bg-secondary/20 border border-border" data-testid={`manager-bill-card-${b.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate text-primary cursor-pointer hover:underline" onClick={() => navigate(`/customer/${b.customer_phone}`)}>{b.customer_name}</p>
          <p className="text-[10px] text-muted-foreground mono mt-0.5">{b.bill_number}</p>
          <p className="text-xs text-muted-foreground mt-0.5">by {b.executive_name}{b.salesperson_name ? ` / ${b.salesperson_name}` : ''}</p>
        </div>
        <div className="text-right shrink-0">
          {statusBadge(b.status)}
          <p className="mono text-sm font-bold text-primary mt-1">{formatCurrency(b.grand_total)}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" className="flex-1 h-10" onClick={() => viewSummary(b.id)} data-testid={`manager-summary-${b.id}`}><ClipboardList size={14} className="mr-1" /> Summary</Button>
        <Button variant="secondary" size="sm" className="flex-1 h-10" onClick={() => navigate(`/bill/${b.id}`)} data-testid={`manager-view-${b.id}`}><Eye size={14} className="mr-1" /> View</Button>
        {showApprove && b.status !== 'approved' && (
          <Button size="sm" className="h-10 bg-[hsl(160,52%,46%)] hover:bg-[hsl(160,52%,40%)] text-white" onClick={() => approveBill(b.id)} data-testid={`manager-approve-${b.id}`}><CheckCircle size={14} className="mr-1" /> Approve</Button>
        )}
      </div>
    </div>
  );

  const BillTable = ({ billList, showApprove = false }) => (
    <div className="hidden md:block overflow-x-auto">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[180px]">Bill #</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[150px]">Customer</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[120px]">Executive</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[80px]">Status</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[50px]">Items</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right w-[100px]">Total</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[90px]">Date</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-auto">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {billList.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bills found</TableCell></TableRow>
          ) : billList.map(b => (
            <TableRow key={b.id} className="border-border hover:bg-secondary/50">
              <TableCell className="mono text-xs truncate max-w-[180px]" title={b.bill_number}>{b.bill_number}</TableCell>
              <TableCell className="max-w-[150px]"><p className="font-medium text-sm cursor-pointer text-primary hover:underline truncate" onClick={() => navigate(`/customer/${b.customer_phone}`)}>{b.customer_name}</p><p className="text-xs text-muted-foreground truncate">{b.customer_phone}</p></TableCell>
              <TableCell className="text-muted-foreground text-sm truncate max-w-[120px]">{b.executive_name}</TableCell>
              <TableCell>{statusBadge(b.status)}</TableCell>
              <TableCell className="mono text-sm">{b.items?.length || 0}</TableCell>
              <TableCell className="mono text-right font-medium text-primary text-sm whitespace-nowrap">{formatCurrency(b.grand_total)}</TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{b.created_at?.slice(0, 10)}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-nowrap">
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => viewSummary(b.id)} data-testid={`manager-summary-${b.id}`}><ClipboardList size={14} className="mr-1" /> Summary</Button>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(`/bill/${b.id}`)} data-testid={`manager-view-${b.id}`}><Eye size={14} className="mr-1" /> View</Button>
                  {showApprove && b.status !== 'approved' && (
                    <Button variant="ghost" size="sm" className="text-green-400 shrink-0" onClick={() => approveBill(b.id)} data-testid={`manager-approve-${b.id}`}><CheckCircle size={14} className="mr-1" /> Approve</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const BillCardList = ({ billList, showApprove = false }) => (
    <div className="md:hidden space-y-3">
      {billList.length === 0 ? <p className="text-center py-8 text-muted-foreground">No bills found</p> : billList.map(b => <BillCard key={b.id} bill={b} showApprove={showApprove} />)}
    </div>
  );

  // Render item details in summary dialog
  const renderItemDetail = (item, idx) => {
    const isMrp = item.item_type === 'mrp';
    return (
      <Card key={idx} className="bg-secondary/20 border-border">
        <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-2">
              {item.tag_number && <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{item.tag_number}</span>}
              <span className="heading text-base sm:text-lg font-bold">{item.item_name}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs ${isMrp ? 'bg-purple-500/20 text-purple-400' : item.item_type === 'diamond' ? 'bg-[hsl(196,70%,52%)]/20 text-[hsl(196,70%,52%)]' : 'bg-primary/20 text-primary'}`}>{isMrp ? 'MRP' : item.item_type}</span>
            </div>
            {!isMrp && <span className="text-primary font-medium text-sm">{item.purity_name}</span>}
          </div>

          {isMrp ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Gross Wt</p><p className="mono font-medium">{(item.gross_weight || 0).toFixed(3)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Net Wt</p><p className="mono font-bold text-primary">{(item.net_weight || 0).toFixed(3)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">MRP</p><p className="mono font-medium">{formatCurrency(item.mrp)}</p></div>
              </div>
              {item.studded_weights?.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Studded Weights</p>
                    {item.studded_weights.map((sw, si) => <div key={si} className="text-xs flex gap-2"><span className="capitalize text-muted-foreground">{sw.type?.replace('_', ' ')}:</span><span className="mono font-medium">{sw.weight} ct ({(sw.weight * 0.2).toFixed(3)}g)</span></div>)}
                  </div>
                </>
              )}
              {item.discounts?.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Discounts</p>
                    {item.discounts.map((d, di) => <div key={di} className="text-xs flex gap-2"><span className="text-muted-foreground">{d.type === 'percentage' ? `${d.value}%` : 'Flat'}:</span><span className="mono font-medium text-destructive">-{formatCurrency(d.type === 'percentage' ? (item.mrp * d.value / 100) : d.value)}</span></div>)}
                  </div>
                </>
              )}
              <Separator className="bg-border" />
              <div className="text-sm space-y-1">
                {item.total_discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="mono text-destructive">-{formatCurrency(item.total_discount)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">After Discount</span><span className="mono">{formatCurrency(item.after_discount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Excl. GST</span><span className="mono text-primary">{formatCurrency(item.amount_without_gst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST (3%)</span><span className="mono">{formatCurrency(item.gst_amount_item)}</span></div>
                <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Item Total</span><span className="mono text-primary">{formatCurrency(item.total_amount)}</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Gross Wt</p><p className="mono font-medium">{(item.gross_weight || 0).toFixed(3)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Less</p><p className="mono font-medium">{(item.less || 0).toFixed(3)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Net Wt</p><p className="mono font-bold text-primary">{(item.net_weight || 0).toFixed(3)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Rate/10g</p><p className="mono font-medium">{formatCurrency(item.rate_per_10g)}</p></div>
              </div>

              <Separator className="bg-border" />
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Gold Value</span><span className="mono text-primary font-medium">{formatCurrency(item.gold_value)}</span></div>
              </div>

              {item.making_charges?.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Making Charges</p>
                    {item.making_charges.map((mc, mi) => (
                      <div key={mi} className="text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">{mc.type === 'percentage' ? '% Making' : mc.type === 'per_gram' ? 'Per Gram' : 'Per Piece'}:</span>
                        <span className="mono font-medium">{mc.value}{mc.type === 'percentage' ? '%' : mc.type === 'per_gram' ? '/g' : ''}</span>
                        {mc.type === 'percentage' && mc.making_per_gram && <sub className="text-primary text-[10px]">₹{Number(mc.making_per_gram).toFixed(0)}/g</sub>}
                        {mc.type === 'per_piece' && <span className="text-muted-foreground">x {mc.quantity} pcs</span>}
                      </div>
                    ))}
                    <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Total Making</span><span className="mono font-medium">{formatCurrency(item.total_making)}</span></div>
                  </div>
                </>
              )}

              {item.stone_charges?.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Stone Charges</p>
                    {item.stone_charges.map((sc, si) => <div key={si} className="text-xs flex items-center gap-2"><span className="capitalize text-muted-foreground">{sc.type}:</span><span className="mono font-medium">{sc.value}</span>{sc.type === 'kundan' && <span className="text-muted-foreground">x {sc.quantity} pcs</span>}</div>)}
                    <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Total Stone</span><span className="mono font-medium">{formatCurrency(item.total_stone)}</span></div>
                  </div>
                </>
              )}

              {item.studded_charges?.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Diamond / Studded</p>
                    {item.studded_charges.map((sc, si) => (
                      <div key={si} className="text-xs flex items-center gap-2 flex-wrap">
                        <span className="capitalize text-muted-foreground">{sc.type?.replace('_', ' ')}:</span>
                        <span className="mono font-medium">{sc.carats} ct</span><span className="text-muted-foreground">@</span><span className="mono font-medium">{formatCurrency(sc.rate_per_carat)}/ct</span>
                        {sc.less_type === 'L' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">L</span>}
                      </div>
                    ))}
                    <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Total Studded</span><span className="mono font-medium">{formatCurrency(item.total_studded)}</span></div>
                  </div>
                </>
              )}

              <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
                <span>Item Total</span><span className="mono text-primary">{formatCurrency(item.total_amount)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="heading text-2xl sm:text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome, {user?.full_name}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card border-border"><CardContent className="p-3 sm:p-5"><p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Today's Sales</p><p className="mono text-lg sm:text-2xl font-bold text-primary mt-1">{formatCurrency(analytics?.today_sales)}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-3 sm:p-5"><p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Pending</p><p className="mono text-lg sm:text-2xl font-bold text-[hsl(38,85%,55%)] mt-1">{pendingBills.length}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-3 sm:p-5"><p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Approved</p><p className="mono text-lg sm:text-2xl font-bold text-[hsl(160,52%,46%)] mt-1">{approvedBills.length}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-3 sm:p-5"><p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Total</p><p className="mono text-lg sm:text-2xl font-bold text-[hsl(196,70%,52%)] mt-1">{bills.length}</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary overflow-x-auto w-full justify-start sm:justify-center">
            <TabsTrigger value="pending" data-testid="tab-pending">Pending {pendingBills.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]">{pendingBills.length}</span>}</TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
            <TabsTrigger value="draft" data-testid="tab-drafts">Drafts</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          </TabsList>
          <TabsContent value="pending"><Card className="bg-card border-border"><CardHeader className="pb-3"><CardTitle className="heading text-lg sm:text-xl">Pending Review ({pendingBills.length})</CardTitle></CardHeader><CardContent><BillCardList billList={pendingBills} showApprove={true} /><BillTable billList={pendingBills} showApprove={true} /></CardContent></Card></TabsContent>
          <TabsContent value="approved"><Card className="bg-card border-border"><CardHeader className="pb-3"><CardTitle className="heading text-lg sm:text-xl">Approved Bills ({approvedBills.length})</CardTitle></CardHeader><CardContent><BillCardList billList={approvedBills} /><BillTable billList={approvedBills} /></CardContent></Card></TabsContent>
          <TabsContent value="draft"><Card className="bg-card border-border"><CardHeader className="pb-3"><CardTitle className="heading text-lg sm:text-xl">Draft Bills ({draftBills.length})</CardTitle></CardHeader><CardContent><BillCardList billList={draftBills} /><BillTable billList={draftBills} /></CardContent></Card></TabsContent>
          <TabsContent value="all"><Card className="bg-card border-border"><CardHeader className="pb-3"><CardTitle className="heading text-lg sm:text-xl">All Bills ({bills.length})</CardTitle></CardHeader><CardContent><BillCardList billList={bills} showApprove={true} /><BillTable billList={bills} showApprove={true} /></CardContent></Card></TabsContent>
        </Tabs>

        {/* Summary Dialog - FULL DETAILS */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto mx-3 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="heading text-lg sm:text-xl">Full Bill Details</DialogTitle>
              {summaryData && (
                <div className="text-xs sm:text-sm text-muted-foreground space-y-1 mt-2">
                  <p><strong>Customer:</strong> {summaryData.customer_name} ({summaryData.customer_phone})</p>
                  <p><strong>Date:</strong> {summaryData.date} | <strong>Exec:</strong> {summaryData.executive_name}{summaryData.salesperson_name ? ` | SP: ${summaryData.salesperson_name}` : ''}</p>
                  <p><strong>Bill:</strong> {summaryData.bill_number} | <strong>Status:</strong> {summaryData.status?.toUpperCase()}</p>
                </div>
              )}
            </DialogHeader>
            {summaryData && (
              <div className="space-y-3 sm:space-y-4 mt-2">
                {summaryData.items?.map((item, idx) => renderItemDetail(item, idx))}

                {/* Bill Totals */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 sm:p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items Total</span><span className="mono font-medium">{formatCurrency(summaryData.items_total)}</span></div>
                    {summaryData.external_charges?.map((ec, i) => (
                      <div key={i} className="flex justify-between text-sm"><span className="text-muted-foreground">{ec.name}</span><span className="mono">{formatCurrency(ec.amount)}</span></div>
                    ))}
                    {summaryData.external_charges_total > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ext. Charges Total</span><span className="mono">{formatCurrency(summaryData.external_charges_total)}</span></div>}
                    <Separator className="bg-border" />
                    <div className="flex justify-between text-sm font-medium"><span>Subtotal (excl. GST)</span><span className="mono">{formatCurrency(summaryData.subtotal_without_gst)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST ({summaryData.gst_percent || 3}%)</span><span className="mono">{formatCurrency(summaryData.gst_amount)}</span></div>
                    <Separator className="bg-primary/30" />
                    <div className="flex justify-between text-lg font-bold"><span className="heading">Grand Total</span><span className="mono text-primary">{formatCurrency(summaryData.grand_total)}</span></div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
