const API_BASE = "/api";

function userToken() {
    return localStorage.getItem("parksmart_user_token");
}

function requireUser() {
    if (!userToken()) {
        window.location.href = "user-login.html";
        return false;
    }

    return true;
}

function logoutUser() {
    localStorage.removeItem("parksmart_user_token");
    localStorage.removeItem("parksmart_user");
    window.location.href = "user-login.html";
}


async function apiRequest(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = userToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message || "Something went wrong."
        );
    }

    return data;
}


/* =========================
   AUTH
========================= */

async function registerUser(data) {
    return apiRequest("/auth/user/register", {
        method: "POST",
        body: JSON.stringify(data)
    });
}


async function loginUser(email, password) {
    return await apiRequest("/auth/user/login", {
        method: "POST",
        body: JSON.stringify({
            email,
            password
        })
    });
}


async function verifyLoginOtp(email, otp) {
    const data = await apiRequest("/auth/user/verify-login-otp", {
        method: "POST",
        body: JSON.stringify({
            email,
            otp
        })
    });

    localStorage.setItem(
        "parksmart_user_token",
        data.token
    );

    localStorage.setItem(
        "parksmart_user",
        JSON.stringify(data.user)
    );

    return data;
}


/* =========================
   PARKING
========================= */

async function searchParking({
    q = "",
    date = "",
    startTime = "",
    endTime = "",
    latitude = null,
    longitude = null,
    radiusKm = 5
} = {}) {

    const params = new URLSearchParams();

    if (q) {
        params.set("q", q);
    }

    // Convert separate date + time fields
    // into proper ISO date/time values for the backend.
    if (date && startTime) {
        params.set(
            "start_time",
            `${date}T${startTime}`
        );
    }

    if (date && endTime) {
        params.set(
            "end_time",
            `${date}T${endTime}`
        );
    }

    if (
        latitude !== null &&
        longitude !== null
    ) {
        params.set(
            "lat",
            latitude
        );

        params.set(
            "lng",
            longitude
        );

        params.set(
            "radius",
            radiusKm
        );
    }

    return apiRequest(
        `/parking?${params.toString()}`
    );
}

async function getParkingDetails(id) {
    return apiRequest(`/parking/${id}`);
}


/* =========================
   VEHICLES
========================= */

async function getVehicles() {
    return apiRequest("/vehicles");
}


async function addVehicle(vehicle) {
    return apiRequest("/vehicles", {
        method: "POST",
        body: JSON.stringify(vehicle)
    });
}


/* =========================
   BOOKINGS
========================= */

async function createBooking(data) {
    return apiRequest("/bookings", {
        method: "POST",
        body: JSON.stringify(data)
    });
}


async function getMyBookings() {
    return apiRequest("/bookings");
}


async function cancelBooking(id, reason = "Cancelled by user") {
    return apiRequest(`/bookings/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
            reason
        })
    });
}


/* =========================
   PAYMENTS
========================= */

async function createPaymentOrder(bookingId) {
    return apiRequest("/payments/orders", {
        method: "POST",
        body: JSON.stringify({
            booking_id: bookingId
        })
    });
}


async function verifyPayment(data) {
    return apiRequest("/payments/verify", {
        method: "POST",
        body: JSON.stringify(data)
    });
}

/* =========================
   USER DASHBOARD
========================= */

async function bootDashboard() {
    if (!requireUser()) {
        return;
    }

    const user = JSON.parse(
        localStorage.getItem("parksmart_user") || "{}"
    );

    const nameElement = document.querySelector("[data-user-name]");

    if (nameElement) {
        nameElement.textContent =
            user.name || "User";
    }

    const results = document.getElementById("results");

    if (!results) {
        return;
    }

    try {
        const data = await searchParking();

        const parkingSpaces = data.parking || [];

        renderParkingResults(
            results,
            parkingSpaces
        );

    } catch (error) {
        console.error(
            "Parking search error:",
            error
        );

        results.innerHTML = `
            <div class="panel" style="padding: 24px;">
                <h3>Unable to load parking</h3>
                <p>
                    ${escapeHtml(error.message)}
                </p>
            </div>
        `;
    }
}


function renderParkingResults(
    container,
    spaces
) {
    if (!Array.isArray(spaces) || spaces.length === 0) {

        container.innerHTML = `
            <div class="panel" style="padding: 28px; text-align: center;">
                <h3>No parking spaces available</h3>
                <p>
                    No owner-listed parking spaces are currently available.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h2>Available Parking</h2>
            <p>
                ${spaces.length} parking
                ${spaces.length === 1 ? "space" : "spaces"}
                listed by owners
            </p>
        </div>

        <div class="parking-results-grid">
            ${spaces.map(renderParkingCard).join("")}
        </div>
    `;
}


function renderParkingCard(parking) {

    const name =
        parking.name ||
        "Parking Space";

    const address =
        parking.address ||
        parking.city ||
        "Location not available";

    const price =
        parking.price_per_hour ??
        parking.hourly_rate ??
        0;

    const capacity =
        parking.capacity ??
        "—";

    const status =
        parking.status ||
        (parking.is_available ? "Available" : "Unavailable");

    const parkingId =
        parking.id;

    return `
        <article class="parking-result-card">

            <div class="parking-card-top">
                <span class="parking-status">
                    ${escapeHtml(status)}
                </span>
            </div>

            <h3>
                ${escapeHtml(name)}
            </h3>

            <p class="parking-address">
                📍 ${escapeHtml(address)}
            </p>

            <div class="parking-card-details">

                <div>
                    <span>Price</span>
                    <strong>₹${escapeHtml(price)}/hr</strong>
                </div>

                <div>
                    <span>Capacity</span>
                    <strong>${escapeHtml(capacity)}</strong>
                </div>

            </div>

            <button
                class="btn btn-primary parking-book-button"
                type="button"
                onclick="openParking('${escapeHtml(parkingId)}')"
            >
                View & Book
            </button>

        </article>
    `;
}


function openParking(id) {

    if (!id) {
        return;
    }

    window.location.href =
        `parking-details.html?id=${encodeURIComponent(id)}`;
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   SEARCH FORM
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const form =
            document.getElementById("search-form");

        if (!form) {
            return;
        }

        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                const formData =
                    new FormData(form);

                const q =
    formData.get("q")?.trim() || "";

const date =
    formData.get("date") || "";

const start =
    formData.get("start") || "";

const end =
    formData.get("end") || "";

                const results =
                    document.getElementById("results");

                results.innerHTML = `
                    <div class="loading">
                        Searching available parking...
                    </div>
                `;

                try {

                    const data = await searchParking({
                                 q,
                                 date,
                                 startTime: start,
                                 endTime: end
    });

                    const spaces = data.parking || [];

                    renderParkingResults(
                        results,
                        spaces
                    );

                } catch (error) {

                    console.error(
                        "Search error:",
                        error
                    );

                    results.innerHTML = `
                        <div class="panel" style="padding: 24px;">
                            <h3>Search failed</h3>
                            <p>
                                ${escapeHtml(error.message)}
                            </p>
                        </div>
                    `;
                }
            }
        );
    }
);

