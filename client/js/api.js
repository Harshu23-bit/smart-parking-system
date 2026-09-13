const API_BASE_URL = "http://localhost:3000/api";

function getAuthToken() {
    return localStorage.getItem("parksmart_auth_token");
}

function setAuthToken(token) {
    localStorage.setItem("parksmart_auth_token", token);
}

function clearAuthToken() {
    localStorage.removeItem("parksmart_auth_token");
}

async function apiRequest(path, options = {}) {
    const token = getAuthToken();

    const isFormData =
    options.body instanceof
    FormData;


    const headers = {
        ...(isFormData
            ? {}
            : {
                "Content-Type":
                    "application/json",
            }),

        ...(options.headers || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            ...options,
            headers,
        }
    );

    let data;

    try {
        data = await response.json();
    } catch {
        data = {
            status: "error",
            message: "Invalid server response.",
        };
    }

    if (!response.ok) {
        const error = new Error(
            data.message || "Request failed."
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}

async function registerOwner(payload) {
    return apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

async function loginOwner(email, password) {
    const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
            email,
            password,
        }),
    });

    if (data.token) {
        setAuthToken(data.token);
    }

    return data;
}

async function getCurrentUser() {
    return apiRequest("/auth/me");
}

async function updateCurrentUser(
    payload
) {
    return apiRequest(
        "/auth/me",
        {
            method: "PATCH",
            body: JSON.stringify(
                payload
            ),
        }
    );
}

async function sendVerificationOtp(
    channel
) {
    return apiRequest(
        "/auth/send-otp",
        {
            method: "POST",
            body: JSON.stringify({
                channel,
            }),
        }
    );
}

async function verifyAccountOtp(
    otp
) {
    return apiRequest(
        "/auth/verify-account",
        {
            method: "POST",
            body: JSON.stringify({
                otp,
            }),
        }
    );
}

async function createParkingSpace(payload) {
    return apiRequest(
        "/owner/parking-spaces",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
}

async function getOwnerParkingSpaces() {
    return apiRequest(
        "/owner/parking-spaces"
    );
}

async function updateParkingSpaceDetails(
    parkingId,
    payload
) {
    return apiRequest(
        `/owner/parking-spaces/${parkingId}`,
        {
            method: "PATCH",
            body: JSON.stringify(
                payload
            ),
        }
    );
}

async function updateParkingAvailability(
    parkingId,
    isAvailable
) {
    return apiRequest(
        `/owner/parking-spaces/${parkingId}/availability`,
        {
            method: "PATCH",
            body: JSON.stringify({
                is_available:
                    isAvailable,
            }),
        }
    );
}

async function updateParkingPricing(
    parkingId,
    payload
) {
    return apiRequest(
        `/owner/parking-spaces/${parkingId}/pricing`,
        {
            method: "PATCH",
            body:
                JSON.stringify(
                    payload
                ),
        }
    );
}

async function getOwnerBookings(
    parkingSpaceId = null
) {

    const query =
        parkingSpaceId
            ? `?parking_space_id=${encodeURIComponent(
                parkingSpaceId
            )}`
            : "";


    return apiRequest(
        `/owner/bookings${query}`
    );
}

async function getOwnerEarnings(
    parkingSpaceId = null
) {

    const query =
        parkingSpaceId
            ? `?parking_space_id=${encodeURIComponent(
                parkingSpaceId
            )}`
            : "";


    return apiRequest(
        `/owner/earnings${query}`
    );
}

async function updateOwnerBookingStatus(
    bookingId,
    status
) {

    return apiRequest(
        `/owner/bookings/${bookingId}/status`,
        {
            method: "PATCH",

            body: JSON.stringify({
                status
            }),
        }
    );
}

async function forgotPassword(
    email
) {

    return apiRequest(
        "/auth/forgot-password",
        {
            method: "POST",

            body: JSON.stringify({
                email
            }),
        }
    );
}


async function verifyResetOtp(
    email,
    otp
) {

    return apiRequest(
        "/auth/verify-reset-otp",
        {
            method: "POST",

            body: JSON.stringify({
                email,
                otp,
            }),
        }
    );
}


async function resetPassword(
    resetToken,
    newPassword
) {

    return apiRequest(
        "/auth/reset-password",
        {
            method: "POST",

            body: JSON.stringify({
                reset_token:
                    resetToken,

                new_password:
                    newPassword,
            }),
        }
    );
}


async function getOwnerOperatingHours(
    parkingId
) {

    return apiRequest(
        `/owner/parking-spaces/${parkingId}/operating-hours`
    );
}


async function updateOwnerOperatingHours(
    parkingId,
    operatingHours
) {

    return apiRequest(
        `/owner/parking-spaces/${parkingId}/operating-hours`,
        {
            method:
                "PATCH",

            body:
                JSON.stringify({
                    operating_hours:
                        operatingHours,
                }),
        }
    );
}


async function getOwnerParkingImages(
    parkingId
) {

    return apiRequest(
        `/owner/parking-spaces/${parkingId}/images`
    );
}


async function uploadOwnerParkingImages(
    parkingId,
    files
) {

    const formData =
        new FormData();


    Array
        .from(files || [])
        .forEach(
            file => {

                formData.append(
                    "images",
                    file
                );
            }
        );


    return apiRequest(
        `/owner/parking-spaces/${parkingId}/images`,
        {
            method:
                "POST",

            body:
                formData,
        }
    );
}


async function setPrimaryParkingImage(
    parkingId,
    imageId
) {

    return apiRequest(
        `/owner/parking-spaces/${parkingId}/images/${imageId}/primary`,
        {
            method:
                "PATCH",
        }
    );
}


async function deleteOwnerParkingImage(
    parkingId,
    imageId
) {

    return apiRequest(
        `/owner/parking-spaces/${parkingId}/images/${imageId}`,
        {
            method:
                "DELETE",
        }
    );
}


// ============================================
// USER PAYMENT API
// ============================================

async function createPaymentOrder(
    bookingId
) {

    return apiRequest(
        "/payments/orders",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    booking_id:
                        bookingId,
                }),
        }
    );
}


async function verifyPayment(
    payload
) {

    return apiRequest(
        "/payments/verify",
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    payload
                ),
        }
    );
}


async function getBookingPayment(
    bookingId
) {

    return apiRequest(
        `/payments/booking/${encodeURIComponent(
            bookingId
        )}`
    );
}


function logoutOwner() {
    clearAuthToken();
}


window.ParkSmartAPI = {
    registerOwner,
    loginOwner,

    forgotPassword,
    verifyResetOtp,
    resetPassword,

    getCurrentUser,
    updateCurrentUser,
    sendVerificationOtp,
    verifyAccountOtp,

    createParkingSpace,
    getOwnerParkingSpaces,
    updateParkingSpaceDetails,
    updateParkingAvailability,
    updateParkingPricing,
    getOwnerBookings,
    updateOwnerBookingStatus,
    getOwnerEarnings,
    getOwnerOperatingHours,
    updateOwnerOperatingHours,

    getOwnerParkingImages,
    uploadOwnerParkingImages,
    setPrimaryParkingImage,
    deleteOwnerParkingImage,

    createPaymentOrder,
    verifyPayment,
    getBookingPayment,

    logoutOwner,
    getAuthToken,
};
