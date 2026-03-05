"""
Tests for Iteration 11 Features:
1. Admin photo viewing in bill pages (lightbox opens on click)
2. Item name editing from Item Name Management page
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or "https://customer-breakdown.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json().get("token")

@pytest.fixture
def auth_headers(admin_token):
    """Auth headers for API calls"""
    return {"Authorization": f"Bearer {admin_token}"}

class TestPhotoFeatures:
    """Test photo upload, serve, and remove endpoints"""
    
    def test_upload_photo_endpoint_exists(self, auth_headers):
        """Verify photo upload endpoint exists (POST /api/upload/photo)"""
        # Creating a simple test image
        import io
        from PIL import Image
        
        # Create a simple 100x100 green test image
        img = Image.new('RGB', (100, 100), color='green')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        files = {"file": ("test_photo.png", img_bytes, "image/png")}
        headers = {"Authorization": auth_headers["Authorization"]}
        
        res = requests.post(f"{BASE_URL}/api/upload/photo", files=files, headers=headers)
        assert res.status_code == 200, f"Photo upload failed: {res.text}"
        
        data = res.json()
        assert "url" in data, "Response should contain 'url'"
        assert "filename" in data, "Response should contain 'filename'"
        
        # Store for later tests
        self.__class__.uploaded_photo_url = data["url"]
        self.__class__.uploaded_filename = data["filename"]
        print(f"Uploaded photo URL: {data['url']}")
    
    def test_serve_uploaded_photo(self, auth_headers):
        """Verify uploaded photo can be served (GET /api/uploads/{filename})"""
        if not hasattr(self.__class__, 'uploaded_filename'):
            pytest.skip("No uploaded photo to test")
        
        filename = self.__class__.uploaded_filename
        res = requests.get(f"{BASE_URL}/api/uploads/{filename}")
        assert res.status_code == 200, f"Photo serve failed: {res.text}"
        assert "image" in res.headers.get("content-type", ""), "Response should be an image"
        print(f"Photo served successfully, content-type: {res.headers.get('content-type')}")
    
    def test_create_bill_with_photo(self, auth_headers):
        """Create a bill, add item, then add photo to item"""
        # Step 1: Create a bill
        bill_payload = {
            "customer_name": "TEST_Photo Customer",
            "customer_phone": "9988776655",
            "customer_location": "Test Location",
            "items": [],
            "external_charges": []
        }
        res = requests.post(f"{BASE_URL}/api/bills", json=bill_payload, headers=auth_headers)
        assert res.status_code == 200, f"Bill creation failed: {res.text}"
        
        bill = res.json()
        bill_id = bill.get("id")
        print(f"Created bill: {bill_id}")
        
        # Step 2: Add an item with a photo
        photo_url = getattr(self.__class__, 'uploaded_photo_url', '/api/uploads/test.png')
        
        item = {
            "item_type": "gold",
            "item_name": "Test Ring",
            "purity_name": "22KT",
            "purity_percent": 92,
            "rate_mode": "normal",
            "rate_per_10g": 60000,
            "gross_weight": 10,
            "less": 0.5,
            "making_charges": [{"type": "per_gram", "value": 500}],
            "stone_charges": [],
            "photos": [photo_url]  # Add photo URL to item
        }
        
        update_payload = {
            "items": [item],
            "external_charges": []
        }
        
        res = requests.put(f"{BASE_URL}/api/bills/{bill_id}", json=update_payload, headers=auth_headers)
        assert res.status_code == 200, f"Bill update failed: {res.text}"
        
        updated_bill = res.json()
        assert len(updated_bill.get("items", [])) == 1, "Bill should have 1 item"
        assert len(updated_bill["items"][0].get("photos", [])) == 1, "Item should have 1 photo"
        
        self.__class__.test_bill_id = bill_id
        print(f"Bill updated with photo, item photos: {updated_bill['items'][0].get('photos')}")
    
    def test_photo_url_accessible(self, auth_headers):
        """Verify photo URL in bill is accessible"""
        if not hasattr(self.__class__, 'test_bill_id'):
            pytest.skip("No test bill created")
        
        bill_id = self.__class__.test_bill_id
        res = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=auth_headers)
        assert res.status_code == 200, f"Bill fetch failed: {res.text}"
        
        bill = res.json()
        photo_url = bill.get("items", [{}])[0].get("photos", [None])[0]
        assert photo_url is not None, "Photo URL should exist"
        
        # Test accessing the photo via full URL
        full_url = f"{BASE_URL}{photo_url}"
        photo_res = requests.get(full_url)
        assert photo_res.status_code == 200, f"Photo not accessible at {full_url}: {photo_res.status_code}"
        print(f"Photo accessible at: {full_url}")
    
    def test_remove_photo_from_item(self, auth_headers):
        """Test removing photo from item (DELETE /api/bills/{bill_id}/items/{idx}/photos/{pidx})"""
        if not hasattr(self.__class__, 'test_bill_id'):
            pytest.skip("No test bill created")
        
        bill_id = self.__class__.test_bill_id
        
        # Remove photo at index 0 from item at index 0
        res = requests.delete(f"{BASE_URL}/api/bills/{bill_id}/items/0/photos/0", headers=auth_headers)
        assert res.status_code == 200, f"Photo removal failed: {res.text}"
        
        updated_bill = res.json()
        photos = updated_bill.get("items", [{}])[0].get("photos", [])
        assert len(photos) == 0, "Photo should be removed"
        print("Photo removed successfully")
    
    def test_cleanup_test_bill(self, auth_headers):
        """Cleanup: Delete test bill"""
        if hasattr(self.__class__, 'test_bill_id'):
            bill_id = self.__class__.test_bill_id
            res = requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=auth_headers)
            print(f"Cleanup: Deleted test bill {bill_id}, status: {res.status_code}")


class TestItemNameManagement:
    """Test item name CRUD and edit functionality"""
    
    def test_list_item_names(self, auth_headers):
        """Verify GET /api/item-names returns list"""
        res = requests.get(f"{BASE_URL}/api/item-names", headers=auth_headers)
        assert res.status_code == 200, f"List item names failed: {res.text}"
        
        items = res.json()
        assert isinstance(items, list), "Response should be a list"
        print(f"Found {len(items)} item names")
    
    def test_create_item_name(self, auth_headers):
        """Test creating a new item name (POST /api/item-names)"""
        payload = {"name": "TEST_ItemName_New"}
        res = requests.post(f"{BASE_URL}/api/item-names", json=payload, headers=auth_headers)
        assert res.status_code == 200, f"Create item name failed: {res.text}"
        
        item = res.json()
        assert item.get("name") == "TEST_ItemName_New", "Item name should match"
        assert "id" in item, "Response should contain 'id'"
        
        self.__class__.created_item_id = item.get("id")
        print(f"Created item name with id: {item.get('id')}")
    
    def test_edit_item_name(self, auth_headers):
        """Test editing item name (PUT /api/item-names/{id})"""
        if not hasattr(self.__class__, 'created_item_id'):
            pytest.skip("No item created to edit")
        
        item_id = self.__class__.created_item_id
        payload = {"name": "TEST_ItemName_Edited"}
        
        res = requests.put(f"{BASE_URL}/api/item-names/{item_id}", json=payload, headers=auth_headers)
        assert res.status_code == 200, f"Edit item name failed: {res.text}"
        
        data = res.json()
        assert data.get("status") == "updated" or data.get("name") == "TEST_ItemName_Edited", "Item should be updated"
        print(f"Item name edited successfully: {data}")
    
    def test_verify_item_name_edited(self, auth_headers):
        """Verify item name was actually edited"""
        if not hasattr(self.__class__, 'created_item_id'):
            pytest.skip("No item created to verify")
        
        res = requests.get(f"{BASE_URL}/api/item-names", headers=auth_headers)
        assert res.status_code == 200, f"List item names failed: {res.text}"
        
        items = res.json()
        edited_item = next((i for i in items if i.get("id") == self.__class__.created_item_id), None)
        assert edited_item is not None, "Edited item should exist"
        assert edited_item.get("name") == "TEST_ItemName_Edited", f"Item name should be 'TEST_ItemName_Edited', got: {edited_item.get('name')}"
        print(f"Verified edited item: {edited_item}")
    
    def test_duplicate_item_name_rejected(self, auth_headers):
        """Test that duplicate item names are rejected"""
        # First create another item
        payload = {"name": "TEST_ItemName_Duplicate"}
        res = requests.post(f"{BASE_URL}/api/item-names", json=payload, headers=auth_headers)
        
        if res.status_code == 200:
            # Try to create duplicate
            dup_res = requests.post(f"{BASE_URL}/api/item-names", json=payload, headers=auth_headers)
            assert dup_res.status_code == 400, f"Duplicate should be rejected: {dup_res.text}"
            print("Duplicate item name correctly rejected")
            
            # Cleanup
            item_id = res.json().get("id")
            requests.delete(f"{BASE_URL}/api/item-names/{item_id}", headers=auth_headers)
    
    def test_delete_item_name(self, auth_headers):
        """Test deleting item name (DELETE /api/item-names/{id})"""
        if not hasattr(self.__class__, 'created_item_id'):
            pytest.skip("No item created to delete")
        
        item_id = self.__class__.created_item_id
        res = requests.delete(f"{BASE_URL}/api/item-names/{item_id}", headers=auth_headers)
        assert res.status_code == 200, f"Delete item name failed: {res.text}"
        
        # Verify deletion
        list_res = requests.get(f"{BASE_URL}/api/item-names", headers=auth_headers)
        items = list_res.json()
        deleted_item = next((i for i in items if i.get("id") == item_id), None)
        assert deleted_item is None, "Deleted item should not exist"
        print(f"Item name deleted successfully")


class TestAdminLogin:
    """Test admin login flow"""
    
    def test_admin_login_with_password(self):
        """Test admin can login with password (POST /api/auth/login)"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin1123"
        })
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        
        data = res.json()
        assert "token" in data, "Response should contain 'token'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"].get("role") == "admin", "User role should be 'admin'"
        print("Admin login successful")
    
    def test_admin_login_wrong_password(self):
        """Test admin login with wrong password fails"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert res.status_code == 401, f"Should reject wrong password: {res.status_code}"
        print("Wrong password correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
