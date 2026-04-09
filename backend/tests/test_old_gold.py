"""
Test Old Gold (OG) feature for bills
- PUT /api/bills/{bill_id}/old-gold - sets old_gold data on a bill
- GET /api/bills/{bill_id} - includes old_gold field
- GET /api/bills/{bill_id}/summary - includes old_gold field
- Verify old_gold.value does NOT affect grand_total
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def api_client(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session

@pytest.fixture(scope="module")
def test_bill(api_client):
    """Create a test bill for OG testing"""
    # First create a customer
    customer_phone = f"99{uuid.uuid4().hex[:8]}"
    bill_data = {
        "customer_name": "OG Test Customer",
        "customer_phone": customer_phone,
        "customer_location": "Test Location",
        "customer_reference": "Walk-in",
        "salesperson_name": "Test SP",
        "items": [{
            "item_type": "gold",
            "item_name": "Test Ring",
            "rate_mode": "manual",
            "purity_name": "22KT",
            "purity_percent": 92,
            "rate_per_10g": 60000,
            "gross_weight": 10,
            "less": 0,
            "making_charges": [{"type": "per_gram", "value": 500}],
            "stone_charges": [],
            "studded_charges": []
        }],
        "external_charges": []
    }
    response = api_client.post(f"{BASE_URL}/api/bills", json=bill_data)
    assert response.status_code == 200, f"Failed to create test bill: {response.text}"
    bill = response.json()
    yield bill
    # Cleanup - delete the test bill
    api_client.delete(f"{BASE_URL}/api/bills/{bill['id']}")


class TestOldGoldEndpoint:
    """Test PUT /api/bills/{bill_id}/old-gold endpoint"""
    
    def test_set_old_gold_enabled(self, api_client, test_bill):
        """Test setting old_gold with enabled=true, value, and no photo"""
        bill_id = test_bill["id"]
        og_data = {
            "enabled": True,
            "photo": None,
            "value": 15000
        }
        response = api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        assert response.status_code == 200, f"Failed to set old gold: {response.text}"
        
        updated_bill = response.json()
        assert "old_gold" in updated_bill, "old_gold field missing in response"
        assert updated_bill["old_gold"]["enabled"] == True
        assert updated_bill["old_gold"]["value"] == 15000
        assert updated_bill["old_gold"]["photo"] is None
        print("PASS: Set old_gold with enabled=true, value=15000")
    
    def test_old_gold_does_not_affect_grand_total(self, api_client, test_bill):
        """Verify that old_gold.value does NOT affect grand_total"""
        bill_id = test_bill["id"]
        
        # Get bill before setting OG
        response = api_client.get(f"{BASE_URL}/api/bills/{bill_id}")
        assert response.status_code == 200
        original_grand_total = response.json()["grand_total"]
        
        # Set OG with a large value
        og_data = {"enabled": True, "photo": None, "value": 50000}
        response = api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        assert response.status_code == 200
        
        # Verify grand_total unchanged
        updated_bill = response.json()
        assert updated_bill["grand_total"] == original_grand_total, \
            f"Grand total changed! Original: {original_grand_total}, After OG: {updated_bill['grand_total']}"
        print(f"PASS: old_gold.value=50000 did NOT affect grand_total ({original_grand_total})")
    
    def test_set_old_gold_with_photo(self, api_client, test_bill):
        """Test setting old_gold with a photo URL"""
        bill_id = test_bill["id"]
        og_data = {
            "enabled": True,
            "photo": "/uploads/test_og_photo.jpg",
            "value": 25000
        }
        response = api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        assert response.status_code == 200
        
        updated_bill = response.json()
        assert updated_bill["old_gold"]["photo"] == "/uploads/test_og_photo.jpg"
        assert updated_bill["old_gold"]["value"] == 25000
        print("PASS: Set old_gold with photo URL")
    
    def test_disable_old_gold(self, api_client, test_bill):
        """Test disabling old_gold"""
        bill_id = test_bill["id"]
        og_data = {"enabled": False, "photo": None, "value": 0}
        response = api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        assert response.status_code == 200
        
        updated_bill = response.json()
        assert updated_bill["old_gold"]["enabled"] == False
        assert updated_bill["old_gold"]["value"] == 0
        print("PASS: Disabled old_gold")


class TestOldGoldInBillEndpoints:
    """Test that old_gold is included in GET bill endpoints"""
    
    def test_get_bill_includes_old_gold(self, api_client, test_bill):
        """GET /api/bills/{bill_id} should include old_gold field"""
        bill_id = test_bill["id"]
        
        # First set old_gold
        og_data = {"enabled": True, "photo": None, "value": 18000}
        api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        
        # Get bill
        response = api_client.get(f"{BASE_URL}/api/bills/{bill_id}")
        assert response.status_code == 200
        
        bill = response.json()
        assert "old_gold" in bill, "old_gold field missing in GET /api/bills/{bill_id}"
        assert bill["old_gold"]["enabled"] == True
        assert bill["old_gold"]["value"] == 18000
        print("PASS: GET /api/bills/{bill_id} includes old_gold field")
    
    def test_get_bill_summary_includes_old_gold(self, api_client, test_bill):
        """GET /api/bills/{bill_id}/summary should include old_gold field"""
        bill_id = test_bill["id"]
        
        # First set old_gold
        og_data = {"enabled": True, "photo": "/uploads/og_summary_test.jpg", "value": 22000}
        api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        
        # Get summary
        response = api_client.get(f"{BASE_URL}/api/bills/{bill_id}/summary")
        assert response.status_code == 200
        
        summary = response.json()
        assert "old_gold" in summary, "old_gold field missing in GET /api/bills/{bill_id}/summary"
        assert summary["old_gold"]["enabled"] == True
        assert summary["old_gold"]["value"] == 22000
        assert summary["old_gold"]["photo"] == "/uploads/og_summary_test.jpg"
        print("PASS: GET /api/bills/{bill_id}/summary includes old_gold field")


class TestOldGoldEdgeCases:
    """Test edge cases for old_gold"""
    
    def test_old_gold_with_zero_value(self, api_client, test_bill):
        """Test setting old_gold with value=0"""
        bill_id = test_bill["id"]
        og_data = {"enabled": True, "photo": None, "value": 0}
        response = api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        assert response.status_code == 200
        
        updated_bill = response.json()
        assert updated_bill["old_gold"]["value"] == 0
        print("PASS: old_gold with value=0 works")
    
    def test_old_gold_with_null_value(self, api_client, test_bill):
        """Test setting old_gold with value=null (should default to 0)"""
        bill_id = test_bill["id"]
        og_data = {"enabled": True, "photo": None, "value": None}
        response = api_client.put(f"{BASE_URL}/api/bills/{bill_id}/old-gold", json=og_data)
        assert response.status_code == 200
        
        updated_bill = response.json()
        assert updated_bill["old_gold"]["value"] == 0, "null value should default to 0"
        print("PASS: old_gold with value=null defaults to 0")
    
    def test_old_gold_nonexistent_bill(self, api_client):
        """Test setting old_gold on non-existent bill returns 404"""
        fake_bill_id = "nonexistent-bill-id-12345"
        og_data = {"enabled": True, "photo": None, "value": 1000}
        response = api_client.put(f"{BASE_URL}/api/bills/{fake_bill_id}/old-gold", json=og_data)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: old_gold on non-existent bill returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
