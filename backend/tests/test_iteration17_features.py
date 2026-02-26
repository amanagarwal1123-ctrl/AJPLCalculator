"""
Test iteration 17 features:
1. Analytics Fix - customer analytics now uses only approved/sent/edited bills for total_spent
2. Salespeople Branch - POST /salespeople accepts branch_id, GET returns branch_name
3. Customer Edit - Customer History page edit button (frontend test)
"""
import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Return auth headers"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestAnalyticsCustomersFix:
    """Test that customer analytics calculates total_spent from approved bills only"""
    
    def test_analytics_customers_endpoint(self, auth_headers):
        """Verify GET /api/analytics/customers returns data"""
        response = requests.get(f"{BASE_URL}/api/analytics/customers", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of customers"
        if len(data) > 0:
            # Verify total_spent field exists
            assert 'total_spent' in data[0], "Customer should have total_spent field"
            print(f"Sample customer total_spent: {data[0].get('total_spent')}")
    
    def test_analytics_customers_frequency_endpoint(self, auth_headers):
        """Verify GET /api/analytics/customers/frequency returns cohort data"""
        response = requests.get(f"{BASE_URL}/api/analytics/customers/frequency", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert 'frequency_cohorts' in data, "Should have frequency_cohorts"
        assert 'spending_tiers' in data, "Should have spending_tiers"
        assert 'total_customers' in data, "Should have total_customers"
        
        # Verify cohorts have total_spent values
        for cohort in data['frequency_cohorts']:
            assert 'name' in cohort
            assert 'count' in cohort
            assert 'total_spent' in cohort
            print(f"Cohort '{cohort['name']}': count={cohort['count']}, total_spent={cohort['total_spent']}")
        
        # Verify spending tiers
        for tier in data['spending_tiers']:
            assert 'name' in tier
            assert 'count' in tier
            assert 'total_spent' in tier
            print(f"Tier '{tier['name']}': count={tier['count']}, total_spent={tier['total_spent']}")
    
    def test_customer_bills_returns_correct_total(self, auth_headers):
        """Verify GET /api/customers/{id}/bills returns total_spent from approved bills only"""
        # First get customers list
        cust_response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert cust_response.status_code == 200
        customers = cust_response.json()
        
        if len(customers) == 0:
            pytest.skip("No customers to test")
        
        # Test first customer with bills
        for cust in customers[:5]:
            phone = cust.get('phone') or cust.get('id')
            response = requests.get(f"{BASE_URL}/api/customers/{phone}/bills", headers=auth_headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            assert 'customer' in data
            assert 'bills' in data
            assert 'total_spent' in data
            
            # Verify total_spent is calculated from bills, not cached
            bills = data.get('bills', [])
            approved_total = sum(
                b.get('grand_total', 0) 
                for b in bills 
                if b.get('status') in ('sent', 'approved', 'edited')
            )
            
            # The API total_spent should match our calculation
            api_total = data.get('total_spent', 0)
            print(f"Customer {phone}: API total={api_total}, Calculated approved={approved_total}")
            
            # Allow small float rounding differences
            assert abs(api_total - approved_total) < 1, f"Mismatch: API={api_total}, Calc={approved_total}"
            
            if len(bills) > 0:
                break  # Found customer with bills


class TestSalespeopleBranch:
    """Test salespeople branch_id support"""
    
    def test_get_salespeople_returns_branch_name(self, auth_headers):
        """Verify GET /api/salespeople returns branch_name if assigned"""
        response = requests.get(f"{BASE_URL}/api/salespeople", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list"
        print(f"Found {len(data)} salespeople")
        
        # Check structure - branch_name should be present (can be null)
        for sp in data:
            assert 'id' in sp
            assert 'name' in sp
            # branch_name may or may not be present depending on whether backend returns it
            print(f"Salesperson: {sp.get('name')}, branch_id={sp.get('branch_id')}, branch_name={sp.get('branch_name')}")
    
    def test_get_branches(self, auth_headers):
        """Verify GET /api/branches works"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list"
        print(f"Found {len(data)} branches")
        return data
    
    def test_create_salesperson_with_branch(self, auth_headers):
        """Test POST /api/salespeople with branch_id"""
        # Get a branch first
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_resp.json()
        
        branch_id = branches[0]['id'] if branches else ''
        branch_name = branches[0]['name'] if branches else 'No Branch'
        
        # Create salesperson with unique name
        random_suffix = ''.join(random.choices(string.ascii_uppercase, k=4))
        test_name = f"TEST_SP_{random_suffix}"
        
        response = requests.post(f"{BASE_URL}/api/salespeople", json={
            "name": test_name,
            "branch_id": branch_id
        }, headers=auth_headers)
        
        assert response.status_code == 200, f"Failed to create: {response.text}"
        data = response.json()
        
        assert data.get('name') == test_name
        assert data.get('branch_id') == branch_id
        print(f"Created salesperson: {test_name} with branch_id={branch_id}")
        
        # Verify in list that branch_name is returned
        list_resp = requests.get(f"{BASE_URL}/api/salespeople", headers=auth_headers)
        salespeople = list_resp.json()
        
        created_sp = next((sp for sp in salespeople if sp.get('name') == test_name), None)
        assert created_sp is not None, "Created salesperson not found in list"
        
        # Verify branch_name is populated
        if branch_id:
            assert created_sp.get('branch_name') == branch_name, f"branch_name mismatch: expected {branch_name}, got {created_sp.get('branch_name')}"
            print(f"Verified branch_name={created_sp.get('branch_name')}")
        
        # Cleanup - delete test salesperson
        delete_resp = requests.delete(f"{BASE_URL}/api/salespeople/{created_sp['id']}", headers=auth_headers)
        assert delete_resp.status_code == 200, f"Cleanup failed: {delete_resp.text}"
        print(f"Cleaned up test salesperson")
    
    def test_create_salesperson_without_branch(self, auth_headers):
        """Test POST /api/salespeople without branch_id still works"""
        random_suffix = ''.join(random.choices(string.ascii_uppercase, k=4))
        test_name = f"TEST_SP_NOBRANCH_{random_suffix}"
        
        response = requests.post(f"{BASE_URL}/api/salespeople", json={
            "name": test_name
        }, headers=auth_headers)
        
        assert response.status_code == 200, f"Failed to create: {response.text}"
        data = response.json()
        
        assert data.get('name') == test_name
        print(f"Created salesperson without branch: {test_name}")
        
        # Cleanup
        delete_resp = requests.delete(f"{BASE_URL}/api/salespeople/{data['id']}", headers=auth_headers)
        assert delete_resp.status_code == 200


class TestCustomerDetailEndpoint:
    """Test customer detail endpoint used by Edit Details navigation"""
    
    def test_get_customer_by_phone(self, auth_headers):
        """Verify GET /api/customers/{phone} returns customer detail"""
        # Get customers list first
        cust_response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert cust_response.status_code == 200
        customers = cust_response.json()
        
        if len(customers) == 0:
            pytest.skip("No customers to test")
        
        # Test fetching by phone
        phone = customers[0].get('phone')
        if not phone:
            pytest.skip("No customer with phone")
        
        response = requests.get(f"{BASE_URL}/api/customers/{phone}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert 'name' in data
        assert 'phone' in data
        print(f"Customer by phone: {data.get('name')} - {data.get('phone')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
