#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

class GoldJewelleryAPITester:
    def __init__(self):
        self.base_url = "https://ajpl-calc.preview.emergentagent.com/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'branch_id': None,
            'executive_user_id': None,
            'executive_username': None,
            'executive_password': None,
            'manager_user_id': None,
            'manager_username': None,
            'manager_password': None,
            'item_name_id': None,
            'bill_id': None
        }

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
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

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

    def test_health_check(self):
        """Test if API is responsive"""
        success, response = self.run_test("API Health Check", "GET", "/", 200, auth_required=False)
        return success

    def test_admin_login(self):
        """Test admin login with default credentials"""
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

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test("Get Current User", "GET", "/auth/me", 200)
        return success and response.get('role') == 'admin'

    def test_get_purities(self):
        """Test fetching gold purities"""
        success, response = self.run_test("Get Purities", "GET", "/purities", 200)
        if success and isinstance(response, list):
            self.log(f"   Found {len(response)} purities: {[p.get('name') for p in response[:3]]}")
            return len(response) > 0
        return False

    def test_get_rates(self):
        """Test fetching rate cards"""
        success, response = self.run_test("Get Rate Cards", "GET", "/rates", 200)
        if success and isinstance(response, list):
            rate_types = [r.get('rate_type') for r in response]
            self.log(f"   Found rate types: {rate_types}")
            return 'normal' in rate_types and 'ajpl' in rate_types
        return False

    def test_update_normal_rates(self):
        """Test updating normal gold rates - Set 24KT to 60000 as per test requirements"""
        # First get current rates
        success, response = self.run_test("Get Normal Rates", "GET", "/rates/normal", 200)
        if not success:
            return False
        
        # Update 24KT rate to 60000 as specified in test requirements
        purities = response.get('purities', [])
        for purity in purities:
            if purity.get('purity_name') == '24KT':
                purity['rate_per_10g'] = 60000
        
        success, _ = self.run_test(
            "Update Normal Rates (24KT = 60000)", 
            "PUT", 
            "/rates/normal",
            200,
            {"rate_type": "normal", "purities": purities}
        )
        return success

    def test_create_branch(self):
        """Test creating a new branch"""
        success, response = self.run_test(
            "Create Branch",
            "POST",
            "/branches",
            200,
            {
                "name": "Main Showroom",
                "address": "123 Gold Street, Jewelry District", 
                "phone": "9876543210"
            }
        )
        if success:
            self.created_resources['branch_id'] = response.get('id')
            self.log(f"   Created branch ID: {self.created_resources['branch_id']}")
        return success

    def test_list_branches(self):
        """Test listing all branches"""
        success, response = self.run_test("List Branches", "GET", "/branches", 200)
        if success and isinstance(response, list):
            self.log(f"   Found {len(response)} branches")
            return len(response) > 0
        return False

    def test_create_executive_user(self):
        """Test creating a sales executive user"""
        exec_username = f"exec_{datetime.now().strftime('%H%M%S')}"
        exec_password = "exec123"
        
        success, response = self.run_test(
            "Create Sales Executive",
            "POST",
            "/users",
            200,
            {
                "username": exec_username,
                "password": exec_password,
                "full_name": "Test Executive",
                "role": "executive",
                "branch_id": self.created_resources['branch_id']
            }
        )
        if success:
            self.created_resources['executive_user_id'] = response.get('id')
            self.created_resources['executive_username'] = exec_username
            self.created_resources['executive_password'] = exec_password
            self.log(f"   Created executive: {exec_username}")
        return success

    def test_create_manager_user(self):
        """Test creating a manager user"""
        manager_username = f"manager_{datetime.now().strftime('%H%M%S')}"
        manager_password = "manager123"
        
        success, response = self.run_test(
            "Create Manager User",
            "POST",
            "/users",
            200,
            {
                "username": manager_username,
                "password": manager_password,
                "full_name": "Test Manager",
                "role": "manager",
                "branch_id": self.created_resources['branch_id']
            }
        )
        if success:
            self.created_resources['manager_user_id'] = response.get('id')
            self.created_resources['manager_username'] = manager_username
            self.created_resources['manager_password'] = manager_password
            self.log(f"   Created manager: {manager_username}")
        return success

    def test_manager_login(self):
        """Test logging in as the created manager"""
        if not self.created_resources['manager_username']:
            self.log("❌ Manager Login - No manager user created")
            return False
            
        success, response = self.run_test(
            "Manager Login",
            "POST",
            "/auth/login", 
            200,
            {
                "username": self.created_resources['manager_username'],
                "password": self.created_resources['manager_password']
            },
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']  # Switch to manager token
            self.log(f"   Logged in as manager: {response['user']['full_name']}")
            return True
        return False

    def test_manager_approve_bill(self):
        """Test manager approving a bill using the new approve endpoint"""
        if not self.created_resources['bill_id']:
            self.log("❌ Manager Approve Bill - No bill to approve")
            return False
            
        success, response = self.run_test(
            "Manager Approve Bill",
            "PUT",
            f"/bills/{self.created_resources['bill_id']}/approve",
            200
        )
        if success:
            self.log("   Bill successfully approved by manager")
        return success

    def test_get_bill_with_audit_trail(self):
        """Test fetching bill to verify audit trail after approval"""
        if not self.created_resources['bill_id']:
            return False
            
        success, response = self.run_test(
            "Get Bill with Audit Trail",
            "GET",
            f"/bills/{self.created_resources['bill_id']}",
            200
        )
        if success:
            change_log = response.get('change_log', [])
            status = response.get('status')
            self.log(f"   Bill status: {status}")
            self.log(f"   Change log entries: {len(change_log)}")
            if change_log:
                last_change = change_log[-1]
                self.log(f"   Last change: {last_change.get('action')} by {last_change.get('user')}")
            return status == 'approved' and len(change_log) > 0
        return False
        """Test creating a sales executive user"""
        exec_username = f"exec_{datetime.now().strftime('%H%M%S')}"
        exec_password = "exec123"
        
        success, response = self.run_test(
            "Create Sales Executive",
            "POST",
            "/users",
            200,
            {
                "username": exec_username,
                "password": exec_password,
                "full_name": "Test Executive",
                "role": "executive",
                "branch_id": self.created_resources['branch_id']
            }
        )
        if success:
            self.created_resources['executive_user_id'] = response.get('id')
            self.created_resources['executive_username'] = exec_username
            self.created_resources['executive_password'] = exec_password
            self.log(f"   Created executive: {exec_username}")
        return success

    def test_list_users(self):
        """Test listing all users"""
        success, response = self.run_test("List Users", "GET", "/users", 200)
        if success and isinstance(response, list):
            roles = [u.get('role') for u in response]
            self.log(f"   Found {len(response)} users with roles: {set(roles)}")
            return len(response) >= 2  # At least admin + executive
        return False

    def test_add_item_names(self):
        """Test adding item names for jewelry"""
        items_to_add = ["Necklace", "Ring", "Bangle", "Pendant"]
        created_count = 0
        
        for item_name in items_to_add:
            success, response = self.run_test(
                f"Add Item Name: {item_name}",
                "POST",
                "/item-names", 
                200,
                {"name": item_name}
            )
            if success:
                created_count += 1
                if not self.created_resources['item_name_id']:
                    self.created_resources['item_name_id'] = response.get('id')
        
        self.log(f"   Successfully added {created_count}/{len(items_to_add)} item names")
        return created_count > 0

    def test_list_item_names(self):
        """Test listing item names"""
        success, response = self.run_test("List Item Names", "GET", "/item-names", 200)
        if success and isinstance(response, list):
            names = [item.get('name') for item in response]
            self.log(f"   Available items: {names[:5]}")
            return len(response) > 0
        return False

    def test_executive_login(self):
        """Test logging in as the created executive"""
        if not self.created_resources['executive_username']:
            self.log("❌ Executive Login - No executive user created")
            return False
            
        success, response = self.run_test(
            "Executive Login",
            "POST",
            "/auth/login", 
            200,
            {
                "username": self.created_resources['executive_username'],
                "password": self.created_resources['executive_password']
            },
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']  # Switch to executive token
            self.log(f"   Logged in as executive: {response['user']['full_name']}")
            return True
        return False

    def test_create_bill(self):
        """Test creating a new bill as executive"""
        success, response = self.run_test(
            "Create Bill",
            "POST",
            "/bills",
            200,
            {
                "customer_name": "Test Customer",
                "customer_phone": "9876543210",
                "customer_location": "Test City",
                "customer_reference": "Instagram",
                "items": [],
                "external_charges": []
            }
        )
        if success:
            self.created_resources['bill_id'] = response.get('id')
            bill_number = response.get('bill_number')
            self.log(f"   Created bill: {bill_number} (ID: {self.created_resources['bill_id']})")
        return success

    def test_calculate_gold_item(self):
        """Test calculating a gold item with making and stone charges"""
        success, response = self.run_test(
            "Calculate Gold Item",
            "POST",
            "/calculate/item",
            200,
            {
                "item_type": "gold",
                "item_name": "Necklace",
                "rate_mode": "normal",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 55000,
                "gross_weight": 10.5,
                "less": 0.5,
                "making_charges": [
                    {
                        "type": "percentage",
                        "value": 15,
                        "quantity": 1
                    }
                ],
                "stone_charges": [
                    {
                        "type": "stone",
                        "value": 500,
                        "quantity": 1
                    }
                ]
            }
        )
        if success:
            net_weight = response.get('net_weight')
            gold_value = response.get('gold_value')
            total_making = response.get('total_making')
            total_stone = response.get('total_stone')
            total_amount = response.get('total_amount')
            self.log(f"   Calculated: Net={net_weight}g, Gold=₹{gold_value}, Making=₹{total_making}, Stone=₹{total_stone}, Total=₹{total_amount}")
        return success

    def test_add_item_to_bill(self):
        """Test adding a calculated item to the bill"""
        if not self.created_resources['bill_id']:
            return False
            
        success, response = self.run_test(
            "Add Item to Bill",
            "PUT",
            f"/bills/{self.created_resources['bill_id']}",
            200,
            {
                "items": [
                    {
                        "item_type": "gold",
                        "item_name": "Necklace",
                        "rate_mode": "normal",
                        "purity_name": "22KT",
                        "purity_percent": 92,
                        "rate_per_10g": 60000,
                        "gross_weight": 10.5,
                        "less": 0.5,
                        "making_charges": [
                            {
                                "type": "percentage", 
                                "value": 15,
                                "quantity": 1
                            }
                        ],
                        "stone_charges": [
                            {
                                "type": "stone",
                                "value": 500,
                                "quantity": 1
                            }
                        ]
                    }
                ],
                "external_charges": []
            }
        )
        if success:
            items_total = response.get('items_total')
            grand_total = response.get('grand_total')
            self.log(f"   Bill updated: Items=₹{items_total}, Grand Total=₹{grand_total}")
        return success

    def test_send_bill_to_manager(self):
        """Test sending bill to manager"""
        if not self.created_resources['bill_id']:
            return False
            
        success, response = self.run_test(
            "Send Bill to Manager",
            "PUT",
            f"/bills/{self.created_resources['bill_id']}/send",
            200
        )
        if success:
            self.log("   Bill successfully sent to manager")
        return success

    def test_get_bills(self):
        """Test listing bills (should show the created bill)"""
        success, response = self.run_test("List Bills", "GET", "/bills", 200)
        if success and isinstance(response, list):
            self.log(f"   Found {len(response)} bills")
            if len(response) > 0:
                recent_bill = response[0]
                self.log(f"   Recent bill: {recent_bill.get('bill_number')} - Status: {recent_bill.get('status')}")
            return len(response) > 0
        return False

    def test_admin_login_again(self):
        """Switch back to admin for admin-only operations"""
        success, response = self.run_test(
            "Admin Login (Switch Back)",
            "POST",
            "/auth/login",
            200,
            {"username": "admin", "password": "admin1123"},
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_bill_pdf_generation(self):
        """Test PDF generation for bill"""
        if not self.created_resources['bill_id']:
            return False
            
        try:
            url = f"{self.base_url}/bills/{self.created_resources['bill_id']}/pdf"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers, timeout=30)
            
            success = response.status_code == 200 and 'pdf' in response.headers.get('content-type', '').lower()
            self.tests_run += 1
            
            if success:
                self.tests_passed += 1
                pdf_size = len(response.content)
                self.log(f"✅ Bill PDF Generation - Generated PDF ({pdf_size} bytes)")
                return True
            else:
                self.log(f"❌ Bill PDF Generation - Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Bill PDF Generation - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_dashboard_analytics(self):
        """Test admin dashboard analytics"""
        success, response = self.run_test("Dashboard Analytics", "GET", "/analytics/dashboard", 200)
        if success:
            today_sales = response.get('today_sales', 0)
            today_count = response.get('today_count', 0)
            self.log(f"   Analytics: Today's Sales=₹{today_sales}, Bills Count={today_count}")
        return success

    def test_customer_frequency_analytics(self):
        """Test new customer frequency analytics endpoint"""
        success, response = self.run_test("Customer Frequency Analytics", "GET", "/analytics/customers/frequency", 200)
        if success:
            frequency_cohorts = response.get('frequency_cohorts', [])
            spending_tiers = response.get('spending_tiers', [])
            total_customers = response.get('total_customers', 0)
            avg_visits = response.get('avg_visits', 0)
            avg_spending = response.get('avg_spending', 0)
            
            self.log(f"   Customer Analytics: {total_customers} customers, Avg visits: {avg_visits}, Avg spending: ₹{avg_spending}")
            self.log(f"   Frequency cohorts: {len(frequency_cohorts)} cohorts")
            self.log(f"   Spending tiers: {len(spending_tiers)} tiers")
            
            # Validate response structure
            expected_cohort_names = ["1 visit", "2-3 visits", "4-5 visits", "6+ visits"]
            expected_tier_names = ["Under 25K", "25K - 50K", "50K - 1L", "1L - 2L", "Above 2L"]
            
            cohort_names = [c.get('name') for c in frequency_cohorts]
            tier_names = [t.get('name') for t in spending_tiers]
            
            valid_cohorts = all(name in expected_cohort_names for name in cohort_names)
            valid_tiers = all(name in expected_tier_names for name in tier_names)
            
            if valid_cohorts and valid_tiers:
                self.log("   ✓ Response structure valid")
                return True
            else:
                self.log(f"   ✗ Invalid structure - Cohorts: {cohort_names}, Tiers: {tier_names}")
                return False
        return False

    def test_inactive_customers_analytics(self):
        """Test new inactive customers analytics endpoint with various thresholds"""
        # Test default threshold (30 days)
        success, response = self.run_test("Inactive Customers (30 days)", "GET", "/analytics/customers/inactive?days=30", 200)
        if not success:
            return False
            
        threshold_days = response.get('threshold_days', 0)
        inactive_count = response.get('inactive_count', 0)
        total_customers = response.get('total_customers', 0)
        inactive_customers = response.get('inactive_customers', [])
        
        self.log(f"   Inactive (30d): {inactive_count}/{total_customers} customers")
        
        # Test custom threshold (60 days)
        success2, response2 = self.run_test("Inactive Customers (60 days)", "GET", "/analytics/customers/inactive?days=60", 200)
        if success2:
            inactive_count_60 = response2.get('inactive_count', 0)
            self.log(f"   Inactive (60d): {inactive_count_60}/{total_customers} customers")
            
            # Validate that longer threshold should have same or more inactive customers
            if inactive_count_60 >= inactive_count:
                self.log("   ✓ Threshold logic working correctly")
                return True
            else:
                self.log("   ✗ Threshold logic error: 60d count should be >= 30d count")
                return False
        
        return success

    def test_basic_customer_analytics(self):
        """Test basic customer analytics endpoint"""
        success, response = self.run_test("Basic Customer Analytics", "GET", "/analytics/customers", 200)
        if success and isinstance(response, list):
            customer_count = len(response)
            self.log(f"   Found {customer_count} customers in analytics")
            
            # Check if days_since_last_visit is calculated
            if customer_count > 0:
                sample_customer = response[0]
                has_days_calc = 'days_since_last_visit' in sample_customer
                self.log(f"   Days since last visit calculation: {'✓' if has_days_calc else '✗'}")
                return has_days_calc
            return True
        return False

    def run_all_tests(self):
        """Execute all test methods"""
        self.log("🚀 Starting Gold Jewellery API Testing...")
        self.log(f"Testing API at: {self.base_url}")
        
        test_methods = [
            # Basic connectivity
            self.test_health_check,
            
            # Authentication
            self.test_admin_login,
            self.test_get_current_user,
            
            # Admin setup operations
            self.test_get_purities,
            self.test_get_rates,
            self.test_update_normal_rates,
            self.test_create_branch,
            self.test_list_branches,
            self.test_create_executive_user,
            self.test_create_manager_user,
            self.test_list_users,
            self.test_add_item_names,
            self.test_list_item_names,
            
            # Executive operations
            self.test_executive_login,
            self.test_create_bill,
            self.test_calculate_gold_item,
            self.test_add_item_to_bill,
            self.test_send_bill_to_manager,
            self.test_get_bills,
            
            # Manager operations (Phase 3)
            self.test_manager_login,
            self.test_manager_approve_bill,
            self.test_get_bill_with_audit_trail,
            
            # Admin final operations
            self.test_admin_login_again,
            self.test_bill_pdf_generation,
            self.test_dashboard_analytics,
            
            # New customer analytics endpoints (as per review request)
            self.test_customer_frequency_analytics,
            self.test_inactive_customers_analytics,
            self.test_basic_customer_analytics,
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
        self.log(f"📊 TEST SUMMARY")
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {self.tests_run - self.tests_passed}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if failed_tests:
            self.log(f"\n❌ Failed Tests: {', '.join(failed_tests)}")
        
        if passed_tests:
            self.log(f"\n✅ Passed Tests: {', '.join(passed_tests[:10])}...")
            
        self.log(f"\n🏗️  Created Resources:")
        for key, value in self.created_resources.items():
            if value:
                self.log(f"   {key}: {value}")

        return self.tests_passed == self.tests_run

def main():
    tester = GoldJewelleryAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())