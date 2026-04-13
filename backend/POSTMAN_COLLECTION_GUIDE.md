# Postman Collection Usage Guide

This guide explains how to use the Postman collections for testing the Lens Management System APIs.

## Collections Available

### 1. **customer_and_admin_apis.postman_collection.json**
Complete collection with Customer APIs and Admin APIs including error test cases.

## Setup Instructions

### Step 1: Import Collection into Postman

1. Open Postman
2. Click **Collections** on the left sidebar
3. Click **Import**
4. Select **Upload Files** and choose the collection JSON file
5. Click **Import**

### Step 2: Set Environment Variables

The collection uses these variables:
- `{{baseUrl}}` - Default: `http://localhost:5005`
- `{{adminToken}}` - Admin authentication token
- `{{customerToken}}` - Customer authentication token

You can modify these in Postman:
- Click the environment icon (top right)
- Select your environment or create a new one
- Add/modify the variables as needed

## API Endpoints Guide

### 1. Customer Authentication

#### Login (Get Token)
```
POST {{baseUrl}}/api/customer/login
```

**Request Body:**
```json
{
    "accountId": "1",
    "password": "ammar123"
}
```

**Success Response (200):**
```json
{
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "customer": {
        "id": "696f2a70287a98c39d1caf9c",
        "accountId": "1",
        "name": "AMMAR",
        "email": "ammar@gmail.com",
        "mobileNumber": "5432678590",
        "address": "kurla",
        "state": "MAHARASHTRA",
        "creditLimit": 0,
        "accountType": "Sale"
    }
}
```

**Error Scenarios:**
- **Invalid AccountId** (404): Returns "Invalid Account ID or password"
- **Invalid Password** (400): Returns "Invalid Account ID or password"
- **Missing Fields** (400): Returns "Account ID and password are required"
- **Non-Sale Account** (403): Returns "This account is not authorized for customer access"

---

### 2. Customer Profile

#### Get Profile
```
GET {{baseUrl}}/api/customer/profile
Headers: Authorization: Bearer {{customerToken}}
```

**Success Response (200):**
```json
{
    "success": true,
    "customer": {
        "id": "696f2a70287a98c39d1caf9c",
        "accountId": "1",
        "name": "AMMAR",
        "alias": "",
        "email": "ammar@gmail.com",
        "mobileNumber": "5432678590",
        "address": "kurla",
        "state": "MAHARASHTRA",
        "creditLimit": 0,
        "enableLoyality": "Y",
        "accountType": "Sale"
    }
}
```

**Error Scenarios:**
- **No Token** (401): Returns "No token provided, authorization required"
- **Invalid Token** (401): Returns "Invalid token"
- **Expired Token** (401): Returns "Token has expired"

---

#### Update Password
```
PUT {{baseUrl}}/api/customer/change-password
Headers: Authorization: Bearer {{customerToken}}
```

**Request Body:**
```json
{
    "oldPassword": "ammar123",
    "newPassword": "newpassword123"
}
```

**Success Response (200):**
```json
{
    "success": true,
    "message": "Password updated successfully"
}
```

**Error Scenarios:**
- **Wrong Old Password** (400): Returns "Current password is incorrect"
- **Missing Fields** (400): Returns "Old password and new password are required"
- **Short Password** (400): Returns "New password must be at least 4 characters"
- **No Token** (401): Returns "No token provided, authorization required"

---

### 3. Customer Ledger

#### Get Ledger (All Transactions)
```
GET {{baseUrl}}/api/customer/ledger
Headers: Authorization: Bearer {{customerToken}}
```

**Success Response (200):**
```json
{
    "success": true,
    "customer": {
        "accountId": "1",
        "name": "AMMAR",
        "email": "ammar@gmail.com",
        "mobileNumber": "5432678590"
    },
    "summary": {
        "openingBalance": 0,
        "totalAmount": 10000,
        "totalPaid": 5000,
        "closingBalance": 5000,
        "fromDate": null,
        "toDate": null
    },
    "entries": [
        {
            "date": "2024-01-15T00:00:00.000Z",
            "reference": "INV-001",
            "type": "Sale",
            "amount": 10000,
            "paid": 5000,
            "balance": 5000,
            "billSeries": "SALE",
            "runningBalance": 5000
        }
    ]
}
```

#### Get Ledger (With Date Filter)
```
POST {{baseUrl}}/api/customer/ledger
Headers: Authorization: Bearer {{customerToken}}
```

**Request Body:**
```json
{
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
}
```

**Entry Types in Ledger:**
- `Sale` - Regular sales invoices
- `Sale Challan` - Delivery challans not yet invoiced
- `Sale Order` - Sales orders

**Error Scenarios:**
- **No Token** (401): Returns "No token provided, authorization required"
- **Invalid Token** (401): Returns "Invalid token"

---

### 4. Customer Balance

#### Get Current Balance
```
GET {{baseUrl}}/api/customer/balance
Headers: Authorization: Bearer {{customerToken}}
```

**Success Response (200):**
```json
{
    "success": true,
    "customer": {
        "accountId": "1",
        "name": "AMMAR"
    },
    "balance": {
        "outstanding": 15000,
        "creditLimit": 50000,
        "availableCredit": 35000
    }
}
```

**Field Explanations:**
- `outstanding` - Total amount customer owes
- `creditLimit` - Maximum credit limit assigned
- `availableCredit` - Available credit (limit - outstanding)

**Error Scenarios:**
- **No Token** (401): Returns "No token provided, authorization required"
- **Invalid Token** (401): Returns "Invalid token"

---

## Testing Workflow

### Complete Test Flow

1. **Login to get token**
   - Run: `Customer Authentication > Customer Login`
   - This automatically saves the token to `{{customerToken}}`

2. **Get Profile**
   - Run: `Customer Profile > Get Customer Profile`
   - Verify customer details

3. **View Ledger**
   - Run: `Customer Ledger > Get Customer Ledger (All)`
   - Or use date filter: `Customer Ledger > Get Customer Ledger (With Date Filter)`

4. **Check Balance**
   - Run: `Customer Balance > Get Customer Balance`

5. **Update Password (Optional)**
   - Run: `Customer Profile > Update Customer Password`
   - Enter old and new passwords

### Error Testing

Test error scenarios to verify proper error handling:

1. **Authentication Errors**
   - `Customer Authentication > Customer Login - Invalid AccountId`
   - `Customer Authentication > Customer Login - Invalid Password`
   - `Customer Authentication > Customer Login - Missing Fields`

2. **Authorization Errors**
   - `Customer Profile > Get Profile - No Token`
   - `Customer Profile > Get Profile - Invalid Token`
   - `Customer Ledger > Get Ledger - No Token`
   - `Customer Balance > Get Balance - No Token`

3. **Validation Errors**
   - `Customer Profile > Update Password - Wrong Old Password`
   - `Customer Profile > Update Password - No Token`

---

## Tips & Tricks

### 1. Automatic Token Management
The collection automatically captures and stores the token from login responses. After logging in, all subsequent requests will use the saved token.

### 2. Modify Requests
- Click on any request to edit it
- Change parameters in the "Body" tab
- Modify headers in the "Headers" tab

### 3. View Response Details
- After sending a request, check the "Response" section
- View Status Code, Headers, Body, and Cookies

### 4. Pre-request Scripts
Some requests have pre-request scripts to set up test data. View these in the "Pre-request Script" tab.

### 5. Tests Tab
Some requests have test scripts that automatically validate responses and set variables. View these in the "Tests" tab.

---

## Common Issues & Solutions

### Issue: 404 Not Found
**Solution:** Verify the API endpoint URL and that the backend server is running on `http://localhost:5005`

### Issue: 401 Unauthorized
**Solution:** 
- Make sure you've logged in first
- Copy the token from the login response
- Verify the token is set in the Authorization header

### Issue: Invalid token type for customer access
**Solution:** You're using an admin token instead of a customer token. Log in with customer credentials.

### Issue: Account not found
**Solution:** Make sure the AccountId exists in the database. The default test AccountId is "1"

---

## Environment Setup

To create a custom environment:

1. Click the environment icon (gear icon, top right)
2. Click **Manage Environments**
3. Click **Create New**
4. Add variables:
   - `baseUrl`: Your API base URL
   - `adminToken`: (leave empty, will be filled after login)
   - `customerToken`: (leave empty, will be filled after login)

---

## Sample Data

### Test Customer Account
- **AccountId:** 1
- **Password:** ammar123
- **Name:** AMMAR
- **AccountType:** Sale

Make sure this account exists in your database with `AccountType` set to "Sale" or "Both".

---

## Exporting Results

1. Click the **...** menu on the collection
2. Select **Export**
3. Choose your format and save location

---

For more information about the APIs, see `CUSTOMER_API_DOCUMENTATION.md` in the backend folder.
