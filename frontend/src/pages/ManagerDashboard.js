import { useState, useEffect } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const approveBill = async (billId) => {
    try {
      await apiClient.put(`/bills/${billId}/approve`);
      toast.success('Bill approved!');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const viewCustomer = (phone) => {
    navigate(`/customer/${phone}`);
  };

  const viewSummary = async (billId) => {
    try {
      const res = await apiClient.get(`/bills/${billId}/summary`);
      setSummaryData(res.data);
      setSummaryOpen(true);
    } catch (err) {
      toast.error('Failed to load summary');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const sentBills = bills.filter(b => b.status === 'sent');
  const editedBills = bills.filter(b => b.status === 'edited');
  const approvedBills = bills.filter(b => b.status === 'approved');
  const draftBills = bills.filter(b => b.status === 'draft');
  const pendingBills = [...sentBills, ...editedBills];

  const statusBadge = (status) => {
    const styles = {
      draft: 'bg-yellow-500/20 text-yellow-400',
      sent: 'bg-blue-500/20 text-blue-400',
      edited: 'bg-orange-500/20 text-orange-400',
      approved: 'bg-green-500/20 text-green-400',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>{status}</span>;
  };

  // Mobile Bill Card Component
  const BillCard = ({ bill: b, showApprove = false }) => (
    <div className="p-3 rounded-lg bg-secondary/20 border border-border" data-testid={`manager-bill-card-${b.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate text-primary cursor-pointer hover:underline" onClick={() => viewCustomer(b.customer_phone)}>{b.customer_name}</p>
          <p className="text-[10px] text-muted-foreground mono mt-0.5">{b.bill_number}</p>
          <p className="text-xs text-muted-foreground mt-0.5">by {b.executive_name}{b.salesperson_name ? ` / ${b.salesperson_name}` : ''}</p>
        </div>
        <div className="text-right shrink-0">
          {statusBadge(b.status)}
          <p className="mono text-sm font-bold text-primary mt-1">{formatCurrency(b.grand_total)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <span>{b.items?.length || 0} items</span>
        <span>&middot;</span>
        <span>{b.created_at?.slice(0, 10)}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" className="flex-1 h-10" onClick={() => viewSummary(b.id)} data-testid={`manager-summary-${b.id}`}>
          <ClipboardList size={14} className="mr-1" /> Summary
        </Button>
        <Button variant="secondary" size="sm" className="flex-1 h-10" onClick={() => navigate(`/bill/${b.id}`)} data-testid={`manager-view-${b.id}`}>
          <Eye size={14} className="mr-1" /> View
        </Button>
        {showApprove && b.status !== 'approved' && (
          <Button size="sm" className="h-10 bg-[hsl(160,52%,46%)] hover:bg-[hsl(160,52%,40%)] text-white" onClick={() => approveBill(b.id)} data-testid={`manager-approve-${b.id}`}>
            <CheckCircle size={14} className="mr-1" /> Approve
          </Button>
        )}
      </div>
    </div>
  );

  // Desktop Table Component
  const BillTable = ({ billList, showApprove = false }) => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Items</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
            <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {billList.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bills found</TableCell></TableRow>
          ) : billList.map(b => (
            <TableRow key={b.id} className="border-border hover:bg-secondary/50">
              <TableCell className="mono text-sm">{b.bill_number}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm cursor-pointer text-primary hover:underline" onClick={() => viewCustomer(b.customer_phone)}>{b.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{b.customer_phone}</p>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{b.executive_name}{b.salesperson_name ? ` / ${b.salesperson_name}` : ''}</TableCell>
              <TableCell>{statusBadge(b.status)}</TableCell>
              <TableCell className="mono text-sm">{b.items?.length || 0}</TableCell>
              <TableCell className="mono text-right font-medium text-primary">{formatCurrency(b.grand_total)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{b.created_at?.slice(0, 10)}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => viewSummary(b.id)} data-testid={`manager-summary-${b.id}`}>
                    <ClipboardList size={14} className="mr-1" /> Summary
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${b.id}`)} data-testid={`manager-view-${b.id}`}>
                    <Eye size={14} className="mr-1" /> View
                  </Button>
                  {showApprove && b.status !== 'approved' && (
                    <Button variant="ghost" size="sm" className="text-green-400" onClick={() => approveBill(b.id)} data-testid={`manager-approve-${b.id}`}>
                      <CheckCircle size={14} className="mr-1" /> Approve
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Mobile Card List Component
  const BillCardList = ({ billList, showApprove = false }) => (
    <div className="md:hidden space-y-3">
      {billList.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No bills found</p>
      ) : billList.map(b => (
        <BillCard key={b.id} bill={b} showApprove={showApprove} />
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="heading text-2xl sm:text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome, {user?.full_name}</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Today's Sales</p>
                  <p className="mono text-lg sm:text-2xl font-bold text-primary mt-1">{formatCurrency(analytics?.today_sales)}</p>
                </div>
                <DollarSign className="text-primary hidden sm:block" size={20} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Pending</p>
                  <p className="mono text-lg sm:text-2xl font-bold text-[hsl(38,85%,55%)] mt-1">{pendingBills.length}</p>
                </div>
                <Clock className="text-[hsl(38,85%,55%)] hidden sm:block" size={20} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Approved</p>
                  <p className="mono text-lg sm:text-2xl font-bold text-[hsl(160,52%,46%)] mt-1">{approvedBills.length}</p>
                </div>
                <CheckCircle className="text-[hsl(160,52%,46%)] hidden sm:block" size={20} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Total</p>
                  <p className="mono text-lg sm:text-2xl font-bold text-[hsl(196,70%,52%)] mt-1">{bills.length}</p>
                </div>
                <FileText className="text-[hsl(196,70%,52%)] hidden sm:block" size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bills by status */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary overflow-x-auto w-full justify-start sm:justify-center">
            <TabsTrigger value="pending" className="relative text-xs sm:text-sm" data-testid="tab-pending">
              Pending
              {pendingBills.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]">{pendingBills.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs sm:text-sm" data-testid="tab-approved">Approved</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs sm:text-sm" data-testid="tab-drafts">Drafts</TabsTrigger>
            <TabsTrigger value="all" className="text-xs sm:text-sm" data-testid="tab-all">All</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[hsl(38,85%,55%)]" />
                  <CardTitle className="heading text-lg sm:text-xl">Pending Review ({pendingBills.length})</CardTitle>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">Bills sent by executives awaiting your review</p>
              </CardHeader>
              <CardContent>
                <BillCardList billList={pendingBills} showApprove={true} />
                <BillTable billList={pendingBills} showApprove={true} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="heading text-lg sm:text-xl">Approved Bills ({approvedBills.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <BillCardList billList={approvedBills} />
                <BillTable billList={approvedBills} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="draft">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="heading text-lg sm:text-xl">Draft Bills ({draftBills.length})</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">Bills still being prepared by executives</p>
              </CardHeader>
              <CardContent>
                <BillCardList billList={draftBills} />
                <BillTable billList={draftBills} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="heading text-lg sm:text-xl">All Bills ({bills.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <BillCardList billList={bills} showApprove={true} />
                <BillTable billList={bills} showApprove={true} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Summary Dialog */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto mx-3 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="heading text-lg sm:text-xl">Visit Summary</DialogTitle>
              {summaryData && (
                <div className="text-xs sm:text-sm text-muted-foreground space-y-1 mt-2">
                  <p><strong>Customer:</strong> {summaryData.customer_name} ({summaryData.customer_phone})</p>
                  <p><strong>Date:</strong> {summaryData.date} | <strong>Exec:</strong> {summaryData.executive_name}</p>
                  <p><strong>Bill:</strong> {summaryData.bill_number}</p>
                </div>
              )}
            </DialogHeader>
            {summaryData && (
              <div className="space-y-3 sm:space-y-4 mt-2">
                {summaryData.items.map((item, idx) => (
                  <Card key={idx} className="bg-secondary/20 border-border">
                    <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className="heading text-base sm:text-lg font-bold">{item.item_name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs ${item.item_type === 'diamond' ? 'bg-[hsl(196,70%,52%)]/20 text-[hsl(196,70%,52%)]' : 'bg-primary/20 text-primary'}`}>{item.item_type}</span>
                        </div>
                        <span className="text-primary font-medium text-sm">{item.purity_name}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-sm">
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Gross Wt</p>
                          <p className="mono font-medium text-sm">{item.gross_weight.toFixed(3)}g</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Less</p>
                          <p className="mono font-medium text-sm">{item.less.toFixed(3)}g</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Net Wt</p>
                          <p className="mono font-bold text-primary text-sm">{item.net_weight.toFixed(3)}g</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Rate/10g</p>
                          <p className="mono font-medium text-sm">{formatCurrency(item.rate_per_10g)}</p>
                        </div>
                      </div>

                      {item.making_charges.length > 0 && (
                        <>
                          <Separator className="bg-border" />
                          <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-widest">Making Charges</p>
                            {item.making_charges.map((mc, mi) => (
                              <div key={mi} className="text-xs sm:text-sm flex items-center gap-2">
                                <span className="capitalize text-muted-foreground">{mc.type === 'percentage' ? '% of 24KT' : mc.type === 'per_gram' ? 'Per Gram' : 'Per Piece'}:</span>
                                <span className="mono font-medium">{mc.value}{mc.type === 'percentage' ? '%' : mc.type === 'per_gram' ? '/g' : ''}</span>
                                {mc.type === 'per_piece' && <span className="text-muted-foreground">x {mc.quantity} pcs</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {item.stone_charges.length > 0 && (
                        <>
                          <Separator className="bg-border" />
                          <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-widest">Stone Charges</p>
                            {item.stone_charges.map((sc, si) => (
                              <div key={si} className="text-xs sm:text-sm flex items-center gap-2">
                                <span className="capitalize text-muted-foreground">{sc.type}:</span>
                                <span className="mono font-medium">{sc.value}</span>
                                {sc.type === 'kundan' && <span className="text-muted-foreground">x {sc.quantity} pcs</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {item.studded_charges.length > 0 && (
                        <>
                          <Separator className="bg-border" />
                          <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-widest">Diamond / Studded</p>
                            {item.studded_charges.map((sc, si) => (
                              <div key={si} className="text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                                <span className="capitalize text-muted-foreground">{sc.type.replace('_', ' ')}:</span>
                                <span className="mono font-medium">{sc.carats} ct</span>
                                <span className="text-muted-foreground">@</span>
                                <span className="mono font-medium">{formatCurrency(sc.rate_per_carat)}/ct</span>
                                {sc.less_type === 'L' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">L</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
