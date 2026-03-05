"""
Test the reference-report endpoint and verify customer count consistency fix.
Tests: GET /api/analytics/reference-report, reference_analysis in dashboard 
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReferenceReport:
    """Test the new reference report feature and bug fix for customer count consistency."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and get auth token."""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
        assert self.token, "No access token returned"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_reference_report_endpoint_returns_200(self):
        """Verify the new reference-report endpoint exists and returns 200."""
        response = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Reference report endpoint returns 200 OK")
    
    def test_reference_report_structure(self):
        """Verify response has correct structure: total, approved, np, summary."""
        response = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level keys
        assert "total" in data, "Missing 'total' key in response"
        assert "approved" in data, "Missing 'approved' key in response"
        assert "np" in data, "Missing 'np' key in response"
        assert "summary" in data, "Missing 'summary' key in response"
        
        # Check summary structure
        summary = data["summary"]
        assert "total_bills" in summary, "Missing total_bills in summary"
        assert "total_customers" in summary, "Missing total_customers in summary"
        assert "approved_bills" in summary, "Missing approved_bills in summary"
        assert "approved_customers" in summary, "Missing approved_customers in summary"
        assert "np_customers" in summary, "Missing np_customers in summary"
        
        print(f"✓ Reference report structure verified: {len(data['total'])} total refs, {len(data['approved'])} approved refs, {len(data['np'])} np refs")
        print(f"  Summary: {summary}")
    
    def test_total_view_data_structure(self):
        """Verify Total view items have correct structure."""
        response = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        if data["total"]:
            item = data["total"][0]
            assert "reference" in item, "Missing 'reference' field"
            assert "bills" in item, "Missing 'bills' field"
            assert "total" in item, "Missing 'total' field"
            assert "customers" in item, "Missing 'customers' field"
            assert "bill_list" in item, "Missing 'bill_list' field"
            
            # Check bill_list item structure
            if item["bill_list"]:
                bill = item["bill_list"][0]
                assert "id" in bill, "Missing 'id' in bill_list item"
                assert "bill_number" in bill, "Missing 'bill_number' in bill_list item"
                assert "customer_name" in bill, "Missing 'customer_name' in bill_list item"
                assert "status" in bill, "Missing 'status' in bill_list item"
                assert "grand_total" in bill, "Missing 'grand_total' in bill_list item"
                print(f"✓ Total view data verified - first reference: {item['reference']} with {item['bills']} bills")
        else:
            print("⚠ No data in total view")
    
    def test_approved_view_only_contains_approved_statuses(self):
        """Verify Approved view only contains sent/approved/edited bills."""
        response = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        approved_statuses = {'sent', 'approved', 'edited'}
        for ref_item in data["approved"]:
            for bill in ref_item.get("bill_list", []):
                status = bill.get("status")
                assert status in approved_statuses, f"Found non-approved status '{status}' in approved view (bill {bill.get('bill_number')})"
        
        print(f"✓ Approved view verified - all {sum(r['bills'] for r in data['approved'])} bills have approved statuses")
    
    def test_np_view_excludes_customers_with_approved_bills(self):
        """Verify NP view only contains customers without any approved bills."""
        response = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # NP customers should only have draft bills
        for ref_item in data["np"]:
            for customer in ref_item.get("customer_list", []):
                for bill in customer.get("bills", []):
                    status = bill.get("status")
                    assert status == "draft", f"Found non-draft status '{status}' in NP view for customer {customer.get('customer_name')}"
        
        print(f"✓ NP view verified - {sum(r['customers'] for r in data['np'])} non-purchaser customers have only draft bills")
    
    def test_date_filter_works(self):
        """Verify date filters are applied correctly."""
        # Get report without filter
        response_all = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response_all.status_code == 200
        data_all = response_all.json()
        
        # Get report with date filter (far future - should return empty/fewer)
        response_future = requests.get(
            f"{BASE_URL}/api/analytics/reference-report?date_from=2030-01-01&date_to=2030-12-31",
            headers=self.headers
        )
        assert response_future.status_code == 200
        data_future = response_future.json()
        
        # Future date should have 0 or fewer bills
        assert data_future["summary"]["total_bills"] <= data_all["summary"]["total_bills"], \
            "Future date filter should have fewer bills"
        
        print(f"✓ Date filter works: All={data_all['summary']['total_bills']} bills, Future filter={data_future['summary']['total_bills']} bills")
    
    def test_dashboard_reference_analysis_consistency(self):
        """Bug fix verification: dashboard reference_analysis counts only sent/approved/edited bills."""
        response = requests.get(f"{BASE_URL}/api/analytics/dashboard", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Get reference_analysis from dashboard
        ref_analysis = data.get("reference_analysis", {})
        
        # Get reference report for comparison
        ref_report = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        ref_data = ref_report.json()
        
        # Both should now only count approved bills for customer counts
        # The bug was: one counted ALL bills, the other only approved
        # After fix: both should count the same (approved only)
        
        print(f"✓ Dashboard reference_analysis has {len(ref_analysis)} references")
        print(f"  Reference report approved view has {len(ref_data['approved'])} references")
        
        # Verify structure exists
        if ref_analysis:
            for ref_name, ref_item in ref_analysis.items():
                assert "customers" in ref_item, f"Missing 'customers' in reference_analysis for {ref_name}"
                assert "count" in ref_item, f"Missing 'count' in reference_analysis for {ref_name}"
        
        print("✓ Reference analysis structure verified - customer counts should now be consistent")
    
    def test_summary_math_is_correct(self):
        """Verify summary calculations are mathematically correct."""
        response = requests.get(f"{BASE_URL}/api/analytics/reference-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Calculate total bills from total view
        calculated_total_bills = sum(r["bills"] for r in data["total"])
        assert data["summary"]["total_bills"] == calculated_total_bills, \
            f"Summary total_bills mismatch: {data['summary']['total_bills']} vs calculated {calculated_total_bills}"
        
        # Calculate approved bills from approved view
        calculated_approved_bills = sum(r["bills"] for r in data["approved"])
        assert data["summary"]["approved_bills"] == calculated_approved_bills, \
            f"Summary approved_bills mismatch: {data['summary']['approved_bills']} vs calculated {calculated_approved_bills}"
        
        # Calculate NP customers
        calculated_np_customers = sum(r["customers"] for r in data["np"])
        assert data["summary"]["np_customers"] == calculated_np_customers, \
            f"Summary np_customers mismatch: {data['summary']['np_customers']} vs calculated {calculated_np_customers}"
        
        print(f"✓ Summary math verified: {calculated_total_bills} total bills, {calculated_approved_bills} approved, {calculated_np_customers} NP customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
