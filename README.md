# Smart Parking System

A full-stack Smart Parking System for drivers and parking owners.

The application is being developed using Node.js, Express, PostgreSQL,
Docker, Google Maps, and vanilla HTML/CSS/JavaScript.

## Features

### Driver
- Search for parking locations
- View parking spaces on Google Maps
- Check parking availability
- Book parking spaces

### Parking Owner
- Owner registration and authentication
- Register parking locations
- Manage parking availability
- View and manage bookings
- Owner dashboard

## Planned Features

- Email OTP verification
- PostgreSQL-backed authentication
- JWT authentication
- Payment integration
- Owner payouts
- Cloud deployment
- IoT parking barrier integration
- PIN/QR-based parking access

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript
- Google Maps JavaScript API
- Google Places API

### Backend
- Node.js
- Express.js
- PostgreSQL
- bcrypt
- JSON Web Tokens

### Infrastructure
- Docker
- Docker Compose

## Project Structure

```text
project/
├── client/
│   ├── pages/
│   ├── css/
│   ├── js/
│   └── assets/
├── server/
├── database/
├── docs/
├── docker-compose.yml
├── package.json
├── .env.example
└── README.md