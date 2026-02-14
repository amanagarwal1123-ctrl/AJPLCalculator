from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import StreamingResponse
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
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib import colors as rl_colors

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'gold_jewellery_sales')]

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET', 'gold-jewellery-secret-key-2024-kintsugi')
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

def create_token(data: dict):
    to_encode = data.copy()
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

class UserCreate(BaseModel):
    username: str
    password: str
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
    items: List[Dict[str, Any]] = []
    external_charges: List[Dict[str, Any]] = []

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
    logger.info("Database indexes created")

# ============ AUTH ROUTES ============
@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"username": req.username})
    if not user or not pwd_context.verify(req.password, user["password"]):
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
        "password": pwd_context.hash(req.password),
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
        if item.get('item_type') == 'diamond':
            calc = calculate_diamond_item(item)
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

    # Recalculate if items changed
    if 'items' in updates:
        calculated_items = []
        for item in updates['items']:
            if item.get('item_type') == 'diamond':
                calc = calculate_diamond_item(item)
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
    
    # Remove fields that shouldn't be directly updated
    for field in ['id', 'bill_number', 'created_at', 'executive_id']:
        updates.pop(field, None)
    
    await db.bills.update_one({"id": bill_id}, {"$set": updates})
    updated = await db.bills.find_one({"id": bill_id})
    return serialize_doc(updated)

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
async def get_dashboard_analytics(user=Depends(get_current_user)):
    await require_role(user, ["admin", "manager"])
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    
    # Build branch filter for managers
    branch_filter = {}
    if user.get('role') == 'manager' and user.get('branch_id'):
        branch_filter = {"branch_id": user.get('branch_id')}
    
    # Today's bills
    today_query = {**branch_filter, "created_at": {"$gte": today}}
    today_bills = await db.bills.find(today_query).to_list(5000)
    today_sales = sum(b.get('grand_total', 0) for b in today_bills)
    today_count = len(today_bills)
    today_gst = sum(b.get('gst_amount', 0) for b in today_bills)
    avg_ticket = today_sales / today_count if today_count > 0 else 0
    
    # All bills for analytics
    all_bills = await db.bills.find(branch_filter).to_list(10000)
    
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
    for bill in all_bills:
        date_str = bill.get('created_at', '')[:10]
        if date_str:
            if date_str not in daily_sales:
                daily_sales[date_str] = {'date': date_str, 'total': 0, 'count': 0}
            daily_sales[date_str]['total'] += bill.get('grand_total', 0)
            daily_sales[date_str]['count'] += 1
    
    # Customer analytics
    total_customers = await db.customers.count_documents({})
    
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
        "total_customers": total_customers,
        "total_bills": len(all_bills),
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
    
    # Gold border
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(3)
    c.rect(15*mm, 15*mm, width - 30*mm, height - 30*mm)
    c.setLineWidth(1)
    c.rect(17*mm, 17*mm, width - 34*mm, height - 34*mm)
    
    # Header
    y = height - 35*mm
    c.setFont('Helvetica-Bold', 20)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawCentredString(width/2, y, 'AJPL JEWELLERY INVOICE')
    
    y -= 8*mm
    c.setFont('Helvetica', 10)
    c.drawCentredString(width/2, y, f"Bill No: {bill_data.get('bill_number', '')}")
    
    y -= 5*mm
    c.drawCentredString(width/2, y, f"Date: {bill_data.get('created_at', '')[:10]}")
    
    # Gold line
    y -= 5*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.setLineWidth(1.5)
    c.line(25*mm, y, width - 25*mm, y)
    
    # Customer details
    y -= 8*mm
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawString(25*mm, y, 'Customer Details')
    y -= 5*mm
    c.setFont('Helvetica', 9)
    c.drawString(25*mm, y, f"Name: {bill_data.get('customer_name', '')}")
    c.drawString(110*mm, y, f"Phone: {bill_data.get('customer_phone', '')}")
    y -= 4*mm
    c.drawString(25*mm, y, f"Location: {bill_data.get('customer_location', '')}")
    c.drawString(110*mm, y, f"Reference: {bill_data.get('customer_reference', '')}")
    y -= 4*mm
    c.drawString(25*mm, y, f"Executive: {bill_data.get('executive_name', '')}")
    
    # Items table header
    y -= 8*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.line(25*mm, y, width - 25*mm, y)
    y -= 5*mm
    c.setFont('Helvetica-Bold', 8)
    headers = ['#', 'Item', 'KT', 'Wt(g)', 'Rate/10g', 'Gold Val', 'Making', 'Stone', 'Studded', 'Total']
    x_positions = [25, 32, 60, 72, 84, 100, 118, 136, 152, 170]
    for i, h in enumerate(headers):
        c.drawString(x_positions[i]*mm, y, h)
    
    y -= 3*mm
    c.line(25*mm, y, width - 25*mm, y)
    
    # Items
    c.setFont('Helvetica', 8)
    for idx, item in enumerate(bill_data.get('items', [])):
        y -= 5*mm
        if y < 40*mm:  # New page if needed
            c.showPage()
            y = height - 25*mm
        
        c.drawString(25*mm, y, str(idx + 1))
        c.drawString(32*mm, y, str(item.get('item_name', ''))[:15])
        c.drawString(60*mm, y, str(item.get('purity_name', '')))
        c.drawString(72*mm, y, f"{item.get('net_weight', 0):.2f}")
        c.drawString(84*mm, y, f"{item.get('rate_per_10g', 0):,.0f}")
        c.drawString(100*mm, y, f"{item.get('gold_value', 0):,.0f}")
        c.drawString(118*mm, y, f"{item.get('total_making', 0):,.0f}")
        c.drawString(136*mm, y, f"{item.get('total_stone', 0):,.0f}")
        c.drawString(152*mm, y, f"{item.get('total_studded', 0):,.0f}")
        c.drawString(170*mm, y, f"{item.get('total_amount', 0):,.0f}")
    
    # Totals
    y -= 5*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.line(25*mm, y, width - 25*mm, y)
    
    y -= 6*mm
    c.setFont('Helvetica-Bold', 9)
    c.drawString(120*mm, y, 'Items Total:')
    c.drawRightString(width - 25*mm, y, f"Rs. {bill_data.get('items_total', 0):,.2f}")
    
    # External charges
    for ec in bill_data.get('external_charges', []):
        y -= 5*mm
        c.setFont('Helvetica', 9)
        c.drawString(120*mm, y, f"{ec.get('name', '')}:")
        c.drawRightString(width - 25*mm, y, f"Rs. {ec.get('amount', 0):,.2f}")
    
    y -= 5*mm
    c.drawString(120*mm, y, 'External Charges Total:')
    c.drawRightString(width - 25*mm, y, f"Rs. {bill_data.get('external_charges_total', 0):,.2f}")
    
    y -= 5*mm
    c.setFont('Helvetica-Bold', 10)
    c.drawString(120*mm, y, 'Subtotal (without GST):')
    c.drawRightString(width - 25*mm, y, f"Rs. {bill_data.get('subtotal_without_gst', 0):,.2f}")
    
    y -= 5*mm
    c.setFont('Helvetica', 9)
    c.drawString(120*mm, y, f"GST ({bill_data.get('gst_percent', 3)}%):")
    c.drawRightString(width - 25*mm, y, f"Rs. {bill_data.get('gst_amount', 0):,.2f}")
    
    y -= 6*mm
    c.setStrokeColor(rl_colors.HexColor('#C5A55A'))
    c.line(120*mm, y, width - 25*mm, y)
    y -= 6*mm
    c.setFont('Helvetica-Bold', 12)
    c.setFillColor(rl_colors.HexColor('#1a1a3e'))
    c.drawString(120*mm, y, 'GRAND TOTAL:')
    c.drawRightString(width - 25*mm, y, f"Rs. {bill_data.get('grand_total', 0):,.2f}")
    
    # Footer
    y -= 15*mm
    c.setFont('Helvetica-Oblique', 8)
    c.setFillColor(rl_colors.HexColor('#666666'))
    c.drawCentredString(width/2, y, 'Thank you for your purchase!')
    
    c.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{bill_data.get("bill_number", "bill")}.pdf"'}
    )

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
