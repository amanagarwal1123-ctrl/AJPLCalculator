"""
Test file for validating the bug fix: Total Customers field in Reports page
should change coherently when date filters are applied.

Key fix: /api/analytics/dashboard endpoint 'total_customers' now counts 
unique customers from filtered bills (not all customers in DB)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

class TestDashboardDateFilterFix:
    """Test the bug fix for date filter coherence in Reports page"""
    
    def test_unfiltered_dashboard_returns_all_customers(self, auth_token):
        """When no filters applied, total_customers shows unique customers from all bills"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have total_customers field
        assert "total_customers" in data
        assert "total_bills" in data
        assert "all_time_total" in data
        
        # Store baseline values
        print(f"Unfiltered: total_customers={data['total_customers']}, total_bills={data['total_bills']}")
        assert data["total_customers"] >= 0
        assert data["total_bills"] >= 0
    
    def test_date_filter_reduces_customer_count(self, auth_token):
        """When date_from filter is applied, total_customers should reflect only customers in that range"""
        # First get unfiltered count
        unfiltered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        # Apply date filter - should reduce counts
        filtered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2026-02-15",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        print(f"Unfiltered: customers={unfiltered['total_customers']}, bills={unfiltered['total_bills']}")
        print(f"Filtered (>=2026-02-15): customers={filtered['total_customers']}, bills={filtered['total_bills']}")
        
        # With date filter, counts should be same or less
        assert filtered["total_customers"] <= unfiltered["total_customers"]
        assert filtered["total_bills"] <= unfiltered["total_bills"]
    
    def test_future_date_returns_zero_customers(self, auth_token):
        """When date_from=2099-01-01 (future), both total_customers and total_bills should be 0"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2099-01-01",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Future date should return 0 for all metrics
        assert data["total_customers"] == 0, f"Expected 0 customers for future date, got {data['total_customers']}"
        assert data["total_bills"] == 0, f"Expected 0 bills for future date, got {data['total_bills']}"
        assert data["all_time_total"] == 0
        assert data["gold_total"] == 0
        assert data["diamond_total"] == 0
        print("Future date filter correctly returns 0 for all metrics")
    
    def test_gold_and_diamond_totals_filter_coherently(self, auth_token):
        """Gold Sales and Diamond Sales should also change with filters"""
        # Get unfiltered
        unfiltered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        # Get filtered
        filtered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2026-02-15",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        print(f"Unfiltered: gold={unfiltered['gold_total']}, diamond={unfiltered['diamond_total']}")
        print(f"Filtered: gold={filtered['gold_total']}, diamond={filtered['diamond_total']}")
        
        # Filtered totals should be <= unfiltered
        assert filtered["gold_total"] <= unfiltered["gold_total"]
        assert filtered["diamond_total"] <= unfiltered["diamond_total"]
        assert filtered["all_time_total"] <= unfiltered["all_time_total"]
    
    def test_reference_analysis_includes_customers_field(self, auth_token):
        """reference_analysis should return 'customers' field alongside 'count' (bills)"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        reference_analysis = data.get("reference_analysis", {})
        
        # Each reference entry should have count (bills), total (revenue), customers (unique)
        for ref_name, ref_data in reference_analysis.items():
            assert "count" in ref_data, f"Missing 'count' for reference {ref_name}"
            assert "total" in ref_data, f"Missing 'total' for reference {ref_name}"
            assert "customers" in ref_data, f"Missing 'customers' for reference {ref_name}"
            print(f"Reference '{ref_name}': bills={ref_data['count']}, customers={ref_data['customers']}, total={ref_data['total']}")
    
    def test_daily_sales_filters_correctly(self, auth_token):
        """daily_sales chart data should reflect filter"""
        # Get filtered data
        filtered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2026-02-20",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        daily_sales = filtered.get("daily_sales", [])
        
        # All dates in daily_sales should be >= 2026-02-20
        for day in daily_sales:
            date_str = day.get("date", "")
            if date_str:
                assert date_str >= "2026-02-20", f"Date {date_str} should not be before filter"
        print(f"Daily sales filtered correctly: {len(daily_sales)} days returned")
    
    def test_branch_sales_filters_correctly(self, auth_token):
        """branch_sales should reflect filtered data"""
        unfiltered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        filtered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2026-02-15",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        unfiltered_branch_total = sum(b.get("total", 0) for b in unfiltered.get("branch_sales", []))
        filtered_branch_total = sum(b.get("total", 0) for b in filtered.get("branch_sales", []))
        
        print(f"Branch sales unfiltered total: {unfiltered_branch_total}")
        print(f"Branch sales filtered total: {filtered_branch_total}")
        
        # Filtered should be <= unfiltered
        assert filtered_branch_total <= unfiltered_branch_total
    
    def test_executive_sales_filters_correctly(self, auth_token):
        """executive_sales should reflect filtered data"""
        unfiltered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        filtered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2026-02-15",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        unfiltered_exec_total = sum(e.get("total", 0) for e in unfiltered.get("executive_sales", []))
        filtered_exec_total = sum(e.get("total", 0) for e in filtered.get("executive_sales", []))
        
        print(f"Executive sales unfiltered total: {unfiltered_exec_total}")
        print(f"Executive sales filtered total: {filtered_exec_total}")
        
        # Filtered should be <= unfiltered
        assert filtered_exec_total <= unfiltered_exec_total
    
    def test_kt_analysis_filters_correctly(self, auth_token):
        """kt_analysis should reflect filtered data"""
        unfiltered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        filtered = requests.get(
            f"{BASE_URL}/api/analytics/dashboard?date_from=2026-02-15",
            headers={"Authorization": f"Bearer {auth_token}"}
        ).json()
        
        unfiltered_kt_total = sum(kt.get("total", 0) for kt in unfiltered.get("kt_analysis", {}).values())
        filtered_kt_total = sum(kt.get("total", 0) for kt in filtered.get("kt_analysis", {}).values())
        
        print(f"KT analysis unfiltered total: {unfiltered_kt_total}")
        print(f"KT analysis filtered total: {filtered_kt_total}")
        
        # Filtered should be <= unfiltered
        assert filtered_kt_total <= unfiltered_kt_total


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
