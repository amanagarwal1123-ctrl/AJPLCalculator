import { Fragment } from 'react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v || 0);
const num = (v) => Number(v || 0);

/**
 * Transparent, step-by-step calculation breakdown for a bill item.
 * Mirrors backend calc_engine.py logic so sales can audit every number.
 */
export default function ItemBreakdown({ item }) {
  const isDiamond = item.item_type === 'diamond';
  const isMrp = item.item_type === 'mrp';
  const gross = num(item.gross_weight);
  const origLess = isDiamond ? num(item.original_less ?? item.less) : num(item.less);
  const studdedLessG = num(item.studded_less_grams);
  const adjustedLess = isDiamond ? origLess + studdedLessG : origLess;
  const net = num(item.net_weight);
  const rate = num(item.rate_per_10g);
  const purity = num(item.purity_percent || 100);
  const rate24kt = purity > 0 ? rate / (purity / 100) : 0;
  // For diamond, making is on gross; for gold, making is on net.
  const makingWeight = isDiamond ? gross : net;

  const Row = ({ label, formula, value, highlight, indent = 0, note }) => (
    <div className={`flex items-start justify-between gap-3 py-1 text-xs ${highlight ? 'font-semibold' : ''}`} style={{ paddingLeft: indent * 14 }} data-testid={`breakdown-row-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="flex-1 min-w-0">
        <div className={highlight ? 'text-primary' : 'text-muted-foreground'}>{label}</div>
        {formula && <div className="text-[10px] mono text-muted-foreground/70 mt-0.5 break-all">{formula}</div>}
        {note && <div className="text-[10px] text-muted-foreground/60 italic">{note}</div>}
      </div>
      <div className={`mono text-right whitespace-nowrap ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</div>
    </div>
  );

  const Divider = () => <div className="h-px bg-border my-1.5" />;

  if (isMrp) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-[hsl(224,50%,10%)]/60 border border-border/60" data-testid="item-breakdown-mrp">
        <Row label="Gross Weight" value={`${gross.toFixed(3)} g`} />
        {num(item.total_studded_carats) > 0 && (
          <>
            <Row label="Studded (carats)" formula={`1 ct = 0.2 g`} value={`${num(item.total_studded_carats).toFixed(2)} ct`} indent={1} />
            <Row label="Studded deduction (g)" formula={`${num(item.total_studded_carats).toFixed(2)} × 0.2`} value={`−${num(item.total_studded_weight).toFixed(3)} g`} indent={1} />
          </>
        )}
        <Row label="Net Weight" formula={`gross − studded (g)`} value={`${net.toFixed(3)} g`} highlight />
        <Divider />
        <Row label="MRP" value={fmt(item.mrp)} />
        {(item.discounts || []).map((d, i) => (
          <Row key={i} label={`Discount ${i + 1}`} formula={d.type === 'percentage' ? `${d.value}% of MRP` : 'Flat off'} value={`−${fmt(d.type === 'percentage' ? num(item.mrp) * num(d.value) / 100 : num(d.value))}`} indent={1} />
        ))}
        {num(item.total_discount) > 0 && <Row label="Total Discount" value={`−${fmt(item.total_discount)}`} />}
        <Row label="After Discount" formula={`MRP − discount`} value={fmt(item.after_discount)} />
        <Divider />
        <Row label="Amount (excl. GST)" formula={`after_discount ÷ 1.03`} value={fmt(item.amount_without_gst)} />
        <Row label="GST (3%)" value={fmt(item.gst_amount)} note="Included in bill GST, not in item total" />
        <Divider />
        <Row label="Item Total (excl. GST)" value={fmt(item.total_amount)} highlight />
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-[hsl(224,50%,10%)]/60 border border-border/60 space-y-0.5" data-testid="item-breakdown">
      {/* Weight section */}
      <Row label="Gross Weight" value={`${gross.toFixed(3)} g`} />
      <Row label="Less (entered)" value={`−${origLess.toFixed(3)} g`} indent={1} />
      {isDiamond && studdedLessG > 0 && (
        <>
          {(item.studded_charges || []).filter(sc => sc.less_type === 'L' && num(sc.carats) > 0).map((sc, i) => (
            <Row
              key={`lss-${i}`}
              label={`Diamond less — ${sc.type?.replace('_', ' ') || 'studded'}`}
              formula={`${num(sc.carats).toFixed(2)} ct × 0.2 g/ct`}
              value={`−${num(sc.weight_grams || num(sc.carats) * 0.2).toFixed(3)} g`}
              indent={2}
            />
          ))}
          <Row label="Total deducted (less + diamond)" formula={`${origLess.toFixed(3)} + ${studdedLessG.toFixed(3)}`} value={`−${adjustedLess.toFixed(3)} g`} indent={1} />
        </>
      )}
      <Row label="Net Weight" formula={`gross − ${isDiamond ? 'adjusted less' : 'less'}`} value={`${net.toFixed(3)} g`} highlight />

      <Divider />

      {/* Gold value */}
      <Row label={`Rate / 10g (${item.purity_name || ''})`} value={fmt(rate)} />
      {isDiamond && purity > 0 && purity !== 100 && (
        <Row label="24KT rate / 10g (extrapolated)" formula={`${fmt(rate)} ÷ ${(purity / 100).toFixed(2)}`} value={fmt(rate24kt)} indent={1} note="used only for % making" />
      )}
      <Row label="Gold Value" formula={`net (${net.toFixed(3)}) × rate ÷ 10`} value={fmt(item.gold_value)} highlight />

      <Divider />

      {/* Making charges */}
      {(item.making_charges || []).length > 0 && (
        <>
          {(item.making_charges || []).map((mc, i) => {
            const val = num(mc.value);
            let formula = '';
            if (mc.type === 'percentage') {
              const perGram = mc.making_per_gram != null ? num(mc.making_per_gram) : (val / 100) * (rate24kt / 10);
              formula = `${val}% of 24KT/g (= ${fmt(perGram)}/g) × ${makingWeight.toFixed(3)} g ${isDiamond ? '(gross)' : '(net)'}`;
            } else if (mc.type === 'per_gram') {
              formula = `${fmt(val)}/g × ${makingWeight.toFixed(3)} g ${isDiamond ? '(gross)' : '(net)'}`;
            } else {
              formula = `${fmt(val)} × ${num(mc.quantity || 1)} pc`;
            }
            return <Row key={`mc-${i}`} label={`Making ${i + 1} (${mc.type?.replace('_', ' ')})`} formula={formula} value={fmt(mc.calculated_amount ?? 0)} indent={1} />;
          })}
          <Row label="Total Making" value={fmt(item.total_making)} highlight />
          <Divider />
        </>
      )}

      {/* Stone charges */}
      {(item.stone_charges || []).length > 0 && (
        <>
          {(item.stone_charges || []).map((sc, i) => {
            const val = num(sc.value);
            let formula = '';
            if (sc.type === 'kundan') formula = `${fmt(val)} × ${num(sc.quantity || 1)} pc`;
            else if (sc.type === 'stone') formula = `${fmt(val)}/g × ${origLess.toFixed(3)} g (less)`;
            else formula = `flat`;
            return <Row key={`sc-${i}`} label={`Stone ${i + 1} (${sc.type})`} formula={formula} value={fmt(sc.calculated_amount ?? 0)} indent={1} />;
          })}
          <Row label="Total Stone" value={fmt(item.total_stone)} highlight />
          <Divider />
        </>
      )}

      {/* Studded diamonds */}
      {isDiamond && (item.studded_charges || []).length > 0 && (
        <>
          {(item.studded_charges || []).map((sc, i) => (
            <Row
              key={`st-${i}`}
              label={`Diamond ${i + 1} (${sc.type?.replace('_', ' ')})${sc.less_type === 'L' ? ' · L' : ''}`}
              formula={`${num(sc.carats).toFixed(2)} ct × ${fmt(sc.rate_per_carat)}/ct`}
              value={fmt(sc.calculated_amount ?? 0)}
              indent={1}
            />
          ))}
          <Row label="Total Diamond (Studded)" value={fmt(item.total_studded)} highlight />
          <Divider />
        </>
      )}

      <Row
        label="Item Total"
        formula={`gold${item.total_making ? ' + making' : ''}${item.total_stone ? ' + stone' : ''}${isDiamond && item.total_studded ? ' + diamond' : ''}`}
        value={fmt(item.total_amount)}
        highlight
      />
    </div>
  );
}
