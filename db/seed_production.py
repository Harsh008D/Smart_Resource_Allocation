"""
Production seed: creates NGOs and demo accounts.
Run once after migrations: DATABASE_URL=<url> python3 db/seed_production.py
"""
import os, sys, json, subprocess
import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.environ["DATABASE_URL"]
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:4000")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# NGOs are seeded by migration 007 already.
# Just create demo user accounts via the API.

import urllib.request, urllib.error

def post(path, data):
    req = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

accounts = [
    {"email": "ngo1_admin@example.com", "password": "demo123", "role": "ngo_admin", "ngo_id": "NGO1"},
    {"email": "ngo2_admin@example.com", "password": "demo123", "role": "ngo_admin", "ngo_id": "NGO2"},
    {"email": "user@example.com",       "password": "demo123", "role": "public_user"},
]

for acc in accounts:
    r = post("/api/auth/signup", acc)
    print(f"  {acc['email']}: {r.get('user_id', r.get('error'))}")

# Create volunteers via NGO admin tokens
def login(email, password):
    r = post("/api/auth/login", {"email": email, "password": password})
    return r.get("token")

ngo1_token = login("ngo1_admin@example.com", "demo123")
ngo2_token = login("ngo2_admin@example.com", "demo123")

ngo1_vols = [
    {"name":"Rahul Sharma","email":"vol1@ngo1.com","password":"demo123","skills":["food"],"latitude":18.94,"longitude":72.83},
    {"name":"Priya Patel","email":"vol2@ngo1.com","password":"demo123","skills":["medical"],"latitude":18.92,"longitude":72.85},
    {"name":"Amit Kumar","email":"vol3@ngo1.com","password":"demo123","skills":["food"],"latitude":18.95,"longitude":72.82},
    {"name":"Sneha Joshi","email":"vol4@ngo1.com","password":"demo123","skills":["medical"],"latitude":18.91,"longitude":72.86},
]
ngo2_vols = [
    {"name":"Vikram Singh","email":"vol1@ngo2.com","password":"demo123","skills":["shelter"],"latitude":28.62,"longitude":77.21},
    {"name":"Anita Gupta","email":"vol2@ngo2.com","password":"demo123","skills":["education"],"latitude":28.61,"longitude":77.20},
    {"name":"Rajesh Verma","email":"vol3@ngo2.com","password":"demo123","skills":["shelter"],"latitude":28.63,"longitude":77.22},
    {"name":"Kavita Rao","email":"vol4@ngo2.com","password":"demo123","skills":["education"],"latitude":28.60,"longitude":77.19},
]

def create_vol(token, data):
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/auth/ngo/create-volunteer",
        data=json.dumps(data).encode(),
        headers={"Content-Type":"application/json","Authorization":f"Bearer {token}"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e: return json.loads(e.read())

for v in ngo1_vols:
    r = create_vol(ngo1_token, v)
    print(f"  NGO1 {v['name']}: {r.get('volunteer_id', r.get('error'))}")

for v in ngo2_vols:
    r = create_vol(ngo2_token, v)
    print(f"  NGO2 {v['name']}: {r.get('volunteer_id', r.get('error'))}")

conn.close()
print("\nProduction seed complete!")
