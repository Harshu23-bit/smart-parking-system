````md
# Smart Parking System

A full-stack **Smart Parking System** designed for **parking owners** and **drivers**.

The project currently includes a working **OWNER module** and a shared backend foundation for:

- Authentication
- Parking management
- Booking management
- Payments
- Refunds
- Availability tracking
- Owner earnings

The **USER frontend** and **ADMIN module** are the next development stages.

---

## 📌 Current Project Status

### ✅ Completed

- PostgreSQL database integration
- Docker-based local database setup
- JWT authentication
- Owner registration and login
- Email and phone verification support
- Forgot password / password reset
- Owner profile and settings
- Parking space creation and editing
- Parking availability management
- Parking pricing management
- Parking operating-hours management
- Parking image upload and management
- Vehicle support and automatic bay allocation
- Driver booking backend
- Booking lifecycle management
- Razorpay Test Mode payment integration
- Payment verification
- Payment webhook handling
- Webhook idempotency
- User booking cancellation
- Razorpay refund support
- Refund webhook handling
- 15-minute stale booking expiry
- Owner earnings and payment history
- Shared backend foundation for USER and ADMIN modules

---

# 🧩 Modules

## 👨‍💼 OWNER Module

The **OWNER module** is currently the most complete part of the project.

### Features

- Registration and authentication
- Email / phone verification support
- Forgot password and password reset
- Owner dashboard
- Owner profile management
- Parking location registration
- Parking space editing
- Parking availability controls
- Parking pricing controls
- Weekly operating hours
- Parking image upload
- Primary parking image selection
- Parking image deletion
- Booking management
- Booking status management
- Earnings summary
- Payment transaction history

# 💳 Payment Flow

The project currently uses **Razorpay Test Mode**.

## Booking & Payment Flow

```text
User creates booking
        ↓
Booking status: pending
        ↓
Razorpay payment order created
        ↓
User completes payment
        ↓
Payment verified
        ↓
Booking status: confirmed
Payment status: paid
````

## Paid Booking Cancellation Flow

```text
User cancels booking
        ↓
Razorpay refund requested
        ↓
Booking status: cancelled
        ↓
Refund webhook finalizes refund status
```

## Payment Timeout

Unpaid bookings that remain pending for more than **15 minutes** are automatically expired when the relevant booking or availability flow is accessed.

```text
pending + unpaid
        ↓
15 minutes elapsed
        ↓
expired
        ↓
reserved bay becomes available again
```

---

# 🛠️ Tech Stack

## Frontend

| Technology         | Usage                                |
| ------------------ | ------------------------------------ |
| HTML5              | Page structure                       |
| CSS3               | Styling and responsive layout        |
| Vanilla JavaScript | Frontend logic and API communication |

## Backend

| Technology      | Usage                    |
| --------------- | ------------------------ |
| Node.js         | Backend runtime          |
| Express.js      | REST API framework       |
| PostgreSQL      | Main database            |
| `pg`            | PostgreSQL client        |
| bcrypt          | Password hashing         |
| JSON Web Tokens | Authentication           |
| Nodemailer      | Email delivery           |
| Twilio          | SMS / voice verification |
| Multer          | Parking image uploads    |
| Razorpay        | Payments and refunds     |

## Infrastructure

| Technology     | Usage                           |
| -------------- | ------------------------------- |
| Docker         | Local infrastructure            |
| Docker Compose | PostgreSQL container management |
| PostgreSQL 16  | Database engine                 |

---

# 📁 Project Structure

```text
project/
├── client/
│   ├── assets/
│   │   └── images/
│   │
│   ├── css/
│   │   ├── owner.css
│   │   └── styles.css
│   │
│   ├── js/
│   │   ├── api.js
│   │   ├── owner.js
│   │   └── script.js
│   │
│   └── pages/
│       ├── index.html
│       ├── owner.html
│       └── owner-dashboard.html
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── uploads/
│   │   └── parking/
│   │
│   ├── app.js
│   └── server.js
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

---

Current migrations cover:

* Authentication and OTP verification
* Owner parking fields
* Two-wheeler bay support
* Vehicles and bookings
* Operating hours
* Payments
* Payment webhook events
* Payment refunds

---

---

# 📌 Development Notes

* Razorpay currently runs in **Test Mode**
* The project is currently configured for **local development**
* Cloud deployment has not yet been configured
* Google Maps billing/API integration is not required for the current OWNER/backend milestone
* USER and ADMIN development should build on the existing shared backend APIs

---