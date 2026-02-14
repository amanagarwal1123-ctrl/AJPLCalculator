import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
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
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  const fmt = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  if (!bill) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading...</p></div>;

  return (
    <div>
      {/* Action bar - no print */}
      <div className="no-print bg-card border-b border-border p-3 sm:p-4 flex items-center justify-between sticky top-0 z-50">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${billId}`)} data-testid="back-from-print"><ArrowLeft size={18} className="mr-1" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint} data-testid="print-action-button"><Printer size={14} className="mr-1" /> Print</Button>
          <Button size="sm" onClick={downloadPdf} data-testid="pdf-download-button"><Download size={14} className="mr-1" /> PDF</Button>
        </div>
      </div>

      {/* Print Sheet */}
      <div className="print-sheet" style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '16px',
        background: '#faf8f0',
        color: '#1a1a3e',
        fontFamily: "'Manrope', sans-serif",
        fontSize: '14px',
        lineHeight: 1.5,
      }}>
        {/* Gold border wrapper */}
        <div style={{
          border: '2px solid #C5A55A',
          padding: '20px',
          position: 'relative',
        }}>
          {/* Inner border */}
          <div style={{
            position: 'absolute',
            inset: '4px',
            border: '1px solid #C5A55A',
            pointerEvents: 'none',
            opacity: 0.4,
          }} />

          {/* ===== HEADER ===== */}
          <div style={{ textAlign: 'center', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            <img
              src="/ajpl-logo.png"
              alt="AJPL"
              style={{ height: '60px', margin: '0 auto 8px', display: 'block', objectFit: 'contain' }}
            />
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '11px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#8B6914',
              marginBottom: '8px',
            }}>INVOICE</div>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent 10%, #C5A55A 50%, transparent 90%)', margin: '0 auto 10px', maxWidth: '250px' }} />
            <div style={{ fontSize: '12px', color: '#666' }}>
              <span style={{ fontWeight: 600 }}>{bill.bill_number}</span>
              <span style={{ margin: '0 8px' }}>|</span>
              <span>{bill.created_at?.slice(0, 10)}</span>
            </div>
          </div>

          {/* ===== CUSTOMER ===== */}
          <div style={{
            background: '#f0ebe0',
            borderRadius: '6px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8B6914',
              marginBottom: '8px',
              borderBottom: '1px solid #d4c9a8',
              paddingBottom: '4px',
            }}>Customer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '12px' }}>
              <div><span style={{ color: '#888' }}>Name:</span> <strong>{bill.customer_name}</strong></div>
              <div><span style={{ color: '#888' }}>Phone:</span> <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{bill.customer_phone}</strong></div>
              {bill.customer_location && <div><span style={{ color: '#888' }}>Location:</span> {bill.customer_location}</div>}
              {bill.customer_reference && <div><span style={{ color: '#888' }}>Ref:</span> {bill.customer_reference}</div>}
              <div><span style={{ color: '#888' }}>Executive:</span> {bill.executive_name}</div>
              <div><span style={{ color: '#888' }}>Status:</span> <strong>{(bill.status || 'draft').toUpperCase()}</strong></div>
            </div>
          </div>

          {/* ===== ITEMS ===== */}
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8B6914',
            marginBottom: '10px',
          }}>Items ({bill.items?.length || 0})</div>

          {bill.items?.map((item, idx) => (
            <div key={idx} style={{
              border: '1px solid #e0d6c4',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '10px',
              background: idx % 2 === 0 ? '#faf8f3' : '#f5f0e8',
              pageBreakInside: 'avoid',
            }}>
              {/* Item header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#999', marginRight: '6px' }}>#{idx + 1}</span>
                  <strong style={{ fontSize: '14px' }}>{item.item_name}</strong>
                  <span style={{
                    display: 'inline-block',
                    marginLeft: '8px',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: item.item_type === 'diamond' ? '#e3f0ff' : '#fff3d4',
                    color: item.item_type === 'diamond' ? '#2563eb' : '#8B6914',
                  }}>{item.item_type === 'diamond' ? 'Diamond' : 'Gold'}</span>
                </div>
                <span style={{
                  fontWeight: 700,
                  fontSize: '10px',
                  color: '#8B6914',
                  padding: '1px 6px',
                  border: '1px solid #C5A55A',
                  borderRadius: '3px',
                }}>{item.purity_name}</span>
              </div>

              {/* Weight row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '4px',
                padding: '6px 8px',
                background: '#fff',
                borderRadius: '4px',
                border: '1px solid #ece5d5',
                marginBottom: '8px',
                fontSize: '11px',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#999', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{(item.gross_weight || 0).toFixed(3)}g</div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid #ece5d5', borderRight: '1px solid #ece5d5' }}>
                  <div style={{ color: '#999', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Less</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#c0392b' }}>{(item.less || 0).toFixed(3)}g</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#999', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Wt</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#1a1a3e' }}>
                    {(item.net_weight || 0).toFixed(3)}g
                    {item.studded_less_grams > 0 && <span style={{ fontSize: '9px', color: '#8B6914', marginLeft: '2px' }}>(-{item.studded_less_grams}g dia)</span>}
                  </div>
                </div>
              </div>

              {/* Value breakdown */}
              <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Rate / 10g</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.rate_per_10g)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Gold Value</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.gold_value)}</span>
                </div>
                {item.total_making > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>Making Charges *</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_making)}</span>
                  </div>
                )}
                {item.total_stone > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>Stone Charges</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_stone)}</span>
                  </div>
                )}
                {item.total_studded > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>Studded Charges</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.total_studded)}</span>
                  </div>
                )}
                {/* Item Total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #d4c9a8',
                  marginTop: '4px',
                  paddingTop: '4px',
                  fontWeight: 700,
                  fontSize: '13px',
                }}>
                  <span>Item Total</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#1a1a3e' }}>{fmt(item.total_amount)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Making charge note */}
          <div style={{ fontSize: '9px', color: '#999', fontStyle: 'italic', marginBottom: '16px' }}>
            * Making charges calculated on net weight
            {bill.items?.some(i => i.studded_less_grams > 0) && (
              <span> | Diamond weight deductions: 1 carat = 0.2g</span>
            )}
          </div>

          {/* ===== TOTALS ===== */}
          <div style={{
            borderTop: '2px solid #C5A55A',
            paddingTop: '12px',
          }}>
            <div style={{ maxWidth: '320px', marginLeft: 'auto', fontSize: '12px', lineHeight: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Items Total</span>
                <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.items_total)}</strong>
              </div>

              {(bill.external_charges || []).map((ec, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                  <span>{ec.name}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(ec.amount)}</span>
                </div>
              ))}

              {bill.external_charges_total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>External Charges</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.external_charges_total)}</span>
                </div>
              )}

              <div style={{ height: '1px', background: '#C5A55A', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '13px' }}>
                <span>Subtotal (excl. GST)</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.subtotal_without_gst)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                <span>GST ({bill.gst_percent || 3}%)</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(bill.gst_amount)}</span>
              </div>

              <div style={{ height: '2px', background: '#C5A55A', margin: '6px 0' }} />

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '16px',
                padding: '4px 0',
              }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.05em' }}>GRAND TOTAL</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#8B6914' }}>{fmt(bill.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            borderTop: '1px solid #e0d6c4',
            paddingTop: '10px',
          }}>
            <p style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              color: '#999',
              fontSize: '12px',
            }}>Thank you for your valuable patronage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
