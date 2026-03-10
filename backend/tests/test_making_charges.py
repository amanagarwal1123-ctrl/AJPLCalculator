"""
Test Making Charges Calculation for Gold and Diamond items.
- Diamond items: making charges calculated on GROSS weight
- Gold items: making charges calculated on NET weight
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestMakingChargesCalculation:
    """Test that making charges use correct weight basis for gold vs diamond items"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin to get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_diamond_making_charge_uses_gross_weight(self):
        """
        Diamond items: making charges should be calculated on GROSS weight (10g), not net weight (9.5g).
        With per_gram making charge of 500/g and gross_weight=10, expected total_making = 500 * 10 = 5000
        """
        diamond_item = {
            "item_type": "diamond",
            "gross_weight": 10,
            "less": 0.5,  # Net weight would be 10 - 0.5 = 9.5g (but NOT used for making)
            "rate_per_10g": 60000,
            "purity_percent": 75,
            "making_charges": [
                {"type": "per_gram", "value": 500}
            ],
            "stone_charges": [],
            "studded_charges": [
                {"type": "diamond", "carats": 2, "rate_per_carat": 5000, "less_type": "L"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/calculate/item",
            json=diamond_item,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"API call failed: {response.text}"
        result = response.json()
        
        # Verify item_type is diamond
        assert result.get("item_type") == "diamond", "Should return diamond item type"
        
        # Key assertion: making charge should be based on GROSS weight (10g)
        # 500/g * 10g = 5000
        expected_making = 5000.00
        actual_making = result.get("total_making")
        
        print(f"Diamond item - Gross weight: {diamond_item['gross_weight']}g")
        print(f"Diamond item - Less: {diamond_item['less']}g")
        print(f"Diamond item - Net weight: {result.get('net_weight')}g")
        print(f"Diamond item - Total making: {actual_making}")
        print(f"Expected making (500/g * 10g gross): {expected_making}")
        
        assert actual_making == expected_making, \
            f"Diamond making charge should be on GROSS weight. Expected {expected_making}, got {actual_making}"

    def test_gold_making_charge_uses_net_weight(self):
        """
        Gold items: making charges should be calculated on NET weight (9.5g), not gross weight (10g).
        With per_gram making charge of 500/g and net_weight=9.5, expected total_making = 500 * 9.5 = 4750
        """
        gold_item = {
            "item_type": "gold",
            "gross_weight": 10,
            "less": 0.5,  # Net weight = 10 - 0.5 = 9.5g (used for making)
            "rate_per_10g": 60000,
            "purity_percent": 75,
            "making_charges": [
                {"type": "per_gram", "value": 500}
            ],
            "stone_charges": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/calculate/item",
            json=gold_item,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"API call failed: {response.text}"
        result = response.json()
        
        # Verify item_type is gold
        assert result.get("item_type") == "gold", "Should return gold item type"
        
        # Verify net weight calculation
        assert result.get("net_weight") == 9.5, "Net weight should be 9.5g (10 - 0.5)"
        
        # Key assertion: making charge should be based on NET weight (9.5g)
        # 500/g * 9.5g = 4750
        expected_making = 4750.00
        actual_making = result.get("total_making")
        
        print(f"Gold item - Gross weight: {gold_item['gross_weight']}g")
        print(f"Gold item - Less: {gold_item['less']}g")
        print(f"Gold item - Net weight: {result.get('net_weight')}g")
        print(f"Gold item - Total making: {actual_making}")
        print(f"Expected making (500/g * 9.5g net): {expected_making}")
        
        assert actual_making == expected_making, \
            f"Gold making charge should be on NET weight. Expected {expected_making}, got {actual_making}"

    def test_diamond_percentage_making_uses_gross_weight(self):
        """
        Test percentage-based making charges for diamond items also use GROSS weight.
        Formula: making_per_gram = (percentage / 100) * (24KT_rate / 10)
        Total = making_per_gram * gross_weight
        """
        diamond_item = {
            "item_type": "diamond",
            "gross_weight": 10,
            "less": 0.5,
            "rate_per_10g": 60000,  # 75% purity rate
            "purity_percent": 75,
            "making_charges": [
                {"type": "percentage", "value": 10}  # 10% making
            ],
            "stone_charges": [],
            "studded_charges": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/calculate/item",
            json=diamond_item,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"API call failed: {response.text}"
        result = response.json()
        
        # Calculate expected making:
        # 24KT rate = 60000 / 0.75 = 80000 per 10g = 8000 per gram
        # 10% of 8000 = 800/g
        # Total making = 800 * 10 (gross) = 8000
        rate_24kt_per_10g = 60000 / 0.75
        rate_24kt_per_gram = rate_24kt_per_10g / 10
        making_per_gram = 0.10 * rate_24kt_per_gram
        expected_making = making_per_gram * 10  # Using gross weight
        
        actual_making = result.get("total_making")
        
        print(f"Diamond percentage making - Expected (gross): {expected_making}")
        print(f"Diamond percentage making - Actual: {actual_making}")
        
        # Allow small rounding difference
        assert abs(actual_making - expected_making) < 0.01, \
            f"Diamond percentage making should use GROSS weight. Expected ~{expected_making}, got {actual_making}"

    def test_gold_percentage_making_uses_net_weight(self):
        """
        Test percentage-based making charges for gold items use NET weight.
        """
        gold_item = {
            "item_type": "gold",
            "gross_weight": 10,
            "less": 0.5,  # Net = 9.5g
            "rate_per_10g": 60000,  # 75% purity rate
            "purity_percent": 75,
            "making_charges": [
                {"type": "percentage", "value": 10}  # 10% making
            ],
            "stone_charges": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/calculate/item",
            json=gold_item,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"API call failed: {response.text}"
        result = response.json()
        
        # Calculate expected making:
        # 24KT rate = 60000 / 0.75 = 80000 per 10g = 8000 per gram
        # 10% of 8000 = 800/g
        # Total making = 800 * 9.5 (net) = 7600
        rate_24kt_per_10g = 60000 / 0.75
        rate_24kt_per_gram = rate_24kt_per_10g / 10
        making_per_gram = 0.10 * rate_24kt_per_gram
        expected_making = making_per_gram * 9.5  # Using net weight
        
        actual_making = result.get("total_making")
        
        print(f"Gold percentage making - Expected (net): {expected_making}")
        print(f"Gold percentage making - Actual: {actual_making}")
        
        # Allow small rounding difference
        assert abs(actual_making - expected_making) < 0.01, \
            f"Gold percentage making should use NET weight. Expected ~{expected_making}, got {actual_making}"

    def test_diamond_with_studded_less_deduction(self):
        """
        Test diamond item with L-type studded charges (deducted from net weight).
        1 carat = 0.2g, so 2 carats = 0.4g deducted from net weight for gold value.
        But making charges still use GROSS weight.
        """
        diamond_item = {
            "item_type": "diamond",
            "gross_weight": 10,
            "less": 0.5,
            "rate_per_10g": 60000,
            "purity_percent": 75,
            "making_charges": [
                {"type": "per_gram", "value": 500}
            ],
            "stone_charges": [],
            "studded_charges": [
                {"type": "diamond", "carats": 2, "rate_per_carat": 5000, "less_type": "L"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/calculate/item",
            json=diamond_item,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"API call failed: {response.text}"
        result = response.json()
        
        # Verify studded deduction
        studded_less = result.get("studded_less_grams", 0)
        assert studded_less == 0.4, f"Studded less should be 0.4g (2 carats * 0.2), got {studded_less}"
        
        # Net weight = 10 - 0.5 - 0.4 = 9.1g (for gold value calculation)
        net_weight = result.get("net_weight")
        assert net_weight == 9.1, f"Net weight should be 9.1g, got {net_weight}"
        
        # BUT making charges should still use GROSS weight (10g)
        # 500/g * 10g = 5000
        expected_making = 5000.00
        actual_making = result.get("total_making")
        
        print(f"Diamond with L-type studded - Net weight: {net_weight}g")
        print(f"Diamond with L-type studded - Making (on gross): {actual_making}")
        
        assert actual_making == expected_making, \
            f"Diamond making should still use GROSS weight. Expected {expected_making}, got {actual_making}"


class TestCalculationEndpointAccess:
    """Test that calculate endpoints are accessible"""
    
    def test_calculate_item_endpoint_exists(self):
        """Verify /api/calculate/item endpoint is accessible"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Test with minimal gold item
        response = requests.post(
            f"{BASE_URL}/api/calculate/item",
            json={"item_type": "gold", "gross_weight": 1, "less": 0, "rate_per_10g": 50000, "purity_percent": 100, "making_charges": [], "stone_charges": []},
            headers=headers
        )
        
        assert response.status_code == 200, f"Calculate item endpoint should return 200, got {response.status_code}"
        print(f"Calculate item endpoint working: {response.status_code}")
