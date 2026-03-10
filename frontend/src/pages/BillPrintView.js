import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download, Home } from 'lucide-react';
import { toast } from 'sonner';

export default function BillPrintView() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);

  useEffect(() => {
    apiClient.get(`/bills/${billId}`).then(res => setBill(res.data)).catch(() => toast.error('Failed to load bill'));
  }, [billId]);

  const handlePrint = () => window.print();

  const downloadPdf = async () => {
    try {
      const res = await apiClient.get(`/bills/${billId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${bill?.bill_number || 'bill'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { toast.error('Failed to generate PDF'); }
  };

  const fmt = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  if (!bill) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading...</p></div>;

  return (
    <div>
      <div className="no-print bg-card border-b border-border p-3 sm:p-4 flex items-center justify-between sticky top-0 z-50">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${billId}`)} data-testid="back-from-print"><ArrowLeft size={18} className="mr-1" /> Back</Button>
        <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate('/')} data-testid="home-from-print"><Home size={18} className="mr-1" /> Home</Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint} data-testid="print-action-button"><Printer size={14} className="mr-1" /> Print</Button>
          <Button size="sm" onClick={downloadPdf} data-testid="pdf-download-button"><Download size={14} className="mr-1" /> PDF</Button>
        </div>
      </div>

      <div className="print-sheet" style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', background: '#fff', color: '#000', fontFamily: "'Manrope', sans-serif", fontSize: '14px', lineHeight: 1.5 }}>
        <div style={{ border: '2px solid #000', padding: '20px', position: 'relative' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            <img src="/ajpl-logo.png" alt="AJPL" style={{ height: '60px', margin: '0 auto 8px', display: 'block', objectFit: 'contain', filter: 'grayscale(100%) contrast(1.5)' }} />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '13px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#000', fontWeight: 700, marginBottom: '8px' }}>TENTATIVE INVOICE</div>
            <div style={{ height: '1px', background: '#000', margin: '0 auto 10px', maxWidth: '250px' }} />
            <div style={{ fontSize: '12px', color: '#333' }}>
              <span style={{ fontWeight: 600 }}>{bill.bill_number}</span><span style={{ margin: '0 8px' }}>|</span><span>{bill.created_at?.slice(0, 10)}</span>
            </div>
          </div>

          {/* Customer */}
          <div style={{ border: '1px solid #000', borderRadius: '4px', padding: '12px 14px', marginBottom: '16px' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#000', marginBottom: '8px', borderBottom: '1px solid #000', paddingBottom: '4px' }}>Customer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '12px' }}>
              <div><span style={{ color: '#555' }}>Name:</span> <strong>{bill.customer_name}</strong></div>
              <div><span style={{ color: '#555' }}>Phone:</span> <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{bill.customer_phone}</strong></div>
              {bill.customer_location && <div><span style={{ color: '#555' }}>Location:</span> {bill.customer_location}</div>}
              {bill.customer_reference && <div><span style={{ color: '#555' }}>Ref:</span> {bill.customer_reference}</div>}
              <div><span style={{ color: '#555' }}>Executive:</span> {bill.executive_name}</div>
              <div><span style={{ color: '#555' }}>Status:</span> <strong>{(bill.status || 'draft').toUpperCase()}</strong></div>
            </div>
          </div>

          {/* Items */}
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#000', marginBottom: '10px' }}>Items ({bill.items?.length || 0})</div>

          {bill.items?.map((item, idx) => {
            const isMrp = item.item_type === 'mrp';
            return (
              <div key={idx} style={{ border: '1px solid #333', borderRadius: '4px', padding: '12px', marginBottom: '10px', background: '#fff', pageBreakInside: 'avoid' }}>
                {/* Item header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#555', marginRight: '6px' }}>#{idx + 1}</span>
                    {item.tag_number && <span style={{ fontSize: '10px', color: '#333', marginRight: '6px', padding: '1px 4px', border: '1px solid #999', borderRadius: '2px' }}>{item.tag_number}</span>}
                    <strong style={{ fontSize: '14px' }}>{item.item_name}</strong>
                    <span style={{ display: 'inline-block', marginLeft: '8px', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #555', color: '#000' }}>
                      {isMrp ? 'MRP' : item.item_type === 'diamond' ? 'Diamond' : 'Gold'}
                    </span>
                  </div>
                  {!isMrp && <span style={{ fontWeight: 700, fontSize: '10px', color: '#000', padding: '1px 6px', border: '1px solid #000', borderRadius: '3px' }}>{item.purity_name}</span>}
                </div>

                {/* Weight row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMrp ? '1fr 1fr' : '1fr 1fr 1fr', gap: '4px', padding: '6px 8px', border: '1px solid #555', borderRadius: '4px', marginBottom: '8px', fontSize: '11px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{(item.gross_weight || 0).toFixed(3)}g</div>
                  </div>
                  {!isMrp && (
                    <div style={{ textAlign: 'center', borderLeft: '1px solid #555', borderRight: '1px solid #555' }}>
                      <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Less</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{(item.less || 0).toFixed(3)}g</div>
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Wt</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{(item.net_weight || 0).toFixed(3)}g</div>
                  </div>
                </div>

                {/* Value breakdown */}
                <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
                  {isMrp ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>MRP</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.mrp)}</span>
                      </div>
                      {item.total_discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#555' }}>Discount</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>-{fmt(item.total_discount)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>After Discount (incl. GST)</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.after_discount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>Amount (excl. GST)</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.amount_without_gst)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>GST (3%)</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.gst_amount)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>Rate / 10g</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.rate_per_10g)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>Gold Value</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.gold_value)}</span>
                      </div>
                      {item.making_charges?.length > 0 && item.making_charges.map((mc, mi) => {
                        let mpgDisplay = '';
                        if (mc.type === 'percentage') {
                          let mpg = mc.making_per_gram;
                          if (!mpg && item.purity_percent && item.rate_per_10g) {
                            const rate24kt = item.rate_per_10g / (item.purity_percent / 100);
                            mpg = (mc.value / 100) * (rate24kt / 10);
                          }
                          mpgDisplay = mpg ? `Rs.${Number(mpg).toFixed(0)}/g` : `${mc.value}%`;
                        } else if (mc.type === 'per_gram') {
                          mpgDisplay = `Rs.${mc.value}/g`;
                        } else {
                          mpgDisplay = `Rs.${mc.value} x${mc.quantity}pc`;
                        }
                        return (
                          <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                            <span style={{ color: '#555' }}>Making ({mpgDisplay})</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}></span>
                          </div>
                        );
                      })}
                      {item.total_making > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#555' }}>Making Charges Total</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_making)}</span>
                        </div>
                      )}
                      {item.total_stone > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#555' }}>Stone Charges</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_stone)}</span>
                        </div>
                      )}
                      {item.total_studded > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#555' }}>Studded Charges</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_studded)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {/* Item Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px', fontWeight: 700, fontSize: '13px' }}>
                    <span>Item Total</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_amount)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginBottom: '16px' }}>
            * Making charges calculated on net weight
            {bill.items?.some(i => i.studded_less_grams > 0) && <span> | Diamond weight deductions: 1 carat = 0.2g</span>}
          </div>

          {/* Totals */}
          <div style={{ borderTop: '2px solid #000', paddingTop: '12px' }}>
            <div style={{ maxWidth: '320px', marginLeft: 'auto', fontSize: '12px', lineHeight: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Items Total</span>
                <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.items_total)}</strong>
              </div>
              {(bill.external_charges || []).map((ec, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#333' }}>
                  <span>{ec.name}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(ec.amount)}</span>
                </div>
              ))}
              {bill.external_charges_total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>External Charges</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.external_charges_total)}</span>
                </div>
              )}
              <div style={{ height: '1px', background: '#000', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '13px' }}>
                <span>Subtotal (excl. GST)</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.subtotal_without_gst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#333' }}>
                <span>GST ({bill.gst_percent || 3}%)</span><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.gst_amount)}</span>
              </div>
              <div style={{ height: '2px', background: '#000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px', padding: '4px 0' }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.05em' }}>GRAND TOTAL</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#000' }}>{fmt(bill.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#555', fontSize: '12px' }}>Thank you for your valuable patronage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
