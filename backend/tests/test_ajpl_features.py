"""
AJPL Calculator - Feature Testing Suite
Tests for iteration 8 features:
- Admin login with password
- Salespeople management
- Feedback questions management
- Notifications
- MRP Calculator
- Photo upload
- Customer tier settings
- Salesperson dropdown in bills
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Test admin login flow with username/password"""
    
    def test_admin_login_success(self):
        """Admin can login with admin/admin1123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "admin", "User role should be admin"
        print(f"PASS: Admin login successful, role={data['user']['role']}")
        
    def test_admin_login_invalid_credentials(self):
        """Invalid credentials should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("PASS: Invalid credentials correctly rejected")


class TestSalespeopleManagement:
    """Test salespeople CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_salespeople_list(self):
        """GET /api/salespeople returns list"""
        response = requests.get(f"{BASE_URL}/api/salespeople", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/salespeople returns {len(data)} salespeople")
        
    def test_create_salesperson(self):
        """POST /api/salespeople creates a salesperson"""
        # Create test salesperson
        response = requests.post(f"{BASE_URL}/api/salespeople", 
            headers=self.headers,
            json={"name": "TEST_Salesperson_123"}
        )
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Salesperson_123"
        print(f"PASS: Created salesperson with id={data['id']}")
        
        # Cleanup - delete test salesperson
        requests.delete(f"{BASE_URL}/api/salespeople/{data['id']}", headers=self.headers)
        
    def test_delete_salesperson(self):
        """DELETE /api/salespeople/{id} removes a salesperson"""
        # Create then delete
        create_res = requests.post(f"{BASE_URL}/api/salespeople",
            headers=self.headers,
            json={"name": "TEST_ToDelete_456"}
        )
        sp_id = create_res.json().get("id")
        
        delete_res = requests.delete(f"{BASE_URL}/api/salespeople/{sp_id}", headers=self.headers)
        assert delete_res.status_code == 200
        print(f"PASS: Deleted salesperson {sp_id}")


class TestFeedbackQuestions:
    """Test feedback questions management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_feedback_questions(self):
        """GET /api/feedback-questions returns list"""
        response = requests.get(f"{BASE_URL}/api/feedback-questions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/feedback-questions returns {len(data)} questions")
        
    def test_create_feedback_question(self):
        """POST /api/feedback-questions creates a question"""
        response = requests.post(f"{BASE_URL}/api/feedback-questions",
            headers=self.headers,
            json={"question": "TEST_How was your experience?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["question"] == "TEST_How was your experience?"
        print(f"PASS: Created feedback question with id={data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/feedback-questions/{data['id']}", headers=self.headers)
        
    def test_delete_feedback_question(self):
        """DELETE /api/feedback-questions/{id} removes a question"""
        create_res = requests.post(f"{BASE_URL}/api/feedback-questions",
            headers=self.headers,
            json={"question": "TEST_Question to delete"}
        )
        q_id = create_res.json().get("id")
        
        delete_res = requests.delete(f"{BASE_URL}/api/feedback-questions/{q_id}", headers=self.headers)
        assert delete_res.status_code == 200
        print(f"PASS: Deleted feedback question {q_id}")


class TestTierSettings:
    """Test customer tier settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_tier_settings(self):
        """GET /api/settings/tiers returns default tiers"""
        response = requests.get(f"{BASE_URL}/api/settings/tiers", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "tiers" in data
        assert isinstance(data["tiers"], list)
        assert len(data["tiers"]) >= 1, "Should have at least one tier"
        print(f"PASS: GET /api/settings/tiers returns {len(data['tiers'])} tiers")
        # Verify tier structure
        tier = data["tiers"][0]
        assert "name" in tier
        assert "min_amount" in tier
        print(f"PASS: First tier is '{tier['name']}' with min_amount={tier['min_amount']}")
        
    def test_update_tier_settings(self):
        """PUT /api/settings/tiers updates tiers"""
        new_tiers = [
            {"name": "Bronze", "min_amount": 0, "max_amount": 50000},
            {"name": "Silver", "min_amount": 50000, "max_amount": 200000},
            {"name": "Gold", "min_amount": 200000, "max_amount": 500000},
        ]
        response = requests.put(f"{BASE_URL}/api/settings/tiers",
            headers=self.headers,
            json={"tiers": new_tiers}
        )
        assert response.status_code == 200
        print("PASS: PUT /api/settings/tiers successfully updated")


class TestNotifications:
    """Test notifications endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_notifications(self):
        """GET /api/notifications returns notifications list"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/notifications returns {len(data)} notifications")


class TestMRPCalculator:
    """Test MRP item calculation endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_calculate_mrp_item(self):
        """POST /api/calculate/mrp-item calculates MRP item correctly"""
        mrp_item = {
            "item_type": "mrp",
            "item_name": "Diamond Ring",
            "tag_number": "TAG001",
            "gross_weight": 10.5,
            "studded_weights": [{"type": "diamond", "weight": 0.5}],
            "mrp": 100000,
            "discounts": [{"type": "percentage", "value": 10}]
        }
        response = requests.post(f"{BASE_URL}/api/calculate/mrp-item",
            headers=self.headers,
            json=mrp_item
        )
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify calculation structure
        assert "item_type" in data
        assert data["item_type"] == "mrp"
        assert "net_weight" in data
        assert "total_amount" in data
        assert "total_discount" in data
        
        # Verify net weight calculation (gross - studded)
        expected_net = 10.5 - 0.5
        assert abs(data["net_weight"] - expected_net) < 0.001, f"Net weight should be {expected_net}"
        
        # Verify discount calculation (10% of 100000 = 10000)
        assert data["total_discount"] == 10000, f"Discount should be 10000, got {data['total_discount']}"
        
        # After discount = 90000, amount without GST = 90000 / 1.03
        expected_amount = 90000 / 1.03
        assert abs(data["total_amount"] - expected_amount) < 1, f"Total amount should be ~{expected_amount}"
        
        print(f"PASS: MRP calculation correct - net_weight={data['net_weight']}, total_amount={data['total_amount']}")


class TestPhotoUpload:
    """Test photo upload endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_photo_upload_endpoint_exists(self):
        """POST /api/upload/photo accepts multipart form data"""
        # Create a simple test image bytes
        import io
        from PIL import Image
        
        # Create a simple 10x10 red image
        img = Image.new('RGB', (10, 10), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        files = {'file': ('test.jpg', img_bytes, 'image/jpeg')}
        # Remove Content-Type from headers for multipart
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/upload/photo",
            headers=headers,
            files=files
        )
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain url"
        print(f"PASS: Photo upload returns url={data['url']}")


class TestBillWithSalesperson:
    """Test bill creation with salesperson field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_create_bill_with_salesperson(self):
        """Bill creation includes salesperson_name field"""
        bill_data = {
            "customer_name": "TEST_Customer",
            "customer_phone": "9999900000",
            "customer_location": "Mumbai",
            "customer_reference": "Walk-in",
            "salesperson_name": "Rahul",
            "items": [],
            "external_charges": []
        }
        response = requests.post(f"{BASE_URL}/api/bills",
            headers=self.headers,
            json=bill_data
        )
        assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["salesperson_name"] == "Rahul"
        print(f"PASS: Bill created with salesperson_name={data['salesperson_name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{data['id']}", headers=self.headers)
        
    def test_get_bill_includes_salesperson(self):
        """GET bill includes salesperson_name field"""
        # Create bill first
        bill_data = {
            "customer_name": "TEST_Customer2",
            "customer_phone": "9999900001",
            "salesperson_name": "Priya",
            "items": [],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=self.headers, json=bill_data)
        bill_id = create_res.json().get("id")
        
        # Get bill
        get_res = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=self.headers)
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["salesperson_name"] == "Priya"
        print(f"PASS: GET bill returns salesperson_name={data['salesperson_name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=self.headers)


class TestCustomerProfile:
    """Test customer profile endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        self.token = res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_customer_by_phone(self):
        """GET /api/customers/{phone} returns customer details"""
        # First create a customer via bill
        bill_data = {
            "customer_name": "TEST_ProfileCustomer",
            "customer_phone": "8888800000",
            "customer_location": "Delhi",
            "items": [],
            "external_charges": []
        }
        requests.post(f"{BASE_URL}/api/bills", headers=self.headers, json=bill_data)
        
        # Get customer by phone
        response = requests.get(f"{BASE_URL}/api/customers/8888800000", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == "8888800000"
        assert data["name"] == "TEST_ProfileCustomer"
        print(f"PASS: Customer profile found - name={data['name']}")
        
    def test_get_customer_bills(self):
        """GET /api/customers/{phone}/bills returns customer purchase history"""
        # Assuming customer exists from previous test
        response = requests.get(f"{BASE_URL}/api/customers/8888800000/bills", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "customer" in data
        assert "bills" in data
        assert "total_spent" in data
        print(f"PASS: Customer bills returned - total_bills={data.get('total_bills', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
