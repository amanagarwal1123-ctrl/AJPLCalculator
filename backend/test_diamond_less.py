#!/usr/bin/env python3
"""
Specific test for L/NL (Less/Not Less) diamond studded charges functionality
Tests the key requirements from the review request.
"""

import requests
import json
import sys
from datetime import datetime

class DiamondLessAPITester:
    def __init__(self):
        self.base_url = "https://farm-exec-flow.preview.emergentagent.com/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Raw response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        success, response = self.run_test(
            "Admin Login",
            "POST", 
            "/auth/login",
            200,
            {"username": "admin", "password": "admin1123"},
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']
            self.log(f"   Admin user: {response['user']['full_name']} (Role: {response['user']['role']})")
            return True
        return False

    def test_diamond_item_nl_default(self):
        """Test diamond item with NL (Not Less) entries - default behavior"""
        success, response = self.run_test(
            "Diamond Item - NL Default",
            "POST",
            "/calculate/item",
            200,
            {
                "item_type": "diamond",
                "item_name": "Diamond Ring",
                "rate_mode": "normal",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 55000,
                "gross_weight": 10.0,
                "less": 0.5,
                "making_charges": [],
                "stone_charges": [],
                "studded_charges": [
                    {
                        "type": "diamond",
                        "carats": 2.5,
                        "rate_per_carat": 50000,
                        "less_type": "NL"  # Not Less - default behavior
                    }
                ]
            }
        )
        if success:
            net_weight = response.get('net_weight')
            studded_less_grams = response.get('studded_less_grams', 0)
            total_studded = response.get('total_studded')
            
            # With NL, net weight should be 10.0 - 0.5 = 9.5g (no diamond deduction)
            expected_net_weight = 9.5
            expected_studded_less = 0.0
            expected_studded_total = 2.5 * 50000  # 125000
            
            self.log(f"   Net Weight: {net_weight}g (expected {expected_net_weight}g)")
            self.log(f"   Studded Less: {studded_less_grams}g (expected {expected_studded_less}g)")
            self.log(f"   Studded Total: ₹{total_studded} (expected ₹{expected_studded_total})")
            
            # Verify calculations
            net_ok = abs(net_weight - expected_net_weight) < 0.001
            less_ok = abs(studded_less_grams - expected_studded_less) < 0.001
            studded_ok = abs(total_studded - expected_studded_total) < 1
            
            return net_ok and less_ok and studded_ok
        return False

    def test_diamond_item_with_less_entries(self):
        """Test diamond item with L (Less) entries - weight should be subtracted"""
        success, response = self.run_test(
            "Diamond Item - L (Less) Entries",
            "POST",
            "/calculate/item",
            200,
            {
                "item_type": "diamond",
                "item_name": "Diamond Ring",
                "rate_mode": "normal", 
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 55000,
                "gross_weight": 10.0,
                "less": 0.5,
                "making_charges": [],
                "stone_charges": [],
                "studded_charges": [
                    {
                        "type": "diamond",
                        "carats": 2.5,
                        "rate_per_carat": 50000,
                        "less_type": "L"  # Less - should subtract from net weight
                    }
                ]
            }
        )
        if success:
            net_weight = response.get('net_weight')
            studded_less_grams = response.get('studded_less_grams', 0)
            total_studded = response.get('total_studded')
            gold_value = response.get('gold_value')
            
            # With L, studded less = 2.5 * 0.2 = 0.5g
            # Net weight should be 10.0 - 0.5 (less) - 0.5 (studded less) = 9.0g
            expected_studded_less = 2.5 * 0.2  # 0.5g
            expected_net_weight = 10.0 - 0.5 - expected_studded_less  # 9.0g
            expected_studded_total = 2.5 * 50000  # 125000 (monetary value unchanged)
            expected_gold_value = expected_net_weight * 55000 / 10  # 49500
            
            self.log(f"   Net Weight: {net_weight}g (expected {expected_net_weight}g)")
            self.log(f"   Studded Less: {studded_less_grams}g (expected {expected_studded_less}g)")
            self.log(f"   Studded Total: ₹{total_studded} (expected ₹{expected_studded_total})")
            self.log(f"   Gold Value: ₹{gold_value} (expected ₹{expected_gold_value})")
            
            # Verify calculations
            net_ok = abs(net_weight - expected_net_weight) < 0.001
            less_ok = abs(studded_less_grams - expected_studded_less) < 0.001
            studded_ok = abs(total_studded - expected_studded_total) < 1
            gold_ok = abs(gold_value - expected_gold_value) < 1
            
            return net_ok and less_ok and studded_ok and gold_ok
        return False

    def test_diamond_item_mixed_l_nl(self):
        """Test diamond item with mixed L and NL entries"""
        success, response = self.run_test(
            "Diamond Item - Mixed L/NL",
            "POST",
            "/calculate/item",
            200,
            {
                "item_type": "diamond",
                "item_name": "Diamond Necklace",
                "rate_mode": "normal",
                "purity_name": "22KT", 
                "purity_percent": 92,
                "rate_per_10g": 55000,
                "gross_weight": 15.0,
                "less": 1.0,
                "making_charges": [],
                "stone_charges": [],
                "studded_charges": [
                    {
                        "type": "diamond",
                        "carats": 1.5,
                        "rate_per_carat": 40000,
                        "less_type": "L"  # This should subtract weight
                    },
                    {
                        "type": "solitaire",
                        "carats": 2.0,
                        "rate_per_carat": 80000,
                        "less_type": "NL"  # This should NOT subtract weight
                    },
                    {
                        "type": "diamond",
                        "carats": 0.5,
                        "rate_per_carat": 30000,
                        "less_type": "L"  # This should subtract weight
                    }
                ]
            }
        )
        if success:
            net_weight = response.get('net_weight')
            studded_less_grams = response.get('studded_less_grams', 0)
            total_studded = response.get('total_studded')
            
            # Only L entries subtract: (1.5 + 0.5) * 0.2 = 0.4g
            expected_studded_less = (1.5 + 0.5) * 0.2  # 0.4g
            expected_net_weight = 15.0 - 1.0 - expected_studded_less  # 13.6g
            expected_studded_total = (1.5 * 40000) + (2.0 * 80000) + (0.5 * 30000)  # 60000 + 160000 + 15000 = 235000
            
            self.log(f"   Net Weight: {net_weight}g (expected {expected_net_weight}g)")
            self.log(f"   Studded Less: {studded_less_grams}g (expected {expected_studded_less}g)")
            self.log(f"   Total Studded: ₹{total_studded} (expected ₹{expected_studded_total})")
            
            # Verify calculations
            net_ok = abs(net_weight - expected_net_weight) < 0.001
            less_ok = abs(studded_less_grams - expected_studded_less) < 0.001
            studded_ok = abs(total_studded - expected_studded_total) < 1
            
            return net_ok and less_ok and studded_ok
        return False

    def test_diamond_item_with_making_charges(self):
        """Test diamond item with L entries affects making charges calculation"""
        success, response = self.run_test(
            "Diamond Item - L Affects Making Charges",
            "POST",
            "/calculate/item",
            200,
            {
                "item_type": "diamond",
                "item_name": "Diamond Ring",
                "rate_mode": "normal",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 55000,
                "gross_weight": 10.0,
                "less": 0.5,
                "making_charges": [
                    {
                        "type": "per_gram",
                        "value": 500,  # ₹500 per gram
                        "quantity": 1
                    }
                ],
                "stone_charges": [],
                "studded_charges": [
                    {
                        "type": "diamond",
                        "carats": 2.5,
                        "rate_per_carat": 50000,
                        "less_type": "L"  # Should affect net weight and thus making charges
                    }
                ]
            }
        )
        if success:
            net_weight = response.get('net_weight')
            studded_less_grams = response.get('studded_less_grams', 0)
            total_making = response.get('total_making')
            
            # Net weight = 10.0 - 0.5 - (2.5 * 0.2) = 9.0g
            expected_net_weight = 9.0
            expected_making = expected_net_weight * 500  # 4500
            
            self.log(f"   Net Weight: {net_weight}g (expected {expected_net_weight}g)")
            self.log(f"   Studded Less: {studded_less_grams}g")
            self.log(f"   Making Charges: ₹{total_making} (expected ₹{expected_making})")
            
            # Making charges should be calculated on the reduced net weight
            net_ok = abs(net_weight - expected_net_weight) < 0.001
            making_ok = abs(total_making - expected_making) < 1
            
            return net_ok and making_ok
        return False

    def test_studded_charge_details(self):
        """Test that studded charge details include weight_grams for display"""
        success, response = self.run_test(
            "Studded Charge Details",
            "POST",
            "/calculate/item",
            200,
            {
                "item_type": "diamond", 
                "item_name": "Diamond Ring",
                "rate_mode": "normal",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 55000,
                "gross_weight": 8.0,
                "less": 0.2,
                "making_charges": [],
                "stone_charges": [],
                "studded_charges": [
                    {
                        "type": "diamond",
                        "carats": 1.25,
                        "rate_per_carat": 60000,
                        "less_type": "L"
                    }
                ]
            }
        )
        if success:
            studded_charges = response.get('studded_charges', [])
            if studded_charges:
                studded_detail = studded_charges[0]
                weight_grams = studded_detail.get('weight_grams')
                calculated_amount = studded_detail.get('calculated_amount')
                less_type = studded_detail.get('less_type')
                
                expected_weight_grams = 1.25 * 0.2  # 0.25g
                expected_amount = 1.25 * 60000  # 75000
                
                self.log(f"   Studded Detail - Carats: {studded_detail.get('carats')}")
                self.log(f"   Weight in Grams: {weight_grams}g (expected {expected_weight_grams}g)")
                self.log(f"   Amount: ₹{calculated_amount} (expected ₹{expected_amount})")
                self.log(f"   Less Type: {less_type}")
                
                weight_ok = abs(weight_grams - expected_weight_grams) < 0.001
                amount_ok = abs(calculated_amount - expected_amount) < 1
                type_ok = less_type == "L"
                
                return weight_ok and amount_ok and type_ok
        return False

    def run_all_tests(self):
        """Execute all diamond less/not less tests"""
        self.log("💎 Starting Diamond L/NL (Less/Not Less) Testing...")
        self.log(f"Testing API at: {self.base_url}")
        
        test_methods = [
            self.test_admin_login,
            self.test_diamond_item_nl_default,
            self.test_diamond_item_with_less_entries,
            self.test_diamond_item_mixed_l_nl,
            self.test_diamond_item_with_making_charges,
            self.test_studded_charge_details,
        ]

        passed_tests = []
        failed_tests = []

        for test_method in test_methods:
            test_name = test_method.__name__.replace('test_', '').replace('_', ' ').title()
            try:
                result = test_method()
                if result:
                    passed_tests.append(test_name)
                else:
                    failed_tests.append(test_name)
            except Exception as e:
                self.log(f"❌ {test_name} - Exception: {str(e)}")
                failed_tests.append(test_name)
                self.tests_run += 1

        # Summary
        self.log("\n" + "="*60)
        self.log(f"📊 DIAMOND L/NL TEST SUMMARY")
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {self.tests_run - self.tests_passed}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if failed_tests:
            self.log(f"\n❌ Failed Tests: {', '.join(failed_tests)}")
        
        if passed_tests:
            self.log(f"\n✅ Passed Tests: {', '.join(passed_tests)}")

        return self.tests_passed == self.tests_run

def main():
    tester = DiamondLessAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())