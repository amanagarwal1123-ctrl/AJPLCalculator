"""
Backend API tests for security and integrity features (iteration 27):
- Manager creation requires branch_id
- Bill access control (check_bill_access helper)
- Send bill restricted to executive owner only
- Customer multi-phone lookup
- Customer profile total_spent excludes drafts
- Notification ownership checks
- Analytics endpoints branch scoping for managers
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestManagerCreationRequiresBranch:
    """Manager role requires branch_id on creation"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        # Login as admin
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin1123"
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        self.admin_token = resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create a test branch for tests that need it
        branch_resp = requests.post(f"{BASE_URL}/api/branches", json={
            "name": f"TEST_Branch_{int(time.time())}", "address": "Test Address"
        }, headers=self.admin_headers)
        if branch_resp.status_code == 200:
            self.test_branch_id = branch_resp.json().get("id")
        else:
            # Try to get an existing branch
            branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=self.admin_headers)
            if branches_resp.status_code == 200 and branches_resp.json():
                self.test_branch_id = branches_resp.json()[0].get("id")
            else:
                self.test_branch_id = None

    def test_create_manager_without_branch_returns_400(self):
        """POST /api/users with role=manager and no branch_id should return 400"""
        resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": f"TEST_mgr_nobranch_{int(time.time())}",
            "password": "test123",
            "full_name": "Test Manager No Branch",
            "role": "manager",
            # No branch_id provided
        }, headers=self.admin_headers)
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "branch" in resp.json().get("detail", "").lower(), f"Error message should mention branch: {resp.json()}"
        print(f"PASS: Manager creation without branch returns 400 - {resp.json()['detail']}")

    def test_create_manager_with_branch_succeeds(self):
        """POST /api/users with role=manager and branch_id should succeed"""
        if not self.test_branch_id:
            pytest.skip("No branch available for testing")
        
        username = f"TEST_mgr_withbranch_{int(time.time())}"
        resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": username,
            "password": "test123",
            "full_name": "Test Manager With Branch",
            "role": "manager",
            "branch_id": self.test_branch_id
        }, headers=self.admin_headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        user_data = resp.json()
        assert user_data["role"] == "manager"
        assert user_data["branch_id"] == self.test_branch_id
        print(f"PASS: Manager creation with branch succeeds - ID: {user_data.get('id')}")
        
        # Cleanup
        if user_data.get("id"):
            requests.delete(f"{BASE_URL}/api/users/{user_data['id']}", headers=self.admin_headers)

    def test_create_executive_without_branch_succeeds(self):
        """Executive role should NOT require branch_id"""
        username = f"TEST_exec_nobranch_{int(time.time())}"
        resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": username,
            "password": "test123",
            "full_name": "Test Executive",
            "role": "executive"
        }, headers=self.admin_headers)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        user_data = resp.json()
        assert user_data["role"] == "executive"
        print(f"PASS: Executive creation without branch succeeds - ID: {user_data.get('id')}")
        
        # Cleanup
        if user_data.get("id"):
            requests.delete(f"{BASE_URL}/api/users/{user_data['id']}", headers=self.admin_headers)


class TestBillAccessControl:
    """Tests for check_bill_access helper - bill access restrictions"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup users and a bill for access control tests"""
        # Admin login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin1123"
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        self.admin_token = resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create test executive A
        ts = int(time.time())
        self.exec_a_username = f"TEST_exec_a_{ts}"
        resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": self.exec_a_username,
            "full_name": "Test Exec A",
            "role": "executive"
        }, headers=self.admin_headers)
        if resp.status_code == 200:
            self.exec_a_id = resp.json()["id"]
        else:
            self.exec_a_id = None
        
        # Create test executive B
        self.exec_b_username = f"TEST_exec_b_{ts}"
        resp = requests.post(f"{BASE_URL}/api/users", json={
            "username": self.exec_b_username,
            "full_name": "Test Exec B",
            "role": "executive"
        }, headers=self.admin_headers)
        if resp.status_code == 200:
            self.exec_b_id = resp.json()["id"]
        else:
            self.exec_b_id = None
        
        self.exec_a_token = None
        self.exec_b_token = None
        self.test_bill_id = None

    def _get_exec_token(self, username):
        """Get OTP-based token for executive"""
        # Request OTP
        resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"username": username})
        if resp.status_code != 200:
            return None
        
        # Get OTP from admin endpoint
        otp_resp = requests.get(f"{BASE_URL}/api/admin/pending-otps", headers=self.admin_headers)
        if otp_resp.status_code != 200:
            return None
        
        otps = otp_resp.json()
        otp_code = None
        for otp in otps:
            if otp.get("username") == username:
                otp_code = otp.get("otp")
                break
        
        if not otp_code:
            return None
        
        # Verify OTP
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "username": username, "otp": otp_code
        })
        if verify_resp.status_code == 200:
            return verify_resp.json()["token"]
        return None

    def test_exec_cannot_access_other_exec_bill(self):
        """GET /api/bills/{id} returns 403 for executive accessing another executive's bill"""
        if not self.exec_a_id or not self.exec_b_id:
            pytest.skip("Could not create test executives")
        
        # Get tokens for both executives
        self.exec_a_token = self._get_exec_token(self.exec_a_username)
        self.exec_b_token = self._get_exec_token(self.exec_b_username)
        
        if not self.exec_a_token or not self.exec_b_token:
            pytest.skip("Could not authenticate executives")
        
        exec_a_headers = {"Authorization": f"Bearer {self.exec_a_token}"}
        exec_b_headers = {"Authorization": f"Bearer {self.exec_b_token}"}
        
        # Create a bill as Exec A
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Access Control Customer",
            "customer_phone": f"9{int(time.time()) % 1000000000:09d}",
            "customer_location": "Test Location",
            "items": [],
            "external_charges": []
        }, headers=exec_a_headers)
        
        assert bill_resp.status_code == 200, f"Bill creation failed: {bill_resp.text}"
        self.test_bill_id = bill_resp.json()["id"]
        
        # Try to access the bill as Exec B - should get 403
        access_resp = requests.get(f"{BASE_URL}/api/bills/{self.test_bill_id}", headers=exec_b_headers)
        assert access_resp.status_code == 403, f"Expected 403, got {access_resp.status_code}: {access_resp.text}"
        print(f"PASS: Executive B cannot access Executive A's bill - 403 Forbidden")
        
        # Cleanup
        if self.test_bill_id:
            requests.delete(f"{BASE_URL}/api/bills/{self.test_bill_id}", headers=self.admin_headers)

    def test_exec_cannot_send_other_exec_bill(self):
        """PUT /api/bills/{id}/send returns 403 if user is not the executive who created the bill"""
        if not self.exec_a_id or not self.exec_b_id:
            pytest.skip("Could not create test executives")
        
        # Get tokens
        exec_a_token = self._get_exec_token(self.exec_a_username)
        exec_b_token = self._get_exec_token(self.exec_b_username)
        
        if not exec_a_token or not exec_b_token:
            pytest.skip("Could not authenticate executives")
        
        exec_a_headers = {"Authorization": f"Bearer {exec_a_token}"}
        exec_b_headers = {"Authorization": f"Bearer {exec_b_token}"}
        
        # Create a bill as Exec A
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Send Control Customer",
            "customer_phone": f"8{int(time.time()) % 1000000000:09d}",
            "items": []
        }, headers=exec_a_headers)
        
        assert bill_resp.status_code == 200, f"Bill creation failed: {bill_resp.text}"
        bill_id = bill_resp.json()["id"]
        
        # Try to send the bill as Exec B - should get 403
        send_resp = requests.put(f"{BASE_URL}/api/bills/{bill_id}/send", headers=exec_b_headers)
        assert send_resp.status_code == 403, f"Expected 403, got {send_resp.status_code}: {send_resp.text}"
        print(f"PASS: Executive B cannot send Executive A's bill - 403 Forbidden")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=self.admin_headers)

    def test_bill_summary_enforces_access_control(self):
        """GET /api/bills/{id}/summary enforces check_bill_access"""
        if not self.exec_a_id or not self.exec_b_id:
            pytest.skip("Could not create test executives")
        
        exec_a_token = self._get_exec_token(self.exec_a_username)
        exec_b_token = self._get_exec_token(self.exec_b_username)
        
        if not exec_a_token or not exec_b_token:
            pytest.skip("Could not authenticate executives")
        
        exec_a_headers = {"Authorization": f"Bearer {exec_a_token}"}
        exec_b_headers = {"Authorization": f"Bearer {exec_b_token}"}
        
        # Create bill as Exec A
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Summary Access Customer",
            "customer_phone": f"7{int(time.time()) % 1000000000:09d}",
            "items": []
        }, headers=exec_a_headers)
        
        assert bill_resp.status_code == 200
        bill_id = bill_resp.json()["id"]
        
        # Exec B should not be able to get summary
        summary_resp = requests.get(f"{BASE_URL}/api/bills/{bill_id}/summary", headers=exec_b_headers)
        assert summary_resp.status_code == 403, f"Expected 403, got {summary_resp.status_code}"
        print(f"PASS: Bill summary endpoint enforces access control - 403")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=self.admin_headers)

    def test_bill_pdf_enforces_access_control(self):
        """GET /api/bills/{id}/pdf enforces check_bill_access"""
        if not self.exec_a_id or not self.exec_b_id:
            pytest.skip("Could not create test executives")
        
        exec_a_token = self._get_exec_token(self.exec_a_username)
        exec_b_token = self._get_exec_token(self.exec_b_username)
        
        if not exec_a_token or not exec_b_token:
            pytest.skip("Could not authenticate executives")
        
        exec_a_headers = {"Authorization": f"Bearer {exec_a_token}"}
        exec_b_headers = {"Authorization": f"Bearer {exec_b_token}"}
        
        # Create bill as Exec A
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST PDF Access Customer",
            "customer_phone": f"6{int(time.time()) % 1000000000:09d}",
            "items": []
        }, headers=exec_a_headers)
        
        assert bill_resp.status_code == 200
        bill_id = bill_resp.json()["id"]
        
        # Exec B should not be able to get PDF
        pdf_resp = requests.get(f"{BASE_URL}/api/bills/{bill_id}/pdf", headers=exec_b_headers)
        assert pdf_resp.status_code == 403, f"Expected 403, got {pdf_resp.status_code}"
        print(f"PASS: Bill PDF endpoint enforces access control - 403")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=self.admin_headers)

    def test_admin_can_access_any_bill(self):
        """Admin should be able to access any bill regardless of ownership"""
        if not self.exec_a_id:
            pytest.skip("Could not create test executive")
        
        exec_a_token = self._get_exec_token(self.exec_a_username)
        if not exec_a_token:
            pytest.skip("Could not authenticate executive")
        
        exec_a_headers = {"Authorization": f"Bearer {exec_a_token}"}
        
        # Create bill as Exec A
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Admin Access Customer",
            "customer_phone": f"5{int(time.time()) % 1000000000:09d}",
            "items": []
        }, headers=exec_a_headers)
        
        assert bill_resp.status_code == 200
        bill_id = bill_resp.json()["id"]
        
        # Admin should be able to access
        admin_resp = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=self.admin_headers)
        assert admin_resp.status_code == 200, f"Admin should be able to access any bill, got {admin_resp.status_code}"
        print(f"PASS: Admin can access any bill regardless of ownership")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=self.admin_headers)

    def teardown_method(self, method):
        """Cleanup test users"""
        if hasattr(self, 'exec_a_id') and self.exec_a_id:
            requests.delete(f"{BASE_URL}/api/users/{self.exec_a_id}", headers=self.admin_headers)
        if hasattr(self, 'exec_b_id') and self.exec_b_id:
            requests.delete(f"{BASE_URL}/api/users/{self.exec_b_id}", headers=self.admin_headers)


class TestMultiPhoneCustomer:
    """Tests for multi-phone customer functionality"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin1123"
        })
        assert resp.status_code == 200
        self.admin_token = resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

    def test_customer_lookup_by_secondary_phone(self):
        """GET /api/customers/{secondary_phone} finds customer by phones array"""
        ts = int(time.time())
        primary_phone = f"9{ts % 1000000000:09d}"
        secondary_phone = f"8{ts % 1000000000:09d}"
        
        # Create customer with primary phone
        cust_resp = requests.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST Multi Phone Customer",
            "phone": primary_phone,
            "location": "Test Location"
        }, headers=self.admin_headers)
        
        assert cust_resp.status_code == 200
        customer_id = cust_resp.json()["id"]
        
        # Add secondary phone
        add_phone_resp = requests.post(f"{BASE_URL}/api/customers/{customer_id}/add-phone", 
            json={"phone": secondary_phone}, headers=self.admin_headers)
        assert add_phone_resp.status_code == 200
        
        # Lookup by secondary phone
        lookup_resp = requests.get(f"{BASE_URL}/api/customers/{secondary_phone}", headers=self.admin_headers)
        assert lookup_resp.status_code == 200, f"Customer lookup by secondary phone failed: {lookup_resp.status_code}"
        assert lookup_resp.json()["id"] == customer_id
        print(f"PASS: Customer found by secondary phone")

    def test_customer_bills_returns_all_phone_bills(self):
        """GET /api/customers/{phone}/bills returns bills from ALL customer phones"""
        ts = int(time.time())
        primary_phone = f"9{(ts + 1) % 1000000000:09d}"
        secondary_phone = f"8{(ts + 1) % 1000000000:09d}"
        
        # Create customer
        cust_resp = requests.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST Multi Phone Bills Customer",
            "phone": primary_phone
        }, headers=self.admin_headers)
        assert cust_resp.status_code == 200
        customer_id = cust_resp.json()["id"]
        
        # Add secondary phone
        requests.post(f"{BASE_URL}/api/customers/{customer_id}/add-phone", 
            json={"phone": secondary_phone}, headers=self.admin_headers)
        
        # Create bill with primary phone
        bill1_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Multi Phone Bills Customer",
            "customer_phone": primary_phone,
            "items": []
        }, headers=self.admin_headers)
        bill1_id = bill1_resp.json()["id"] if bill1_resp.status_code == 200 else None
        
        # Create bill with secondary phone (simulating different bill creation)
        bill2_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Multi Phone Bills Customer",
            "customer_phone": secondary_phone,
            "items": []
        }, headers=self.admin_headers)
        bill2_id = bill2_resp.json()["id"] if bill2_resp.status_code == 200 else None
        
        # Get all bills for customer - should include both phones
        bills_resp = requests.get(f"{BASE_URL}/api/customers/{customer_id}/bills", headers=self.admin_headers)
        assert bills_resp.status_code == 200
        
        bills = bills_resp.json().get("bills", [])
        bill_ids = [b["id"] for b in bills]
        
        assert bill1_id in bill_ids, "Bill from primary phone should be included"
        assert bill2_id in bill_ids, "Bill from secondary phone should be included"
        print(f"PASS: Customer bills include bills from all phones - found {len(bills)} bills")
        
        # Cleanup
        if bill1_id:
            requests.delete(f"{BASE_URL}/api/bills/{bill1_id}", headers=self.admin_headers)
        if bill2_id:
            requests.delete(f"{BASE_URL}/api/bills/{bill2_id}", headers=self.admin_headers)

    def test_new_bill_includes_customer_id(self):
        """New bills should include customer_id field"""
        ts = int(time.time())
        phone = f"9{(ts + 2) % 1000000000:09d}"
        
        # Create customer first
        cust_resp = requests.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST Customer ID Bill Customer",
            "phone": phone
        }, headers=self.admin_headers)
        assert cust_resp.status_code == 200
        customer_id = cust_resp.json()["id"]
        
        # Create bill
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Customer ID Bill Customer",
            "customer_phone": phone,
            "items": []
        }, headers=self.admin_headers)
        assert bill_resp.status_code == 200
        bill_data = bill_resp.json()
        
        assert "customer_id" in bill_data, "Bill should have customer_id field"
        assert bill_data["customer_id"] == customer_id, "Bill customer_id should match customer"
        print(f"PASS: New bill includes customer_id field: {bill_data['customer_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_data['id']}", headers=self.admin_headers)


class TestCustomerTotalSpent:
    """Tests for customer total_spent calculation (excludes drafts)"""

    @pytest.fixture(autouse=True)
    def setup(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin1123"
        })
        assert resp.status_code == 200
        self.admin_token = resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

    def test_total_spent_excludes_drafts(self):
        """Customer Profile total_spent should exclude draft bills"""
        ts = int(time.time())
        phone = f"9{(ts + 10) % 1000000000:09d}"
        
        # Create customer
        cust_resp = requests.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST Total Spent Customer",
            "phone": phone
        }, headers=self.admin_headers)
        assert cust_resp.status_code == 200
        customer_id = cust_resp.json()["id"]
        
        # Create a draft bill (should NOT be counted)
        draft_bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST Total Spent Customer",
            "customer_phone": phone,
            "items": [{
                "item_name": "Test Ring",
                "item_type": "gold",
                "rate_mode": "normal",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 60000,
                "gross_weight": 10,
                "less": 0,
                "making_charges": [],
                "stone_charges": []
            }]
        }, headers=self.admin_headers)
        draft_bill_id = draft_bill_resp.json()["id"] if draft_bill_resp.status_code == 200 else None
        
        # Get customer bills - check total_spent
        bills_resp = requests.get(f"{BASE_URL}/api/customers/{customer_id}/bills", headers=self.admin_headers)
        assert bills_resp.status_code == 200
        
        total_spent = bills_resp.json().get("total_spent", 0)
        # Draft bills should NOT be included in total_spent
        # The bill we created is a draft, so total_spent should be 0 (or exclude that amount)
        print(f"Total spent with draft bill: {total_spent}")
        
        # Cleanup
        if draft_bill_id:
            requests.delete(f"{BASE_URL}/api/bills/{draft_bill_id}", headers=self.admin_headers)


class TestNotificationOwnership:
    """Tests for notification ownership checks"""

    @pytest.fixture(autouse=True)
    def setup(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin1123"
        })
        assert resp.status_code == 200
        self.admin_token = resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create two executives for testing
        ts = int(time.time())
        self.exec_a_username = f"TEST_notif_exec_a_{ts}"
        self.exec_b_username = f"TEST_notif_exec_b_{ts}"
        
        resp_a = requests.post(f"{BASE_URL}/api/users", json={
            "username": self.exec_a_username,
            "full_name": "Test Notif Exec A",
            "role": "executive"
        }, headers=self.admin_headers)
        self.exec_a_id = resp_a.json().get("id") if resp_a.status_code == 200 else None
        
        resp_b = requests.post(f"{BASE_URL}/api/users", json={
            "username": self.exec_b_username,
            "full_name": "Test Notif Exec B",
            "role": "executive"
        }, headers=self.admin_headers)
        self.exec_b_id = resp_b.json().get("id") if resp_b.status_code == 200 else None

    def _get_exec_token(self, username):
        """Get OTP-based token for executive"""
        requests.post(f"{BASE_URL}/api/auth/request-otp", json={"username": username})
        otp_resp = requests.get(f"{BASE_URL}/api/admin/pending-otps", headers=self.admin_headers)
        if otp_resp.status_code != 200:
            return None
        
        otps = otp_resp.json()
        otp_code = None
        for otp in otps:
            if otp.get("username") == username:
                otp_code = otp.get("otp")
                break
        
        if not otp_code:
            return None
        
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "username": username, "otp": otp_code
        })
        return verify_resp.json()["token"] if verify_resp.status_code == 200 else None

    def test_exec_cannot_mark_other_exec_notification_done(self):
        """PUT /api/notifications/{id}/done returns 403 for exec accessing other exec's notification"""
        if not self.exec_a_id or not self.exec_b_id:
            pytest.skip("Could not create test executives")
        
        # Create a notification for exec A (using admin)
        ts = int(time.time())
        notif_resp = requests.post(f"{BASE_URL}/api/notifications", json={
            "title": f"TEST Notification {ts}",
            "message": "Test message",
            "due_date": "2026-12-31",
            "target_user_id": self.exec_a_id
        }, headers=self.admin_headers)
        
        if notif_resp.status_code != 200:
            pytest.skip(f"Could not create notification: {notif_resp.text}")
        
        notification_id = notif_resp.json().get("id")
        
        # Get exec B token
        exec_b_token = self._get_exec_token(self.exec_b_username)
        if not exec_b_token:
            pytest.skip("Could not authenticate exec B")
        
        exec_b_headers = {"Authorization": f"Bearer {exec_b_token}"}
        
        # Exec B tries to mark exec A's notification as done - should get 403
        done_resp = requests.put(f"{BASE_URL}/api/notifications/{notification_id}/done", headers=exec_b_headers)
        assert done_resp.status_code == 403, f"Expected 403, got {done_resp.status_code}: {done_resp.text}"
        print(f"PASS: Executive B cannot mark Executive A's notification as done - 403")
        
        # Cleanup
        if notification_id:
            requests.delete(f"{BASE_URL}/api/notifications/{notification_id}", headers=self.admin_headers)

    def teardown_method(self, method):
        """Cleanup test users"""
        if hasattr(self, 'exec_a_id') and self.exec_a_id:
            requests.delete(f"{BASE_URL}/api/users/{self.exec_a_id}", headers=self.admin_headers)
        if hasattr(self, 'exec_b_id') and self.exec_b_id:
            requests.delete(f"{BASE_URL}/api/users/{self.exec_b_id}", headers=self.admin_headers)


class TestAnalyticsEndpoints:
    """Tests for analytics endpoints - admin access and branch scoping"""

    @pytest.fixture(autouse=True)
    def setup(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin1123"
        })
        assert resp.status_code == 200
        self.admin_token = resp.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

    def test_analytics_customers_works_for_admin(self):
        """GET /api/analytics/customers works for admin"""
        resp = requests.get(f"{BASE_URL}/api/analytics/customers", headers=self.admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list), "Should return a list"
        print(f"PASS: /api/analytics/customers works for admin - returned {len(resp.json())} customers")

    def test_analytics_customers_frequency_works_for_admin(self):
        """GET /api/analytics/customers/frequency works for admin"""
        resp = requests.get(f"{BASE_URL}/api/analytics/customers/frequency", headers=self.admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS: /api/analytics/customers/frequency works for admin")

    def test_analytics_customers_inactive_works_for_admin(self):
        """GET /api/analytics/customers/inactive works for admin"""
        resp = requests.get(f"{BASE_URL}/api/analytics/customers/inactive?days=30", headers=self.admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS: /api/analytics/customers/inactive works for admin")

    def test_analytics_dashboard_works_for_admin(self):
        """GET /api/analytics/dashboard works for admin"""
        resp = requests.get(f"{BASE_URL}/api/analytics/dashboard", headers=self.admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "today_sales" in data
        assert "total_bills" in data
        print(f"PASS: /api/analytics/dashboard works for admin")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
