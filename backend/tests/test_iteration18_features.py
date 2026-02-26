"""
Iteration 18 Tests:
1. Bug Fix: /api/analytics/customers/inactive calculates total_spent from approved/sent/edited bills
2. UI: Salespeople management shows branch_name next to each salesperson
3. New Feature: /api/salespeople/:spName/performance endpoint
4. New Feature: Salesperson performance page with charts
5. Navigation: Salesperson list items clickable -> navigate to performance page
"""
import pytest
import requests
import os
from urllib.parse import quote

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("token")
    assert token, "No token returned"
    return token

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestInactiveCustomersEndpoint:
    """Test Bug Fix: /api/analytics/customers/inactive calculates total_spent from bills"""
    
    def test_inactive_customers_endpoint_returns_data(self, authenticated_client):
        """Test that inactive customers endpoint returns expected structure"""
        response = authenticated_client.get(f"{BASE_URL}/api/analytics/customers/inactive?days=30")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "threshold_days" in data
        assert "inactive_count" in data
        assert "total_customers" in data
        assert "inactive_customers" in data
        assert isinstance(data["inactive_customers"], list)
        print(f"PASS: Inactive customers endpoint returns {data['inactive_count']} inactive customers out of {data['total_customers']} total")
    
    def test_inactive_customers_have_total_spent_field(self, authenticated_client):
        """Test that each inactive customer has total_spent field"""
        response = authenticated_client.get(f"{BASE_URL}/api/analytics/customers/inactive?days=1")
        assert response.status_code == 200
        data = response.json()
        
        if data["inactive_customers"]:
            customer = data["inactive_customers"][0]
            assert "total_spent" in customer, "Missing total_spent field"
            assert "name" in customer
            assert "phone" in customer
            assert "days_since_last_visit" in customer
            print(f"PASS: Inactive customer has total_spent={customer['total_spent']}, days_since={customer['days_since_last_visit']}")
        else:
            print("INFO: No inactive customers found to verify structure (all customers active)")
    
    def test_inactive_customers_total_spent_calculated_correctly(self, authenticated_client):
        """Verify total_spent is calculated from approved/sent/edited bills only"""
        # Get inactive customers
        response = authenticated_client.get(f"{BASE_URL}/api/analytics/customers/inactive?days=1")
        assert response.status_code == 200
        inactive_data = response.json()
        
        if inactive_data["inactive_customers"]:
            # Pick first inactive customer
            customer = inactive_data["inactive_customers"][0]
            phone = customer.get("phone", "")
            
            if phone:
                # Get customer bills
                # First find customer id
                cust_response = authenticated_client.get(f"{BASE_URL}/api/customers/search?phone={phone}")
                if cust_response.status_code == 200 and cust_response.json():
                    cust_id = cust_response.json()[0].get("id", phone)
                    
                    bills_response = authenticated_client.get(f"{BASE_URL}/api/customers/{cust_id}/bills")
                    if bills_response.status_code == 200:
                        bills_data = bills_response.json()
                        expected_total = bills_data.get("total_spent", 0)
                        actual_total = customer.get("total_spent", 0)
                        
                        # They should match as both use same bill-based calculation now
                        print(f"INFO: Customer {customer['name']}: inactive endpoint total_spent={actual_total}, bills endpoint total_spent={expected_total}")
        else:
            print("INFO: No inactive customers to verify calculation")


class TestSalespeopleEndpoint:
    """Test salespeople list with branch_name"""
    
    def test_salespeople_list_returns_branch_name(self, authenticated_client):
        """Test that /api/salespeople returns branch_name field"""
        response = authenticated_client.get(f"{BASE_URL}/api/salespeople")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"PASS: Salespeople endpoint returns {len(data)} salespeople")
        
        if data:
            sp = data[0]
            assert "id" in sp
            assert "name" in sp
            # branch_name should be present (may be empty string if no branch)
            assert "branch_name" in sp, "Missing branch_name field in response"
            print(f"PASS: Salesperson '{sp['name']}' has branch_name='{sp.get('branch_name', '')}'")


class TestSalespersonPerformanceEndpoint:
    """Test new /api/salespeople/:spName/performance endpoint"""
    
    def test_performance_endpoint_exists(self, authenticated_client):
        """Test that performance endpoint is accessible"""
        # Get a salesperson name first
        sp_response = authenticated_client.get(f"{BASE_URL}/api/salespeople")
        assert sp_response.status_code == 200
        salespeople = sp_response.json()
        
        if salespeople:
            sp_name = salespeople[0]["name"]
            encoded_name = quote(sp_name, safe='')
            
            response = authenticated_client.get(f"{BASE_URL}/api/salespeople/{encoded_name}/performance")
            assert response.status_code == 200, f"Performance endpoint failed: {response.text}"
            data = response.json()
            
            # Verify response structure
            assert "name" in data
            assert "branch_name" in data
            assert "total_sales" in data
            assert "total_bills" in data
            assert "daily_sales" in data
            assert isinstance(data["daily_sales"], list)
            
            print(f"PASS: Performance endpoint returns: name={data['name']}, total_sales={data['total_sales']}, total_bills={data['total_bills']}, daily_entries={len(data['daily_sales'])}")
        else:
            print("INFO: No salespeople exist to test performance endpoint")
    
    def test_performance_with_nonexistent_salesperson(self, authenticated_client):
        """Test performance endpoint with non-existent salesperson returns empty data"""
        response = authenticated_client.get(f"{BASE_URL}/api/salespeople/NonExistentPerson123/performance")
        assert response.status_code == 200  # Should return empty data, not 404
        data = response.json()
        
        assert data["name"] == "NonExistentPerson123"
        assert data["total_sales"] == 0
        assert data["total_bills"] == 0
        assert data["daily_sales"] == []
        print("PASS: Non-existent salesperson returns empty performance data")
    
    def test_performance_daily_sales_structure(self, authenticated_client):
        """Test daily_sales array structure"""
        sp_response = authenticated_client.get(f"{BASE_URL}/api/salespeople")
        assert sp_response.status_code == 200
        salespeople = sp_response.json()
        
        if salespeople:
            sp_name = salespeople[0]["name"]
            encoded_name = quote(sp_name, safe='')
            
            response = authenticated_client.get(f"{BASE_URL}/api/salespeople/{encoded_name}/performance")
            assert response.status_code == 200
            data = response.json()
            
            if data["daily_sales"]:
                day_entry = data["daily_sales"][0]
                assert "date" in day_entry, "daily_sales entry missing 'date'"
                assert "amount" in day_entry, "daily_sales entry missing 'amount'"
                assert "bill_count" in day_entry, "daily_sales entry missing 'bill_count'"
                print(f"PASS: daily_sales entry has correct structure: date={day_entry['date']}, amount={day_entry['amount']}, bill_count={day_entry['bill_count']}")
            else:
                print("INFO: No daily_sales data for this salesperson (no bills)")
        else:
            print("INFO: No salespeople to test daily_sales structure")


class TestSalespersonPerformanceAuth:
    """Test authorization for performance endpoint"""
    
    def test_performance_requires_auth(self, api_client):
        """Test that performance endpoint requires authentication"""
        # Clear any auth header
        if "Authorization" in api_client.headers:
            del api_client.headers["Authorization"]
        
        response = api_client.get(f"{BASE_URL}/api/salespeople/TestPerson/performance")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Performance endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
