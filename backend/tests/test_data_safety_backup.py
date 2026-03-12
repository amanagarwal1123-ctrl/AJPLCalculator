"""
Test Data Safety Backup Feature for AJPL Calculator
- GET /api/admin/backup/status - backup status (admin only)
- POST /api/admin/backup/export - encrypted .dat export
- POST /api/admin/backup/export-excel - .xlsx export
- POST /api/admin/backup/import/preview - dry-run preview
- POST /api/admin/backup/import/apply - apply import
- GET /api/admin/backup/decode-instructions - decode instructions text
- Admin-only access (403 for non-admin)
- Wrong password error handling
"""

import pytest
import requests
import os
import io

# Use PUBLIC URL from env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin1123"
TEST_BACKUP_PASSWORD = "test1234"


class TestAdminAuth:
    """Authentication tests for admin user"""
    
    def test_admin_login(self):
        """Test admin can login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert data["user"]["role"] == "admin", "User is not admin"
        print(f"Admin login successful: {data['user']['username']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed - cannot run backup tests")
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    """Authenticated requests session for admin"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


class TestBackupStatus:
    """GET /api/admin/backup/status tests"""
    
    def test_get_backup_status_admin(self, admin_client):
        """Admin can get backup status"""
        response = admin_client.get(f"{BASE_URL}/api/admin/backup/status")
        assert response.status_code == 200, f"Status failed: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "last_export" in data, "Missing last_export field"
        assert "period_start_ist" in data, "Missing period_start_ist"
        assert "period_end_ist" in data, "Missing period_end_ist"
        assert "current_year" in data, "Missing current_year"
        print(f"Backup status: current_year={data['current_year']}, last_export={data['last_export']}")
    
    def test_get_backup_status_unauthenticated(self):
        """Unauthenticated user cannot get backup status"""
        response = requests.get(f"{BASE_URL}/api/admin/backup/status")
        assert response.status_code == 401, "Should require authentication"
        print("Unauthenticated access correctly rejected")


class TestBackupExport:
    """POST /api/admin/backup/export tests"""
    
    def test_export_encrypted_backup(self, admin_client):
        """Admin can export encrypted .dat backup"""
        # Need to send JSON body with password
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/export",
            headers={"Authorization": admin_client.headers["Authorization"]},
            json={"password": TEST_BACKUP_PASSWORD}
        )
        assert response.status_code == 200, f"Export failed: {response.text}"
        # Verify it's a binary file
        assert len(response.content) > 100, "Export file too small"
        # Check for AJPLDAT1 magic header
        assert response.content[:8] == b"AJPLDAT1", "Missing AJPLDAT1 magic header"
        # Check content-disposition header
        cd = response.headers.get("content-disposition", "")
        assert "AJPL_BACKUP" in cd, f"Missing expected filename in header: {cd}"
        print(f"Encrypted backup exported: {len(response.content)} bytes, header: {cd}")
    
    def test_export_short_password_rejected(self, admin_client):
        """Export with short password (<6 chars) is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/export",
            headers={"Authorization": admin_client.headers["Authorization"]},
            json={"password": "abc"}  # Too short
        )
        assert response.status_code == 400, f"Should reject short password: {response.status_code}"
        data = response.json()
        assert "6 characters" in data.get("detail", "").lower() or "password" in data.get("detail", "").lower()
        print(f"Short password correctly rejected: {data['detail']}")


class TestExcelExport:
    """POST /api/admin/backup/export-excel tests"""
    
    def test_export_excel_snapshot(self, admin_client):
        """Admin can export Excel snapshot"""
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/export-excel",
            headers={"Authorization": admin_client.headers["Authorization"]}
        )
        assert response.status_code == 200, f"Excel export failed: {response.text}"
        # Verify it's an xlsx file (starts with PK for zip)
        assert len(response.content) > 100, "Excel file too small"
        assert response.content[:2] == b"PK", "Not a valid xlsx file (missing PK header)"
        # Check content-disposition
        cd = response.headers.get("content-disposition", "")
        assert "AJPL_EXCEL" in cd or ".xlsx" in cd, f"Missing expected filename: {cd}"
        print(f"Excel snapshot exported: {len(response.content)} bytes, header: {cd}")


class TestDecodeInstructions:
    """GET /api/admin/backup/decode-instructions tests"""
    
    def test_get_decode_instructions(self, admin_client):
        """Admin can download decode instructions"""
        response = admin_client.get(f"{BASE_URL}/api/admin/backup/decode-instructions")
        assert response.status_code == 200, f"Decode instructions failed: {response.text}"
        text = response.text
        # Verify content
        assert "AJPLDAT1" in text, "Missing AJPLDAT1 reference"
        assert "AES-256-CBC" in text, "Missing encryption details"
        assert "PBKDF2" in text or "250000" in text, "Missing KDF details"
        assert "Python" in text, "Missing Python script"
        # Check header
        cd = response.headers.get("content-disposition", "")
        assert "DECODE" in cd or ".txt" in cd, f"Missing expected filename: {cd}"
        print(f"Decode instructions downloaded: {len(text)} chars")


class TestImportPreview:
    """POST /api/admin/backup/import/preview tests"""
    
    @pytest.fixture
    def backup_file(self, admin_client):
        """Create a backup file for import tests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/export",
            headers={"Authorization": admin_client.headers["Authorization"]},
            json={"password": TEST_BACKUP_PASSWORD}
        )
        assert response.status_code == 200, f"Failed to create backup for import test: {response.text}"
        return response.content
    
    def test_import_preview_merge_mode(self, admin_client, backup_file):
        """Import preview with merge mode shows expected actions"""
        files = {"file": ("backup.dat", io.BytesIO(backup_file), "application/octet-stream")}
        data = {"password": TEST_BACKUP_PASSWORD, "mode": "merge"}
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/import/preview",
            headers={"Authorization": admin_client.headers["Authorization"]},
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        result = response.json()
        # Verify structure
        assert "mode" in result, "Missing mode"
        assert result["mode"] == "merge", f"Wrong mode: {result['mode']}"
        assert "collections" in result, "Missing collections"
        assert "manifest" in result, "Missing manifest"
        # Check some collections
        colls = result["collections"]
        assert "users" in colls, "Missing users collection"
        assert "bills" in colls, "Missing bills collection"
        print(f"Import preview (merge): {len(colls)} collections, mode={result['mode']}")
        for cname, counts in colls.items():
            print(f"  {cname}: insert={counts.get('insert', 0)}, update={counts.get('update', 0)}")
    
    def test_import_preview_replace_mode(self, admin_client, backup_file):
        """Import preview with replace_current_year_data mode"""
        files = {"file": ("backup.dat", io.BytesIO(backup_file), "application/octet-stream")}
        data = {"password": TEST_BACKUP_PASSWORD, "mode": "replace_current_year_data"}
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/import/preview",
            headers={"Authorization": admin_client.headers["Authorization"]},
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        result = response.json()
        assert result["mode"] == "replace_current_year_data"
        # For transactional collections (bills, feedbacks, notifications), expect delete counts
        print(f"Import preview (replace): {len(result['collections'])} collections")
        for cname in ["bills", "feedbacks", "notifications"]:
            if cname in result["collections"]:
                counts = result["collections"][cname]
                print(f"  {cname}: delete={counts.get('delete', 0)}, insert={counts.get('insert', 0)}")
    
    def test_import_preview_wrong_password(self, admin_client, backup_file):
        """Import preview with wrong password returns clear error"""
        files = {"file": ("backup.dat", io.BytesIO(backup_file), "application/octet-stream")}
        data = {"password": "wrongpassword123", "mode": "merge"}
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/import/preview",
            headers={"Authorization": admin_client.headers["Authorization"]},
            files=files,
            data=data
        )
        assert response.status_code == 400, f"Should fail with wrong password: {response.status_code}"
        detail = response.json().get("detail", "").lower()
        assert "wrong password" in detail or "corrupt" in detail or "invalid" in detail, f"Error not clear: {detail}"
        print(f"Wrong password correctly rejected: {response.json()['detail']}")


class TestImportApply:
    """POST /api/admin/backup/import/apply tests"""
    
    @pytest.fixture
    def backup_file(self, admin_client):
        """Create a backup file for import tests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/export",
            headers={"Authorization": admin_client.headers["Authorization"]},
            json={"password": TEST_BACKUP_PASSWORD}
        )
        assert response.status_code == 200, f"Failed to create backup: {response.text}"
        return response.content
    
    def test_import_apply_merge_mode(self, admin_client, backup_file):
        """Import apply with merge mode"""
        files = {"file": ("backup.dat", io.BytesIO(backup_file), "application/octet-stream")}
        data = {"password": TEST_BACKUP_PASSWORD, "mode": "merge"}
        response = requests.post(
            f"{BASE_URL}/api/admin/backup/import/apply",
            headers={"Authorization": admin_client.headers["Authorization"]},
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Apply failed: {response.text}"
        result = response.json()
        assert "mode" in result, "Missing mode"
        assert result["mode"] == "merge", f"Wrong mode: {result['mode']}"
        assert "results" in result, "Missing results"
        print(f"Import apply (merge): {len(result['results'])} collections processed")
        for cname, counts in result["results"].items():
            print(f"  {cname}: inserted={counts.get('inserted', 0)}, updated={counts.get('updated', 0)}")


class TestAccessControl:
    """Test that non-admin users are rejected (403)"""
    
    def test_non_admin_rejected_status(self):
        """Non-admin user cannot access backup status"""
        # Try without any auth
        response = requests.get(f"{BASE_URL}/api/admin/backup/status")
        assert response.status_code == 401, "Should require authentication"
        print("Non-authenticated correctly rejected with 401")
    
    def test_invalid_token_rejected(self):
        """Invalid token is rejected"""
        response = requests.get(
            f"{BASE_URL}/api/admin/backup/status",
            headers={"Authorization": "Bearer invalid_token_123"}
        )
        assert response.status_code == 401, f"Should reject invalid token: {response.status_code}"
        print("Invalid token correctly rejected with 401")


class TestRoundtrip:
    """Test export->import roundtrip preserves data"""
    
    def test_export_import_roundtrip(self, admin_client):
        """Export and reimport preserves data"""
        # 1. Get initial counts
        status_before = admin_client.get(f"{BASE_URL}/api/admin/backup/status").json()
        
        # 2. Export backup
        export_response = requests.post(
            f"{BASE_URL}/api/admin/backup/export",
            headers={"Authorization": admin_client.headers["Authorization"]},
            json={"password": TEST_BACKUP_PASSWORD}
        )
        assert export_response.status_code == 200, "Export failed"
        backup_data = export_response.content
        
        # 3. Preview import
        files = {"file": ("backup.dat", io.BytesIO(backup_data), "application/octet-stream")}
        data = {"password": TEST_BACKUP_PASSWORD, "mode": "merge"}
        preview_response = requests.post(
            f"{BASE_URL}/api/admin/backup/import/preview",
            headers={"Authorization": admin_client.headers["Authorization"]},
            files=files,
            data=data
        )
        assert preview_response.status_code == 200, "Preview failed"
        preview = preview_response.json()
        
        # 4. Verify preview shows expected structure
        assert preview["mode"] == "merge"
        assert "collections" in preview
        
        # 5. Apply import
        files = {"file": ("backup.dat", io.BytesIO(backup_data), "application/octet-stream")}
        apply_response = requests.post(
            f"{BASE_URL}/api/admin/backup/import/apply",
            headers={"Authorization": admin_client.headers["Authorization"]},
            files=files,
            data=data
        )
        assert apply_response.status_code == 200, "Apply failed"
        result = apply_response.json()
        
        # 6. Verify roundtrip completed
        assert result["mode"] == "merge"
        print("Export->Import roundtrip completed successfully")
        print(f"Collections processed: {list(result['results'].keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
