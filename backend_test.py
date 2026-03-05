import requests
import json
import sys
from datetime import datetime

class AJPLTestRunner:
    def __init__(self, base_url="https://customer-breakdown.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint,
                    'response': response.text[:200] if hasattr(response, 'text') else str(response)
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200] if hasattr(response, 'text') else str(response)}")
                return False, {}

        except Exception as e:
            self.failed_tests.append({
                'name': name,
                'expected': expected_status,
                'actual': 'Exception',
                'endpoint': endpoint,
                'response': str(e)
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test OTP-based authentication flow"""
        print("\n🔐 Testing OTP Authentication Flow...")
        
        # Step 1: Request OTP for admin user
        success, response = self.run_test(
            "Request OTP for Admin",
            "POST",
            "/auth/request-otp",
            200,
            data={"username": "admin"}
        )
        
        if not success:
            print("❌ Failed to request OTP, falling back to legacy login")
            return self.test_legacy_login()
        
        print("✅ OTP requested successfully")
        
        # Step 2: Get the OTP from admin endpoint
        # First try legacy login to get admin token
        legacy_success, legacy_response = self.run_test(
            "Legacy Admin Login (to get pending OTPs)",
            "POST",
            "/auth/login",
            200,
            data={"username": "admin", "password": "admin1123"}
        )
        
        if not legacy_success:
            print("❌ Cannot get admin token to fetch OTP")
            return False
        
        admin_token = legacy_response.get('token')
        if not admin_token:
            print("❌ No admin token received")
            return False
        
        # Step 3: Get pending OTPs using admin token
        success, otps = self.run_test(
            "Get Pending OTPs",
            "GET",
            "/admin/pending-otps",
            200,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        if not success or not otps:
            print("❌ Failed to get pending OTPs")
            return False
        
        # Find OTP for admin user
        admin_otp = None
        for otp_record in otps:
            if otp_record.get('username') == 'admin':
                admin_otp = otp_record.get('otp')
                break
        
        if not admin_otp:
            print("❌ No OTP found for admin user")
            return False
        
        print(f"✅ Found OTP for admin: {admin_otp}")
        
        # Step 4: Verify OTP
        success, response = self.run_test(
            "Verify OTP for Admin",
            "POST",
            "/auth/verify-otp",
            200,
            data={"username": "admin", "otp": admin_otp}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"✅ OTP verification successful! Token obtained: {self.token[:20]}...")
            return True
        else:
            print("❌ OTP verification failed")
            return False
    
    def test_legacy_login(self):
        """Fallback to legacy password login"""
        print("\n🔐 Testing Legacy Authentication...")
        success, response = self.run_test(
            "Legacy Admin Login",
            "POST",
            "/auth/login",
            200,
            data={"username": "admin", "password": "admin1123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"✅ Legacy token obtained: {self.token[:20]}...")
            return True
        return False

    def test_customer_endpoints(self):
        """Test customer-related endpoints"""
        print("\n👥 Testing Customer Endpoints...")
        
        # Get customers list
        success, customers = self.run_test(
            "Get Customers List",
            "GET",
            "/analytics/customers",
            200
        )
        
        customer_id = None
        if success and customers and len(customers) > 0:
            customer_id = customers[0].get('id') or customers[0].get('phone')
            print(f"   Using customer ID: {customer_id}")
            
            # Get customer bills
            if customer_id:
                self.run_test(
                    "Get Customer Bills",
                    "GET",
                    f"/customers/{customer_id}/bills",
                    200
                )
                
                self.run_test(
                    "Get Customer Detail",
                    "GET",
                    f"/customers/{customer_id}",
                    200
                )
        else:
            print("⚠️  No customers found to test customer endpoints")

    def test_bills_endpoints(self):
        """Test bills-related endpoints"""
        print("\n📄 Testing Bills Endpoints...")
        
        # Get all bills
        success, bills = self.run_test(
            "Get All Bills",
            "GET",
            "/bills",
            200
        )
        
        bill_id = None
        if success and bills and len(bills) > 0:
            bill_id = bills[0].get('id')
            print(f"   Using bill ID: {bill_id}")
            
            # Get bill detail
            if bill_id:
                self.run_test(
                    "Get Bill Detail",
                    "GET",
                    f"/bills/{bill_id}",
                    200
                )
                
                # Get bill summary (new endpoint)
                self.run_test(
                    "Get Bill Summary",
                    "GET",
                    f"/bills/{bill_id}/summary",
                    200
                )
        else:
            print("⚠️  No bills found to test bill endpoints")

    def test_item_history_endpoints(self):
        """Test item history endpoints"""
        print("\n🏷️  Testing Item History Endpoints...")
        
        # Get item names
        success, items = self.run_test(
            "Get Item Names",
            "GET",
            "/item-names",
            200
        )
        
        if success and items and len(items) > 0:
            # Test with first item
            item_name = items[0].get('name')
            if item_name:
                print(f"   Testing with item: {item_name}")
                self.run_test(
                    "Get Item Sales History",
                    "GET",
                    f"/item-names/{item_name}/sales",
                    200
                )
        else:
            # Try with common item names
            test_items = ['Necklace', 'Ring', 'Earrings', 'Bracelet']
            for item_name in test_items:
                success, _ = self.run_test(
                    f"Get {item_name} Sales History",
                    "GET",
                    f"/item-names/{item_name}/sales",
                    200
                )
                if success:
                    break

    def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        print("\n📊 Testing Analytics Endpoints...")
        
        self.run_test(
            "Get Dashboard Analytics",
            "GET",
            "/analytics/dashboard",
            200
        )
        
        self.run_test(
            "Get Customer Analytics",
            "GET",
            "/analytics/customers",
            200
        )

    def test_basic_crud_endpoints(self):
        """Test basic CRUD endpoints"""
        print("\n⚙️ Testing Basic CRUD Endpoints...")
        
        # Test rates
        self.run_test("Get Rates", "GET", "/rates", 200)
        
        # Test purities
        self.run_test("Get Purities", "GET", "/purities", 200)
        
        # Test branches
        self.run_test("Get Branches", "GET", "/branches", 200)
        
        # Test users
        self.run_test("Get Users", "GET", "/users", 200)

    def test_otp_endpoints(self):
        """Test OTP-specific endpoints"""
        print("\n🔑 Testing OTP Endpoints...")
        
        # Test requesting OTP for non-existent user
        self.run_test(
            "Request OTP for Non-existent User",
            "POST",
            "/auth/request-otp",
            404,
            data={"username": "nonexistent"}
        )
        
        # Test verifying invalid OTP
        self.run_test(
            "Verify Invalid OTP",
            "POST",
            "/auth/verify-otp",
            401,
            data={"username": "admin", "otp": "0000"}
        )
        
        # Test admin pending OTPs endpoint without auth
        self.run_test(
            "Get Pending OTPs Without Auth",
            "GET",
            "/admin/pending-otps",
            401
        )

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting AJPL Calculator Backend API Tests...")
        print(f"   Base URL: {self.base_url}")
        print(f"   API URL: {self.api_url}")
        
        # Authentication first
        if not self.test_authentication():
            print("❌ Authentication failed, stopping tests")
            return False
        
        # Test OTP-specific endpoints
        self.test_otp_endpoints()
        
        # Test all endpoint categories
        self.test_basic_crud_endpoints()
        self.test_customer_endpoints()
        self.test_bills_endpoints()
        self.test_item_history_endpoints()
        self.test_analytics_endpoints()
        
        # Print final results
        print(f"\n📊 Test Results:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {len(self.failed_tests)}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   • {test['name']}: Expected {test['expected']}, got {test['actual']}")
                if 'endpoint' in test:
                    print(f"     Endpoint: {test['endpoint']}")
                if 'response' in test:
                    print(f"     Response: {test['response']}")
        
        return len(self.failed_tests) == 0

if __name__ == "__main__":
    tester = AJPLTestRunner()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)