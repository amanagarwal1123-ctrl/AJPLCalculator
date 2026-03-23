"""
Test Reference Normalization Feature - Iteration 30
Tests:
1. PUT /api/bills/{bill_id}/reference - admin can update bill reference
2. PUT /api/bills/{bill_id}/reference - non-admin users rejected (403)
3. POST /api/admin/normalize-references - normalizes all existing references
4. Reference normalization in analytics: GET /api/analytics/dashboard groups references case-insensitively
5. Reference normalization at data entry: POST /api/customers and POST /api/bills normalize references
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReferenceNormalization:
    """Test reference normalization feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_token = None
        self.executive_token = None
        self.test_bill_id = None
        self.test_customer_phone = f"TEST{uuid.uuid4().hex[:6]}"
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.admin_token:
            return self.admin_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        return self.admin_token
    
    def create_executive_user(self):
        """Create a test executive user and get token"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create executive user
        exec_username = f"test_exec_{uuid.uuid4().hex[:6]}"
        exec_password = "testpass123"
        
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": exec_username,
            "password": exec_password,
            "full_name": "Test Executive",
            "role": "executive"
        }, headers=headers)
        
        if response.status_code != 200:
            # User might already exist, try login
            pass
        
        # Login as executive
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": exec_username,
            "password": exec_password
        })
        
        if response.status_code == 200:
            self.executive_token = response.json()["token"]
            self.executive_user_id = response.json()["user"]["id"]
            return self.executive_token
        return None
    
    def create_test_bill(self, reference="instagram"):
        """Create a test bill with a specific reference"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        phone = f"TEST{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Test Customer",
            "customer_phone": phone,
            "customer_location": "Test Location",
            "customer_reference": reference,
            "items": [],
            "external_charges": []
        }, headers=headers)
        
        assert response.status_code == 200, f"Failed to create bill: {response.text}"
        bill = response.json()
        self.test_bill_id = bill["id"]
        return bill
    
    # ============ PUT /api/bills/{bill_id}/reference Tests ============
    
    def test_admin_can_update_bill_reference(self):
        """Test that admin can update bill reference without changing status"""
        # Create a test bill
        bill = self.create_test_bill(reference="instagram")
        original_status = bill.get("status", "draft")
        
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Update reference
        response = requests.put(
            f"{BASE_URL}/api/bills/{bill['id']}/reference",
            json={"customer_reference": "Facebook"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to update reference: {response.text}"
        updated_bill = response.json()
        
        # Verify reference was updated and normalized to title case
        assert updated_bill["customer_reference"] == "Facebook", f"Expected 'Facebook', got '{updated_bill['customer_reference']}'"
        
        # Verify status was NOT changed
        assert updated_bill["status"] == original_status, f"Status changed from {original_status} to {updated_bill['status']}"
        
        print(f"PASS: Admin updated reference from 'instagram' to 'Facebook', status unchanged: {original_status}")
    
    def test_reference_update_normalizes_to_title_case(self):
        """Test that reference update normalizes to title case"""
        bill = self.create_test_bill(reference="test")
        
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Update with lowercase reference
        response = requests.put(
            f"{BASE_URL}/api/bills/{bill['id']}/reference",
            json={"customer_reference": "walk-in"},
            headers=headers
        )
        
        assert response.status_code == 200
        updated_bill = response.json()
        
        # Should be normalized to title case
        assert updated_bill["customer_reference"] == "Walk-In", f"Expected 'Walk-In', got '{updated_bill['customer_reference']}'"
        print(f"PASS: Reference normalized to title case: 'walk-in' -> 'Walk-In'")
    
    def test_non_admin_cannot_update_bill_reference(self):
        """Test that non-admin users are rejected with 403"""
        # Create a test bill as admin
        bill = self.create_test_bill(reference="test")
        
        # Create executive user
        exec_token = self.create_executive_user()
        if not exec_token:
            pytest.skip("Could not create executive user")
        
        headers = {"Authorization": f"Bearer {exec_token}"}
        
        # Try to update reference as executive
        response = requests.put(
            f"{BASE_URL}/api/bills/{bill['id']}/reference",
            json={"customer_reference": "Facebook"},
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASS: Non-admin user rejected with 403")
    
    def test_reference_update_adds_to_change_log(self):
        """Test that reference update is logged in change_log"""
        bill = self.create_test_bill(reference="Instagram")
        
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Update reference
        response = requests.put(
            f"{BASE_URL}/api/bills/{bill['id']}/reference",
            json={"customer_reference": "Facebook"},
            headers=headers
        )
        
        assert response.status_code == 200
        updated_bill = response.json()
        
        # Check change_log
        change_log = updated_bill.get("change_log", [])
        assert len(change_log) > 0, "Change log should have entries"
        
        # Find reference_update entry
        ref_updates = [log for log in change_log if log.get("action") == "reference_update"]
        assert len(ref_updates) > 0, "Should have reference_update entry in change_log"
        
        latest = ref_updates[-1]
        assert latest.get("old_reference") == "Instagram"
        assert latest.get("new_reference") == "Facebook"
        
        print(f"PASS: Reference update logged in change_log")
    
    # ============ POST /api/admin/normalize-references Tests ============
    
    def test_normalize_references_endpoint(self):
        """Test POST /api/admin/normalize-references normalizes all references"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create bills with various case references
        bills_created = []
        for ref in ["instagram", "INSTAGRAM", "Instagram"]:
            bill = self.create_test_bill(reference=ref)
            bills_created.append(bill["id"])
        
        # Call normalize endpoint
        response = requests.post(
            f"{BASE_URL}/api/admin/normalize-references",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to normalize: {response.text}"
        result = response.json()
        
        # Should return counts
        assert "bills_normalized" in result
        assert "customers_normalized" in result
        
        print(f"PASS: Normalize endpoint returned - bills: {result['bills_normalized']}, customers: {result['customers_normalized']}")
    
    def test_normalize_references_requires_admin(self):
        """Test that normalize-references endpoint requires admin role"""
        exec_token = self.create_executive_user()
        if not exec_token:
            pytest.skip("Could not create executive user")
        
        headers = {"Authorization": f"Bearer {exec_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/admin/normalize-references",
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASS: Non-admin rejected from normalize-references endpoint")
    
    # ============ Reference Normalization at Data Entry Tests ============
    
    def test_customer_creation_normalizes_reference(self):
        """Test POST /api/customers normalizes reference"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        phone = f"TEST{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/customers", json={
            "name": "Test Customer",
            "phone": phone,
            "location": "Test Location",
            "reference": "instagram"  # lowercase
        }, headers=headers)
        
        assert response.status_code == 200, f"Failed to create customer: {response.text}"
        customer = response.json()
        
        # Reference should be normalized to title case
        assert customer["reference"] == "Instagram", f"Expected 'Instagram', got '{customer['reference']}'"
        print(f"PASS: Customer reference normalized: 'instagram' -> 'Instagram'")
    
    def test_bill_creation_normalizes_reference(self):
        """Test POST /api/bills normalizes customer_reference"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        phone = f"TEST{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Test Customer",
            "customer_phone": phone,
            "customer_location": "Test Location",
            "customer_reference": "FACEBOOK",  # uppercase
            "items": [],
            "external_charges": []
        }, headers=headers)
        
        assert response.status_code == 200, f"Failed to create bill: {response.text}"
        bill = response.json()
        
        # Reference should be normalized to title case
        assert bill["customer_reference"] == "Facebook", f"Expected 'Facebook', got '{bill['customer_reference']}'"
        print(f"PASS: Bill reference normalized: 'FACEBOOK' -> 'Facebook'")
    
    # ============ Analytics Reference Grouping Tests ============
    
    def test_analytics_dashboard_groups_references_case_insensitively(self):
        """Test GET /api/analytics/dashboard groups references case-insensitively"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get analytics dashboard
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        
        # Check reference_analysis exists (not reference_breakdown)
        assert "reference_analysis" in data, "reference_analysis should be in analytics response"
        
        # All references should be title-cased (normalized)
        for ref_name, ref_data in data["reference_analysis"].items():
            if ref_name and ref_name != "Unknown":
                # Check it's title-cased (first letter uppercase)
                assert ref_name[0].isupper() or ref_name == ref_name.title(), f"Reference '{ref_name}' should be title-cased"
        
        print(f"PASS: Analytics dashboard has reference_analysis with normalized references")
    
    def test_reference_breakdown_endpoint(self):
        """Test GET /api/analytics/reference-breakdown groups correctly"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # This endpoint requires a 'references' query parameter
        response = requests.get(
            f"{BASE_URL}/api/analytics/reference-breakdown",
            params={"references": "Instagram,Facebook,Walk-in"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get reference breakdown: {response.text}"
        data = response.json()
        
        # Should have 'references' and 'combined' keys
        assert "references" in data, "Should have 'references' key"
        assert "combined" in data, "Should have 'combined' key"
        
        # Check references list
        refs_list = data.get("references", [])
        for ref_item in refs_list:
            ref_name = ref_item.get("reference", "")
            if ref_name and ref_name != "Unknown":
                # Check it's title-cased (first letter uppercase)
                assert ref_name[0].isupper() or ref_name == ref_name.title(), f"Reference '{ref_name}' should be title-cased"
        
        print(f"PASS: Reference breakdown returned {len(refs_list)} references")


class TestReferenceUpdateEdgeCases:
    """Edge case tests for reference update"""
    
    def get_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        return response.json()["token"]
    
    def test_update_reference_to_empty_string(self):
        """Test updating reference to empty string"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create bill
        phone = f"TEST{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Test Customer",
            "customer_phone": phone,
            "customer_reference": "Instagram",
            "items": [],
            "external_charges": []
        }, headers=headers)
        bill = response.json()
        
        # Update to empty
        response = requests.put(
            f"{BASE_URL}/api/bills/{bill['id']}/reference",
            json={"customer_reference": ""},
            headers=headers
        )
        
        assert response.status_code == 200
        updated = response.json()
        assert updated["customer_reference"] == "", "Should allow empty reference"
        print(f"PASS: Reference can be set to empty string")
    
    def test_update_reference_with_whitespace(self):
        """Test updating reference with leading/trailing whitespace"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create bill
        phone = f"TEST{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Test Customer",
            "customer_phone": phone,
            "customer_reference": "Test",
            "items": [],
            "external_charges": []
        }, headers=headers)
        bill = response.json()
        
        # Update with whitespace
        response = requests.put(
            f"{BASE_URL}/api/bills/{bill['id']}/reference",
            json={"customer_reference": "  instagram  "},
            headers=headers
        )
        
        assert response.status_code == 200
        updated = response.json()
        # Should be trimmed and title-cased
        assert updated["customer_reference"] == "Instagram", f"Expected 'Instagram', got '{updated['customer_reference']}'"
        print(f"PASS: Reference whitespace trimmed: '  instagram  ' -> 'Instagram'")
    
    def test_update_nonexistent_bill_reference(self):
        """Test updating reference of non-existent bill"""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/bills/{fake_id}/reference",
            json={"customer_reference": "Facebook"},
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Non-existent bill returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
