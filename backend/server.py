from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Response, UploadFile, File, Form
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
        return serialize_doc(user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_role(user: dict, roles: list):
    if user.get('role') not in roles:
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
    items: List[Dict[str, Any]] = []
    external_charges: List[Dict[str, Any]] = []
    bill_mode: Optional[str] = "regular"  # regular or mrp

class SalespersonCreate(BaseModel):
    name: str

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
    for rate_type in ['normal', 'ajpl']:
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
    await db.customers.create_index("phone")
    await db.otps.create_index("username")
    await db.otps.create_index("expires_at")
    await db.salespeople.create_index("name", unique=True)
    await db.feedback_questions.create_index("order")
    await db.notifications.create_index("target_user_id")
    await db.notifications.create_index("due_date")
    logger.info("Database indexes created")

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
async def verify_otp(req: OTPVerify):
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
    user_data = serialize_doc(user)
    user_data.pop('password', None)
    return {"token": token, "user": user_data}

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    """Legacy password login (kept for backward compatibility)."""
    user = await db.users.find_one({"username": req.username})
    if not user or not user.get("password") or not pwd_context.verify(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_token({"sub": user["id"], "role": user["role"]})
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
    for rate_type in ['normal', 'ajpl']:
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
    for rate_type in ['normal', 'ajpl']:
        await db.rate_cards.update_one(
            {"rate_type": rate_type},
            {"$pull": {"purities": {"purity_id": purity_id}}}
        )
    return {"status": "deleted"}

# ============ RATE CARD MANAGEMENT ============
@api_router.get("/rates")
async def get_rates(user=Depends(get_current_user)):
    rates = await db.rate_cards.find({}).to_list(10)
    return [serialize_doc(r) for r in rates]

@api_router.get("/rates/{rate_type}")
async def get_rate_by_type(rate_type: str, user=Depends(get_current_user)):
    rate = await db.rate_cards.find_one({"rate_type": rate_type})
    if not rate:
        raise HTTPException(status_code=404, detail="Rate card not found")
    return serialize_doc(rate)

@api_router.put("/rates/{rate_type}")
async def update_rates(rate_type: str, req: RateCardUpdate, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.rate_cards.update_one(
        {"rate_type": rate_type},
        {"$set": {
            "purities": [dict(p) for p in req.purities],
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
    customers = await db.customers.find({"phone": {"$regex": phone}}).to_list(20)
    return [serialize_doc(c) for c in customers]

@api_router.get("/customers/{customer_id}/bills")
async def get_customer_bills(customer_id: str, user=Depends(get_current_user)):
    """Get all bills for a specific customer (by customer id or phone)."""
    # Try finding by id first, then by phone
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phone": customer_id})
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
    
    # Get all bills for this customer by phone
    bills = await db.bills.find({"customer_phone": customer["phone"]}).sort("created_at", -1).to_list(10000)
    
    return {
        "customer": c_data,
        "bills": [serialize_doc(b) for b in bills],
        "total_bills": len(bills),
        "total_spent": sum(b.get('grand_total', 0) for b in bills),
    }

@api_router.get("/customers/{customer_id}")
async def get_customer_detail(customer_id: str, user=Depends(get_current_user)):
    """Get customer details by ID or phone."""
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phone": customer_id})
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
                "reference": req.reference,
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
        "reference": req.reference,
        "first_visit": datetime.now(timezone.utc).isoformat(),
        "last_visit": datetime.now(timezone.utc).isoformat(),
        "total_visits": 1,
        "total_spent": 0,
    }
    await db.customers.insert_one(customer_doc)
    return serialize_doc(customer_doc)

# ============ BILL MANAGEMENT ============
@api_router.post("/bills")
async def create_bill(req: BillCreate, user=Depends(get_current_user)):
    # Create or get customer
    customer = await db.customers.find_one({"phone": req.customer_phone})
    if not customer:
        customer = {
            "id": str(uuid.uuid4()),
            "name": req.customer_name,
            "phone": req.customer_phone,
            "location": req.customer_location,
            "reference": req.customer_reference,
            "first_visit": datetime.now(timezone.utc).isoformat(),
            "last_visit": datetime.now(timezone.utc).isoformat(),
            "total_visits": 1,
            "total_spent": 0,
        }
        await db.customers.insert_one(customer)
    else:
        await db.customers.update_one(
            {"phone": req.customer_phone},
            {"$set": {"last_visit": datetime.now(timezone.utc).isoformat()},
             "$inc": {"total_visits": 1}}
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

    bill_doc = {
        "id": str(uuid.uuid4()),
        "bill_number": f"BILL-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4].upper()}",
        "customer_name": req.customer_name,
        "customer_phone": req.customer_phone,
        "customer_location": req.customer_location,
        "customer_reference": req.customer_reference,
        "salesperson_name": req.salesperson_name,
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
    # Update customer total spent
    if bill.get('customer_phone'):
        await db.customers.update_one(
            {"phone": bill['customer_phone']},
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
    return [serialize_doc(b) for b in bills]

@api_router.get("/bills/{bill_id}/summary")
async def get_bill_summary(bill_id: str, user=Depends(get_current_user)):
    """Get a simplified summary of a bill for manager view.
    Shows items with rates, making details, diamond rates - but NOT final amounts."""
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    bill_data = serialize_doc(bill)
    
    # Build simplified item summaries
    item_summaries = []
    for item in bill_data.get('items', []):
        summary = {
            "item_name": item.get('item_name'),
            "item_type": item.get('item_type', 'gold'),
            "purity_name": item.get('purity_name'),
            "rate_mode": item.get('rate_mode'),
            "gross_weight": item.get('gross_weight', 0),
            "less": item.get('less', 0),
            "net_weight": item.get('net_weight', 0),
            "rate_per_10g": item.get('rate_per_10g', 0),
            "making_charges": [],
            "stone_charges": [],
            "studded_charges": [],
        }
        # Making charge details (type + value only, no calculated amount)
        for mc in item.get('making_charges', []):
            summary["making_charges"].append({
                "type": mc.get('type'),
                "value": mc.get('value', 0),
                "quantity": mc.get('quantity', 1),
            })
        # Stone charge details
        for sc in item.get('stone_charges', []):
            summary["stone_charges"].append({
                "type": sc.get('type'),
                "value": sc.get('value', 0),
                "quantity": sc.get('quantity', 1),
            })
        # Diamond rates only (carats + rate per carat, no amounts)
        for sc in item.get('studded_charges', []):
            summary["studded_charges"].append({
                "type": sc.get('type'),
                "carats": sc.get('carats', 0),
                "rate_per_carat": sc.get('rate_per_carat', 0),
                "less_type": sc.get('less_type', 'NL'),
            })
        item_summaries.append(summary)
    
    return {
        "bill_id": bill_data.get('id'),
        "bill_number": bill_data.get('bill_number'),
        "customer_name": bill_data.get('customer_name'),
        "customer_phone": bill_data.get('customer_phone'),
        "executive_name": bill_data.get('executive_name'),
        "date": bill_data.get('created_at', '')[:10],
        "status": bill_data.get('status'),
        "items": item_summaries,
    }

@api_router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, user=Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return serialize_doc(bill)

@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin", "manager"])
    await db.bills.delete_one({"id": bill_id})
    return {"status": "deleted"}

# ============ CALCULATE ENDPOINT ============
@api_router.post("/calculate/item")
async def calculate_item(item: dict, user=Depends(get_current_user)):
    """Calculate a single item's totals in real-time."""
    if item.get('item_type') == 'diamond':
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
        if item.get('item_type') == 'diamond':
            calc = calculate_diamond_item(item)
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
    
    # Today's bills (always unfiltered by date range for KPIs)
    today_query = {**base_filter, "created_at": {"$gte": today}}
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
    reference_analysis = {}
    
    for bill in all_bills:
        # Reference tracking
        ref = bill.get('customer_reference', 'unknown')
        if ref:
            if ref not in reference_analysis:
                reference_analysis[ref] = {'count': 0, 'total': 0}
            reference_analysis[ref]['count'] += 1
            reference_analysis[ref]['total'] += bill.get('grand_total', 0)
        
        for item in bill.get('items', []):
            purity = item.get('purity_name', 'Unknown')
            iname = item.get('item_name', 'Unknown')
            amount = item.get('total_amount', 0)
            
            if purity not in kt_analysis:
                kt_analysis[purity] = {'count': 0, 'total': 0}
            kt_analysis[purity]['count'] += 1
            kt_analysis[purity]['total'] += amount
            
            key = f"{purity}-{iname}"
            if key not in item_analysis:
                item_analysis[key] = {'purity': purity, 'item_name': iname, 'count': 0, 'total': 0}
            item_analysis[key]['count'] += 1
            item_analysis[key]['total'] += amount
            
            if item.get('item_type') == 'diamond':
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
    
    # Customer analytics
    total_customers = await db.customers.count_documents({})
    
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
        "reference_analysis": reference_analysis,
        "daily_sales": sorted(daily_sales.values(), key=lambda x: x['date']),
        "branch_sales": list(branch_sales.values()),
        "executive_sales": sorted(executive_sales.values(), key=lambda x: x['total'], reverse=True),
        "total_customers": total_customers,
        "total_bills": len(all_bills),
        "all_time_total": round(all_time_total, 2),
    }

@api_router.get("/analytics/customers")
async def get_customer_analytics(user=Depends(get_current_user)):
    await require_role(user, ["admin", "manager"])
    customers = await db.customers.find({}).to_list(5000)
    result = []
    for c in customers:
        c_data = serialize_doc(c)
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
    customers = await db.customers.find({}).to_list(5000)
    
    # Define cohort buckets
    cohorts = {
        "1 visit": {"count": 0, "total_spent": 0},
        "2-3 visits": {"count": 0, "total_spent": 0},
        "4-5 visits": {"count": 0, "total_spent": 0},
        "6+ visits": {"count": 0, "total_spent": 0},
    }
    
    for c in customers:
        visits = c.get('total_visits', 1)
        spent = c.get('total_spent', 0)
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
        spent = c.get('total_spent', 0)
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
    c.drawCentredString(width/2, y, 'INVOICE')
    
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
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.salespeople.insert_one(doc)
    return serialize_doc(doc)

@api_router.get("/salespeople")
async def list_salespeople(user=Depends(get_current_user)):
    people = await db.salespeople.find({"is_active": True}).to_list(500)
    return [serialize_doc(p) for p in people]

@api_router.delete("/salespeople/{sp_id}")
async def delete_salesperson(sp_id: str, user=Depends(get_current_user)):
    await require_role(user, ["admin"])
    await db.salespeople.delete_one({"id": sp_id})
    return {"status": "deleted"}

# ============ ENHANCED CUSTOMER MANAGEMENT ============
@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, req: CustomerUpdate, user=Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        customer = await db.customers.find_one({"phone": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    update_data = {k: v for k, v in req.dict(exclude_none=True).items()}
    if update_data:
        await db.customers.update_one({"id": customer.get("id", customer_id)}, {"$set": update_data})
    updated = await db.customers.find_one({"id": customer.get("id", customer_id)})
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
    # Re-remind pending tasks from yesterday
    yesterday = (today_ist - timedelta(days=1)).strftime("%Y-%m-%d")
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
    await db.notifications.update_one(
        {"id": notif_id},
        {"$set": {"status": "done", "completed_by": user.get("full_name", ""), "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "done"}

@api_router.put("/notifications/{notif_id}/pending")
async def mark_notification_pending(notif_id: str, user=Depends(get_current_user)):
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

# ============ MRP CALCULATION ============
@api_router.post("/calculate/mrp-item")
async def calculate_mrp_item(item: dict, user=Depends(get_current_user)):
    """Calculate MRP item: net weight, discount, GST breakdown."""
    gross_weight = float(item.get("gross_weight", 0))
    studded_weights = item.get("studded_weights", [])
    total_studded_weight = sum(float(sw.get("weight", 0)) for sw in studded_weights)
    net_weight = max(0, gross_weight - total_studded_weight)
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
        "total_studded_weight": round(total_studded_weight, 3),
        "mrp": mrp,
        "total_discount": round(total_discount, 2),
        "after_discount": round(after_discount, 2),
        "amount_without_gst": amount_without_gst,
        "gst_amount": gst_amount,
        "total_amount": amount_without_gst,  # Show without GST in items; GST added at end
    }

# ============ ROOT ============
@api_router.get("/")
async def root():
    return {"message": "AJPL Calculator API"}

# Include router
app.include_router(api_router)

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
