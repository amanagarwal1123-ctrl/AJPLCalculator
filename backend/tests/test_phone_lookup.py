"""
Test Suite: Phone-First Customer Entry Flow
Tests for:
- Phone lookup endpoint (primary + phones array search)
- Add phone to customer endpoint
- Bill creation with narration field
- Multi-phone customer lookup
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# --- Fixtures ---

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token via password login."""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["token"]

@pytest.fixture(scope="module")
def exec_token(admin_token):
    """Get exec1 auth token via OTP flow."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Request OTP for exec1
    res = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"username": "exec1"})
    if res.status_code == 404:
        pytest.skip("exec1 user not found - using admin token instead")
        return admin_token
    assert res.status_code == 200, f"OTP request failed: {res.text}"
    
    # Get OTP from pending-otps admin endpoint
    time.sleep(0.5)
    res = requests.get(f"{BASE_URL}/api/admin/pending-otps", headers=headers)
    assert res.status_code == 200, f"Get pending OTPs failed: {res.text}"
    
    otps = res.json()
    exec_otp = next((o for o in otps if o.get("username") == "exec1"), None)
    if not exec_otp:
        pytest.skip("No pending OTP for exec1")
        return admin_token
    
    # Verify OTP
    res = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
        "username": "exec1",
        "otp": exec_otp["otp"]
    })
    assert res.status_code == 200, f"OTP verification failed: {res.text}"
    return res.json()["token"]

@pytest.fixture(scope="module")
def test_customer_phone():
    """Generate unique phone number for test customer."""
    return f"9{uuid.uuid4().hex[:9]}"

@pytest.fixture(scope="module")
def created_customer(admin_token, test_customer_phone):
    """Create test customer with known phone."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = requests.post(f"{BASE_URL}/api/customers", json={
        "name": "TEST_PhoneLookup Customer",
        "phone": test_customer_phone,
        "location": "Test City",
        "reference": "TEST"
    }, headers=headers)
    assert res.status_code == 200, f"Customer creation failed: {res.text}"
    return res.json()


# --- Phone Lookup Tests ---

class TestPhoneLookup:
    """Tests for GET /api/customers/lookup-phone endpoint."""
    
    def test_lookup_returns_found_for_existing_primary_phone(self, admin_token, created_customer, test_customer_phone):
        """Lookup by primary phone should return found=True with customer data."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = requests.get(f"{BASE_URL}/api/customers/lookup-phone?phone={test_customer_phone}", headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is True, "Should find customer by primary phone"
        assert "customer" in data
        assert data["customer"]["phone"] == test_customer_phone
        assert data["customer"]["name"] == "TEST_PhoneLookup Customer"
        print(f"✓ Found customer by primary phone: {data['customer']['name']}")
    
    def test_lookup_returns_not_found_for_unknown_phone(self, admin_token):
        """Lookup by unknown phone should return found=False."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        unknown_phone = "1234567890"  # Unlikely to exist
        res = requests.get(f"{BASE_URL}/api/customers/lookup-phone?phone={unknown_phone}", headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is False, "Should not find customer with unknown phone"
        print(f"✓ Unknown phone correctly returns found=False")
    
    def test_lookup_returns_not_found_for_invalid_phone(self, admin_token):
        """Lookup with invalid phone (less than 10 digits) should return found=False."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = requests.get(f"{BASE_URL}/api/customers/lookup-phone?phone=12345", headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is False
        print(f"✓ Invalid phone (5 digits) correctly returns found=False")
    
    def test_lookup_includes_all_phones_array(self, admin_token, created_customer, test_customer_phone):
        """Lookup should return all_phones array with primary and additional phones."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        res = requests.get(f"{BASE_URL}/api/customers/lookup-phone?phone={test_customer_phone}", headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is True
        assert "all_phones" in data["customer"]
        assert test_customer_phone in data["customer"]["all_phones"]
        print(f"✓ all_phones array included in response: {data['customer']['all_phones']}")


# --- Add Phone Tests ---

class TestAddPhone:
    """Tests for POST /api/customers/{id}/add-phone endpoint."""
    
    def test_add_phone_validates_10_digits(self, admin_token, created_customer):
        """Adding phone with less/more than 10 digits should fail."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        cust_id = created_customer["id"]
        
        # Test invalid phone (9 digits)
        res = requests.post(f"{BASE_URL}/api/customers/{cust_id}/add-phone", 
                          json={"phone": "123456789"}, headers=headers)
        assert res.status_code == 400
        assert "10-digit" in res.json().get("detail", "")
        print(f"✓ 9-digit phone rejected with 400")
        
        # Test invalid phone (11 digits)
        res = requests.post(f"{BASE_URL}/api/customers/{cust_id}/add-phone", 
                          json={"phone": "12345678901"}, headers=headers)
        assert res.status_code == 400
        print(f"✓ 11-digit phone rejected with 400")
    
    def test_add_phone_success(self, admin_token, created_customer):
        """Successfully add a new phone to customer."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        cust_id = created_customer["id"]
        new_phone = f"8{uuid.uuid4().hex[:9]}"
        
        res = requests.post(f"{BASE_URL}/api/customers/{cust_id}/add-phone", 
                          json={"phone": new_phone}, headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "added"
        print(f"✓ New phone {new_phone} added successfully")
        
        # Verify via lookup
        res = requests.get(f"{BASE_URL}/api/customers/lookup-phone?phone={new_phone}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is True
        assert data["customer"]["id"] == cust_id
        print(f"✓ Customer found via new phone in phones array")
    
    def test_add_phone_prevents_duplicate_primary(self, admin_token, created_customer, test_customer_phone):
        """Adding the primary phone number should return already_exists."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        cust_id = created_customer["id"]
        
        res = requests.post(f"{BASE_URL}/api/customers/{cust_id}/add-phone", 
                          json={"phone": test_customer_phone}, headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "already_exists"
        assert "primary" in data.get("message", "").lower()
        print(f"✓ Duplicate primary phone correctly returns already_exists")


# --- Bill Creation with Narration Tests ---

class TestBillWithNarration:
    """Tests for bill creation with narration field."""
    
    def test_create_bill_with_narration(self, exec_token):
        """Create bill with narration field - verify it's stored."""
        headers = {"Authorization": f"Bearer {exec_token}"}
        test_phone = f"7{uuid.uuid4().hex[:9]}"
        test_narration = "Bought for daughter's wedding"
        
        res = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST_Narration Customer",
            "customer_phone": test_phone,
            "customer_location": "Test Location",
            "customer_reference": "Test Reference",
            "salesperson_name": "Test Sales",
            "narration": test_narration,
            "items": [],
            "external_charges": []
        }, headers=headers)
        
        assert res.status_code == 200, f"Bill creation failed: {res.text}"
        bill = res.json()
        assert "id" in bill
        assert bill["narration"] == test_narration
        print(f"✓ Bill created with narration: '{test_narration}'")
        
        # Verify by fetching the bill
        bill_id = bill["id"]
        res = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=headers)
        assert res.status_code == 200
        fetched = res.json()
        assert fetched["narration"] == test_narration
        print(f"✓ Narration persisted and retrieved: '{fetched['narration']}'")
    
    def test_create_bill_without_narration(self, exec_token):
        """Create bill without narration - verify it's empty string."""
        headers = {"Authorization": f"Bearer {exec_token}"}
        test_phone = f"6{uuid.uuid4().hex[:9]}"
        
        res = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "TEST_NoNarration Customer",
            "customer_phone": test_phone,
            "customer_location": "Test Location",
            "customer_reference": "Walk-in",
            "salesperson_name": "Test Sales",
            "items": [],
            "external_charges": []
        }, headers=headers)
        
        assert res.status_code == 200, f"Bill creation failed: {res.text}"
        bill = res.json()
        assert bill.get("narration", "") == ""
        print(f"✓ Bill created without narration (empty string)")


# --- Bill Creation Customer Lookup Tests ---

class TestBillCreationCustomerLookup:
    """Tests for bill creation multi-phone customer lookup."""
    
    def test_bill_finds_customer_by_phones_array(self, admin_token, exec_token, created_customer):
        """Bill creation should find customer by phone in phones array."""
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_exec = {"Authorization": f"Bearer {exec_token}"}
        cust_id = created_customer["id"]
        
        # Add a new phone to customer
        secondary_phone = f"5{uuid.uuid4().hex[:9]}"
        res = requests.post(f"{BASE_URL}/api/customers/{cust_id}/add-phone",
                          json={"phone": secondary_phone}, headers=headers_admin)
        assert res.status_code == 200
        
        # Create bill using secondary phone
        res = requests.post(f"{BASE_URL}/api/bills", json={
            "customer_name": created_customer["name"],
            "customer_phone": secondary_phone,  # Use secondary phone
            "customer_location": created_customer.get("location", ""),
            "customer_reference": "Repeat Customer",
            "salesperson_name": "Test Sales",
            "narration": "",
            "items": [],
            "external_charges": []
        }, headers=headers_exec)
        
        assert res.status_code == 200, f"Bill creation failed: {res.text}"
        bill = res.json()
        print(f"✓ Bill created using secondary phone from phones array")
        
        # Verify customer was NOT duplicated - check customer count
        res = requests.get(f"{BASE_URL}/api/customers/lookup-phone?phone={secondary_phone}", headers=headers_admin)
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is True
        assert data["customer"]["id"] == cust_id, "Should reference existing customer, not create new"
        print(f"✓ Existing customer used (not duplicated)")


# --- Customer Search Tests ---

class TestCustomerSearch:
    """Tests for customer search endpoint searching phones array."""
    
    def test_search_finds_by_partial_phone(self, admin_token, created_customer, test_customer_phone):
        """Search should find customer by partial phone match."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        partial = test_customer_phone[:6]  # First 6 digits
        
        res = requests.get(f"{BASE_URL}/api/customers/search?phone={partial}", headers=headers)
        assert res.status_code == 200
        customers = res.json()
        
        found = any(c["phone"] == test_customer_phone for c in customers)
        assert found, f"Customer with phone {test_customer_phone} should be found with partial search"
        print(f"✓ Customer found by partial phone search: {partial}...")


# --- Cleanup ---

@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_token):
    """Cleanup test data after all tests."""
    yield
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get all customers and delete TEST_ ones
    try:
        res = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        if res.status_code == 200:
            customers = res.json()
            for c in customers:
                if c.get("name", "").startswith("TEST_"):
                    # No direct delete endpoint, so just leave them
                    pass
        
        # Delete TEST_ bills
        res = requests.get(f"{BASE_URL}/api/bills", headers=headers)
        if res.status_code == 200:
            bills = res.json()
            for b in bills:
                if b.get("customer_name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/bills/{b['id']}", headers=headers)
    except Exception:
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
