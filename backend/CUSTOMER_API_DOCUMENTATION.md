# Customer API Documentation

This documentation describes the APIs for the sale customer mobile/web application. These endpoints allow sale customers to log in, view their profile, and access their ledger information.

## Base URL
```
http://localhost:5000/api/customer
```

## Authentication

### 1. Customer Login
Authenticate a sale customer using their Account ID and Password.

**Endpoint:** `POST /login`

**Request Body:**
```json
{
  "accountId": "ACC001",
  "password": "password123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "507f1f77bcf86cd799439011",
    "accountId": "ACC001",
    "name": "John Electronics",
    "email": "john@example.com",
    "mobileNumber": "9876543210",
    "address": "123 Main Street",
    "state": "Maharashtra",
    "creditLimit": 50000,
    "accountType": "Sale"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Invalid Account ID or password"
}
```

**Response (Not Authorized - 403):**
```json
{
  "success": false,
  "message": "This account is not authorized for customer access"
}
```

---

## Protected Endpoints

All endpoints below require the JWT token obtained from login. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

---

### 2. Get Customer Profile
Retrieve the authenticated customer's profile information.

**Endpoint:** `GET /profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "customer": {
    "id": "507f1f77bcf86cd799439011",
    "accountId": "ACC001",
    "name": "John Electronics",
    "alias": "John",
    "email": "john@example.com",
    "mobileNumber": "9876543210",
    "address": "123 Main Street",
    "state": "Maharashtra",
    "creditLimit": 50000,
    "enableLoyality": "Y",
    "accountType": "Sale"
  }
}
```

---

### 3. Update Customer Password
Update the customer's login password.

**Endpoint:** `PUT /change-password`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "oldPassword": "password123",
  "newPassword": "newpassword123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

## Ledger APIs

### 4. Get Customer Ledger
Retrieve the customer's complete ledger showing all transactions (sales, sale challans, and sale orders).

**Endpoint:** 
- `GET /ledger` (with optional query parameters)
- `POST /ledger` (with date filters in request body)

**Headers:**
```
Authorization: Bearer <token>
```

**Optional Parameters:**
```json
{
  "fromDate": "2024-01-01",
  "toDate": "2024-12-31"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "customer": {
    "accountId": "ACC001",
    "name": "John Electronics",
    "email": "john@example.com",
    "mobileNumber": "9876543210"
  },
  "summary": {
    "openingBalance": 5000,
    "totalAmount": 50000,
    "totalPaid": 30000,
    "closingBalance": 25000,
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
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
      "runningBalance": 10000
    },
    {
      "date": "2024-02-10T00:00:00.000Z",
      "reference": "CHN-001",
      "type": "Sale Challan",
      "amount": 15000,
      "paid": 0,
      "balance": 15000,
      "billSeries": "CHALLAN",
      "runningBalance": 25000
    },
    {
      "date": "2024-03-05T00:00:00.000Z",
      "reference": "ORD-001",
      "type": "Sale Order",
      "amount": 25000,
      "paid": 25000,
      "balance": 0,
      "billSeries": "ORDER",
      "runningBalance": 25000
    }
  ]
}
```

**Ledger Entry Types:**
- `Sale`: Regular sales invoices
- `Sale Challan`: Delivery challans (not yet invoiced)
- `Sale Order`: Sales orders

---

### 5. Get Customer Balance
Get the customer's current outstanding balance and available credit.

**Endpoint:** `GET /balance`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "customer": {
    "accountId": "ACC001",
    "name": "John Electronics"
  },
  "balance": {
    "outstanding": 15000,
    "creditLimit": 50000,
    "availableCredit": 35000
  }
}
```

**Field Explanations:**
- `outstanding`: Total amount customer owes
- `creditLimit`: Maximum credit limit assigned
- `availableCredit`: Credit limit - outstanding balance

---

## Error Responses

### Unauthorized (401)
```json
{
  "success": false,
  "message": "No token provided, authorization required"
}
```

### Token Expired (401)
```json
{
  "success": false,
  "message": "Token has expired"
}
```

### Invalid Token (401)
```json
{
  "success": false,
  "message": "Invalid token"
}
```

### Customer Not Found (404)
```json
{
  "success": false,
  "message": "Account not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Something went wrong"
}
```

---

## Usage Examples

### 1. Login
```bash
curl -X POST http://localhost:5000/api/customer/login \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "ACC001",
    "password": "password123"
  }'
```

### 2. Get Profile (with token)
```bash
curl -X GET http://localhost:5000/api/customer/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Get Ledger with Date Filter
```bash
curl -X POST http://localhost:5000/api/customer/ledger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
  }'
```

### 4. Get Current Balance
```bash
curl -X GET http://localhost:5000/api/customer/balance \
  -H "Authorization: Bearer <token>"
```

---

## Token Details

The JWT token returned by the login endpoint:
- **Expires in:** 30 days
- **Contains:** Customer ID, Account ID, Name, Account Type
- **Used for:** All authenticated requests
- **Storage:** Store in localStorage or sessionStorage on client side

Example decoded token:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "accountId": "ACC001",
  "name": "John Electronics",
  "accountType": "Sale",
  "type": "customer",
  "iat": 1705392000,
  "exp": 1738080000
}
```

---

## Important Notes

1. **Sale Customers Only:** Login only works for accounts with `AccountType` of "Sale" or "Both"
2. **Password Plain Text:** Currently passwords are stored as plain text. For production, implement bcrypt hashing
3. **Ledger Filtering:** The ledger automatically filters to show only transactions for the logged-in customer
4. **Date Formats:** Use ISO format `YYYY-MM-DD` for date parameters
5. **Token Expiration:** Token expires after 30 days. Users will need to log in again
6. **CORS:** Ensure CORS is enabled for your mobile/web app domain

---

## Security Recommendations

1. Always use HTTPS in production
2. Implement rate limiting on login endpoint
3. Add password hashing (bcrypt) for stored passwords
4. Implement refresh token mechanism for long-lived sessions
5. Add IP whitelisting if needed
6. Implement request logging and monitoring
7. Add JWT token blacklist for logout functionality

---

## Contact & Support

For issues or questions about the Customer API, please contact the development team.
