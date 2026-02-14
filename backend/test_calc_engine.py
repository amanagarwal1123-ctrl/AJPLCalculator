"""
Test script for Gold Jewellery Calculation Engine
Covers all calculation types: gold items, diamond items, making charges, stone charges, bill totals.
"""
import sys
sys.path.insert(0, '/app/backend')

from calc_engine import (
    calculate_net_weight,
    extrapolate_24kt_rate,
    calculate_making_charge,
    calculate_stone_charge,
    calculate_studded_charge,
    calculate_gold_item,
    calculate_diamond_item,
    calculate_bill_totals,
)

def approx_equal(a, b, tolerance=0.02):
    return abs(a - b) <= tolerance


def test_net_weight():
    """Test net weight calculation."""
    print("\n=== Test: Net Weight ===")
    # Basic case
    nw = calculate_net_weight(10.5, 0.5)
    assert approx_equal(nw, 10.0), f"Expected 10.0, got {nw}"
    print(f"  10.5g - 0.5g = {nw}g ✓")
    
    # No less
    nw = calculate_net_weight(15.0, 0.0)
    assert approx_equal(nw, 15.0), f"Expected 15.0, got {nw}"
    print(f"  15.0g - 0.0g = {nw}g ✓")
    
    # Large less
    nw = calculate_net_weight(25.5, 3.2)
    assert approx_equal(nw, 22.3), f"Expected 22.3, got {nw}"
    print(f"  25.5g - 3.2g = {nw}g ✓")
    
    print("  ✅ All net weight tests passed")


def test_extrapolate_24kt():
    """Test 24KT rate extrapolation."""
    print("\n=== Test: 24KT Rate Extrapolation ===")
    
    # 22KT rate is 55000 per 10g, purity 92%
    # 24KT rate = 55000 / 0.92 = 59782.61
    rate_24kt = extrapolate_24kt_rate(55000, 92)
    expected = 59782.61
    assert approx_equal(rate_24kt, expected, 0.1), f"Expected ~{expected}, got {rate_24kt}"
    print(f"  22KT rate 55000, purity 92% -> 24KT rate: {rate_24kt} ✓")
    
    # 18KT rate is 45000 per 10g, purity 76%
    rate_24kt = extrapolate_24kt_rate(45000, 76)
    expected = 59210.53
    assert approx_equal(rate_24kt, expected, 0.1), f"Expected ~{expected}, got {rate_24kt}"
    print(f"  18KT rate 45000, purity 76% -> 24KT rate: {rate_24kt} ✓")
    
    # 24KT rate should return same
    rate_24kt = extrapolate_24kt_rate(60000, 100)
    assert approx_equal(rate_24kt, 60000, 0.1), f"Expected 60000, got {rate_24kt}"
    print(f"  24KT rate 60000, purity 100% -> 24KT rate: {rate_24kt} ✓")
    
    print("  ✅ All 24KT extrapolation tests passed")


def test_making_charges():
    """Test all 3 types of making charges."""
    print("\n=== Test: Making Charges ===")
    
    # Type 1: Percentage making
    # 22KT rate = 55000/10g, purity = 92%
    # 24KT rate = 55000/0.92 = 59782.61/10g = 5978.26/g
    # 5.5% making = 0.055 * 5978.26 = 328.80/g
    # Net weight = 10g -> Total = 3288.04
    mc = {'type': 'percentage', 'value': 5.5}
    charge = calculate_making_charge(mc, 10.0, 55000, 92)
    expected = 3288.04
    print(f"  Percentage making (5.5% of 24KT for 10g): {charge}")
    assert approx_equal(charge, expected, 1.0), f"Expected ~{expected}, got {charge}"
    print(f"  ✓ Correct (~{expected})")
    
    # Type 2: Per gram making
    # 350 per gram, net weight 10g = 3500
    mc = {'type': 'per_gram', 'value': 350}
    charge = calculate_making_charge(mc, 10.0, 55000, 92)
    assert approx_equal(charge, 3500, 0.01), f"Expected 3500, got {charge}"
    print(f"  Per gram making (₹350/g × 10g): {charge} ✓")
    
    # Type 3: Per piece making
    # 500 per piece, 3 pieces = 1500
    mc = {'type': 'per_piece', 'value': 500, 'quantity': 3}
    charge = calculate_making_charge(mc, 10.0, 55000, 92)
    assert approx_equal(charge, 1500, 0.01), f"Expected 1500, got {charge}"
    print(f"  Per piece making (₹500 × 3 pieces): {charge} ✓")
    
    print("  ✅ All making charge tests passed")


def test_stone_charges():
    """Test all 3 types of stone charges."""
    print("\n=== Test: Stone Charges ===")
    
    # Kundan: 25 pieces at ₹100 each = 2500
    sc = {'type': 'kundan', 'value': 100, 'quantity': 25}
    charge = calculate_stone_charge(sc, 0.5)
    assert approx_equal(charge, 2500, 0.01), f"Expected 2500, got {charge}"
    print(f"  Kundan (₹100 × 25 pieces): {charge} ✓")
    
    # Stone: ₹200/g, less weight = 0.5g -> 100
    sc = {'type': 'stone', 'value': 200}
    charge = calculate_stone_charge(sc, 0.5)
    assert approx_equal(charge, 100, 0.01), f"Expected 100, got {charge}"
    print(f"  Stone (₹200/g × 0.5g less): {charge} ✓")
    
    # Moti: flat ₹1500
    sc = {'type': 'moti', 'value': 1500}
    charge = calculate_stone_charge(sc, 0.5)
    assert approx_equal(charge, 1500, 0.01), f"Expected 1500, got {charge}"
    print(f"  Moti (flat ₹1500): {charge} ✓")
    
    print("  ✅ All stone charge tests passed")


def test_studded_charges():
    """Test diamond/studded charge calculations."""
    print("\n=== Test: Studded (Diamond) Charges ===")
    
    # Diamond: 0.5 carats × ₹80000/carat = 40000
    sc = {'type': 'diamond', 'carats': 0.5, 'rate_per_carat': 80000}
    charge = calculate_studded_charge(sc)
    assert approx_equal(charge, 40000, 0.01), f"Expected 40000, got {charge}"
    print(f"  Diamond (0.5ct × ₹80000): {charge} ✓")
    
    # Solitaire: 1.2 carats × ₹150000/carat = 180000
    sc = {'type': 'solitaire', 'carats': 1.2, 'rate_per_carat': 150000}
    charge = calculate_studded_charge(sc)
    assert approx_equal(charge, 180000, 0.01), f"Expected 180000, got {charge}"
    print(f"  Solitaire (1.2ct × ₹150000): {charge} ✓")
    
    # Colored stones: 0.3 carats × ₹25000/carat = 7500
    sc = {'type': 'colored_stones', 'carats': 0.3, 'rate_per_carat': 25000}
    charge = calculate_studded_charge(sc)
    assert approx_equal(charge, 7500, 0.01), f"Expected 7500, got {charge}"
    print(f"  Colored stones (0.3ct × ₹25000): {charge} ✓")
    
    print("  ✅ All studded charge tests passed")


def test_gold_item_full():
    """Test a complete gold item calculation."""
    print("\n=== Test: Full Gold Item ===")
    
    # 22KT Gold Necklace
    # Rate: 55000/10g (22KT), Purity: 92%
    # Gross: 25.5g, Less: 1.5g -> Net: 24.0g
    # Gold value: 24.0 * 55000/10 = 132000
    # Making: 5% of 24KT -> 24KT rate = 55000/0.92 = 59782.61
    #   per gram = 0.05 * 5978.26 = 298.91
    #   total making = 298.91 * 24 = 7173.91
    # Stone: Kundan 10 pieces × ₹50 = 500
    # Total: 132000 + 7173.91 + 500 = 139673.91
    
    item = {
        'item_name': 'Necklace',
        'rate_per_10g': 55000,
        'purity_percent': 92,
        'gross_weight': 25.5,
        'less': 1.5,
        'making_charges': [
            {'type': 'percentage', 'value': 5.0}
        ],
        'stone_charges': [
            {'type': 'kundan', 'value': 50, 'quantity': 10}
        ],
    }
    
    result = calculate_gold_item(item)
    
    print(f"  Item: {result['item_name']}")
    print(f"  Net Weight: {result['net_weight']}g (expected 24.0)")
    print(f"  Gold Value: ₹{result['gold_value']} (expected ~132000)")
    print(f"  Total Making: ₹{result['total_making']} (expected ~7173.91)")
    print(f"  Total Stone: ₹{result['total_stone']} (expected 500)")
    print(f"  Total Amount: ₹{result['total_amount']} (expected ~139673.91)")
    
    assert approx_equal(result['net_weight'], 24.0), f"Net weight wrong"
    assert approx_equal(result['gold_value'], 132000, 1), f"Gold value wrong"
    assert approx_equal(result['total_making'], 7173.91, 5), f"Making wrong: {result['total_making']}"
    assert approx_equal(result['total_stone'], 500, 0.01), f"Stone wrong"
    assert approx_equal(result['total_amount'], 139673.91, 10), f"Total wrong: {result['total_amount']}"
    
    print("  ✅ Full gold item test passed")


def test_diamond_item_full():
    """Test a complete diamond item calculation (NL default - no studded less)."""
    print("\n=== Test: Full Diamond Item (NL default) ===")
    
    # 18KT Diamond Ring
    # Rate: 45000/10g (18KT), Purity: 76%
    # Gross: 8.0g, Less: 0.3g -> Net: 7.7g (no L-type studded)
    # Gold value: 7.7 * 45000/10 = 34650
    # Making: ₹400/gram -> 400 * 7.7 = 3080
    # Stone: Moti flat ₹800
    # Gold total: 34650 + 3080 + 800 = 38530
    # Studded (all NL):
    #   Diamond: 0.25ct × ₹90000 = 22500
    #   Solitaire: 0.8ct × ₹200000 = 160000
    # Studded total: 182500
    # Grand item total: 38530 + 182500 = 221030
    
    item = {
        'item_name': 'Diamond Ring',
        'rate_per_10g': 45000,
        'purity_percent': 76,
        'gross_weight': 8.0,
        'less': 0.3,
        'making_charges': [
            {'type': 'per_gram', 'value': 400}
        ],
        'stone_charges': [
            {'type': 'moti', 'value': 800}
        ],
        'studded_charges': [
            {'type': 'diamond', 'carats': 0.25, 'rate_per_carat': 90000, 'less_type': 'NL'},
            {'type': 'solitaire', 'carats': 0.8, 'rate_per_carat': 200000, 'less_type': 'NL'},
        ],
    }
    
    result = calculate_diamond_item(item)
    
    print(f"  Item: {result['item_name']}")
    print(f"  Net Weight: {result['net_weight']}g (expected 7.7)")
    print(f"  Studded Less: {result['studded_less_grams']}g (expected 0)")
    print(f"  Gold Value: ₹{result['gold_value']} (expected 34650)")
    print(f"  Total Making: ₹{result['total_making']} (expected 3080)")
    print(f"  Total Stone: ₹{result['total_stone']} (expected 800)")
    print(f"  Total Studded: ₹{result['total_studded']} (expected 182500)")
    print(f"  Total Amount: ₹{result['total_amount']} (expected 221030)")
    
    assert approx_equal(result['net_weight'], 7.7, 0.01)
    assert approx_equal(result['studded_less_grams'], 0, 0.001)
    assert approx_equal(result['gold_value'], 34650, 1)
    assert approx_equal(result['total_making'], 3080, 1)
    assert approx_equal(result['total_stone'], 800, 0.01)
    assert approx_equal(result['total_studded'], 182500, 1)
    assert approx_equal(result['total_amount'], 221030, 5)
    
    print("  ✅ Full diamond item test passed (NL)")


def test_diamond_item_with_less():
    """Test diamond item with L-type studded entries (weight subtracted from net)."""
    print("\n=== Test: Diamond Item with L (Less) Studded ===")
    
    # 18KT Diamond Ring
    # Rate: 45000/10g (18KT), Purity: 76%
    # Gross: 8.0g, Original Less: 0.3g
    # Studded:
    #   Diamond: 0.25ct (L) -> 0.25 * 0.2 = 0.050g subtracted
    #   Solitaire: 0.8ct (NL) -> NOT subtracted
    # Studded less = 0.050g
    # Adjusted less = 0.3 + 0.05 = 0.35g
    # Adjusted Net Weight = 8.0 - 0.35 = 7.65g
    # Gold value: 7.65 * 45000/10 = 34425
    # Making: ₹400/gram -> 400 * 7.65 = 3060
    # Stone: Moti flat ₹800
    # Gold portion: 34425 + 3060 + 800 = 38285
    # Studded amounts (unchanged by L/NL):
    #   Diamond: 0.25ct × ₹90000 = 22500
    #   Solitaire: 0.8ct × ₹200000 = 160000
    # Studded total: 182500
    # Grand item total: 38285 + 182500 = 220785
    
    item = {
        'item_name': 'Diamond Ring L-Test',
        'rate_per_10g': 45000,
        'purity_percent': 76,
        'gross_weight': 8.0,
        'less': 0.3,
        'making_charges': [
            {'type': 'per_gram', 'value': 400}
        ],
        'stone_charges': [
            {'type': 'moti', 'value': 800}
        ],
        'studded_charges': [
            {'type': 'diamond', 'carats': 0.25, 'rate_per_carat': 90000, 'less_type': 'L'},
            {'type': 'solitaire', 'carats': 0.8, 'rate_per_carat': 200000, 'less_type': 'NL'},
        ],
    }
    
    result = calculate_diamond_item(item)
    
    print(f"  Item: {result['item_name']}")
    print(f"  Original Less: {result['original_less']}g")
    print(f"  Studded Less: {result['studded_less_grams']}g (expected 0.050)")
    print(f"  Adjusted Net Weight: {result['net_weight']}g (expected 7.65)")
    print(f"  Gold Value: ₹{result['gold_value']} (expected 34425)")
    print(f"  Total Making: ₹{result['total_making']} (expected 3060)")
    print(f"  Total Stone: ₹{result['total_stone']} (expected 800)")
    print(f"  Total Studded: ₹{result['total_studded']} (expected 182500)")
    print(f"  Total Amount: ₹{result['total_amount']} (expected 220785)")
    
    assert approx_equal(result['studded_less_grams'], 0.050, 0.001), f"Studded less wrong: {result['studded_less_grams']}"
    assert approx_equal(result['net_weight'], 7.65, 0.01), f"Net weight wrong: {result['net_weight']}"
    assert approx_equal(result['gold_value'], 34425, 1), f"Gold value wrong: {result['gold_value']}"
    assert approx_equal(result['total_making'], 3060, 1), f"Making wrong: {result['total_making']}"
    assert approx_equal(result['total_studded'], 182500, 1), f"Studded wrong: {result['total_studded']}"
    assert approx_equal(result['total_amount'], 220785, 10), f"Total wrong: {result['total_amount']}"
    
    print("  ✅ Diamond item with L (Less) test passed")


def test_bill_totals():
    """Test complete bill totals with items + external charges + GST."""
    print("\n=== Test: Bill Totals ===")
    
    # Two items: one gold, one diamond
    gold_item = calculate_gold_item({
        'item_name': 'Bangle',
        'rate_per_10g': 55000,
        'purity_percent': 92,
        'gross_weight': 15.0,
        'less': 0.5,
        'making_charges': [{'type': 'per_gram', 'value': 300}],
        'stone_charges': [],
    })
    
    diamond_item = calculate_diamond_item({
        'item_name': 'Pendant',
        'rate_per_10g': 55000,
        'purity_percent': 92,
        'gross_weight': 5.0,
        'less': 0.2,
        'making_charges': [{'type': 'per_piece', 'value': 2000, 'quantity': 1}],
        'stone_charges': [{'type': 'kundan', 'value': 75, 'quantity': 8}],
        'studded_charges': [
            {'type': 'diamond', 'carats': 0.15, 'rate_per_carat': 85000}
        ],
    })
    
    items = [gold_item, diamond_item]
    external_charges = [
        {'name': 'Rhodium Plating', 'amount': 500},
        {'name': 'Hallmarking', 'amount': 200},
    ]
    
    result = calculate_bill_totals(items, external_charges, gst_percent=3.0)
    
    print(f"  Gold item total: ₹{gold_item['total_amount']}")
    print(f"  Diamond item total: ₹{diamond_item['total_amount']}")
    print(f"  Items total: ₹{result['items_total']}")
    print(f"  External charges: ₹{result['external_charges_total']}")
    print(f"  Subtotal (without GST): ₹{result['subtotal_without_gst']}")
    print(f"  GST (3%): ₹{result['gst_amount']}")
    print(f"  Grand Total: ₹{result['grand_total']}")
    
    # Verify items total = sum of individual totals
    expected_items = gold_item['total_amount'] + diamond_item['total_amount']
    assert approx_equal(result['items_total'], expected_items, 1), f"Items total mismatch"
    
    # Verify external charges
    assert approx_equal(result['external_charges_total'], 700, 0.01)
    
    # Verify subtotal
    expected_subtotal = expected_items + 700
    assert approx_equal(result['subtotal_without_gst'], expected_subtotal, 1)
    
    # Verify GST
    expected_gst = expected_subtotal * 0.03
    assert approx_equal(result['gst_amount'], expected_gst, 5)
    
    # Verify grand total
    expected_grand = expected_subtotal + expected_gst
    assert approx_equal(result['grand_total'], expected_grand, 10)
    
    print("  ✅ Bill totals test passed")


def test_multiple_making_charges():
    """Test an item with multiple making charges."""
    print("\n=== Test: Multiple Making Charges ===")
    
    item = {
        'item_name': 'Complex Necklace',
        'rate_per_10g': 55000,
        'purity_percent': 92,
        'gross_weight': 30.0,
        'less': 2.0,
        'making_charges': [
            {'type': 'percentage', 'value': 3.0},
            {'type': 'per_gram', 'value': 150},
            {'type': 'per_piece', 'value': 1000, 'quantity': 2},
        ],
        'stone_charges': [
            {'type': 'kundan', 'value': 80, 'quantity': 15},
            {'type': 'stone', 'value': 300},
            {'type': 'moti', 'value': 2000},
        ],
    }
    
    result = calculate_gold_item(item)
    
    print(f"  Item: {result['item_name']}")
    print(f"  Net Weight: {result['net_weight']}g")
    print(f"  Gold Value: ₹{result['gold_value']}")
    print(f"  Making charges breakdown:")
    for mc in result['making_charges']:
        print(f"    - {mc['type']}: ₹{mc['calculated_amount']}")
    print(f"  Total Making: ₹{result['total_making']}")
    print(f"  Stone charges breakdown:")
    for sc in result['stone_charges']:
        print(f"    - {sc['type']}: ₹{sc['calculated_amount']}")
    print(f"  Total Stone: ₹{result['total_stone']}")
    print(f"  Total Amount: ₹{result['total_amount']}")
    
    assert result['net_weight'] == 28.0
    assert result['total_making'] > 0
    assert result['total_stone'] > 0
    assert result['total_amount'] > result['gold_value']
    
    print("  ✅ Multiple making charges test passed")


def test_manual_rates():
    """Test manual rate entry (same calculation, just different rate source)."""
    print("\n=== Test: Manual Rate Entry ===")
    
    # User manually enters a rate
    item = {
        'item_name': 'Custom Ring',
        'rate_per_10g': 52000,  # Manually entered
        'purity_percent': 92,  # Still need purity for making calc
        'gross_weight': 5.0,
        'less': 0.0,
        'making_charges': [
            {'type': 'percentage', 'value': 4.0}
        ],
        'stone_charges': [],
    }
    
    result = calculate_gold_item(item)
    
    # Gold value: 5 * 52000/10 = 26000
    assert approx_equal(result['gold_value'], 26000, 1)
    print(f"  Manual rate gold value: ₹{result['gold_value']} ✓")
    
    # Making: 4% of 24KT (52000/0.92 = 56521.74/10g = 5652.17/g)
    # Making per g = 0.04 * 5652.17 = 226.09
    # Total = 226.09 * 5 = 1130.43
    print(f"  Making: ₹{result['total_making']}")
    assert result['total_making'] > 0
    
    print(f"  Total: ₹{result['total_amount']}")
    print("  ✅ Manual rate test passed")


if __name__ == '__main__':
    print("🏅 Gold Jewellery Calculation Engine - Test Suite")
    print("=" * 60)
    
    tests = [
        test_net_weight,
        test_extrapolate_24kt,
        test_making_charges,
        test_stone_charges,
        test_studded_charges,
        test_gold_item_full,
        test_diamond_item_full,
        test_diamond_item_with_less,
        test_bill_totals,
        test_multiple_making_charges,
        test_manual_rates,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED - Calculation engine is verified!")
    else:
        print(f"\n⚠️ {failed} tests failed - needs fixing")
    
    sys.exit(0 if failed == 0 else 1)
