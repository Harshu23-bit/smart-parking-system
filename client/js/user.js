const API_BASE = "/api";


/* =====================================================
USER AUTH HELPERS
===================================================== */

function userToken() {

    return localStorage.getItem(
        "parksmart_user_token"
    );
}


function requireUser() {

    if (!userToken()) {

        window.location.href =
            "user-login.html";

        return false;
    }

    return true;
}


function logoutUser() {

    localStorage.removeItem(
        "parksmart_user_token"
    );

    localStorage.removeItem(
        "parksmart_user"
    );

    window.location.href =
        "user-login.html";
}


/* =====================================================
COMMON API REQUEST
===================================================== */

async function apiRequest(
    url,
    options = {}
) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };


    const token =
        userToken();


    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }


    const response =
        await fetch(
            `${API_BASE}${url}`,
            {
                ...options,
                headers
            }
        );


    const data =
        await response
            .json()
            .catch(() => ({}));


    if (!response.ok) {

        throw new Error(
            data.message ||
            "Something went wrong."
        );
    }


    return data;
}


/* =====================================================
AUTH
===================================================== */

async function registerUser(
    data
) {

    return apiRequest(
        "/auth/user/register",
        {
            method: "POST",

            body:
                JSON.stringify(
                    data
                )
        }
    );
}


async function loginUser(
    email,
    password
) {

    const data =
        await apiRequest(
            "/auth/user/login",
            {
                method: "POST",

                body:
                    JSON.stringify({
                        email,
                        password
                    })
            }
        );


    localStorage.setItem(
        "parksmart_user_token",
        data.token
    );


    localStorage.setItem(
        "parksmart_user",
        JSON.stringify(
            data.user
        )
    );


    return data;
}


/* =====================================================
PARKING
===================================================== */

/*
 * Parking can now be searched in two ways:
 *
 * 1. Normal text search
 *    q = "Mira Road"
 *
 * 2. Coordinate-based search
 *    latitude / longitude / radiusKm
 *
 * Coordinate search is used after:
 * - selecting an address suggestion
 * - clicking "Use My Location"
 */

async function searchParking({

    q = "",

    startTime = "",

    endTime = "",

    latitude = null,

    longitude = null,

    radiusKm = 5

} = {}) {

    const params =
        new URLSearchParams();


    if (q) {

        params.set(
            "q",
            q
        );
    }


    if (startTime) {

        params.set(
            "start_time",
            startTime
        );
    }


    if (endTime) {

        params.set(
            "end_time",
            endTime
        );
    }


    /*
     * Only send coordinate parameters
     * when BOTH latitude and longitude exist.
     */

    if (
        latitude !== null &&
        longitude !== null
    ) {

        params.set(
            "latitude",
            String(latitude)
        );


        params.set(
            "longitude",
            String(longitude)
        );


        params.set(
            "radius_km",
            String(radiusKm)
        );
    }


    return apiRequest(
        `/parking?${params.toString()}`
    );
}


async function getParkingDetails(
    id
) {

    return apiRequest(
        `/parking/${encodeURIComponent(id)}`
    );
}


/* =====================================================
VEHICLES
===================================================== */

async function getVehicles() {

    return apiRequest(
        "/vehicles"
    );
}


async function addVehicle(
    vehicle
) {

    return apiRequest(
        "/vehicles",
        {
            method: "POST",

            body:
                JSON.stringify(
                    vehicle
                )
        }
    );
}


/* =====================================================
BOOKINGS
===================================================== */

async function createBooking(
    data
) {

    return apiRequest(
        "/bookings",
        {
            method: "POST",

            body:
                JSON.stringify(
                    data
                )
        }
    );
}


async function getMyBookings() {

    return apiRequest(
        "/bookings"
    );
}


async function cancelBooking(
    id,
    reason = "Cancelled by user"
) {

    return apiRequest(
        `/bookings/${encodeURIComponent(id)}/cancel`,
        {
            method: "POST",

            body:
                JSON.stringify({
                    reason
                })
        }
    );
}


/* =====================================================
PAYMENTS
===================================================== */

async function createPaymentOrder(
    bookingId
) {

    return apiRequest(
        "/payments/orders",
        {
            method: "POST",

            body:
                JSON.stringify({
                    booking_id:
                        bookingId
                })
        }
    );
}


async function verifyPayment(
    data
) {

    return apiRequest(
        "/payments/verify",
        {
            method: "POST",

            body:
                JSON.stringify(
                    data
                )
        }
    );
}