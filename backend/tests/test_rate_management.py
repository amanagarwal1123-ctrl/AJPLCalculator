"""
Test Rate Management API - Verifying AJPL rate bug fix
Tests: GET /api/rates, PUT /api/rates/ajpl, and auto-healing behavior
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRateManagement:
    """Rate Management API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        self.token = login_res.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_purities(self):
        """Test GET /api/purities returns all 5 purities"""
        res = requests.get(f"{BASE_URL}/api/purities", headers=self.headers)
        assert res.status_code == 200
        purities = res.json()
        assert len(purities) >= 5, f"Expected at least 5 purities, got {len(purities)}"
        
        # Verify all standard purities exist
        purity_names = [p["name"] for p in purities]
        expected = ["24KT", "22KT", "20KT", "18KT", "14KT"]
        for name in expected:
            assert name in purity_names, f"Missing purity: {name}"
        print(f"✓ GET /api/purities: Found {len(purities)} purities - {purity_names}")
    
    def test_get_rates_returns_both_cards(self):
        """Test GET /api/rates returns both normal and ajpl rate cards"""
        res = requests.get(f"{BASE_URL}/api/rates", headers=self.headers)
        assert res.status_code == 200
        rates = res.json()
        
        rate_types = [r["rate_type"] for r in rates]
        assert "normal" in rate_types, "Missing normal rate card"
        assert "ajpl" in rate_types, "Missing AJPL rate card"
        print(f"✓ GET /api/rates: Found rate cards - {rate_types}")
    
    def test_ajpl_rate_card_has_purities(self):
        """Test AJPL rate card has all 5 purities with rates"""
        res = requests.get(f"{BASE_URL}/api/rates/ajpl", headers=self.headers)
        assert res.status_code == 200
        ajpl = res.json()
        
        # Critical check - purities should NOT be empty
        assert "purities" in ajpl, "Missing purities field"
        assert len(ajpl["purities"]) >= 5, f"Expected 5 purities, got {len(ajpl['purities'])}"
        
        # Print purity details
        for p in ajpl["purities"]:
            print(f"  - {p['purity_name']}: {p['rate_per_10g']}")
        print(f"✓ GET /api/rates/ajpl: Has {len(ajpl['purities'])} purities")
    
    def test_save_ajpl_rates_preserves_purities(self):
        """Test PUT /api/rates/ajpl saves and returns purities correctly - BUG FIX TEST"""
        # Step 1: Get current AJPL rates
        get_res = requests.get(f"{BASE_URL}/api/rates/ajpl", headers=self.headers)
        assert get_res.status_code == 200
        current_ajpl = get_res.json()
        original_purities = current_ajpl["purities"]
        print(f"  Before save: {len(original_purities)} purities")
        
        # Step 2: Save the same purities back (this is what UI does)
        put_res = requests.put(f"{BASE_URL}/api/rates/ajpl", headers=self.headers, json={
            "rate_type": "ajpl",
            "purities": original_purities
        })
        assert put_res.status_code == 200, f"PUT failed: {put_res.text}"
        print(f"  Save response: {put_res.json()}")
        
        # Step 3: CRITICAL CHECK - Get rates again and verify purities are not empty
        get_res2 = requests.get(f"{BASE_URL}/api/rates/ajpl", headers=self.headers)
        assert get_res2.status_code == 200
        after_save = get_res2.json()
        
        assert "purities" in after_save, "Missing purities after save"
        assert len(after_save["purities"]) >= 5, f"BUG: Only {len(after_save['purities'])} purities after save!"
        
        print(f"  After save: {len(after_save['purities'])} purities")
        print("✓ PUT /api/rates/ajpl: Purities PRESERVED after save!")
    
    def test_multiple_saves_preserve_purities(self):
        """Test multiple consecutive saves preserve purities - BUG FIX TEST"""
        for i in range(3):
            # Get current rates
            get_res = requests.get(f"{BASE_URL}/api/rates/ajpl", headers=self.headers)
            assert get_res.status_code == 200
            purities = get_res.json()["purities"]
            
            # Save rates
            put_res = requests.put(f"{BASE_URL}/api/rates/ajpl", headers=self.headers, json={
                "rate_type": "ajpl",
                "purities": purities
            })
            assert put_res.status_code == 200
            
            # Verify purities remain
            get_res2 = requests.get(f"{BASE_URL}/api/rates/ajpl", headers=self.headers)
            assert get_res2.status_code == 200
            after = get_res2.json()["purities"]
            
            assert len(after) >= 5, f"Save #{i+1}: Only {len(after)} purities!"
            print(f"  Save #{i+1}: {len(after)} purities ✓")
        
        print("✓ Multiple saves: Purities preserved across 3 consecutive saves!")
    
    def test_auto_heal_empty_purities(self):
        """Test auto-heal: If purities become empty, GET should sync from purities collection"""
        # This tests the auto-healing behavior in the backend
        # Even if somehow purities become empty, GET should restore them
        
        # Get rates (auto-heal should kick in if needed)
        res = requests.get(f"{BASE_URL}/api/rates", headers=self.headers)
        assert res.status_code == 200
        
        for rate in res.json():
            purities = rate.get("purities", [])
            # After auto-heal, should have purities
            print(f"  {rate['rate_type']}: {len(purities)} purities")
            assert len(purities) >= 5, f"{rate['rate_type']} missing purities!"
        
        print("✓ Auto-heal check: All rate cards have purities")
    
    def test_normal_rates_also_work(self):
        """Test Normal rates save/load works correctly"""
        # Get Normal rates
        get_res = requests.get(f"{BASE_URL}/api/rates/normal", headers=self.headers)
        assert get_res.status_code == 200
        normal = get_res.json()
        
        assert len(normal.get("purities", [])) >= 5
        
        # Save Normal rates
        put_res = requests.put(f"{BASE_URL}/api/rates/normal", headers=self.headers, json={
            "rate_type": "normal",
            "purities": normal["purities"]
        })
        assert put_res.status_code == 200
        
        # Verify after save
        get_res2 = requests.get(f"{BASE_URL}/api/rates/normal", headers=self.headers)
        assert get_res2.status_code == 200
        assert len(get_res2.json()["purities"]) >= 5
        
        print("✓ Normal rates: Save/load works correctly")


class TestFeedbacksAPI:
    """Test Feedbacks API for Reports page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert login_res.status_code == 200
        self.token = login_res.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_feedbacks(self):
        """Test GET /api/feedbacks returns feedback list"""
        res = requests.get(f"{BASE_URL}/api/feedbacks", headers=self.headers)
        assert res.status_code == 200
        feedbacks = res.json()
        
        print(f"✓ GET /api/feedbacks: Found {len(feedbacks)} feedbacks")
        assert isinstance(feedbacks, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
