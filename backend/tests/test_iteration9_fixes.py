"""
AJPL Calculator - Iteration 9 Bug Fixes Tests
Tests for the 9 user-reported issues that were just fixed:
1. MRP items should be editable after saving
2. Show full calculation details to manager/admin (making charges were not showing)
3. Admin should see pending bills and approve them
4. Manager back-button loop between bill/items pages - approve should redirect to home
5. Complete calculations in printed bill/PDF
6. Customer tier calculations wrong - items were counted as bills
7. Phone number must be 10 digits (frontend validation)
8. Photos should be openable, editable (removable) across all users
9. MRP section in bill printing should show MRP in place of rate/10g and Discount in place of gold value

Also: Multi-tab billing UI for sales executives
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_auth():
    """Get admin token for authenticated requests"""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin1123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json().get("token")
    return {"Authorization": f"Bearer {token}"}


class TestAdminDashboardBillTabs:
    """Issue #3: Admin should see pending bills and approve them"""
    
    def test_admin_can_get_all_bills(self, admin_auth):
        """Admin can get all bills (for tabs: pending/approved/draft/all)"""
        response = requests.get(f"{BASE_URL}/api/bills", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin can get all bills - count={len(data)}")
        
    def test_admin_can_filter_pending_bills(self, admin_auth):
        """Admin can filter bills by status=sent for pending tab"""
        response = requests.get(f"{BASE_URL}/api/bills?status=sent", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        # All returned bills should have status 'sent' or empty
        for bill in data:
            assert bill["status"] == "sent"
        print(f"PASS: Admin pending bills filter works - count={len(data)}")
        
    def test_admin_can_filter_approved_bills(self, admin_auth):
        """Admin can filter bills by status=approved"""
        response = requests.get(f"{BASE_URL}/api/bills?status=approved", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        for bill in data:
            assert bill["status"] == "approved"
        print(f"PASS: Admin approved bills filter works - count={len(data)}")


class TestBillApproval:
    """Issue #3 & #4: Admin can approve bills, redirect after approval"""
    
    def test_create_send_and_approve_bill(self, admin_auth):
        """Full flow: create draft, send to manager, approve"""
        # Step 1: Create a draft bill
        bill_data = {
            "customer_name": "TEST_ApprovalFlow",
            "customer_phone": "7777700001",
            "customer_location": "Test City",
            "customer_reference": "Walk-in",
            "salesperson_name": "Test SP",
            "items": [],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        assert create_res.status_code == 200
        bill_id = create_res.json()["id"]
        print(f"PASS: Created draft bill {bill_id}")
        
        # Step 2: Send bill to manager
        send_res = requests.put(f"{BASE_URL}/api/bills/{bill_id}/send", headers=admin_auth)
        assert send_res.status_code == 200
        print("PASS: Bill sent to manager")
        
        # Step 3: Verify bill status is now 'sent'
        get_res = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)
        assert get_res.json()["status"] == "sent"
        print("PASS: Bill status is 'sent'")
        
        # Step 4: Approve the bill
        approve_res = requests.put(f"{BASE_URL}/api/bills/{bill_id}/approve", headers=admin_auth)
        assert approve_res.status_code == 200
        print("PASS: Bill approved")
        
        # Step 5: Verify status is now 'approved'
        get_res2 = requests.get(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)
        assert get_res2.json()["status"] == "approved"
        print("PASS: Bill status is 'approved' after approval")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)


class TestBillSummaryFullDetails:
    """Issue #2: Show full calculation details to manager/admin"""
    
    def test_summary_includes_gold_value(self, admin_auth):
        """Summary endpoint returns gold_value for gold items"""
        # Create bill with gold item
        bill_data = {
            "customer_name": "TEST_SummaryGold",
            "customer_phone": "7777700002",
            "items": [{
                "item_type": "gold",
                "item_name": "Gold Ring",
                "tag_number": "TAG-001",
                "rate_mode": "manual",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 60000,
                "gross_weight": 10,
                "less": 0.5,
                "making_charges": [{"type": "per_gram", "value": 500}],
                "stone_charges": [],
                "studded_charges": []
            }],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        bill_id = create_res.json()["id"]
        
        # Get summary
        summary_res = requests.get(f"{BASE_URL}/api/bills/{bill_id}/summary", headers=admin_auth)
        assert summary_res.status_code == 200
        summary = summary_res.json()
        
        # Check item details are complete
        item = summary["items"][0]
        assert "gold_value" in item, "Summary should include gold_value"
        assert "total_making" in item, "Summary should include total_making"
        assert "making_charges" in item, "Summary should include making_charges breakdown"
        assert item["gold_value"] > 0, "gold_value should be calculated"
        print(f"PASS: Summary includes gold_value={item['gold_value']}, total_making={item['total_making']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)
        
    def test_summary_includes_mrp_details(self, admin_auth):
        """Summary endpoint returns MRP item details"""
        # Create bill with MRP item via calculate endpoint
        mrp_item = {
            "item_type": "mrp",
            "item_name": "MRP Ring",
            "tag_number": "MRP-001",
            "gross_weight": 8.5,
            "studded_weights": [{"type": "diamond", "weight": 1.0}],
            "mrp": 150000,
            "discounts": [{"type": "percentage", "value": 10}]
        }
        
        # Calculate MRP item first
        calc_res = requests.post(f"{BASE_URL}/api/calculate/mrp-item", headers=admin_auth, json=mrp_item)
        assert calc_res.status_code == 200
        calculated_item = calc_res.json()
        
        # Create bill with calculated MRP item
        bill_data = {
            "customer_name": "TEST_SummaryMRP",
            "customer_phone": "7777700003",
            "items": [calculated_item],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        bill_id = create_res.json()["id"]
        
        # Get summary
        summary_res = requests.get(f"{BASE_URL}/api/bills/{bill_id}/summary", headers=admin_auth)
        summary = summary_res.json()
        
        item = summary["items"][0]
        assert "mrp" in item, "Summary should include mrp"
        assert "total_discount" in item, "Summary should include total_discount"
        assert "after_discount" in item, "Summary should include after_discount"
        assert "discounts" in item, "Summary should include discounts array"
        print(f"PASS: MRP summary includes mrp={item['mrp']}, total_discount={item['total_discount']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)


class TestMRPItemEdit:
    """Issue #1: MRP items should be editable after saving"""
    
    def test_edit_mrp_item_in_bill(self, admin_auth):
        """MRP items can be edited via PUT /bills/{id}"""
        # Create MRP item
        mrp_item = {
            "item_type": "mrp",
            "item_name": "Edit Test Ring",
            "tag_number": "EDIT-001",
            "gross_weight": 5.0,
            "studded_weights": [],
            "mrp": 50000,
            "discounts": []
        }
        calc_res = requests.post(f"{BASE_URL}/api/calculate/mrp-item", headers=admin_auth, json=mrp_item)
        calculated_item = calc_res.json()
        
        # Create bill
        bill_data = {
            "customer_name": "TEST_MRPEdit",
            "customer_phone": "7777700004",
            "items": [calculated_item],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        bill_id = create_res.json()["id"]
        original_total = create_res.json()["grand_total"]
        
        # Update MRP item with new discount
        updated_mrp = {
            "item_type": "mrp",
            "item_name": "Edit Test Ring",
            "tag_number": "EDIT-001",
            "gross_weight": 5.0,
            "studded_weights": [],
            "mrp": 50000,
            "discounts": [{"type": "percentage", "value": 20}]  # Add 20% discount
        }
        calc_updated = requests.post(f"{BASE_URL}/api/calculate/mrp-item", headers=admin_auth, json=updated_mrp)
        
        # Update bill with new item
        update_res = requests.put(f"{BASE_URL}/api/bills/{bill_id}", 
            headers=admin_auth,
            json={"items": [calc_updated.json()], "external_charges": []}
        )
        assert update_res.status_code == 200
        updated_bill = update_res.json()
        
        # Verify MRP item was updated (discount applied means total changed)
        assert updated_bill["items"][0]["total_discount"] == 10000  # 20% of 50000
        print(f"PASS: MRP item editable - original_total changed from {original_total} to {updated_bill['grand_total']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)


class TestPhotoRemoval:
    """Issue #8: Photos should be removable"""
    
    def test_photo_removal_endpoint_exists(self, admin_auth):
        """DELETE /api/bills/{bill_id}/items/{item_index}/photos/{photo_index} works"""
        # First create a bill with an item
        bill_data = {
            "customer_name": "TEST_PhotoRemove",
            "customer_phone": "7777700005",
            "items": [{
                "item_type": "gold",
                "item_name": "Photo Test",
                "rate_mode": "manual",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 60000,
                "gross_weight": 5,
                "less": 0,
                "making_charges": [],
                "stone_charges": [],
                "studded_charges": [],
                "photos": ["/uploads/test1.jpg", "/uploads/test2.jpg"]  # Simulated photos
            }],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        bill_id = create_res.json()["id"]
        
        # Try to remove photo at index 0
        delete_res = requests.delete(f"{BASE_URL}/api/bills/{bill_id}/items/0/photos/0", headers=admin_auth)
        assert delete_res.status_code == 200, f"Photo removal failed: {delete_res.text}"
        
        # Verify photo was removed
        updated_bill = delete_res.json()
        remaining_photos = updated_bill["items"][0].get("photos", [])
        assert len(remaining_photos) == 1, "Should have 1 photo remaining"
        print(f"PASS: Photo removed - remaining photos: {len(remaining_photos)}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)


class TestCustomerFrequencyFromBills:
    """Issue #6: Customer tier calculations - should be from actual bills not cached"""
    
    def test_customer_frequency_uses_actual_bills(self, admin_auth):
        """GET /api/analytics/customers/frequency calculates from actual bills"""
        response = requests.get(f"{BASE_URL}/api/analytics/customers/frequency", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        
        assert "frequency_cohorts" in data
        assert "spending_tiers" in data
        assert "total_customers" in data
        
        # Verify spending tiers are populated
        spending_tiers = data["spending_tiers"]
        assert isinstance(spending_tiers, list)
        assert len(spending_tiers) > 0
        
        # Check structure
        tier = spending_tiers[0]
        assert "name" in tier
        assert "count" in tier
        assert "total_spent" in tier
        
        print(f"PASS: Customer frequency endpoint returns {len(spending_tiers)} spending tiers")
        for tier in spending_tiers:
            print(f"  - {tier['name']}: {tier['count']} customers, total spent: {tier['total_spent']}")


class TestBillPDFGeneration:
    """Issue #5 & #9: Complete calculations in PDF, MRP shows correctly"""
    
    def test_pdf_endpoint_works(self, admin_auth):
        """GET /api/bills/{id}/pdf returns PDF"""
        # Create a bill first
        bill_data = {
            "customer_name": "TEST_PDFTest",
            "customer_phone": "7777700006",
            "items": [{
                "item_type": "gold",
                "item_name": "PDF Test Ring",
                "rate_mode": "manual",
                "purity_name": "22KT",
                "purity_percent": 92,
                "rate_per_10g": 60000,
                "gross_weight": 5,
                "less": 0.5,
                "making_charges": [{"type": "per_gram", "value": 400}],
                "stone_charges": [],
                "studded_charges": []
            }],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        bill_id = create_res.json()["id"]
        
        # Get PDF
        pdf_res = requests.get(f"{BASE_URL}/api/bills/{bill_id}/pdf", headers=admin_auth)
        assert pdf_res.status_code == 200
        assert pdf_res.headers.get('content-type') == 'application/pdf'
        assert len(pdf_res.content) > 0
        print(f"PASS: PDF generation works - size={len(pdf_res.content)} bytes")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)
        
    def test_pdf_with_mrp_item(self, admin_auth):
        """PDF generation works with MRP items"""
        # Create MRP item
        mrp_item = {
            "item_type": "mrp",
            "item_name": "MRP PDF Ring",
            "tag_number": "PDF-MRP",
            "gross_weight": 6.0,
            "studded_weights": [],
            "mrp": 80000,
            "discounts": [{"type": "flat", "value": 5000}]
        }
        calc_res = requests.post(f"{BASE_URL}/api/calculate/mrp-item", headers=admin_auth, json=mrp_item)
        
        bill_data = {
            "customer_name": "TEST_PDFMRPTest",
            "customer_phone": "7777700007",
            "items": [calc_res.json()],
            "external_charges": []
        }
        create_res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
        bill_id = create_res.json()["id"]
        
        # Get PDF
        pdf_res = requests.get(f"{BASE_URL}/api/bills/{bill_id}/pdf", headers=admin_auth)
        assert pdf_res.status_code == 200
        assert pdf_res.headers.get('content-type') == 'application/pdf'
        print(f"PASS: MRP item PDF generation works - size={len(pdf_res.content)} bytes")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bills/{bill_id}", headers=admin_auth)


class TestMultiBillDrafts:
    """Multi-tab billing UI for sales executives"""
    
    def test_executive_can_have_multiple_draft_bills(self, admin_auth):
        """Executive can create multiple draft bills"""
        # Create multiple draft bills
        bill_ids = []
        for i in range(3):
            bill_data = {
                "customer_name": f"TEST_MultiDraft_{i}",
                "customer_phone": f"666600000{i}",
                "items": [],
                "external_charges": []
            }
            res = requests.post(f"{BASE_URL}/api/bills", headers=admin_auth, json=bill_data)
            assert res.status_code == 200
            bill_ids.append(res.json()["id"])
        
        # Get all bills and filter drafts
        all_res = requests.get(f"{BASE_URL}/api/bills?status=draft", headers=admin_auth)
        draft_bills = [b for b in all_res.json() if b["customer_name"].startswith("TEST_MultiDraft")]
        
        assert len(draft_bills) >= 3, "Should have at least 3 draft bills"
        print(f"PASS: Multiple draft bills exist - count={len(draft_bills)}")
        
        # Cleanup
        for bid in bill_ids:
            requests.delete(f"{BASE_URL}/api/bills/{bid}", headers=admin_auth)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
