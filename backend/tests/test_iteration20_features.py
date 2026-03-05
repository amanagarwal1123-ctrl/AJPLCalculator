"""
Test iteration 20 features:
1. Inactive Customers 'X out of Y customers' ratio display
2. Reference breakdown endpoint (multi-reference support)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin1123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")


class TestInactiveCustomersRatio:
    """Test inactive customers endpoint returns inactive_count and total_customers"""
    
    def test_inactive_customers_30_days(self, auth_token):
        """Test inactive customers with 30 days threshold"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/customers/inactive?days=30",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Must have required fields for ratio display
        assert "inactive_count" in data, "Response missing inactive_count"
        assert "total_customers" in data, "Response missing total_customers"
        assert "threshold_days" in data, "Response missing threshold_days"
        assert "inactive_customers" in data, "Response missing inactive_customers list"
        
        # Validate data types
        assert isinstance(data["inactive_count"], int)
        assert isinstance(data["total_customers"], int)
        assert data["threshold_days"] == 30
        
        # Logic check
        assert data["inactive_count"] <= data["total_customers"]
        
        print(f"30 days: {data['inactive_count']} out of {data['total_customers']} customers inactive")

    def test_inactive_customers_15_days(self, auth_token):
        """Test inactive customers with shorter threshold"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/customers/inactive?days=15",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "inactive_count" in data
        assert "total_customers" in data
        assert data["threshold_days"] == 15
        
        print(f"15 days: {data['inactive_count']} out of {data['total_customers']} customers inactive")

    def test_inactive_customers_1_day(self, auth_token):
        """Test inactive customers with 1 day threshold (most strict)"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/customers/inactive?days=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "inactive_count" in data
        assert "total_customers" in data
        assert data["threshold_days"] == 1
        
        # With 1 day threshold, most/all customers should be inactive
        print(f"1 day: {data['inactive_count']} out of {data['total_customers']} customers inactive")

    def test_inactive_customers_changes_with_threshold(self, auth_token):
        """Verify that inactive_count changes as threshold changes"""
        results = {}
        for days in [1, 15, 30, 60]:
            response = requests.get(
                f"{BASE_URL}/api/analytics/customers/inactive?days={days}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            results[days] = data["inactive_count"]
        
        # More lenient threshold = fewer inactive
        # Less lenient (stricter) threshold = more inactive
        # 1 day >= 15 days >= 30 days >= 60 days
        assert results[1] >= results[15], f"1 day ({results[1]}) should have >= inactive than 15 days ({results[15]})"
        assert results[15] >= results[30], f"15 days ({results[15]}) should have >= inactive than 30 days ({results[30]})"
        assert results[30] >= results[60] or results[60] == results[30], f"30 days ({results[30]}) should have >= inactive than 60 days ({results[60]})"
        
        print(f"Inactive counts by threshold: {results}")


class TestReferenceBreakdownEndpoint:
    """Test /api/analytics/reference-breakdown endpoint"""
    
    def test_single_reference_instagram(self, auth_token):
        """Test reference breakdown with single reference"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/reference-breakdown?references=Instagram",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response structure
        assert "references" in data, "Missing 'references' array"
        assert "combined" in data, "Missing 'combined' summary"
        
        # Combined must have required fields
        combined = data["combined"]
        assert "gold_total" in combined, "Combined missing gold_total"
        assert "diamond_total" in combined, "Combined missing diamond_total"
        assert "total" in combined, "Combined missing total"
        assert "bills" in combined, "Combined missing bills"
        assert "customers" in combined, "Combined missing customers"
        
        # Per-reference data
        refs = data["references"]
        if len(refs) > 0:
            ref = refs[0]
            assert ref["reference"] == "Instagram"
            assert "gold_total" in ref
            assert "diamond_total" in ref
            assert "total" in ref
            assert "bills" in ref
            assert "customers" in ref
            
            # Instagram has 3 approved bills with gold sales
            assert ref["gold_total"] > 0, "Instagram should have gold sales"
            print(f"Instagram: Gold={ref['gold_total']}, Diamond={ref['diamond_total']}, Bills={ref['bills']}")

    def test_multi_reference_breakdown(self, auth_token):
        """Test reference breakdown with multiple references"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/reference-breakdown?references=Instagram,Repeat%20Customer",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "references" in data
        assert "combined" in data
        
        # Combined should aggregate multiple references
        combined = data["combined"]
        assert isinstance(combined["gold_total"], (int, float))
        assert isinstance(combined["diamond_total"], (int, float))
        assert isinstance(combined["bills"], int)
        
        print(f"Combined: Gold={combined['gold_total']}, Diamond={combined['diamond_total']}, Bills={combined['bills']}")

    def test_empty_references_returns_zeros(self, auth_token):
        """Test that empty references param returns zeroed combined"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/reference-breakdown?references=",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["references"] == [], "Empty references should return empty array"
        assert data["combined"]["gold_total"] == 0
        assert data["combined"]["diamond_total"] == 0
        assert data["combined"]["total"] == 0
        assert data["combined"]["bills"] == 0
        assert data["combined"]["customers"] == 0
        
        print("Empty references returns zeroed combined object - PASS")

    def test_nonexistent_reference(self, auth_token):
        """Test breakdown with non-existent reference"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/reference-breakdown?references=NonExistentRef12345",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return empty results
        assert data["combined"]["bills"] == 0
        print("Non-existent reference returns zeros - PASS")

    def test_reference_breakdown_requires_auth(self):
        """Test that endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/reference-breakdown?references=Instagram"
        )
        assert response.status_code == 401, "Should require authentication"
        print("Auth requirement - PASS")


class TestDashboardReferenceAnalysis:
    """Verify dashboard reference_analysis supports the breakdown feature"""
    
    def test_dashboard_has_reference_analysis(self, auth_token):
        """Dashboard should return reference_analysis for chip display"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "reference_analysis" in data, "Dashboard missing reference_analysis"
        ref_analysis = data["reference_analysis"]
        assert isinstance(ref_analysis, dict)
        
        # Each reference should have count, total, customers
        for ref_name, ref_data in ref_analysis.items():
            assert "count" in ref_data, f"{ref_name} missing count"
            assert "total" in ref_data, f"{ref_name} missing total"
            assert "customers" in ref_data, f"{ref_name} missing customers"
        
        print(f"References available: {list(ref_analysis.keys())}")
