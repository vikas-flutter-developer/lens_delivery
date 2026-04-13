# API Quick Reference

## Base URL
```
http://localhost:5005
```

## Customer APIs

### Authentication
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/api/customer/login` | ❌ No | Customer login with AccountId & Password |
| GET | `/api/customer/profile` | ✅ Yes | Get customer profile details |
| PUT | `/api/customer/change-password` | ✅ Yes | Update customer password |

### Ledger
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/customer/ledger` | ✅ Yes | Get all customer transactions |
| POST | `/api/customer/ledger` | ✅ Yes | Get transactions with date filter |
| GET | `/api/customer/balance` | ✅ Yes | Get current outstanding balance |

---

## Request/Response Examples

### 1. Customer Login
```http
POST /api/customer/login HTTP/1.1
Content-Type: application/json

{
    "accountId": "1",
    "password": "ammar123"
}
```

**Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "customer": {
        "id": "696f2a70287a98c39d1caf9c",
        "accountId": "1",
        "name": "AMMAR"
    }
}
```

### 2. Get Profile
```http
GET /api/customer/profile HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
    "success": true,
    "customer": {
        "id": "696f2a70287a98c39d1caf9c",
        "name": "AMMAR",
        "email": "ammar@gmail.com",
        "accountType": "Sale"
    }
}
```

### 3. Get Ledger with Filters
```http
POST /api/customer/ledger HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
}
```

**Response:**
```json
{
    "success": true,
    "summary": {
        "openingBalance": 0,
        "totalAmount": 10000,
        "totalPaid": 5000,
        "closingBalance": 5000
    },
    "entries": [
        {
            "date": "2024-01-15T00:00:00.000Z",
            "type": "Sale",
            "amount": 10000,
            "paid": 5000,
            "runningBalance": 5000
        }
    ]
}
```

### 4. Get Balance
```http
GET /api/customer/balance HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
    "success": true,
    "balance": {
        "outstanding": 15000,
        "creditLimit": 50000,
        "availableCredit": 35000
    }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
    "success": false,
    "message": "Account ID and password are required"
}
```

### 401 Unauthorized
```json
{
    "success": false,
    "message": "No token provided, authorization required"
}
```

### 403 Forbidden
```json
{
    "success": false,
    "message": "This account is not authorized for customer access"
}
```

### 404 Not Found
```json
{
    "success": false,
    "message": "Account not found"
}
```

### 500 Server Error
```json
{
    "success": false,
    "message": "Something went wrong"
}
```

---

## HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input or missing fields |
| 401 | Unauthorized | No token or invalid token |
| 403 | Forbidden | Access denied (e.g., non-sale account) |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Backend error |

---

## Token Management

### Getting a Token
1. Call `/api/customer/login` with credentials
2. Extract `token` from response
3. Store token in `Authorization: Bearer <token>` header

### Token Validity
- **Expiration:** 30 days
- **Format:** JWT
- **Storage:** localStorage or sessionStorage (frontend)

### Using Token in Requests
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NmYyYTcwMjg3YTk4YzM5ZDFjYWY5YyIsImFjY291bnRJZCI6IjEiLCJuYW1lIjoiQU1NQVIiLCJhY2NvdW50VHlwZSI6IlNhbGUiLCJ0eXBlIjoiY3VzdG9tZXIiLCJpYXQiOjE3Njk0MTc3MDksImV4cCI6MTc3MjAwOTcwOX0.nPjBTmWREBMrbILwaWBX22iGxjEagwoFUaN7h-DmNOw
```

---

## Date Format

All dates should be in ISO format: `YYYY-MM-DD`

**Examples:**
- `2024-01-01` → January 1, 2024
- `2024-12-31` → December 31, 2024

---

## Postman Collection Usage

### Import Collection
1. Open Postman
2. Collections → Import
3. Select `customer_and_admin_apis.postman_collection.json`

### Environment Variables
- `{{baseUrl}}` → `http://localhost:5005`
- `{{customerToken}}` → Auto-populated after login

### Quick Test Flow
1. Run "Customer Login"
2. Run "Get Customer Profile"
3. Run "Get Customer Ledger"
4. Run "Get Customer Balance"

---

## Common Test Scenarios

### Scenario 1: View Full Ledger
```
1. Login
2. GET /api/customer/ledger
3. Check all transactions
```

### Scenario 2: View Ledger for Specific Period
```
1. Login
2. POST /api/customer/ledger with dates
3. Check filtered transactions
```

### Scenario 3: Check Outstanding Balance
```
1. Login
2. GET /api/customer/balance
3. Verify outstanding vs credit limit
```

### Scenario 4: Update Password
```
1. Login
2. PUT /api/customer/change-password
3. Use new password for next login
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 404 Not Found | Check API URL, ensure backend is running |
| 401 Unauthorized | Login first, verify token in header |
| Invalid token type | Use customer token, not admin token |
| Account not found | Verify AccountId exists in database |
| Token expired | Log in again to get new token |

---

**Last Updated:** January 26, 2026
**Version:** 1.0
