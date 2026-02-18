"""
Gold Jewellery Sales Calculation Engine
Handles all complex calculations for gold and diamond items.
"""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import List, Optional, Dict, Any


def to_decimal(value) -> Decimal:
    """Safely convert any value to Decimal."""
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal('0')


def round_currency(value: Decimal) -> Decimal:
    """Round to 2 decimal places (paise precision)."""
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_net_weight(gross_weight: float, less: float) -> float:
    """Calculate net weight = gross weight - less."""
    gw = to_decimal(gross_weight)
    ls = to_decimal(less)
    result = gw - ls
    return float(result.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP))


def extrapolate_24kt_rate(rate: float, purity_percent: float) -> float:
    """
    Extrapolate the 24KT rate from any KT rate.
    E.g., 22KT rate / 0.92 = 24KT rate
    """
    r = to_decimal(rate)
    p = to_decimal(purity_percent) / Decimal('100')
    if p == 0:
        return 0.0
    result = r / p
    return float(round_currency(result))


def calculate_making_charge(making_entry: Dict[str, Any], net_weight: float, rate_per_10g: float, purity_percent: float) -> float:
    """
    Calculate a single making charge entry.
    
    making_entry contains:
      - type: 'percentage' | 'per_gram' | 'per_piece'
      - value: the percentage/rate/labour value
      - quantity: (for per_piece only) number of pieces
    
    For percentage type:
      First extrapolate 24KT rate from the given rate & purity
      Then making_per_gram = (percentage / 100) * (24KT_rate / 10)
      Total making = making_per_gram * net_weight
    
    For per_gram type:
      Total making = value * net_weight
    
    For per_piece type:
      Total making = value * quantity
    """
    m_type = making_entry.get('type', '')
    value = to_decimal(making_entry.get('value', 0))
    quantity = to_decimal(making_entry.get('quantity', 1))
    nw = to_decimal(net_weight)
    rate = to_decimal(rate_per_10g)
    purity = to_decimal(purity_percent)
    
    if m_type == 'percentage':
        # Extrapolate 24KT rate: rate_per_10g is for the selected KT
        # 24KT rate per 10g = rate_per_10g / (purity/100)
        if purity == 0:
            return 0.0
        rate_24kt_per_10g = rate / (purity / Decimal('100'))
        rate_24kt_per_gram = rate_24kt_per_10g / Decimal('10')
        making_per_gram = (value / Decimal('100')) * rate_24kt_per_gram
        total = making_per_gram * nw
        return float(round_currency(total))
    
    elif m_type == 'per_gram':
        total = value * nw
        return float(round_currency(total))
    
    elif m_type == 'per_piece':
        total = value * quantity
        return float(round_currency(total))
    
    return 0.0


def calculate_stone_charge(stone_entry: Dict[str, Any], less_weight: float) -> float:
    """
    Calculate a single stone charge entry.
    
    stone_entry contains:
      - type: 'kundan' | 'stone' | 'moti'
      - value: per piece price / per gram price / total charge
      - quantity: (for kundan) number of pieces
    
    Kundan: quantity * value (per piece)
    Stone: value (per gram) * less_weight
    Moti: value (flat total)
    """
    s_type = stone_entry.get('type', '')
    value = to_decimal(stone_entry.get('value', 0))
    quantity = to_decimal(stone_entry.get('quantity', 1))
    lw = to_decimal(less_weight)
    
    if s_type == 'kundan':
        total = value * quantity
        return float(round_currency(total))
    
    elif s_type == 'stone':
        total = value * lw
        return float(round_currency(total))
    
    elif s_type == 'moti':
        return float(round_currency(value))
    
    return 0.0


def calculate_studded_charge(studded_entry: Dict[str, Any]) -> float:
    """
    Calculate a single studded (diamond) charge entry.
    
    studded_entry contains:
      - type: 'diamond' | 'solitaire' | 'colored_stones'
      - carats: weight in carats
      - rate_per_carat: rate per carat
    
    All types: carats * rate_per_carat
    """
    carats = to_decimal(studded_entry.get('carats', 0))
    rate = to_decimal(studded_entry.get('rate_per_carat', 0))
    total = carats * rate
    return float(round_currency(total))


def calculate_gold_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate totals for a gold item.
    
    item contains:
      - item_name: str
      - rate_per_10g: float (rate for 10 grams of selected KT)
      - purity_percent: float (e.g., 92 for 22KT)
      - gross_weight: float
      - less: float
      - making_charges: List[Dict] - list of making charge entries
      - stone_charges: List[Dict] - list of stone charge entries
    
    Returns item with calculated fields:
      - net_weight
      - gold_value (net_weight * rate / 10)
      - total_making
      - total_stone
      - total_amount
    """
    gross_weight = item.get('gross_weight', 0)
    less = item.get('less', 0)
    rate_per_10g = item.get('rate_per_10g', 0)
    purity_percent = item.get('purity_percent', 100)
    
    net_weight = calculate_net_weight(gross_weight, less)
    
    # Gold value = net_weight * rate_per_10g / 10
    nw = to_decimal(net_weight)
    r = to_decimal(rate_per_10g)
    gold_value = float(round_currency(nw * r / Decimal('10')))
    
    # Making charges
    making_charges = item.get('making_charges', [])
    making_details = []
    total_making = Decimal('0')
    for mc in making_charges:
        charge = calculate_making_charge(mc, net_weight, rate_per_10g, purity_percent)
        detail = {**mc, 'calculated_amount': charge}
        # Store making_per_gram for percentage type display
        if mc.get('type') == 'percentage':
            p = to_decimal(purity_percent)
            if p > 0:
                rate_24kt = to_decimal(rate_per_10g) / (p / Decimal('100'))
                mpg = (to_decimal(mc.get('value', 0)) / Decimal('100')) * (rate_24kt / Decimal('10'))
                detail['making_per_gram'] = float(round_currency(mpg))
        making_details.append(detail)
        total_making += to_decimal(charge)
    total_making = float(round_currency(total_making))
    
    # Stone charges
    stone_charges = item.get('stone_charges', [])
    stone_details = []
    total_stone = Decimal('0')
    for sc in stone_charges:
        charge = calculate_stone_charge(sc, less)
        stone_details.append({**sc, 'calculated_amount': charge})
        total_stone += to_decimal(charge)
    total_stone = float(round_currency(total_stone))
    
    # Total
    total_amount = float(round_currency(
        to_decimal(gold_value) + to_decimal(total_making) + to_decimal(total_stone)
    ))
    
    return {
        **item,
        'item_type': 'gold',
        'net_weight': net_weight,
        'gold_value': gold_value,
        'making_charges': making_details,
        'total_making': total_making,
        'stone_charges': stone_details,
        'total_stone': total_stone,
        'total_amount': total_amount,
    }


def calculate_diamond_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate totals for a diamond item (gold base + studded diamonds).
    
    item has all gold fields PLUS:
      - studded_charges: List[Dict] - list of studded entries
        Each studded entry may have:
          - less_type: 'L' or 'NL' (default 'NL')
          - If 'L', the carat weight is converted to grams (1 carat = 0.2g)
            and subtracted from gross weight before net weight calculation.
    
    Returns item with gold calculations PLUS:
      - studded_details
      - total_studded
      - studded_less_grams (total grams subtracted due to L-type entries)
      - adjusted_net_weight (net weight after studded less deduction)
      - total_amount (gold_total + studded_total)
    """
    # Calculate studded less weight first (L-type entries)
    # 1 carat = 0.2 grams
    CARAT_TO_GRAM = Decimal('0.2')
    studded_charges = item.get('studded_charges', [])
    studded_less_grams = Decimal('0')
    for sc in studded_charges:
        if sc.get('less_type', 'NL') == 'L':
            carats = to_decimal(sc.get('carats', 0))
            studded_less_grams += carats * CARAT_TO_GRAM
    studded_less_grams_float = float(studded_less_grams.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP))
    
    # Adjust the item's "less" to include studded less before calculating gold portion
    original_less = to_decimal(item.get('less', 0))
    adjusted_less = float(round_currency(original_less + studded_less_grams))
    
    # Create a modified item with adjusted less for gold calculation
    adjusted_item = {**item, 'less': adjusted_less}
    
    # Calculate the gold portion with adjusted net weight
    gold_calc = calculate_gold_item(adjusted_item)
    gold_total = to_decimal(gold_calc['total_amount'])
    
    # Studded charges (monetary)
    studded_details = []
    total_studded = Decimal('0')
    for sc in studded_charges:
        charge = calculate_studded_charge(sc)
        detail = {**sc, 'calculated_amount': charge}
        # Add gram equivalent for display
        carats = to_decimal(sc.get('carats', 0))
        detail['weight_grams'] = float((carats * CARAT_TO_GRAM).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP))
        studded_details.append(detail)
        total_studded += to_decimal(charge)
    total_studded = float(round_currency(total_studded))
    
    # Total = gold total + studded total
    total_amount = float(round_currency(gold_total + to_decimal(total_studded)))
    
    return {
        **gold_calc,
        'item_type': 'diamond',
        'original_less': float(original_less),
        'studded_less_grams': studded_less_grams_float,
        'studded_charges': studded_details,
        'total_studded': total_studded,
        'total_amount': total_amount,
    }


def calculate_bill_totals(items: List[Dict[str, Any]], external_charges: List[Dict[str, Any]] = None, gst_percent: float = 3.0) -> Dict[str, Any]:
    """
    Calculate full bill totals.
    
    items: List of calculated items (already processed through calculate_gold_item or calculate_diamond_item)
    external_charges: List of {name: str, amount: float}
    gst_percent: GST percentage (default 3%)
    
    Returns:
      - items_total: sum of all item amounts
      - external_charges_total
      - subtotal (amount without GST)
      - gst_amount
      - grand_total
    """
    if external_charges is None:
        external_charges = []
    
    items_total = Decimal('0')
    for item in items:
        items_total += to_decimal(item.get('total_amount', 0))
    items_total = round_currency(items_total)
    
    ext_total = Decimal('0')
    for ec in external_charges:
        ext_total += to_decimal(ec.get('amount', 0))
    ext_total = round_currency(ext_total)
    
    subtotal = round_currency(items_total + ext_total)
    
    gst_rate = to_decimal(gst_percent) / Decimal('100')
    gst_amount = round_currency(subtotal * gst_rate)
    
    grand_total = round_currency(subtotal + gst_amount)
    
    return {
        'items_total': float(items_total),
        'external_charges': external_charges,
        'external_charges_total': float(ext_total),
        'subtotal_without_gst': float(subtotal),
        'gst_percent': gst_percent,
        'gst_amount': float(gst_amount),
        'grand_total': float(grand_total),
    }
