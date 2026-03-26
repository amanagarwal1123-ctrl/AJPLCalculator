from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Response, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json
from bson import ObjectId
from calc_engine import (
    calculate_gold_item,
    calculate_diamond_item,
    calculate_bill_totals,
)
import io
import shutil
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib import colors as rl_colors
import pytz

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Canonical reference mapping for case-insensitive grouping
import re as _re
import unicodedata as _ud

# Matches zero-width / truly invisible chars → remove entirely
_ZERO_WIDTH_RE = _re.compile(
    r'[\u0000-\u001f'   # C0 control chars
    r'\u007f-\u009f'     # C1 control chars
    r'\u00ad'            # soft hyphen
    r'\u034f'            # combining grapheme joiner
    r'\u061c'            # arabic letter mark
    r'\u115f\u1160'      # hangul fillers
    r'\u17b4\u17b5'      # khmer vowel inherent
    r'\u180e'            # mongolian vowel separator
    r'\u200b-\u200f'     # zero-width spaces, LTR/RTL marks
    r'\u2028\u2029'      # line/paragraph separators
    r'\u202a-\u202e'     # embedding marks
    r'\u2060-\u2064'     # word joiner, invisible chars
    r'\u2066-\u2069'     # bidi isolates
    r'\u206a-\u206f'     # deprecated formatting
    r'\u3164'            # hangul filler
    r'\ufeff'            # BOM / zero-width no-break space
    r'\uffa0'            # halfwidth hangul filler
    r'\ufff0-\uffff'     # specials
    r']+'
)

# Matches space-like invisible chars → replace with regular space
_SPACE_LIKE_RE = _re.compile(
    r'[\u00a0'           # non-breaking space
    r'\u2000-\u200a'     # en/em/thin/hair spaces etc.
    r'\u202f'            # narrow no-break space
    r'\u205f'            # medium mathematical space
    r'\u3000'            # ideographic space
    r']+'
)

_KNOWN_REFS = {
    'instagram': 'Instagram',
    'facebook': 'Facebook',
    'friends': 'Friends',
    'family': 'Family',
    'repeat customer': 'Repeat Customer',
    'walk-in': 'Walk-in',
    'walkin': 'Walk-in',
    'walk in': 'Walk-in',
    'google': 'Google',
    'newspaper': 'Newspaper',
    'tv': 'TV',
    'other': 'Other',
}

def normalize_reference(ref: str) -> str:
    """Aggressively normalize a reference string.
    Removes zero-width chars, replaces space-like chars with regular space,
    and maps to a known canonical form."""
    if not ref:
        return ""
    # Remove zero-width/invisible chars entirely
    cleaned = _ZERO_WIDTH_RE.sub('', ref)
    # Replace space-like chars with regular space
    cleaned = _SPACE_LIKE_RE.sub(' ', cleaned)
    # Collapse any remaining whitespace
    cleaned = ' '.join(cleaned.split())
    if not cleaned:
        return ""
    # Look up canonical form
    key = cleaned.lower()
    if key in _KNOWN_REFS:
        return _KNOWN_REFS[key]
    return cleaned.title()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'gold_jewellery_sales')]

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET')
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Create the main app
app = FastAPI(title="AJPL Calculator")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ HELPERS ============
def serialize_doc(doc):
    """Convert MongoDB document to JSON-safe dict."""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == '_id':
            # Only set 'id' from _id if the doc doesn't already have a custom 'id'
            if 'id' not in doc:
                result['id'] = str(value)
            # Skip _id field in output
            continue
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else str(v) if isinstance(v, (ObjectId, datetime)) else v for v in value]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result

IST = pytz.timezone('Asia/Kolkata')

# Uploads directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

def create_token(data: dict):
    to_encode = data.copy()
    role = data.get("role", "")
    if role in ("manager", "executive"):
        # Expire at 10 PM IST today (or tomorrow if already past 10 PM)
        now_ist = datetime.now(IST)
        cutoff = now_ist.replace(hour=22, minute=0, second=0, microsecond=0)
        if now_ist >= cutoff:
            cutoff += timedelta(days=1)
        expire = cutoff.astimezone(timezone.utc)
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Session check for non-admin users
        if user.get("role") != "admin":
            session = await db.sessions.find_one({
                "user_id": user_id,
                "token": credentials.credentials,
                "is_active": True,
            })
            if not session:
                raise HTTPException(status_code=401, detail="Session expired or logged in from another device")
        return serialize_doc(user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_role(user: dict, roles: list):
    if user.get('role') not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

async def check_bill_access(bill: dict, user: dict):
    """Verify user has access to this bill based on role/ownership."""
    role = user.get('role', '')
    if role == 'admin':
        return  # Admin sees all
    if role == 'manager':
        if user.get('branch_id') and bill.get('branch_id') and user['branch_id'] != bill['branch_id']:
            raise HTTPException(status_code=403, detail="Bill belongs to a different branch")
        return

async def enrich_bills_with_customer_data(bills_serialized: list) -> list:
    """Enrich bill list with current customer names from the customers collection."""
    if not bills_serialized:
        return bills_serialized
    # Collect unique customer_ids and phones
    cust_ids = set()
    phones = set()
    for b in bills_serialized:
        if b.get("customer_id"):
            cust_ids.add(b["customer_id"])
        if b.get("customer_phone"):
            phones.add(b["customer_phone"])
    # Batch lookup customers by id and phone
    customer_map = {}  # phone -> customer data
    if cust_ids:
        async for c in db.customers.find({"id": {"$in": list(cust_ids)}}):
            phone = c.get("phone", "")
            if phone:
                customer_map[phone] = c
            cid = c.get("id", "")
            if cid:
                customer_map[f"_id_{cid}"] = c
    if phones:
        remaining = [p for p in phones if p not in customer_map]
        if remaining:
            async for c in db.customers.find({"$or": [{"phone": {"$in": remaining}}, {"phones": {"$in": remaining}}]}):
                phone = c.get("phone", "")
                if phone:
                    customer_map[phone] = c
                for p in (c.get("phones") or []):
                    if p:
                        customer_map[p] = c
    # Enrich bills
    for b in bills_serialized:
        cust = customer_map.get(f"_id_{b.get('customer_id')}") or customer_map.get(b.get("customer_phone", ""))
        if cust:
            if cust.get("name"):
                b["customer_name"] = cust["name"]
            if cust.get("phone"):
                b["customer_phone"] = cust["phone"]
            if cust.get("location"):
                b["customer_location"] = cust["location"]
            if cust.get("reference"):
                b["customer_reference"] = cust["reference"]
    return bills_serialized
    if role == 'executive':
        if bill.get('executive_id') != user.get('id'):
            raise HTTPException(status_code=403, detail="You can only access your own bills")
        return
    raise HTTPException(status_code=403, detail="Insufficient permissions")

# ============ MODELS ============
class LoginRequest(BaseModel):
    username: str
    password: str

class OTPRequest(BaseModel):
    username: str

class OTPVerify(BaseModel):
    username: str
    otp: str

class UserCreate(BaseModel):
    username: str
    password: Optional[str] = None
    full_name: str
    role: str  # admin, manager, executive
    branch_id: Optional[str] = None

class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""

class RateCardUpdate(BaseModel):
    rate_type: str  # normal, ajpl
    purities: List[Dict[str, Any]]  # [{name: "24KT", percent: 100, rate_per_10g: 60000}, ...]

class PurityCreate(BaseModel):
    name: str
    percent: float

class ItemNameCreate(BaseModel):
    name: str
    category: Optional[str] = "general"

class CustomerCreate(BaseModel):
    name: str
    phone: str
    location: Optional[str] = ""
    reference: Optional[str] = ""

class BillItemCreate(BaseModel):
    item_type: str  # gold or diamond
    item_name: str
    rate_mode: str  # normal, ajpl, manual
    purity_name: str
    purity_percent: float
    rate_per_10g: float
    gross_weight: float
    less: float
    making_charges: List[Dict[str, Any]] = []
    stone_charges: List[Dict[str, Any]] = []
    studded_charges: List[Dict[str, Any]] = []

class ExternalChargeCreate(BaseModel):
    name: str
    amount: float

class BillCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_location: Optional[str] = ""
    customer_reference: Optional[str] = ""
    salesperson_name: Optional[str] = ""
    narration: Optional[str] = ""
    items: List[Dict[str, Any]] = []
    external_charges: List[Dict[str, Any]] = []
    bill_mode: Optional[str] = "regular"  # regular or mrp

class SalespersonCreate(BaseModel):
    name: str
    branch_id: Optional[str] = ""

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    reference: Optional[str] = None
    dob: Optional[str] = None
    anniversary: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class FeedbackQuestionCreate(BaseModel):
    question: str
    order: Optional[int] = 0

class FeedbackSubmit(BaseModel):
    ratings: List[Dict[str, Any]]  # [{question_id, question, rating}]
    customer_name: Optional[str] = ""
    additional_comments: Optional[str] = ""

class TierSettingsUpdate(BaseModel):
    tiers: List[Dict[str, Any]]  # [{name, min_amount, max_amount}]

# ============ SEED DATA ============
@app.on_event("startup")
async def startup_event():
    # Create default admin if not exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password": pwd_context.hash("admin1123"),
            "full_name": "System Admin",
            "role": "admin",
            "branch_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default admin created")

    # Create default purities if not exists
    purities_count = await db.purities.count_documents({})
    if purities_count == 0:
        default_purities = [
            {"id": str(uuid.uuid4()), "name": "24KT", "percent": 100, "order": 1},
            {"id": str(uuid.uuid4()), "name": "22KT", "percent": 92, "order": 2},
            {"id": str(uuid.uuid4()), "name": "20KT", "percent": 84, "order": 3},
            {"id": str(uuid.uuid4()), "name": "18KT", "percent": 76, "order": 4},
            {"id": str(uuid.uuid4()), "name": "14KT", "percent": 62, "order": 5},
        ]
        await db.purities.insert_many(default_purities)
        logger.info("Default purities created")

    # Create default rate cards if not exists
    for rate_type in ['normal', 'ajpl', 'buyback']:
        rc = await db.rate_cards.find_one({"rate_type": rate_type})
        if not rc:
            purities = await db.purities.find({}).to_list(100)
            purity_rates = []
            for p in purities:
                purity_rates.append({
                    "purity_id": p["id"],
                    "purity_name": p["name"],
                    "purity_percent": p["percent"],
                    "rate_per_10g": 0,
                })
            rate_doc = {
                "id": str(uuid.uuid4()),
                "rate_type": rate_type,
                "purities": purity_rates,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": "system",
            }
            await db.rate_cards.insert_one(rate_doc)
        logger.info(f"Rate card '{rate_type}' initialized")

    # Create indexes
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.bills.create_index("created_at")
    await db.bills.create_index("branch_id")
    await db.bills.create_index("executive_id")
    await db.bills.create_index("customer_phone")
    await db.bills.create_index("created_date")
    await db.customers.create_index("phone")
    await db.customers.create_index("phones")
    await db.otps.create_index("username")
    await db.otps.create_index("expires_at")
    await db.sessions.create_index("user_id")
    await db.sessions.create_index("token")
    await db.salespeople.create_index("name", unique=True)
    await db.feedback_questions.create_index("order")
    await db.notifications.create_index("target_user_id")
    await db.notifications.create_index("due_date")
    logger.info("Database indexes created")

    # Backfill old bills missing daily_serial/created_date or with old bill_number format
    old_bills = await db.bills.find({
        "$or": [
            {"daily_serial": {"$exists": False}},
            {"created_date": {"$exists": False}},
            {"daily_serial": None},
            {"created_date": None},
            {"bill_number": {"$regex": "^BILL-"}},
        ]
    }).sort("created_at", 1).to_list(10000)
    if old_bills:
        # Group by date to assign serial numbers
        from collections import defaultdict
        date_groups = defaultdict(list)
        for b in old_bills:
            created_at = b.get("created_at", "")
            if created_at:
                date_str = created_at[:10]  # YYYY-MM-DD
            else:
                date_str = datetime.now(IST).strftime("%Y-%m-%d")
            date_groups[date_str].append(b)
        for date_str, bills_in_date in date_groups.items():
            # Count existing bills with serials on this date
            existing_count = await db.bills.count_documents({"created_date": date_str, "daily_serial": {"$exists": True, "$ne": None}})
            for i, b in enumerate(bills_in_date):
                serial = existing_count + i + 1
                # Also update bill_number to new format if it's old format
                bill_number = b.get("bill_number", "")
                if bill_number.startswith("BILL-"):
                    dd_mm_yyyy = date_str[8:10] + date_str[5:7] + date_str[0:4]
                    bill_number = f"{serial:04d}-{dd_mm_yyyy}"
                await db.bills.update_one({"_id": b["_id"]}, {"$set": {"daily_serial": serial, "created_date": date_str, "bill_number": bill_number}})
        logger.info(f"Backfilled {len(old_bills)} old bills with daily_serial and created_date")

    # Create default tier settings if not exists
    tiers = await db.settings.find_one({"key": "customer_tiers"})
    if not tiers:
        await db.settings.insert_one({
            "key": "customer_tiers",
            "tiers": [
                {"name": "Bronze", "min_amount": 0, "max_amount": 50000},
                {"name": "Silver", "min_amount": 50000, "max_amount": 200000},
                {"name": "Gold", "min_amount": 200000, "max_amount": 500000},
                {"name": "Platinum", "min_amount": 500000, "max_amount": 1500000},
                {"name": "Diamond", "min_amount": 1500000, "max_amount": 999999999},
            ],
        })
        logger.info("Default customer tiers created")

# ============ AUTH ROUTES ============
import random

@api_router.post("/auth/request-otp")
async def request_otp(req: OTPRequest):
    """Generate a 4-digit OTP for the given username."""
    user = await db.users.find_one({"username": req.username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    # Clean up expired/old OTPs for this user
    now = datetime.now(timezone.utc).isoformat()
    await db.otps.delete_many({
        "$or": [
            {"username": req.username, "verified": True},
            {"username": req.username, "expires_at": {"$lt": now}},
        ]
    })

    # Generate 4-digit OTP
    otp_code = str(random.randint(1000, 9999))

    # Store OTP in database with 5-minute expiry
    otp_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": req.username,
        "full_name": user.get("full_name", req.username),
        "role": user.get("role", ""),
        "otp": otp_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "verified": False,
    }
    await db.otps.insert_one(otp_doc)
    logger.info(f"OTP generated for user '{req.username}': {otp_code}")

    return {"message": "OTP sent", "username": req.username}

@api_router.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify, request: Request):
    """Verify OTP and return JWT token."""
    user = await db.users.find_one({"username": req.username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    # Find valid OTP (not expired, not used)
    now = datetime.now(timezone.utc).isoformat()
    otp_doc = await db.otps.find_one({
        "username": req.username,
        "otp": req.otp,
        "verified": False,
        "expires_at": {"$gt": now},
    })

    if not otp_doc:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    # Mark OTP as used
    await db.otps.update_one({"id": otp_doc["id"]}, {"$set": {"verified": True}})

    # Generate JWT token
    token = create_token({"sub": user["id"], "role": user["role"]})
    # Single-device session: deactivate old sessions for non-admin only
    if user.get("role") != "admin":
        await db.sessions.update_many({"user_id": user["id"]}, {"$set": {"is_active": False}})
    # Store session for ALL roles including admin
    ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    user_agent = request.headers.get("user-agent", "unknown")
    await db.sessions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user.get("username", ""),
        "full_name": user.get("full_name", ""),
        "role": user.get("role", ""),
        "token": token,
        "is_active": True,
        "ip_address": ip_address.split(",")[0].strip() if ip_address else "unknown",
        "user_agent": user_agent,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    user_data = serialize_doc(user)
    user_data.pop('password', None)
    return {"token": token, "user": user_data}

@api_router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    """Legacy password login (kept for backward compatibility)."""
    user = await db.users.find_one({"username": req.username})
    if not user or not user.get("password") or not pwd_context.verify(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_token({"sub": user["id"], "role": user["role"]})
    # Single-device session: deactivate old sessions for non-admin only
    if user.get("role") != "admin":
        await db.sessions.update_many({"user_id": user["id"]}, {"$set": {"is_active": False}})
    # Store session for ALL roles including admin
    ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    user_agent = request.headers.get("user-agent", "unknown")
    await db.sessions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user.get("username", ""),
        "full_name": user.get("full_name", ""),
        "role": user.get("role", ""),
        "token": token,
        "is_active": True,
        "ip_address": ip_address.split(",")[0].strip() if ip_address else "unknown",
        "user_agent": user_agent,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    user_data = serialize_doc(user)
    user_data.pop('password', None)
    return {"token": token, "user": user_data}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    user.pop('password', None)
    return user

@api_router.get("/admin/pending-otps")
async def get_pending_otps(user=Depends(get_current_user)):
    """Admin endpoint to see recent OTP requests."""
    await require_role(user, ["admin"])
    now = datetime.now(timezone.utc).isoformat()
    # Clean up expired OTPs
    await db.otps.delete_many({"expires_at": {"$lt": now}})
    await db.otps.delete_many({"verified": True})
    # Get active (non-expired, non-verified) OTPs
    otps = await db.otps.find({
        "verified": False,
        "expires_at": {"$gt": now},
    }).sort("created_at", -1).to_list(50)
    return [serialize_doc(o) for o in otps]

# ============ USER MANAGEMENT ============
@api_router.post("/users")
async def create_user(req: UserCreate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    if req.role == "manager" and not req.branch_id:
        raise HTTPException(status_code=400, detail="Branch is required for manager role")
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password": pwd_context.hash(req.password) if req.password else None,
        "full_name": req.full_name,
        "role": req.role,
        "branch_id": req.branch_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop('password')
    return serialize_doc(user_doc)

@api_router.get("/users")
async def list_users(user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    allowed = {"full_name", "role", "branch_id", "is_active", "username"}
    update_data = {k: v for k, v in updates.items() if k in allowed}
    if update_data.get("role") == "manager" and not update_data.get("branch_id"):
        # Check if existing user already has branch_id when switching to manager
        existing = await db.users.find_one({"id": user_id})
        if existing and not existing.get("branch_id") and not updates.get("branch_id"):
            raise HTTPException(status_code=400, detail="Branch is required for manager role")
    if "password" in updates and updates["password"]:
        update_data["password"] = pwd_context.hash(updates["password"])
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return {"status": "updated"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.users.delete_one({"id": user_id})
    return {"status": "deleted"}

# ============ BRANCH MANAGEMENT ============
@api_router.post("/branches")
async def create_branch(req: BranchCreate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    branch_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "address": req.address,
        "phone": req.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.branches.insert_one(branch_doc)
    return serialize_doc(branch_doc)

@api_router.get("/branches")
async def list_branches(user=Depends(get_current_user)):
    branches = await db.branches.find({}).to_list(1000)
    return [serialize_doc(b) for b in branches]

@api_router.put("/branches/{branch_id}")
async def update_branch(branch_id: str, updates: dict, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    allowed = {"name", "address", "phone", "is_active"}
    update_data = {k: v for k, v in updates.items() if k in allowed}
    await db.branches.update_one({"id": branch_id}, {"$set": update_data})
    return {"status": "updated"}

@api_router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.branches.delete_one({"id": branch_id})
    return {"status": "deleted"}

# ============ PURITY MANAGEMENT ============
@api_router.get("/purities")
async def list_purities(user=Depends(get_current_user)):
    purities = await db.purities.find({}).sort("order", 1).to_list(100)
    return [serialize_doc(p) for p in purities]

@api_router.post("/purities")
async def add_purity(req: PurityCreate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    count = await db.purities.count_documents({})
    purity_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "percent": req.percent,
        "order": count + 1,
    }
    await db.purities.insert_one(purity_doc)
    # Add this purity to all rate cards
    for rate_type in ['normal', 'ajpl', 'buyback']:
        await db.rate_cards.update_one(
            {"rate_type": rate_type},
            {"$push": {"purities": {
                "purity_id": purity_doc["id"],
                "purity_name": req.name,
                "purity_percent": req.percent,
                "rate_per_10g": 0,
            }}}
        )
    return serialize_doc(purity_doc)

@api_router.delete("/purities/{purity_id}")
async def delete_purity(purity_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.purities.delete_one({"id": purity_id})
    for rate_type in ['normal', 'ajpl', 'buyback']:
        await db.rate_cards.update_one(
            {"rate_type": rate_type},
            {"$pull": {"purities": {"purity_id": purity_id}}}
        )
    return {"status": "deleted"}

# ============ RATE CARD MANAGEMENT ============
@api_router.get("/rates")
async def get_rates(user=Depends(get_current_user)):
    rates = await db.rate_cards.find({}).to_list(10)
    all_purities = await db.purities.find({}).to_list(100)
    result = []
    for r in rates:
        r_data = serialize_doc(r)
        # Auto-heal: if rate card has empty purities, re-sync from purities collection
        if not r_data.get("purities") and all_purities:
            synced = [{"purity_id": p["id"], "purity_name": p["name"], "purity_percent": p["percent"], "rate_per_10g": 0} for p in all_purities]
            r_data["purities"] = synced
            await db.rate_cards.update_one({"rate_type": r_data["rate_type"]}, {"$set": {"purities": synced}})
        result.append(r_data)
    return result

@api_router.get("/rates/{rate_type}")
async def get_rate_by_type(rate_type: str, user=Depends(get_current_user)):
    rate = await db.rate_cards.find_one({"rate_type": rate_type})
    if not rate:
        raise HTTPException(status_code=404, detail="Rate card not found")
    r_data = serialize_doc(rate)
    if not r_data.get("purities"):
        all_purities = await db.purities.find({}).to_list(100)
        if all_purities:
            synced = [{"purity_id": p["id"], "purity_name": p["name"], "purity_percent": p["percent"], "rate_per_10g": 0} for p in all_purities]
            r_data["purities"] = synced
            await db.rate_cards.update_one({"rate_type": rate_type}, {"$set": {"purities": synced}})
    return r_data

@api_router.put("/rates/{rate_type}")
async def update_rates(rate_type: str, req: RateCardUpdate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    purities_to_save = [dict(p) for p in req.purities]
    # Guard: never save empty purities if purities collection has data
    if not purities_to_save:
        all_purities = await db.purities.find({}).to_list(100)
        if all_purities:
            purities_to_save = [{"purity_id": p["id"], "purity_name": p["name"], "purity_percent": p["percent"], "rate_per_10g": 0} for p in all_purities]
    await db.rate_cards.update_one(
        {"rate_type": rate_type},
        {"$set": {
            "purities": purities_to_save,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.get('full_name', 'admin'),
        }}
    )
    return {"status": "updated"}

# ============ ITEM NAMES MANAGEMENT ============
@api_router.get("/item-names")
async def list_item_names(user=Depends(get_current_user)):
    items = await db.item_names.find({}).to_list(1000)
    return [serialize_doc(i) for i in items]

@api_router.post("/item-names")
async def create_item_name(req: ItemNameCreate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    existing = await db.item_names.find_one({"name": req.name})
    if existing:
        raise HTTPException(status_code=400, detail="Item name already exists")
    item_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "category": req.category,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.item_names.insert_one(item_doc)
    return serialize_doc(item_doc)

@api_router.delete("/item-names/{item_id}")
async def delete_item_name(item_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.item_names.delete_one({"id": item_id})
    return {"status": "deleted"}

@api_router.get("/item-names/{item_name}/sales")
async def get_item_sales_history(item_name: str, user=Depends(get_current_user)):
    """Get complete sales history for a specific item name."""
    await require_role(user, ["admin", "manager"])
    
    # Find all bills containing this item
    all_bills = await db.bills.find({}).sort("created_at", -1).to_list(10000)
    
    sales = []
    total_quantity = 0
    total_weight = 0
    total_revenue = 0
    
    for bill in all_bills:
        bill_data = serialize_doc(bill)
        for idx, item in enumerate(bill.get('items', [])):
            if item.get('item_name', '').lower() == item_name.lower():
                total_quantity += 1
                total_weight += item.get('net_weight', 0)
                total_revenue += item.get('total_amount', 0)
                sales.append({
                    "bill_id": bill_data.get('id'),
                    "bill_number": bill_data.get('bill_number'),
                    "customer_name": bill_data.get('customer_name'),
                    "customer_phone": bill_data.get('customer_phone'),
                    "executive_name": bill_data.get('executive_name'),
                    "branch_id": bill_data.get('branch_id'),
                    "date": bill_data.get('created_at', '')[:10],
                    "status": bill_data.get('status'),
                    "item_index": idx,
                    "item_type": item.get('item_type', 'gold'),
                    "purity_name": item.get('purity_name'),
                    "rate_mode": item.get('rate_mode'),
                    "gross_weight": item.get('gross_weight', 0),
                    "less": item.get('less', 0),
                    "net_weight": item.get('net_weight', 0),
                    "rate_per_10g": item.get('rate_per_10g', 0),
                    "gold_value": item.get('gold_value', 0),
                    "total_making": item.get('total_making', 0),
                    "total_stone": item.get('total_stone', 0),
                    "total_studded": item.get('total_studded', 0),
                    "total_amount": item.get('total_amount', 0),
                    "making_charges": item.get('making_charges', []),
                    "stone_charges": item.get('stone_charges', []),
                    "studded_charges": item.get('studded_charges', []),
                })
    
    return {
        "item_name": item_name,
        "total_sold": total_quantity,
        "total_weight": round(total_weight, 3),
        "total_revenue": round(total_revenue, 2),
        "sales": sales,
    }

# ============ CUSTOMER MANAGEMENT ============
@api_router.get("/customers")
async def list_customers(user=Depends(get_current_user)):
    customers = await db.customers.find({}).to_list(5000)
    return [serialize_doc(c) for c in customers]

@api_router.get("/customers/search")
async def search_customer(phone: str = Query(""), user=Depends(get_current_user)):
    if not phone:
        return []
    customers = await db.customers.find({"$or": [
        {"phone": {"$regex": phone}},
        {"phones": {"$regex": phone}}
    ]}).to_list(20)
    return [serialize_doc(c) for c in customers]

@api_router.get("/customers/lookup-phone")
async def lookup_customer_by_phone(phone: str = Query(...), user=Depends(get_current_user)):
    """Lookup a customer by any of their phone numbers (primary or additional)."""
    if not phone or len(phone.strip()) < 10:
        return {"found": False}
    phone = phone.strip()
    # Search primary phone first
    customer = await db.customers.find_one({"phone": phone})
    if not customer:
        # Search in additional phones array
        customer = await db.customers.find_one({"phones": phone})
    if customer:
        c_data = serialize_doc(customer)
        c_data['all_phones'] = [customer.get('phone', '')] + customer.get('phones', [])
        return {"found": True, "customer": c_data}
    return {"found": False}

@api_router.post("/customers/{customer_id}/add-phone")
async def add_phone_to_customer(customer_id: str, body: dict, user=Depends(get_current_user)):
    """Add an additional phone number to an existing customer."""
    new_phone = body.get('phone', '').strip()
    if not new_phone or len(new_phone) != 10:
        raise HTTPException(status_code=400, detail="Valid 10-digit phone number required")
    
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if phone already exists on any customer
    existing = await db.customers.find_one({"phone": new_phone})
    if existing and existing.get('id') != customer_id:
        raise HTTPException(status_code=400, detail="This phone number belongs to another customer")
    existing_in_phones = await db.customers.find_one({"phones": new_phone})
    if existing_in_phones and existing_in_phones.get('id') != customer_id:
        raise HTTPException(status_code=400, detail="This phone number belongs to another customer")
    
    # Don't add if it's already the primary phone or in the phones array
    if new_phone == customer.get('phone'):
        return {"status": "already_exists", "message": "This is already the primary phone"}
    
    current_phones = customer.get('phones', [])
    if new_phone in current_phones:
        return {"status": "already_exists", "message": "Phone already added"}
    
    await db.customers.update_one(
        {"id": customer_id},
        {"$push": {"phones": new_phone}}
    )
    return {"status": "added"}

@api_router.get("/customers/{customer_id}/bills")
async def get_customer_bills(customer_id: str, user=Depends(get_current_user)):
    """Get all bills for a specific customer (by customer id or phone)."""
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phone": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phones": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    c_data = serialize_doc(customer)
    # Calculate days since last visit
    last_visit = customer.get('last_visit', '')
    if last_visit:
        try:
            lv = datetime.fromisoformat(last_visit.replace('Z', '+00:00'))
            c_data['days_since_last_visit'] = (datetime.now(timezone.utc) - lv).days
        except Exception:
            c_data['days_since_last_visit'] = None
    
    # Get all bills for this customer by customer_id, primary phone AND secondary phones
    cust_id = customer.get("id", "")
    all_phones = [customer["phone"]] + (customer.get("phones") or [])
    all_phones = list(set(p for p in all_phones if p))  # dedupe + remove empty
    bill_query = {"$or": [{"customer_id": cust_id}]}
    if all_phones:
        bill_query["$or"].append({"customer_phone": {"$in": all_phones}})
    bills = await db.bills.find(bill_query).sort("created_at", -1).to_list(10000)

    # Enrich bills with current customer data (guaranteed fresh names)
    current_name = customer.get("name", "")
    current_phone = customer.get("phone", "")
    current_location = customer.get("location", "")
    current_reference = customer.get("reference", "")
    serialized_bills = []
    for b in bills:
        sb = serialize_doc(b)
        if current_name:
            sb["customer_name"] = current_name
        if current_phone:
            sb["customer_phone"] = current_phone
        if current_location:
            sb["customer_location"] = current_location
        if current_reference:
            sb["customer_reference"] = current_reference
        serialized_bills.append(sb)

    # Only count approved/sent/edited bills for total_spent
    approved_total = sum(b.get('grand_total', 0) for b in bills if b.get('status') in ('sent', 'approved', 'edited'))
    
    return {
        "customer": c_data,
        "bills": serialized_bills,
        "total_bills": len(bills),
        "total_spent": approved_total,
    }

@api_router.get("/customers/{customer_id}")
async def get_customer_detail(customer_id: str, user=Depends(get_current_user)):
    """Get customer details by ID or phone (including secondary phones)."""
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phone": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phones": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return serialize_doc(customer)

@api_router.post("/customers")
async def create_or_get_customer(req: CustomerCreate, user=Depends(get_current_user)):
    existing = await db.customers.find_one({"phone": req.phone})
    if existing:
        # Update info
        await db.customers.update_one(
            {"phone": req.phone},
            {"$set": {
                "name": req.name,
                "location": req.location,
                "reference": normalize_reference(req.reference or ""),
                "last_visit": datetime.now(timezone.utc).isoformat(),
            }}
        )
        updated = await db.customers.find_one({"phone": req.phone})
        return serialize_doc(updated)
    customer_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "phone": req.phone,
        "location": req.location,
        "reference": normalize_reference(req.reference or ""),
        "first_visit": datetime.now(timezone.utc).isoformat(),
        "last_visit": datetime.now(timezone.utc).isoformat(),
        "total_visits": 1,
        "total_spent": 0,
    }
    await db.customers.insert_one(customer_doc)
    return serialize_doc(customer_doc)

# ============ BILL MANAGEMENT ============
async def _get_daily_serial():
    """Get the next daily serial number (resets daily)."""
    today = datetime.now(IST).strftime("%Y-%m-%d")
    count = await db.bills.count_documents({"created_date": today})
    return count + 1

@api_router.post("/bills")
async def create_bill(req: BillCreate, user=Depends(get_current_user)):
    # Create or get customer - search primary phone and phones array
    customer = await db.customers.find_one({"phone": req.customer_phone})
    if not customer:
        customer = await db.customers.find_one({"phones": req.customer_phone})
    if not customer:
        customer = {
            "id": str(uuid.uuid4()),
            "name": req.customer_name,
            "phone": req.customer_phone,
            "location": req.customer_location,
            "reference": normalize_reference(req.customer_reference or ""),
            "phones": [],
            "first_visit": datetime.now(timezone.utc).isoformat(),
            "last_visit": datetime.now(timezone.utc).isoformat(),
            "total_visits": 1,
            "total_spent": 0,
        }
        await db.customers.insert_one(customer)
    else:
        update_fields = {"last_visit": datetime.now(timezone.utc).isoformat()}
        if req.customer_location:
            update_fields["location"] = req.customer_location
        await db.customers.update_one(
            {"id": customer["id"]},
            {"$set": update_fields, "$inc": {"total_visits": 1}}
        )

    # Calculate items
    calculated_items = []
    for item in req.items:
        if item.get('item_type') == 'mrp':
            # MRP items are already calculated by /calculate/mrp-item - pass through
            calculated_items.append(item)
        elif item.get('item_type') == 'diamond':
            calc = calculate_diamond_item(item)
            calculated_items.append(calc)
        else:
            calc = calculate_gold_item(item)
            calculated_items.append(calc)

    # Calculate bill totals
    totals = calculate_bill_totals(calculated_items, req.external_charges)

    daily_serial = await _get_daily_serial()
    today_str = datetime.now(IST).strftime("%d%m%Y")
    bill_doc = {
        "id": str(uuid.uuid4()),
        "bill_number": f"{daily_serial:04d}-{today_str}",
        "daily_serial": daily_serial,
        "created_date": datetime.now(IST).strftime("%Y-%m-%d"),
        "mmi_entered": False,
        "customer_id": customer.get("id", ""),
        "customer_name": req.customer_name,
        "customer_phone": req.customer_phone,
        "customer_location": req.customer_location,
        "customer_reference": normalize_reference(req.customer_reference or ""),
        "salesperson_name": req.salesperson_name,
        "narration": req.narration or "",
        "bill_mode": req.bill_mode,
        "items": calculated_items,
        "external_charges": req.external_charges,
        "items_total": totals["items_total"],
        "external_charges_total": totals["external_charges_total"],
        "subtotal_without_gst": totals["subtotal_without_gst"],
        "gst_percent": totals["gst_percent"],
        "gst_amount": totals["gst_amount"],
        "grand_total": totals["grand_total"],
        "status": "draft",  # draft, sent, edited, approved
        "executive_id": user.get('id'),
        "executive_name": user.get('full_name', ''),
        "branch_id": user.get('branch_id', ''),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": None,
        "approved_at": None,
        "last_modified_by": user.get('full_name', ''),
        "change_log": [],
    }
    await db.bills.insert_one(bill_doc)
    return serialize_doc(bill_doc)

@api_router.put("/bills/{bill_id}")
async def update_bill(bill_id: str, updates: dict, user=Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Check permissions
    if bill["status"] != "draft" and user.get('role') == 'executive':
        raise HTTPException(status_code=403, detail="Cannot edit sent bill as executive")
    
    if user.get('role') == 'executive' and bill.get('executive_id') != user.get('id'):
        raise HTTPException(status_code=403, detail="Cannot edit another executive's bill")

    # Build audit log entry
    old_total = bill.get('grand_total', 0)
    
    # Recalculate if items changed
    if 'items' in updates:
        calculated_items = []
        for item in updates['items']:
            if item.get('item_type') == 'mrp':
                # MRP items are pre-calculated - pass through
                calculated_items.append(item)
            elif item.get('item_type') == 'diamond':
                calc = calculate_diamond_item(item)
                calculated_items.append(calc)
            else:
                calc = calculate_gold_item(item)
                calculated_items.append(calc)
        updates['items'] = calculated_items
        ext_charges = updates.get('external_charges', bill.get('external_charges', []))
        totals = calculate_bill_totals(calculated_items, ext_charges)
        updates.update(totals)
    elif 'external_charges' in updates:
        items = bill.get('items', [])
        totals = calculate_bill_totals(items, updates['external_charges'])
        updates.update(totals)

    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    updates['last_modified_by'] = user.get('full_name', '')
    
    # If manager/admin editing a sent bill, mark as edited
    if bill.get('status') == 'sent' and user.get('role') in ['admin', 'manager']:
        updates['status'] = 'edited'
    
    # Remove fields that shouldn't be directly updated
    for field in ['id', 'bill_number', 'created_at', 'executive_id', 'change_log']:
        updates.pop(field, None)
    
    # Add to change log
    new_total = updates.get('grand_total', old_total)
    change_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user.get('full_name', ''),
        "role": user.get('role', ''),
        "action": "edit",
        "old_total": old_total,
        "new_total": new_total,
    }
    
    await db.bills.update_one(
        {"id": bill_id}, 
        {"$set": updates, "$push": {"change_log": change_entry}}
    )
    updated = await db.bills.find_one({"id": bill_id})
    return serialize_doc(updated)


class BillReferenceUpdate(BaseModel):
    customer_reference: str

@api_router.put("/bills/{bill_id}/reference")
async def update_bill_reference(bill_id: str, req: BillReferenceUpdate, user=Depends(get_current_user)):
    """Admin-only: update the reference on any bill without changing status."""
    await require_role(user, ["admin"])
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    new_ref = normalize_reference(req.customer_reference)
    old_ref = bill.get('customer_reference', '')
    
    change_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user.get('full_name', ''),
        "role": user.get('role', ''),
        "action": "reference_update",
        "old_reference": old_ref,
        "new_reference": new_ref,
    }
    
    await db.bills.update_one(
        {"id": bill_id},
        {"$set": {"customer_reference": new_ref, "updated_at": datetime.now(timezone.utc).isoformat()},
         "$push": {"change_log": change_entry}}
    )
    updated = await db.bills.find_one({"id": bill_id})
    return serialize_doc(updated)

@api_router.post("/admin/normalize-references")
async def normalize_all_references(user=Depends(get_current_user)):
    """Admin-only: one-time fix to normalize all reference strings in bills and customers."""
    await require_role(user, ["admin"])
    
    bills_fixed = 0
    changes = []
    async for bill in db.bills.find({"customer_reference": {"$exists": True, "$ne": None}}):
        old = bill.get("customer_reference", "")
        new = normalize_reference(old)
        if old != new:
            await db.bills.update_one({"_id": bill["_id"]}, {"$set": {"customer_reference": new}})
            bills_fixed += 1
            hex_repr = old.encode('utf-8').hex()
            changes.append({"type": "bill", "old": old, "new": new, "old_hex": hex_repr, "bill_id": bill.get("id", "")})
    
    custs_fixed = 0
    async for cust in db.customers.find({"reference": {"$exists": True, "$ne": None}}):
        old = cust.get("reference", "")
        new = normalize_reference(old)
        if old != new:
            await db.customers.update_one({"_id": cust["_id"]}, {"$set": {"reference": new}})
            custs_fixed += 1
            hex_repr = old.encode('utf-8').hex()
            changes.append({"type": "customer", "old": old, "new": new, "old_hex": hex_repr})
    
    return {"bills_normalized": bills_fixed, "customers_normalized": custs_fixed, "changes": changes}

@api_router.get("/admin/reference-diagnostics")
async def reference_diagnostics(user=Depends(get_current_user)):
    """Admin-only: show all distinct reference values with their hex encoding for debugging."""
    await require_role(user, ["admin"])
    
    bill_refs = await db.bills.distinct("customer_reference")
    cust_refs = await db.customers.distinct("reference")
    
    def to_diag(val):
        if val is None:
            return {"value": None, "hex": "", "length": 0, "normalized": ""}
        s = str(val)
        return {
            "value": s,
            "hex": s.encode('utf-8').hex(),
            "length": len(s),
            "char_codes": [f"U+{ord(c):04X}" for c in s],
            "normalized": normalize_reference(s),
        }
    
    return {
        "bill_references": [to_diag(r) for r in bill_refs],
        "customer_references": [to_diag(r) for r in cust_refs],
    }


@api_router.put("/bills/{bill_id}/approve")
async def approve_bill(bill_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin", "manager"])
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill["status"] not in ["sent", "edited"]:
        raise HTTPException(status_code=400, detail="Bill must be sent or edited to approve")
    
    change_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user.get('full_name', ''),
        "role": user.get('role', ''),
        "action": "approved",
        "old_total": bill.get('grand_total', 0),
        "new_total": bill.get('grand_total', 0),
    }
    
    await db.bills.update_one(
        {"id": bill_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_modified_by": user.get('full_name', ''),
        }, "$push": {"change_log": change_entry}}
    )
    return {"status": "approved"}

@api_router.put("/bills/{bill_id}/send")
async def send_bill_to_manager(bill_id: str, user=Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    # Only the executive who created the bill can send it
    if user.get('role') != 'executive' or bill.get('executive_id') != user.get('id'):
        raise HTTPException(status_code=403, detail="Only the bill's creator can send it to manager")
    if bill["status"] != "draft":
        raise HTTPException(status_code=400, detail="Bill already sent")
    
    await db.bills.update_one(
        {"id": bill_id},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    # Update customer total spent - use customer_id if available, fallback to phone matching
    cust_id = bill.get('customer_id')
    if cust_id:
        await db.customers.update_one(
            {"id": cust_id},
            {"$inc": {"total_spent": bill.get('grand_total', 0)}}
        )
    elif bill.get('customer_phone'):
        await db.customers.update_one(
            {"$or": [{"phone": bill['customer_phone']}, {"phones": bill['customer_phone']}]},
            {"$inc": {"total_spent": bill.get('grand_total', 0)}}
        )
    return {"status": "sent"}

@api_router.get("/bills")
async def list_bills(
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    executive_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    customer_phone: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if user.get('role') == 'executive':
        query['executive_id'] = user.get('id')
    elif user.get('role') == 'manager':
        if user.get('branch_id'):
            query['branch_id'] = user.get('branch_id')
    # Admin sees all
    
    if status:
        query['status'] = status
    if branch_id:
        query['branch_id'] = branch_id
    if executive_id:
        query['executive_id'] = executive_id
    if customer_phone:
        query['customer_phone'] = customer_phone
    if date_from:
        query.setdefault('created_at', {})
        query['created_at']['$gte'] = date_from
    if date_to:
        query.setdefault('created_at', {})
        query['created_at']['$lte'] = date_to
    
    bills = await db.bills.find(query).sort("created_at", -1).to_list(5000)
    serialized = [serialize_doc(b) for b in bills]
    return await enrich_bills_with_customer_data(serialized)

@api_router.get("/bills/{bill_id}/summary")
async def get_bill_summary(bill_id: str, user=Depends(get_current_user)):
    """Get full detailed summary of a bill for manager/admin view."""
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    await check_bill_access(bill, user)
    
    bill_data = serialize_doc(bill)
    
    # Return FULL item details - nothing hidden
    item_summaries = []
    for item in bill_data.get('items', []):
        summary = {
            "item_name": item.get('item_name'),
            "item_type": item.get('item_type', 'gold'),
            "tag_number": item.get('tag_number', ''),
            "purity_name": item.get('purity_name'),
            "rate_mode": item.get('rate_mode'),
            "gross_weight": item.get('gross_weight', 0),
            "less": item.get('less', 0),
            "net_weight": item.get('net_weight', 0),
            "rate_per_10g": item.get('rate_per_10g', 0),
            "gold_value": item.get('gold_value', 0),
            "total_making": item.get('total_making', 0),
            "total_stone": item.get('total_stone', 0),
            "total_studded": item.get('total_studded', 0),
            "total_amount": item.get('total_amount', 0),
            "studded_less_grams": item.get('studded_less_grams', 0),
            "making_charges": item.get('making_charges', []),
            "stone_charges": item.get('stone_charges', []),
            "studded_charges": item.get('studded_charges', []),
            # MRP fields
            "mrp": item.get('mrp', 0),
            "total_discount": item.get('total_discount', 0),
            "after_discount": item.get('after_discount', 0),
            "amount_without_gst": item.get('amount_without_gst', 0),
            "gst_amount_item": item.get('gst_amount', 0),
            "studded_weights": item.get('studded_weights', []),
            "discounts": item.get('discounts', []),
            "photos": item.get('photos', []),
        }
        item_summaries.append(summary)
    
    # Enrich with current customer data
    enriched = await enrich_bills_with_customer_data([bill_data])
    bill_data = enriched[0]

    return {
        "bill_id": bill_data.get('id'),
        "bill_number": bill_data.get('bill_number'),
        "customer_name": bill_data.get('customer_name'),
        "customer_phone": bill_data.get('customer_phone'),
        "customer_location": bill_data.get('customer_location', ''),
        "customer_reference": bill_data.get('customer_reference', ''),
        "salesperson_name": bill_data.get('salesperson_name', ''),
        "executive_name": bill_data.get('executive_name'),
        "date": bill_data.get('created_at', '')[:10],
        "status": bill_data.get('status'),
        "items": item_summaries,
        "external_charges": bill_data.get('external_charges', []),
        "items_total": bill_data.get('items_total', 0),
        "external_charges_total": bill_data.get('external_charges_total', 0),
        "subtotal_without_gst": bill_data.get('subtotal_without_gst', 0),
        "gst_percent": bill_data.get('gst_percent', 3),
        "gst_amount": bill_data.get('gst_amount', 0),
        "grand_total": bill_data.get('grand_total', 0),
    }

@api_router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, user=Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    await check_bill_access(bill, user)
    serialized = serialize_doc(bill)
    enriched = await enrich_bills_with_customer_data([serialized])
    return enriched[0]

@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin", "manager"])
    await db.bills.delete_one({"id": bill_id})
    return {"status": "deleted"}

# ============ CALCULATE ENDPOINT ============
@api_router.post("/calculate/item")
async def calculate_item(item: dict, user=Depends(get_current_user)):
    """Calculate a single item's totals in real-time."""
    if item.get('item_type') == 'mrp':
        return item  # MRP items are calculated via /calculate/mrp-item
    elif item.get('item_type') == 'diamond':
        result = calculate_diamond_item(item)
    else:
        result = calculate_gold_item(item)
    return result

@api_router.post("/calculate/bill")
async def calculate_bill(data: dict, user=Depends(get_current_user)):
    """Calculate full bill totals."""
    items = data.get('items', [])
    external_charges = data.get('external_charges', [])
    calculated_items = []
    for item in items:
        if item.get('item_type') == 'mrp':
            calculated_items.append(item)
        elif item.get('item_type') == 'diamond':
            calc = calculate_diamond_item(item)
            calculated_items.append(calc)
        else:
            calc = calculate_gold_item(item)
            calculated_items.append(calc)
    totals = calculate_bill_totals(calculated_items, external_charges)
    totals['items'] = calculated_items
    return totals

# ============ REPORTS/ANALYTICS ============
@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    branch_id: Optional[str] = None,
    executive_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    await require_role(user, ["admin", "manager"])
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    
    # Build branch filter for managers
    base_filter = {}
    if user.get('role') == 'manager' and user.get('branch_id'):
        base_filter = {"branch_id": user.get('branch_id')}
    if branch_id:
        base_filter["branch_id"] = branch_id
    if executive_id:
        base_filter["executive_id"] = executive_id
    
    # Today's bills (always unfiltered by date range for KPIs) - only approved bills count as sales
    today_query = {**base_filter, "created_at": {"$gte": today}, "status": "approved"}
    today_bills = await db.bills.find(today_query).to_list(5000)
    today_sales = sum(b.get('grand_total', 0) for b in today_bills)
    today_count = len(today_bills)
    today_gst = sum(b.get('gst_amount', 0) for b in today_bills)
    avg_ticket = today_sales / today_count if today_count > 0 else 0
    
    # All bills for analytics (with date range if provided)
    analytics_filter = {**base_filter}
    if date_from or date_to:
        analytics_filter.setdefault('created_at', {})
        if date_from:
            analytics_filter['created_at']['$gte'] = date_from
        if date_to:
            analytics_filter['created_at']['$lte'] = date_to + 'T23:59:59'
    
    all_bills = await db.bills.find(analytics_filter).to_list(10000)
    
    # KT category analysis
    kt_analysis = {}
    item_analysis = {}
    gold_total = 0
    diamond_total = 0
    mrp_total = 0
    reference_analysis = {}
    
    for bill in all_bills:
        # Reference tracking - count unique customers per reference (only sent/approved/edited bills)
        ref = normalize_reference(bill.get('customer_reference', '') or '') or 'Unknown'
        phone = bill.get('customer_phone', '')
        bill_status = bill.get('status', '')
        if ref and bill_status in ('sent', 'approved', 'edited'):
            if ref not in reference_analysis:
                reference_analysis[ref] = {'count': 0, 'total': 0, '_phones': set()}
            reference_analysis[ref]['count'] += 1
            reference_analysis[ref]['total'] += bill.get('grand_total', 0)
            if phone:
                reference_analysis[ref]['_phones'].add(phone)
        
        for item in bill.get('items', []):
            item_type = item.get('item_type', 'gold')
            iname = item.get('item_name', 'Unknown')
            amount = item.get('total_amount', 0)
            
            if item_type == 'mrp':
                # MRP items: separate category, skip KT analysis
                mrp_total += amount
                diamond_total += amount
                key = f"MRP-{iname}"
                if key not in item_analysis:
                    item_analysis[key] = {'purity': 'MRP', 'item_name': iname, 'count': 0, 'total': 0}
                item_analysis[key]['count'] += 1
                item_analysis[key]['total'] += amount
            else:
                purity = item.get('purity_name', 'Unknown')
                
                if purity not in kt_analysis:
                    kt_analysis[purity] = {'count': 0, 'total': 0}
                kt_analysis[purity]['count'] += 1
                kt_analysis[purity]['total'] += amount
                
                key = f"{purity}-{iname}"
                if key not in item_analysis:
                    item_analysis[key] = {'purity': purity, 'item_name': iname, 'count': 0, 'total': 0}
                item_analysis[key]['count'] += 1
                item_analysis[key]['total'] += amount
                
                if item_type == 'diamond':
                    diamond_total += amount
                else:
                    gold_total += amount
    
    # Daily sales trend (last 30 days)
    daily_sales = {}
    branch_sales = {}
    executive_sales = {}
    for bill in all_bills:
        date_str = bill.get('created_at', '')[:10]
        if date_str:
            if date_str not in daily_sales:
                daily_sales[date_str] = {'date': date_str, 'total': 0, 'count': 0}
            daily_sales[date_str]['total'] += bill.get('grand_total', 0)
            daily_sales[date_str]['count'] += 1
        
        # Branch-wise sales
        bid = bill.get('branch_id', 'unassigned')
        if bid not in branch_sales:
            branch_sales[bid] = {'branch_id': bid, 'total': 0, 'count': 0}
        branch_sales[bid]['total'] += bill.get('grand_total', 0)
        branch_sales[bid]['count'] += 1
        
        # Executive-wise sales
        eid = bill.get('executive_id', '')
        ename = bill.get('executive_name', 'Unknown')
        if eid not in executive_sales:
            executive_sales[eid] = {'executive_id': eid, 'executive_name': ename, 'total': 0, 'count': 0}
        executive_sales[eid]['total'] += bill.get('grand_total', 0)
        executive_sales[eid]['count'] += 1
    
    # Get branch names for branch_sales
    branches = await db.branches.find({}).to_list(100)
    branch_map = {b['id']: b.get('name', 'Unknown') for b in branches}
    for bs in branch_sales.values():
        bs['branch_name'] = branch_map.get(bs['branch_id'], 'Unassigned')
    
    # Customer analytics - unique customers from filtered bills
    unique_customer_phones = set()
    for bill in all_bills:
        phone = bill.get('customer_phone', '')
        if phone:
            unique_customer_phones.add(phone)
    total_customers_in_period = len(unique_customer_phones)
    
    # All-time total 
    all_time_total = sum(b.get('grand_total', 0) for b in all_bills)
    
    return {
        "today_sales": round(today_sales, 2),
        "today_count": today_count,
        "today_gst": round(today_gst, 2),
        "avg_ticket": round(avg_ticket, 2),
        "kt_analysis": kt_analysis,
        "item_analysis": list(item_analysis.values()),
        "gold_total": round(gold_total, 2),
        "diamond_total": round(diamond_total, 2),
        "reference_analysis": {k: {"count": v["count"], "total": v["total"], "customers": len(v.get("_phones", set()))} for k, v in reference_analysis.items()},
        "daily_sales": sorted(daily_sales.values(), key=lambda x: x['date']),
        "branch_sales": list(branch_sales.values()),
        "executive_sales": sorted(executive_sales.values(), key=lambda x: x['total'], reverse=True),
        "total_customers": total_customers_in_period,
        "total_bills": len(all_bills),
        "all_time_total": round(all_time_total, 2),
    }

@api_router.get("/analytics/reference-breakdown")
async def get_reference_breakdown(
    references: str = Query(..., description="Comma-separated list of references"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Get gold vs diamond sales breakdown for selected references."""
    await require_role(user, ["admin", "manager"])
    
    ref_list = [r.strip() for r in references.split(',') if r.strip()]
    if not ref_list:
        return {"references": [], "combined": {"gold_total": 0, "diamond_total": 0, "total": 0, "bills": 0, "customers": 0}}
    
    # Normalize requested references for matching
    ref_set = {normalize_reference(r) for r in ref_list}
    
    # Fetch all matching bills and filter by normalized reference in Python
    # (MongoDB regex can't match invisible Unicode chars)
    # No status filter — matches reference-report "Total" view which includes all bills
    query = {}
    if user.get('role') == 'manager' and user.get('branch_id'):
        query["branch_id"] = user['branch_id']
    if date_from or date_to:
        query.setdefault('created_at', {})
        if date_from:
            query['created_at']['$gte'] = date_from
        if date_to:
            query['created_at']['$lte'] = date_to + 'T23:59:59'
    
    all_bills = await db.bills.find(query).to_list(10000)
    
    # Filter bills whose normalized reference matches the requested set
    bills = []
    for bill in all_bills:
        norm_ref = normalize_reference(bill.get('customer_reference', '') or '')
        if norm_ref in ref_set:
            bills.append(bill)
    
    per_ref = {}
    combined_phones = set()
    for bill in bills:
        ref = normalize_reference(bill.get('customer_reference', '') or '') or 'Unknown'
        phone = bill.get('customer_phone', '')
        if phone:
            combined_phones.add(phone)
        
        if ref not in per_ref:
            per_ref[ref] = {"reference": ref, "gold_total": 0, "diamond_total": 0, "total": 0, "bills": 0, "_phones": set()}
        per_ref[ref]["bills"] += 1
        per_ref[ref]["total"] += bill.get('grand_total', 0)
        if phone:
            per_ref[ref]["_phones"].add(phone)
        
        for item in bill.get('items', []):
            item_type = item.get('item_type', 'gold')
            amount = item.get('total_amount', 0)
            if item_type in ('diamond', 'mrp'):
                per_ref[ref]["diamond_total"] += amount
            else:
                per_ref[ref]["gold_total"] += amount
    
    result = []
    combined_gold = 0
    combined_diamond = 0
    combined_total = 0
    combined_bills = 0
    for ref_data in per_ref.values():
        combined_gold += ref_data["gold_total"]
        combined_diamond += ref_data["diamond_total"]
        combined_total += ref_data["total"]
        combined_bills += ref_data["bills"]
        result.append({
            "reference": ref_data["reference"],
            "gold_total": round(ref_data["gold_total"], 2),
            "diamond_total": round(ref_data["diamond_total"], 2),
            "total": round(ref_data["total"], 2),
            "bills": ref_data["bills"],
            "customers": len(ref_data["_phones"]),
        })
    
    return {
        "references": result,
        "combined": {
            "gold_total": round(combined_gold, 2),
            "diamond_total": round(combined_diamond, 2),
            "total": round(combined_total, 2),
            "bills": combined_bills,
            "customers": len(combined_phones),
        }
    }

@api_router.get("/analytics/reference-report")
async def get_reference_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Get reference-wise report with Total, Approved, and NP (Non-Purchaser) views."""
    await require_role(user, ["admin", "manager"])
    
    base_filter = {}
    if user.get('role') == 'manager' and user.get('branch_id'):
        base_filter["branch_id"] = user.get('branch_id')
    
    query = {**base_filter}
    if date_from or date_to:
        query.setdefault('created_at', {})
        if date_from:
            query['created_at']['$gte'] = date_from
        if date_to:
            query['created_at']['$lte'] = date_to + 'T23:59:59'
    
    all_bills = await db.bills.find(query, {"_id": 0}).to_list(10000)
    
    approved_statuses = ('sent', 'approved', 'edited')
    
    # Build per-reference data
    ref_total = {}  # All bills by reference
    ref_approved = {}  # Approved bills by reference
    ref_customer_statuses = {}  # Track per-customer, per-reference: has approved? has draft?
    
    for bill in all_bills:
        ref = normalize_reference(bill.get('customer_reference', '') or '') or 'Unknown'
        phone = bill.get('customer_phone', '')
        status = bill.get('status', 'draft')
        grand_total = bill.get('grand_total', 0)
        
        # TOTAL view
        if ref not in ref_total:
            ref_total[ref] = {'reference': ref, 'bills': 0, 'total': 0, '_phones': set(), 'bill_list': []}
        ref_total[ref]['bills'] += 1
        ref_total[ref]['total'] += grand_total
        if phone:
            ref_total[ref]['_phones'].add(phone)
        ref_total[ref]['bill_list'].append({
            'id': bill.get('id'),
            'bill_number': bill.get('bill_number'),
            'customer_name': bill.get('customer_name'),
            'customer_phone': phone,
            'grand_total': grand_total,
            'status': status,
            'created_at': bill.get('created_at', ''),
            'salesperson_name': bill.get('salesperson_name', ''),
        })
        
        # APPROVED view
        if status in approved_statuses:
            if ref not in ref_approved:
                ref_approved[ref] = {'reference': ref, 'bills': 0, 'total': 0, '_phones': set(), 'bill_list': []}
            ref_approved[ref]['bills'] += 1
            ref_approved[ref]['total'] += grand_total
            if phone:
                ref_approved[ref]['_phones'].add(phone)
            ref_approved[ref]['bill_list'].append({
                'id': bill.get('id'),
                'bill_number': bill.get('bill_number'),
                'customer_name': bill.get('customer_name'),
                'customer_phone': phone,
                'grand_total': grand_total,
                'status': status,
                'created_at': bill.get('created_at', ''),
                'salesperson_name': bill.get('salesperson_name', ''),
            })
        
        # Track customer purchase status per reference
        key = (ref, phone)
        if key not in ref_customer_statuses:
            ref_customer_statuses[key] = {'has_approved': False, 'drafts': []}
        if status in approved_statuses:
            ref_customer_statuses[key]['has_approved'] = True
        else:
            ref_customer_statuses[key]['drafts'].append({
                'id': bill.get('id'),
                'bill_number': bill.get('bill_number'),
                'customer_name': bill.get('customer_name'),
                'customer_phone': phone,
                'grand_total': grand_total,
                'status': status,
                'created_at': bill.get('created_at', ''),
                'salesperson_name': bill.get('salesperson_name', ''),
            })
    
    # Build NP (Non-Purchaser) data: customers with drafts but no approved bills
    ref_np = {}
    for (ref, phone), data in ref_customer_statuses.items():
        if not data['has_approved'] and data['drafts']:
            if ref not in ref_np:
                ref_np[ref] = {'reference': ref, 'customers': 0, '_phones': set(), 'customer_list': []}
            if phone and phone not in ref_np[ref]['_phones']:
                ref_np[ref]['_phones'].add(phone)
                ref_np[ref]['customers'] += 1
                # Get customer name from first draft
                first_draft = data['drafts'][0]
                ref_np[ref]['customer_list'].append({
                    'customer_name': first_draft['customer_name'],
                    'customer_phone': phone,
                    'inquiry_count': len(data['drafts']),
                    'last_inquiry': data['drafts'][-1]['created_at'],
                    'bills': data['drafts'],
                })
    
    def serialize_ref(d):
        return {
            'reference': d['reference'],
            'bills': d.get('bills', 0),
            'total': round(d.get('total', 0), 2),
            'customers': len(d.get('_phones', set())),
            'bill_list': d.get('bill_list', []),
        }
    
    def serialize_np(d):
        return {
            'reference': d['reference'],
            'customers': d['customers'],
            'customer_list': d.get('customer_list', []),
        }
    
    total_data = sorted([serialize_ref(v) for v in ref_total.values()], key=lambda x: x['total'], reverse=True)
    approved_data = sorted([serialize_ref(v) for v in ref_approved.values()], key=lambda x: x['total'], reverse=True)
    np_data = sorted([serialize_np(v) for v in ref_np.values()], key=lambda x: x['customers'], reverse=True)
    
    return {
        "total": total_data,
        "approved": approved_data,
        "np": np_data,
        "summary": {
            "total_bills": sum(d['bills'] for d in total_data),
            "total_customers": len(set(p for v in ref_total.values() for p in v['_phones'])),
            "approved_bills": sum(d['bills'] for d in approved_data),
            "approved_customers": len(set(p for v in ref_approved.values() for p in v['_phones'])),
            "np_customers": sum(d['customers'] for d in np_data),
        }
    }


@api_router.get("/analytics/customers")
async def get_customer_analytics(user=Depends(get_current_user)):
    await require_role(user, ["admin", "manager"])
    
    # Branch-scoped bill query for managers
    bill_query = {"status": {"$in": ["sent", "approved", "edited"]}}
    if user.get('role') == 'manager' and user.get('branch_id'):
        bill_query["branch_id"] = user['branch_id']
    
    all_bills = await db.bills.find(bill_query).to_list(10000)
    
    # Aggregate spending by customer_id (preferred) or phone
    scoped_phones = set()
    customer_id_spending = {}  # customer_id -> total
    phone_spending = {}  # phone -> total (fallback for bills without customer_id)
    scoped_customer_ids = set()
    for bill in all_bills:
        phone = bill.get('customer_phone', '')
        cust_id = bill.get('customer_id', '')
        amount = bill.get('grand_total', 0)
        if phone:
            scoped_phones.add(phone)
        if cust_id:
            scoped_customer_ids.add(cust_id)
            customer_id_spending[cust_id] = customer_id_spending.get(cust_id, 0) + amount
        elif phone:
            phone_spending[phone] = phone_spending.get(phone, 0) + amount
    
    # For managers, only show customers who have bills in their branch
    if user.get('role') == 'manager' and user.get('branch_id'):
        cust_query_parts = []
        if scoped_customer_ids:
            cust_query_parts.append({"id": {"$in": list(scoped_customer_ids)}})
        if scoped_phones:
            cust_query_parts.append({"phone": {"$in": list(scoped_phones)}})
            cust_query_parts.append({"phones": {"$in": list(scoped_phones)}})
        customers = await db.customers.find({"$or": cust_query_parts} if cust_query_parts else {}).to_list(5000)
    else:
        customers = await db.customers.find({}).to_list(5000)
    
    result = []
    for c in customers:
        c_data = serialize_doc(c)
        # Use customer_id-based spending, fallback to phone-based
        cid = c.get('id', '')
        phone = c.get('phone', '')
        spent = customer_id_spending.get(cid, 0) + phone_spending.get(phone, 0)
        c_data['total_spent'] = round(spent, 2)
        # Calculate days since last visit
        last_visit = c.get('last_visit', '')
        if last_visit:
            try:
                lv = datetime.fromisoformat(last_visit.replace('Z', '+00:00'))
                days_since = (datetime.now(timezone.utc) - lv).days
                c_data['days_since_last_visit'] = days_since
            except Exception:
                c_data['days_since_last_visit'] = None
        result.append(c_data)
    return result

@api_router.get("/analytics/customers/frequency")
async def get_customer_frequency(user=Depends(get_current_user)):
    """Get customer visit frequency cohorts."""
    await require_role(user, ["admin", "manager"])
    
    # Branch-scoped bill query for managers
    bill_query = {"status": {"$in": ["sent", "approved", "edited"]}}
    if user.get('role') == 'manager' and user.get('branch_id'):
        bill_query["branch_id"] = user['branch_id']
    
    all_bills = await db.bills.find(bill_query).to_list(10000)
    
    scoped_phones = set()
    scoped_customer_ids = set()
    customer_id_spending = {}
    phone_spending = {}
    for bill in all_bills:
        phone = bill.get('customer_phone', '')
        cust_id = bill.get('customer_id', '')
        amount = bill.get('grand_total', 0)
        if phone:
            scoped_phones.add(phone)
        if cust_id:
            scoped_customer_ids.add(cust_id)
            customer_id_spending[cust_id] = customer_id_spending.get(cust_id, 0) + amount
        elif phone:
            phone_spending[phone] = phone_spending.get(phone, 0) + amount
    
    if user.get('role') == 'manager' and user.get('branch_id'):
        cust_query_parts = []
        if scoped_customer_ids:
            cust_query_parts.append({"id": {"$in": list(scoped_customer_ids)}})
        if scoped_phones:
            cust_query_parts.append({"phone": {"$in": list(scoped_phones)}})
            cust_query_parts.append({"phones": {"$in": list(scoped_phones)}})
        customers = await db.customers.find({"$or": cust_query_parts} if cust_query_parts else {}).to_list(5000)
    else:
        customers = await db.customers.find({}).to_list(5000)
    
    def get_customer_spent(c):
        cid = c.get('id', '')
        phone = c.get('phone', '')
        return customer_id_spending.get(cid, 0) + phone_spending.get(phone, 0)
    
    # Define cohort buckets
    cohorts = {
        "1 visit": {"count": 0, "total_spent": 0},
        "2-3 visits": {"count": 0, "total_spent": 0},
        "4-5 visits": {"count": 0, "total_spent": 0},
        "6+ visits": {"count": 0, "total_spent": 0},
    }
    
    for c in customers:
        visits = c.get('total_visits', 1)
        spent = get_customer_spent(c)
        if visits <= 1:
            cohorts["1 visit"]["count"] += 1
            cohorts["1 visit"]["total_spent"] += spent
        elif visits <= 3:
            cohorts["2-3 visits"]["count"] += 1
            cohorts["2-3 visits"]["total_spent"] += spent
        elif visits <= 5:
            cohorts["4-5 visits"]["count"] += 1
            cohorts["4-5 visits"]["total_spent"] += spent
        else:
            cohorts["6+ visits"]["count"] += 1
            cohorts["6+ visits"]["total_spent"] += spent
    
    # Spending tiers
    spending_tiers = {
        "Under 25K": {"count": 0, "total_spent": 0},
        "25K - 50K": {"count": 0, "total_spent": 0},
        "50K - 1L": {"count": 0, "total_spent": 0},
        "1L - 2L": {"count": 0, "total_spent": 0},
        "Above 2L": {"count": 0, "total_spent": 0},
    }
    
    for c in customers:
        spent = get_customer_spent(c)
        if spent < 25000:
            spending_tiers["Under 25K"]["count"] += 1
            spending_tiers["Under 25K"]["total_spent"] += spent
        elif spent < 50000:
            spending_tiers["25K - 50K"]["count"] += 1
            spending_tiers["25K - 50K"]["total_spent"] += spent
        elif spent < 100000:
            spending_tiers["50K - 1L"]["count"] += 1
            spending_tiers["50K - 1L"]["total_spent"] += spent
        elif spent < 200000:
            spending_tiers["1L - 2L"]["count"] += 1
            spending_tiers["1L - 2L"]["total_spent"] += spent
        else:
            spending_tiers["Above 2L"]["count"] += 1
            spending_tiers["Above 2L"]["total_spent"] += spent
    
    return {
        "frequency_cohorts": [
            {"name": k, "count": v["count"], "total_spent": round(v["total_spent"], 2)} 
            for k, v in cohorts.items()
        ],
        "spending_tiers": [
            {"name": k, "count": v["count"], "total_spent": round(v["total_spent"], 2)} 
            for k, v in spending_tiers.items()
        ],
        "total_customers": len(customers),
        "avg_visits": round(sum(c.get('total_visits', 1) for c in customers) / max(len(customers), 1), 1),
        "avg_spending": round(sum(c.get('total_spent', 0) for c in customers) / max(len(customers), 1), 2),
    }

@api_router.get("/analytics/customers/inactive")
async def get_inactive_customers(
    days: int = Query(default=30, ge=1, description="Number of days of inactivity"),
    user=Depends(get_current_user)
):
    """Get customers who haven't visited in X days."""
    await require_role(user, ["admin", "manager"])
    
    # Branch-scoped bill query for managers
    bill_query = {"status": {"$in": ["sent", "approved", "edited"]}}
    if user.get('role') == 'manager' and user.get('branch_id'):
        bill_query["branch_id"] = user['branch_id']
    
    all_bills = await db.bills.find(bill_query).to_list(10000)
    
    scoped_phones = set()
    scoped_customer_ids = set()
    customer_id_spending = {}
    phone_spending = {}
    for bill in all_bills:
        phone = bill.get('customer_phone', '')
        cust_id = bill.get('customer_id', '')
        amount = bill.get('grand_total', 0)
        if phone:
            scoped_phones.add(phone)
        if cust_id:
            scoped_customer_ids.add(cust_id)
            customer_id_spending[cust_id] = customer_id_spending.get(cust_id, 0) + amount
        elif phone:
            phone_spending[phone] = phone_spending.get(phone, 0) + amount
    
    if user.get('role') == 'manager' and user.get('branch_id'):
        cust_query_parts = []
        if scoped_customer_ids:
            cust_query_parts.append({"id": {"$in": list(scoped_customer_ids)}})
        if scoped_phones:
            cust_query_parts.append({"phone": {"$in": list(scoped_phones)}})
            cust_query_parts.append({"phones": {"$in": list(scoped_phones)}})
        customers = await db.customers.find({"$or": cust_query_parts} if cust_query_parts else {}).to_list(5000)
    else:
        customers = await db.customers.find({}).to_list(5000)
    
    inactive = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    for c in customers:
        last_visit = c.get('last_visit', '')
        if last_visit:
            try:
                lv = datetime.fromisoformat(last_visit.replace('Z', '+00:00'))
                if lv < cutoff:
                    c_data = serialize_doc(c)
                    c_data['days_since_last_visit'] = (datetime.now(timezone.utc) - lv).days
                    cid = c.get('id', '')
                    phone = c.get('phone', '')
                    c_data['total_spent'] = round(customer_id_spending.get(cid, 0) + phone_spending.get(phone, 0), 2)
                    inactive.append(c_data)
            except Exception:
                pass
    
    # Sort by days_since_last_visit descending (most inactive first)
    inactive.sort(key=lambda x: x.get('days_since_last_visit', 0), reverse=True)
    
    return {
        "threshold_days": days,
        "inactive_count": len(inactive),
        "total_customers": len(customers),
        "inactive_customers": inactive,
    }


# ============ BILL PDF GENERATION ============
@api_router.get("/bills/{bill_id}/pdf")
async def generate_bill_pdf(bill_id: str, user=Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    await check_bill_access(bill, user)
    
    bill_data = serialize_doc(bill)
    
    # Generate PDF using reportlab
    buffer = io.BytesIO()
    width, height = A4
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    
    # Margins and content area
    margin_left = 20*mm
    margin_right = width - 20*mm
    content_width = margin_right - margin_left
    
    # Gold double border
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(2.5)
    c.rect(14*mm, 14*mm, width - 28*mm, height - 28*mm)
    c.setLineWidth(0.6)
    c.rect(16*mm, 16*mm, width - 32*mm, height - 32*mm)
    
    # Header
    y = height - 32*mm
    c.setFont('Helvetica-Bold', 22)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawCentredString(width/2, y, 'AJPL JEWELLERY')
    
    y -= 7*mm
    c.setFont('Helvetica', 11)
    c.setFillColor(rl_colors.HexColor('#666666'))
    c.drawCentredString(width/2, y, 'TENTATIVE INVOICE')
    
    # Gold divider
    y -= 5*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(1.2)
    c.line(width/2 - 50*mm, y, width/2 + 50*mm, y)
    
    y -= 6*mm
    c.setFont('Helvetica', 9)
    c.setFillColor(rl_colors.HexColor('#444444'))
    c.drawCentredString(width/2, y, f"Bill No: {bill_data.get('bill_number', '')}")
    y -= 4*mm
    c.drawCentredString(width/2, y, f"Date: {bill_data.get('created_at', '')[:10]}")
    
    # Customer details box
    y -= 8*mm
    box_top = y + 3*mm
    box_bottom = y - 28*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(0.5)
    c.setFillColor(rl_colors.HexColor('#f8f4ec'))
    c.rect(margin_left, box_bottom, content_width, box_top - box_bottom, fill=1, stroke=1)
    
    y -= 2*mm
    c.setFont('Helvetica-Bold', 10)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawString(margin_left + 4*mm, y, 'Customer Details')
    y -= 5*mm
    c.setFont('Helvetica', 9)
    c.setFillColor(rl_colors.HexColor('#333333'))
    c.drawString(margin_left + 4*mm, y, f"Name: {bill_data.get('customer_name', '')}")
    c.drawString(width/2, y, f"Phone: {bill_data.get('customer_phone', '')}")
    y -= 4.5*mm
    c.drawString(margin_left + 4*mm, y, f"Location: {bill_data.get('customer_location', '-')}")
    c.drawString(width/2, y, f"Reference: {bill_data.get('customer_reference', '-')}")
    y -= 4.5*mm
    c.drawString(margin_left + 4*mm, y, f"Executive: {bill_data.get('executive_name', '')}")
    status_str = bill_data.get('status', 'draft').upper()
    c.drawString(width/2, y, f"Status: {status_str}")
    
    # Items table
    y = box_bottom - 6*mm
    
    # Check if any diamond items
    has_diamond = any(item.get('item_type') == 'diamond' for item in bill_data.get('items', []))
    
    # Define columns to fit within margins
    # Columns: #, Item, KT, Gross, Less, Net, Rate/10g, Gold Val, Making, Stone, [Studded], Total
    if has_diamond:
        cols = [
            (margin_left, 6*mm, 'L', '#'),
            (margin_left + 6*mm, 22*mm, 'L', 'Item'),
            (margin_left + 28*mm, 10*mm, 'L', 'KT'),
            (margin_left + 38*mm, 12*mm, 'R', 'Gross(g)'),
            (margin_left + 50*mm, 10*mm, 'R', 'Less(g)'),
            (margin_left + 60*mm, 12*mm, 'R', 'Net(g)'),
            (margin_left + 72*mm, 18*mm, 'R', 'Rate/10g'),
            (margin_left + 90*mm, 18*mm, 'R', 'Gold Val'),
            (margin_left + 108*mm, 16*mm, 'R', 'Making'),
            (margin_left + 124*mm, 14*mm, 'R', 'Stone'),
            (margin_left + 138*mm, 14*mm, 'R', 'Studded'),
            (margin_left + 152*mm, content_width - 152*mm, 'R', 'Total'),
        ]
    else:
        cols = [
            (margin_left, 7*mm, 'L', '#'),
            (margin_left + 7*mm, 26*mm, 'L', 'Item'),
            (margin_left + 33*mm, 11*mm, 'L', 'KT'),
            (margin_left + 44*mm, 14*mm, 'R', 'Gross(g)'),
            (margin_left + 58*mm, 12*mm, 'R', 'Less(g)'),
            (margin_left + 70*mm, 14*mm, 'R', 'Net(g)'),
            (margin_left + 84*mm, 20*mm, 'R', 'Rate/10g'),
            (margin_left + 104*mm, 20*mm, 'R', 'Gold Val'),
            (margin_left + 124*mm, 18*mm, 'R', 'Making'),
            (margin_left + 142*mm, 14*mm, 'R', 'Stone'),
            (margin_left + 156*mm, content_width - 156*mm, 'R', 'Total'),
        ]
    
    # Table header background
    c.setFillColor(rl_colors.HexColor('#f0ebe0'))
    c.rect(margin_left, y - 4*mm, content_width, 6*mm, fill=1, stroke=0)
    
    # Table header text
    c.setFont('Helvetica-Bold', 7)
    c.setFillColor(rl_colors.HexColor('#666666'))
    for (x, w, align, header) in cols:
        if align == 'R':
            c.drawRightString(x + w, y - 2.5*mm, header.upper())
        else:
            c.drawString(x + 1*mm, y - 2.5*mm, header.upper())
    
    # Header bottom line
    y -= 4.5*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(1)
    c.line(margin_left, y, margin_right, y)
    
    # Items
    c.setFont('Helvetica', 8)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    for idx, item in enumerate(bill_data.get('items', [])):
        y -= 5.5*mm
        if y < 40*mm:
            c.showPage()
            y = height - 25*mm
            # Redraw border on new page
            c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
            c.setLineWidth(2.5)
            c.rect(14*mm, 14*mm, width - 28*mm, height - 28*mm)
            c.setLineWidth(0.6)
            c.rect(16*mm, 16*mm, width - 32*mm, height - 32*mm)
        
        # Alternate row background
        if idx % 2 == 1:
            c.setFillColor(rl_colors.HexColor('#faf8f3'))
            c.rect(margin_left, y - 1.5*mm, content_width, 5*mm, fill=1, stroke=0)
        
        c.setFillColor(rl_colors.HexColor('#1a1a3e'))
        c.setFont('Helvetica', 8)
        
        # Truncate item name to fit column
        item_name = str(item.get('item_name', ''))
        max_chars = 16 if has_diamond else 20
        if len(item_name) > max_chars:
            item_name = item_name[:max_chars-1] + '..'
        
        gross_wt = item.get('gross_weight', 0)
        less_wt = item.get('less', 0)
        net_wt = item.get('net_weight', 0)
        
        is_mrp_item = item.get('item_type') == 'mrp'
        
        if is_mrp_item:
            row_data = [
                str(idx + 1),
                item_name,
                'MRP',
                f"{gross_wt:.3f}",
                '-',
                f"{net_wt:.3f}",
                f"{item.get('mrp', 0):,.0f}",
                f"-{item.get('total_discount', 0):,.0f}" if item.get('total_discount', 0) > 0 else '-',
                '-',
                '-',
            ]
        else:
            row_data = [
                str(idx + 1),
                item_name,
                str(item.get('purity_name', '')),
                f"{gross_wt:.3f}",
                f"{less_wt:.3f}",
                f"{net_wt:.3f}",
                f"{item.get('rate_per_10g', 0):,.0f}",
                f"{item.get('gold_value', 0):,.0f}",
                f"{item.get('total_making', 0):,.0f}",
                f"{item.get('total_stone', 0):,.0f}",
            ]
        
        if has_diamond:
            row_data.append(f"{item.get('total_studded', 0):,.0f}")
        
        row_data.append(f"{item.get('total_amount', 0):,.0f}")
        
        for i, (x, w, align, _) in enumerate(cols):
            if i < len(row_data):
                if align == 'R':
                    c.drawRightString(x + w, y, row_data[i])
                else:
                    c.drawString(x + 1*mm, y, row_data[i])
        
        # Light row separator
        c.setStrokeColor(rl_colors.HexColor('#e8e0d0'))
        c.setLineWidth(0.3)
        c.line(margin_left, y - 2*mm, margin_right, y - 2*mm)
    
    # Bottom line of items table
    y -= 4*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(1)
    c.line(margin_left, y, margin_right, y)
    
    # Totals section (right aligned)
    totals_x = margin_right - 70*mm
    
    y -= 7*mm
    c.setFont('Helvetica', 9)
    c.setFillColor(rl_colors.HexColor('#444444'))
    c.drawString(totals_x, y, 'Items Total:')
    c.setFont('Helvetica-Bold', 9)
    c.drawRightString(margin_right - 2*mm, y, f"Rs. {bill_data.get('items_total', 0):,.2f}")
    
    # External charges
    for ec in bill_data.get('external_charges', []):
        y -= 5*mm
        c.setFont('Helvetica', 8.5)
        c.setFillColor(rl_colors.HexColor('#666666'))
        c.drawString(totals_x, y, f"{ec.get('name', '')}:")
        c.drawRightString(margin_right - 2*mm, y, f"Rs. {ec.get('amount', 0):,.2f}")
    
    if bill_data.get('external_charges_total', 0) > 0:
        y -= 5*mm
        c.setFont('Helvetica', 9)
        c.setFillColor(rl_colors.HexColor('#444444'))
        c.drawString(totals_x, y, 'External Charges:')
        c.drawRightString(margin_right - 2*mm, y, f"Rs. {bill_data.get('external_charges_total', 0):,.2f}")
    
    # Divider
    y -= 4*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(0.8)
    c.line(totals_x, y, margin_right - 2*mm, y)
    
    y -= 6*mm
    c.setFont('Helvetica-Bold', 10)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawString(totals_x, y, 'Subtotal (without GST):')
    c.drawRightString(margin_right - 2*mm, y, f"Rs. {bill_data.get('subtotal_without_gst', 0):,.2f}")
    
    y -= 5*mm
    c.setFont('Helvetica', 9)
    c.setFillColor(rl_colors.HexColor('#666666'))
    c.drawString(totals_x, y, f"GST ({bill_data.get('gst_percent', 3)}%):")
    c.drawRightString(margin_right - 2*mm, y, f"Rs. {bill_data.get('gst_amount', 0):,.2f}")
    
    # Grand total double line
    y -= 4*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(1.5)
    c.line(totals_x, y, margin_right - 2*mm, y)
    c.setLineWidth(0.5)
    c.line(totals_x, y - 1.5*mm, margin_right - 2*mm, y - 1.5*mm)
    
    y -= 7*mm
    c.setFont('Helvetica-Bold', 13)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawString(totals_x, y, 'GRAND TOTAL:')
    c.drawRightString(margin_right - 2*mm, y, f"Rs. {bill_data.get('grand_total', 0):,.2f}")
    
    # Footer
    y -= 14*mm
    c.setStrokeColor(rl_colors.HexColor('#e0d6c4'))
    c.setLineWidth(0.5)
    c.line(margin_left + 20*mm, y + 4*mm, margin_right - 20*mm, y + 4*mm)
    c.setFont('Helvetica-Oblique', 8.5)
    c.setFillColor(rl_colors.HexColor('#888888'))
    c.drawCentredString(width/2, y, 'Thank you for your valuable patronage!')
    
    c.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{bill_data.get("bill_number", "bill")}.pdf"'}
    )

# ============ SALESPERSON MANAGEMENT ============
@api_router.post("/salespeople")
async def create_salesperson(req: SalespersonCreate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    existing = await db.salespeople.find_one({"name": req.name})
    if existing:
        raise HTTPException(status_code=400, detail="Salesperson already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "branch_id": req.branch_id or "",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.salespeople.insert_one(doc)
    return serialize_doc(doc)

@api_router.get("/salespeople")
async def list_salespeople(branch_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"is_active": True}
    if branch_id:
        query["branch_id"] = branch_id
    people = await db.salespeople.find(query).to_list(500)
    # Lookup branch names
    branches = {b["id"]: b["name"] for b in await db.branches.find({}).to_list(100)}
    result = []
    for p in people:
        p_data = serialize_doc(p)
        p_data["branch_name"] = branches.get(p.get("branch_id", ""), "")
        result.append(p_data)
    return result

@api_router.delete("/salespeople/{sp_id}")
async def delete_salesperson(sp_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.salespeople.delete_one({"id": sp_id})
    return {"status": "deleted"}

@api_router.get("/salespeople/{sp_name}/performance")
async def get_salesperson_performance(sp_name: str, user=Depends(get_current_user)):
    """Get salesperson performance data: total sales, day-wise breakdown, branch."""
    await require_role(user, ["admin", "manager"])
    
    sp = await db.salespeople.find_one({"name": sp_name})
    # Manager branch check: only allow viewing salespeople in own branch
    if user.get('role') == 'manager' and user.get('branch_id'):
        if sp and sp.get('branch_id') and sp['branch_id'] != user['branch_id']:
            raise HTTPException(status_code=403, detail="Salesperson belongs to a different branch")
    
    branch_name = ""
    if sp and sp.get("branch_id"):
        branch = await db.branches.find_one({"id": sp["branch_id"]})
        branch_name = branch.get("name", "") if branch else ""
    
    bill_query = {
        "salesperson_name": sp_name,
        "status": {"$in": ["sent", "approved", "edited"]}
    }
    if user.get('role') == 'manager' and user.get('branch_id'):
        bill_query["branch_id"] = user['branch_id']
    
    bills = await db.bills.find(bill_query).to_list(10000)
    
    total_sales = sum(b.get("grand_total", 0) for b in bills)
    total_bills = len(bills)
    
    daily_sales = {}
    for b in bills:
        date_str = b.get("created_date", "")
        if not date_str:
            created_at = b.get("created_at", "")
            if created_at:
                try:
                    date_str = created_at[:10]
                except Exception:
                    continue
        if date_str:
            if date_str not in daily_sales:
                daily_sales[date_str] = {"date": date_str, "amount": 0, "bill_count": 0}
            daily_sales[date_str]["amount"] += b.get("grand_total", 0)
            daily_sales[date_str]["bill_count"] += 1
    
    daily_list = sorted(daily_sales.values(), key=lambda x: x["date"])
    for d in daily_list:
        d["amount"] = round(d["amount"], 2)
    
    return {
        "name": sp_name,
        "branch_name": branch_name,
        "total_sales": round(total_sales, 2),
        "total_bills": total_bills,
        "daily_sales": daily_list,
    }

# ============ ENHANCED CUSTOMER MANAGEMENT ============
@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, req: CustomerUpdate, user=Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phone": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    cust_id = customer.get("id", customer_id)
    old_phone = customer.get("phone") or ""
    old_phones = customer.get("phones") or []
    update_data = {k: v for k, v in req.dict(exclude_none=True).items()}
    # Normalize reference at write time
    if "reference" in update_data:
        update_data["reference"] = normalize_reference(update_data["reference"])
    if update_data:
        await db.customers.update_one({"id": cust_id}, {"$set": update_data})

    # Propagate changes to all associated bills
    bill_update = {}
    if req.name is not None:
        bill_update["customer_name"] = req.name
    if req.phone is not None:
        bill_update["customer_phone"] = req.phone
    if req.location is not None:
        bill_update["customer_location"] = req.location
    if req.reference is not None:
        bill_update["customer_reference"] = normalize_reference(req.reference)
    if bill_update:
        # Collect all possible phone identifiers for this customer
        all_phones = set()
        if old_phone:
            all_phones.add(old_phone)
        for p in old_phones:
            if p:
                all_phones.add(p)
        # Also include the URL parameter if it looks like a phone (not a UUID)
        if customer_id != cust_id and customer_id:
            all_phones.add(customer_id)
        all_phones = list(all_phones)

        total_modified = 0
        try:
            # Strategy 1: Update by customer_id
            if cust_id:
                r1 = await db.bills.update_many({"customer_id": cust_id}, {"$set": bill_update})
                total_modified += r1.modified_count
            # Strategy 2: Update by customer_phone (catches bills without customer_id)
            if all_phones:
                r2 = await db.bills.update_many(
                    {"customer_phone": {"$in": all_phones}},
                    {"$set": bill_update}
                )
                total_modified += r2.modified_count
            logger.info(f"Customer {cust_id} update propagated to {total_modified} bill(s). Phones: {all_phones}")
        except Exception as e:
            logger.error(f"Bill propagation failed for customer {cust_id}: {e}")

    updated = await db.customers.find_one({"id": cust_id})
    return serialize_doc(updated)

# ============ CUSTOMER TIER SETTINGS ============
@api_router.get("/settings/tiers")
async def get_tier_settings(user=Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "customer_tiers"})
    if not settings:
        return {"tiers": []}
    return {"tiers": settings.get("tiers", [])}

@api_router.put("/settings/tiers")
async def update_tier_settings(req: TierSettingsUpdate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.settings.update_one(
        {"key": "customer_tiers"},
        {"$set": {"tiers": [dict(t) for t in req.tiers]}},
        upsert=True,
    )
    return {"status": "updated"}

# ============ FEEDBACK SYSTEM ============
@api_router.post("/feedback-questions")
async def create_feedback_question(req: FeedbackQuestionCreate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    count = await db.feedback_questions.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        "question": req.question,
        "order": req.order or count + 1,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback_questions.insert_one(doc)
    return serialize_doc(doc)

@api_router.get("/feedback-questions")
async def list_feedback_questions(user=Depends(get_current_user)):
    questions = await db.feedback_questions.find({"is_active": True}).sort("order", 1).to_list(100)
    return [serialize_doc(q) for q in questions]

@api_router.delete("/feedback-questions/{q_id}")
async def delete_feedback_question(q_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.feedback_questions.delete_one({"id": q_id})
    return {"status": "deleted"}

@api_router.post("/bills/{bill_id}/feedback")
async def submit_feedback(bill_id: str, req: FeedbackSubmit):
    """Submit customer feedback for a bill - no auth required (customer fills this)."""
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "bill_id": bill_id,
        "customer_name": req.customer_name or bill.get("customer_name", ""),
        "ratings": [dict(r) for r in req.ratings],
        "additional_comments": req.additional_comments or "",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedbacks.insert_one(feedback_doc)
    await db.bills.update_one({"id": bill_id}, {"$set": {"has_feedback": True}})
    return serialize_doc(feedback_doc)

@api_router.get("/bills/{bill_id}/feedback")
async def get_bill_feedback(bill_id: str, user=Depends(get_current_user)):
    feedback = await db.feedbacks.find_one({"bill_id": bill_id})
    if not feedback:
        return None
    return serialize_doc(feedback)

@api_router.get("/feedbacks")
async def list_all_feedbacks(user=Depends(get_current_user)):
    """Get all feedbacks with bill details, sorted by date."""
    await require_role(user, ["admin", "manager"])
    feedbacks = await db.feedbacks.find({}).sort("submitted_at", -1).to_list(5000)
    result = []
    for f in feedbacks:
        f_data = serialize_doc(f)
        bill = await db.bills.find_one({"id": f.get("bill_id")})
        if bill:
            # Manager branch scoping: skip feedbacks for bills outside their branch
            if user.get('role') == 'manager' and user.get('branch_id'):
                if bill.get('branch_id') and bill['branch_id'] != user['branch_id']:
                    continue
            f_data["bill_number"] = bill.get("bill_number", "")
            f_data["bill_date"] = bill.get("created_date", bill.get("created_at", "")[:10])
            f_data["grand_total"] = bill.get("grand_total", 0)
            f_data["customer_phone"] = bill.get("customer_phone", "")
            f_data["executive_name"] = bill.get("executive_name", "")
        avg_rating = 0
        ratings = f.get("ratings", [])
        if ratings:
            avg_rating = sum(r.get("rating", 0) for r in ratings) / len(ratings)
        f_data["avg_rating"] = round(avg_rating, 1)
        result.append(f_data)
    return result

# ============ NOTIFICATION SYSTEM ============
async def generate_notifications():
    """Generate birthday/anniversary notifications. Called periodically or on demand."""
    today_ist = datetime.now(IST)
    today_str = today_ist.strftime("%m-%d")
    customers = await db.customers.find({}).to_list(10000)
    tiers_doc = await db.settings.find_one({"key": "customer_tiers"})
    tiers = tiers_doc.get("tiers", []) if tiers_doc else []

    for c in customers:
        customer_id = c.get("id", "")
        # Birthday notifications
        dob = c.get("dob", "")
        if dob:
            try:
                dob_md = dob[5:10]  # MM-DD from YYYY-MM-DD
                if dob_md == today_str:
                    existing = await db.notifications.find_one({
                        "customer_id": customer_id,
                        "type": "birthday",
                        "due_date": today_ist.strftime("%Y-%m-%d"),
                    })
                    if not existing:
                        tier = get_customer_tier(c.get("total_spent", 0), tiers)
                        await db.notifications.insert_one({
                            "id": str(uuid.uuid4()),
                            "type": "birthday",
                            "customer_id": customer_id,
                            "customer_name": c.get("name", ""),
                            "customer_phone": c.get("phone", ""),
                            "tier": tier,
                            "message": f"Birthday today! {c.get('name', '')}",
                            "due_date": today_ist.strftime("%Y-%m-%d"),
                            "status": "pending",
                            "target_user_id": c.get("last_executive_id", ""),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        })
            except Exception:
                pass
        # Anniversary notifications
        anniv = c.get("anniversary", "")
        if anniv:
            try:
                anniv_md = anniv[5:10]
                if anniv_md == today_str:
                    existing = await db.notifications.find_one({
                        "customer_id": customer_id,
                        "type": "anniversary",
                        "due_date": today_ist.strftime("%Y-%m-%d"),
                    })
                    if not existing:
                        tier = get_customer_tier(c.get("total_spent", 0), tiers)
                        await db.notifications.insert_one({
                            "id": str(uuid.uuid4()),
                            "type": "anniversary",
                            "customer_id": customer_id,
                            "customer_name": c.get("name", ""),
                            "customer_phone": c.get("phone", ""),
                            "tier": tier,
                            "message": f"Anniversary today! {c.get('name', '')}",
                            "due_date": today_ist.strftime("%Y-%m-%d"),
                            "status": "pending",
                            "target_user_id": c.get("last_executive_id", ""),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        })
            except Exception:
                pass
    # Re-remind pending tasks from before today
    old_pending = await db.notifications.find({
        "status": "pending",
        "due_date": {"$lt": today_ist.strftime("%Y-%m-%d")},
    }).to_list(1000)
    for n in old_pending:
        await db.notifications.update_one({"id": n["id"]}, {"$set": {"due_date": today_ist.strftime("%Y-%m-%d")}})


def get_customer_tier(total_spent, tiers):
    """Determine customer tier based on total spent."""
    for t in sorted(tiers, key=lambda x: x.get("min_amount", 0), reverse=True):
        if total_spent >= t.get("min_amount", 0):
            return t.get("name", "Bronze")
    return "Bronze"


@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    """Get notifications for the current user."""
    await generate_notifications()
    query = {}
    if user.get("role") == "executive":
        query["target_user_id"] = user.get("id", "")
    # Admins and managers see all
    notifications = await db.notifications.find(query).sort("due_date", -1).to_list(200)
    return [serialize_doc(n) for n in notifications]

@api_router.put("/notifications/{notif_id}/done")
async def mark_notification_done(notif_id: str, user=Depends(get_current_user)):
    notif = await db.notifications.find_one({"id": notif_id})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    # Executives can only mark their own notifications
    if user.get('role') == 'executive' and notif.get('target_user_id') != user.get('id'):
        raise HTTPException(status_code=403, detail="Cannot modify this notification")
    await db.notifications.update_one(
        {"id": notif_id},
        {"$set": {"status": "done", "completed_by": user.get("full_name", ""), "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "done"}

@api_router.put("/notifications/{notif_id}/pending")
async def mark_notification_pending(notif_id: str, user=Depends(get_current_user)):
    notif = await db.notifications.find_one({"id": notif_id})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    # Executives can only mark their own notifications
    if user.get('role') == 'executive' and notif.get('target_user_id') != user.get('id'):
        raise HTTPException(status_code=403, detail="Cannot modify this notification")
    await db.notifications.update_one({"id": notif_id}, {"$set": {"status": "pending"}})
    return {"status": "pending"}

# ============ PHOTO UPLOAD ============
@api_router.post("/upload/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"filename": filename, "url": f"/api/uploads/{filename}"}

@api_router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

@api_router.delete("/bills/{bill_id}/items/{item_index}/photos/{photo_index}")
async def remove_item_photo(bill_id: str, item_index: int, photo_index: int, user=Depends(get_current_user)):
    """Remove a photo from a bill item."""
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    await check_bill_access(bill, user)
    items = bill.get('items', [])
    if item_index >= len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    photos = items[item_index].get('photos', [])
    if photo_index >= len(photos):
        raise HTTPException(status_code=404, detail="Photo not found")
    photo_url = photos[photo_index]
    filename = photo_url.split('/')[-1]
    filepath = UPLOAD_DIR / filename
    if filepath.exists():
        filepath.unlink()
    photos.pop(photo_index)
    items[item_index]['photos'] = photos
    await db.bills.update_one({"id": bill_id}, {"$set": {"items": items}})
    updated = await db.bills.find_one({"id": bill_id})
    return serialize_doc(updated)

# ============ MRP CALCULATION ============
@api_router.post("/calculate/mrp-item")
async def calculate_mrp_item(item: dict, user=Depends(get_current_user)):
    """Calculate MRP item: net weight, discount, GST breakdown."""
    gross_weight = float(item.get("gross_weight", 0))
    studded_weights = item.get("studded_weights", [])
    # Studded weights are entered in carats; 1 carat = 0.2 grams
    total_studded_carats = sum(float(sw.get("weight", 0)) for sw in studded_weights)
    total_studded_grams = round(total_studded_carats * 0.2, 3)
    net_weight = max(0, gross_weight - total_studded_grams)
    mrp = float(item.get("mrp", 0))

    # Discounts
    discounts = item.get("discounts", [])
    total_discount = 0
    for d in discounts:
        if d.get("type") == "percentage":
            total_discount += mrp * float(d.get("value", 0)) / 100
        else:
            total_discount += float(d.get("value", 0))

    after_discount = max(0, mrp - total_discount)
    amount_without_gst = round(after_discount / 1.03, 2)
    gst_amount = round(after_discount - amount_without_gst, 2)

    return {
        **item,
        "item_type": "mrp",
        "net_weight": round(net_weight, 3),
        "total_studded_carats": round(total_studded_carats, 2),
        "total_studded_weight": total_studded_grams,
        "mrp": mrp,
        "total_discount": round(total_discount, 2),
        "after_discount": round(after_discount, 2),
        "amount_without_gst": amount_without_gst,
        "gst_amount": gst_amount,
        "total_amount": amount_without_gst,  # Show without GST in items; GST added at end
    }

# ============ SESSION MANAGEMENT ============
@api_router.get("/admin/sessions")
async def get_active_sessions(request: Request, user=Depends(get_current_user), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Admin: list all active sessions, grouped by user."""
    await require_role(user, ["admin"])
    # Ensure the current admin has a session record (backfill for old logins)
    current_token = credentials.credentials
    existing = await db.sessions.find_one({"token": current_token, "is_active": True})
    if not existing:
        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        user_agent = request.headers.get("user-agent", "unknown")
        await db.sessions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "full_name": user.get("full_name", ""),
            "role": user.get("role", ""),
            "token": current_token,
            "is_active": True,
            "ip_address": ip_address.split(",")[0].strip() if ip_address else "unknown",
            "user_agent": user_agent,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    sessions = await db.sessions.find({"is_active": True}).sort("created_at", -1).to_list(500)
    serialized = [serialize_doc(s) for s in sessions]
    # Group sessions by user_id
    grouped = {}
    for s in serialized:
        uid = s.get("user_id", "unknown")
        if uid not in grouped:
            grouped[uid] = {
                "user_id": uid,
                "username": s.get("username", ""),
                "full_name": s.get("full_name", ""),
                "role": s.get("role", ""),
                "session_count": 0,
                "sessions": [],
            }
        grouped[uid]["session_count"] += 1
        grouped[uid]["sessions"].append(s)
    return list(grouped.values())

@api_router.delete("/admin/sessions/end-all")
async def end_all_sessions_except_current(user=Depends(get_current_user), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Admin: terminate all sessions except the current one."""
    await require_role(user, ["admin"])
    current_token = credentials.credentials
    result = await db.sessions.update_many(
        {"is_active": True, "token": {"$ne": current_token}},
        {"$set": {"is_active": False}}
    )
    return {"terminated": result.modified_count}

@api_router.delete("/admin/sessions/{session_id}")
async def terminate_session(session_id: str, user=Depends(get_current_user)):
    """Admin: terminate a session."""
    await require_role(user, ["admin"])
    await db.sessions.update_one({"id": session_id}, {"$set": {"is_active": False}})
    return {"status": "terminated"}

# ============ MMI TOGGLE ============
@api_router.put("/bills/{bill_id}/mmi")
async def toggle_mmi(bill_id: str, user=Depends(get_current_user)):
    """Toggle MMI entered status for a bill."""
    await require_role(user, ["admin"])
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    current = bill.get("mmi_entered", False)
    await db.bills.update_one({"id": bill_id}, {"$set": {"mmi_entered": not current}})
    return {"mmi_entered": not current}

# ============ ITEM NAME EDIT ============
@api_router.put("/item-names/{item_id}")
async def update_item_name(item_id: str, updates: dict, user=Depends(get_current_user)):
    """Admin: rename an item name."""
    await require_role(user, ["admin"])
    new_name = updates.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name is required")
    existing = await db.item_names.find_one({"name": new_name})
    if existing and existing.get("id") != item_id:
        raise HTTPException(status_code=400, detail="Item name already exists")
    await db.item_names.update_one({"id": item_id}, {"$set": {"name": new_name}})
    return {"status": "updated", "name": new_name}


# ============ ROOT ============
@api_router.get("/")
async def root():
    return {"message": "AJPL Calculator API"}

# Include router
app.include_router(api_router)

# ============ DATA SAFETY BACKUP ============
from backup_engine import (
    build_package, build_excel_only, encrypt_bytes, decrypt_bytes,
    validate_package, import_preview, import_apply, get_decode_instructions,
    now_ist, ist_label, year_start_ist, backup_filename, excel_filename,
    BUSINESS_COLLECTIONS,
)

class BackupExportRequest(BaseModel):
    password: str

class BackupImportRequest(BaseModel):
    mode: str = "merge"  # merge | replace_current_year_data

backup_router = APIRouter(prefix="/api/admin/backup")

@backup_router.get("/status")
async def backup_status(user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    latest = await db.backup_audit_logs.find_one(
        {"action": "export", "status": "success"},
        sort=[("generated_at_ist", -1)],
    )
    ts = now_ist()
    # Show the last export's actual period if available, otherwise current window
    if latest:
        p_start = latest.get("period_start_ist", year_start_ist(ts.year).isoformat())
        p_end = latest.get("period_end_ist", ts.isoformat())
    else:
        p_start = year_start_ist(ts.year).isoformat()
        p_end = ts.isoformat()
    return {
        "last_export": serialize_doc(latest) if latest else None,
        "period_start_ist": p_start,
        "period_end_ist": p_end,
        "current_year": ts.year,
    }

@backup_router.post("/export")
async def export_backup(req: BackupExportRequest, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    ts = now_ist()
    fname = backup_filename(ts.year, ts)
    try:
        manifest, zip_bytes = await build_package(db, user["id"], user.get("username", ""))
        dat_bytes = encrypt_bytes(zip_bytes, req.password)
        # audit log
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "export",
            "status": "success",
            "filename": fname,
            "generated_at_ist": ist_label(ts),
            "period_start_ist": year_start_ist(ts.year).isoformat(),
            "period_end_ist": ts.isoformat(),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "collection_counts": manifest.get("collection_counts", {}),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return Response(
            content=dat_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )
    except Exception as e:
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "export",
            "status": "failed",
            "error_message": str(e),
            "generated_at_ist": ist_label(ts),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")

@backup_router.post("/export-excel")
async def export_excel(user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    ts = now_ist()
    fname = excel_filename(ts.year, ts)
    try:
        xl_bytes = await build_excel_only(db)
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "export",
            "status": "success",
            "filename": fname,
            "generated_at_ist": ist_label(ts),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return Response(
            content=xl_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel export failed: {e}")

@backup_router.post("/import/preview")
async def backup_import_preview(
    file: UploadFile = File(...),
    password: str = Form(...),
    mode: str = Form("merge"),
    user=Depends(get_current_user),
):
    await require_role(user, ["admin"])
    ts = now_ist()
    try:
        raw = await file.read()
        zip_bytes = decrypt_bytes(raw, password)
        preview = await import_preview(db, zip_bytes, mode)
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "import_preview",
            "status": "success",
            "mode": mode,
            "filename": file.filename or "unknown",
            "generated_at_ist": ist_label(ts),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return preview
    except ValueError as e:
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "import_preview",
            "status": "failed",
            "error_message": str(e),
            "filename": file.filename or "unknown",
            "generated_at_ist": ist_label(ts),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=400, detail=str(e))

@backup_router.post("/import/apply")
async def backup_import_apply(
    file: UploadFile = File(...),
    password: str = Form(...),
    mode: str = Form("merge"),
    user=Depends(get_current_user),
):
    await require_role(user, ["admin"])
    ts = now_ist()
    try:
        raw = await file.read()
        zip_bytes = decrypt_bytes(raw, password)
        result = await import_apply(db, zip_bytes, mode)
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "import_apply",
            "status": "success",
            "mode": mode,
            "filename": file.filename or "unknown",
            "generated_at_ist": ist_label(ts),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return result
    except ValueError as e:
        await db.backup_audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "import_apply",
            "status": "failed",
            "error_message": str(e),
            "filename": file.filename or "unknown",
            "generated_at_ist": ist_label(ts),
            "user_id": user["id"],
            "username": user.get("username", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=400, detail=str(e))

@backup_router.get("/decode-instructions")
async def download_decode_instructions(user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    txt = get_decode_instructions()
    return Response(
        content=txt.encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": 'attachment; filename="DECODE_INSTRUCTIONS.txt"'},
    )

app.include_router(backup_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
