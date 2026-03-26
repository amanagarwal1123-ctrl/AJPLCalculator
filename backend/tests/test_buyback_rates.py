"""
Test Buyback Rates Feature
- GET /api/rates/buyback - returns buyback rate card with all purities
- PUT /api/rates/buyback - admin can update buyback rates
- PUT /api/rates/buyback - non-admin users should be rejected (403)
- Buyback rate card auto-created on startup with all purities
- Adding a new purity should add it to buyback rate card too
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBuybackRates:
    """Test buyback rates feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def exec_token(self, admin_headers):
        """Get or create a sales exec user and get their token"""
        # First check if test exec exists
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        if users_res.status_code == 200:
            users = users_res.json()
            test_exec = next((u for u in users if u.get('username') == 'test_exec_buyback'), None)
            if not test_exec:
                # Create test exec
                create_res = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
                    "username": "test_exec_buyback",
                    "password": "testpass123",
                    "full_name": "Test Exec Buyback",
                    "role": "executive"
                })
                if create_res.status_code != 200:
                    pytest.skip("Could not create test exec user")
        
        # Login as exec
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "test_exec_buyback",
            "password": "testpass123"
        })
        if login_res.status_code == 200:
            return login_res.json().get("token")
        pytest.skip("Exec authentication failed")
    
    @pytest.fixture(scope="class")
    def exec_headers(self, exec_token):
        """Headers with exec auth"""
        return {
            "Authorization": f"Bearer {exec_token}",
            "Content-Type": "application/json"
        }
    
    def test_buyback_rate_card_exists(self, admin_headers):
        """Test that buyback rate card is auto-created on startup"""
        response = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("rate_type") == "buyback", "Rate type should be 'buyback'"
        assert "purities" in data, "Response should contain purities"
        assert isinstance(data["purities"], list), "Purities should be a list"
        assert len(data["purities"]) > 0, "Buyback rate card should have purities"
        
        # Verify purity structure
        for purity in data["purities"]:
            assert "purity_id" in purity, "Purity should have purity_id"
            assert "purity_name" in purity, "Purity should have purity_name"
            assert "purity_percent" in purity, "Purity should have purity_percent"
            assert "rate_per_10g" in purity, "Purity should have rate_per_10g"
        
        print(f"✓ Buyback rate card exists with {len(data['purities'])} purities")
    
    def test_get_all_rates_includes_buyback(self, admin_headers):
        """Test that GET /api/rates returns buyback along with normal and ajpl"""
        response = requests.get(f"{BASE_URL}/api/rates", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        rate_types = [r.get("rate_type") for r in data]
        
        assert "normal" in rate_types, "Should include normal rate card"
        assert "ajpl" in rate_types, "Should include ajpl rate card"
        assert "buyback" in rate_types, "Should include buyback rate card"
        
        print(f"✓ GET /api/rates returns all 3 rate types: {rate_types}")
    
    def test_admin_can_update_buyback_rates(self, admin_headers):
        """Test that admin can update buyback rates"""
        # First get current buyback rates
        get_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        assert get_res.status_code == 200
        current_data = get_res.json()
        
        # Update rates with test values
        test_purities = []
        for p in current_data["purities"]:
            test_rate = 0
            if p["purity_name"] == "24KT":
                test_rate = 58000
            elif p["purity_name"] == "22KT":
                test_rate = 52000
            elif p["purity_name"] == "18KT":
                test_rate = 43000
            
            test_purities.append({
                "purity_id": p["purity_id"],
                "purity_name": p["purity_name"],
                "purity_percent": p["purity_percent"],
                "rate_per_10g": test_rate
            })
        
        update_res = requests.put(f"{BASE_URL}/api/rates/buyback", headers=admin_headers, json={
            "rate_type": "buyback",
            "purities": test_purities
        })
        assert update_res.status_code == 200, f"Expected 200, got {update_res.status_code}: {update_res.text}"
        
        # Verify update persisted
        verify_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        
        # Check specific rates
        for p in verify_data["purities"]:
            if p["purity_name"] == "24KT":
                assert p["rate_per_10g"] == 58000, f"24KT rate should be 58000, got {p['rate_per_10g']}"
            elif p["purity_name"] == "22KT":
                assert p["rate_per_10g"] == 52000, f"22KT rate should be 52000, got {p['rate_per_10g']}"
            elif p["purity_name"] == "18KT":
                assert p["rate_per_10g"] == 43000, f"18KT rate should be 43000, got {p['rate_per_10g']}"
        
        print("✓ Admin can update buyback rates and changes persist")
    
    def test_non_admin_cannot_update_buyback_rates(self, exec_headers, admin_headers):
        """Test that non-admin users get 403 when trying to update buyback rates"""
        # Get current rates first
        get_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        assert get_res.status_code == 200
        current_data = get_res.json()
        
        # Try to update as exec (should fail)
        update_res = requests.put(f"{BASE_URL}/api/rates/buyback", headers=exec_headers, json={
            "rate_type": "buyback",
            "purities": current_data["purities"]
        })
        
        assert update_res.status_code == 403, f"Expected 403 for non-admin, got {update_res.status_code}"
        print("✓ Non-admin users correctly rejected with 403")
    
    def test_exec_can_read_buyback_rates(self, exec_headers):
        """Test that exec users can read buyback rates"""
        response = requests.get(f"{BASE_URL}/api/rates/buyback", headers=exec_headers)
        assert response.status_code == 200, f"Exec should be able to read buyback rates, got {response.status_code}"
        
        data = response.json()
        assert data.get("rate_type") == "buyback"
        print("✓ Exec users can read buyback rates")
    
    def test_buyback_rates_have_same_purities_as_normal(self, admin_headers):
        """Test that buyback rate card has same purities as normal rate card"""
        normal_res = requests.get(f"{BASE_URL}/api/rates/normal", headers=admin_headers)
        buyback_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        
        assert normal_res.status_code == 200
        assert buyback_res.status_code == 200
        
        normal_purities = {p["purity_name"] for p in normal_res.json()["purities"]}
        buyback_purities = {p["purity_name"] for p in buyback_res.json()["purities"]}
        
        assert normal_purities == buyback_purities, f"Purity mismatch: normal={normal_purities}, buyback={buyback_purities}"
        print(f"✓ Buyback has same purities as normal: {buyback_purities}")
    
    def test_updated_at_and_updated_by_fields(self, admin_headers):
        """Test that buyback rate card has updated_at and updated_by fields after update"""
        # Get current rates
        get_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        assert get_res.status_code == 200
        current_data = get_res.json()
        
        # Update rates
        update_res = requests.put(f"{BASE_URL}/api/rates/buyback", headers=admin_headers, json={
            "rate_type": "buyback",
            "purities": current_data["purities"]
        })
        assert update_res.status_code == 200
        
        # Verify updated_at and updated_by
        verify_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        verify_data = verify_res.json()
        
        assert "updated_at" in verify_data, "Should have updated_at field"
        assert "updated_by" in verify_data, "Should have updated_by field"
        assert verify_data["updated_at"] is not None, "updated_at should not be None"
        
        print(f"✓ Buyback rate card has updated_at={verify_data['updated_at'][:19]}, updated_by={verify_data['updated_by']}")


class TestBuybackRatesWithPurityChanges:
    """Test that adding/deleting purities affects buyback rate card"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    def test_adding_purity_adds_to_buyback(self, admin_headers):
        """Test that adding a new purity adds it to buyback rate card"""
        # Get current buyback purities count
        before_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
        assert before_res.status_code == 200
        before_count = len(before_res.json()["purities"])
        before_names = {p["purity_name"] for p in before_res.json()["purities"]}
        
        # Add a test purity
        test_purity_name = "TEST_BUYBACK_KT"
        add_res = requests.post(f"{BASE_URL}/api/purities", headers=admin_headers, json={
            "name": test_purity_name,
            "percent": 50
        })
        
        if add_res.status_code == 400 and "already exists" in add_res.text.lower():
            # Purity already exists from previous test run, skip this test
            print("✓ Test purity already exists, skipping add test")
            return
        
        assert add_res.status_code == 200, f"Failed to add purity: {add_res.text}"
        new_purity_id = add_res.json().get("id")
        
        try:
            # Verify buyback rate card now has the new purity
            after_res = requests.get(f"{BASE_URL}/api/rates/buyback", headers=admin_headers)
            assert after_res.status_code == 200
            after_names = {p["purity_name"] for p in after_res.json()["purities"]}
            
            assert test_purity_name in after_names, f"New purity {test_purity_name} should be in buyback rate card"
            assert len(after_res.json()["purities"]) == before_count + 1, "Buyback should have one more purity"
            
            print(f"✓ Adding purity '{test_purity_name}' also added it to buyback rate card")
        finally:
            # Cleanup: delete the test purity
            if new_purity_id:
                requests.delete(f"{BASE_URL}/api/purities/{new_purity_id}", headers=admin_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
