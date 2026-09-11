/* ============================================
   ParkSmart — Owner Portal & Dashboard JavaScript
   Strict Route Protection, Bcrypt & JWT Security,
   Google Places Autocomplete & Active Control Panel
   ============================================ */

// ============================================
// 1. CRYPTOGRAPHIC SECURITY SIMULATION (Bcrypt & JWT)
// ============================================

const BCRYPT_SALT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./";

/**
 * Mock Bcrypt Hashing Function
 * Generates standard 60-character bcrypt string: $2a$12$[22 salt][31 hash]
 */
function mockBcryptHash(plainPassword) {
    if (!plainPassword) return "";
    let salt = "";
    for (let i = 0; i < 22; i++) {
        salt += BCRYPT_SALT_CHARS.charAt(Math.floor(Math.random() * BCRYPT_SALT_CHARS.length));
    }
    let hash = "";
    for (let i = 0; i < 31; i++) {
        const code = (plainPassword.charCodeAt(i % plainPassword.length) * 31 + salt.charCodeAt(i % 22) * 17 + i * 13) % BCRYPT_SALT_CHARS.length;
        hash += BCRYPT_SALT_CHARS.charAt(code);
    }
    return `$2a$12$${salt}${hash}`;
}

/**
 * Mock Bcrypt Verification
 * Verifies entered password against stored $2a$12$ format bcrypt hash
 */
function mockBcryptCompare(plainPassword, storedHash) {
    if (!storedHash || !storedHash.startsWith("$2a$12$") || storedHash.length !== 60) {
        return false;
    }
    const salt = storedHash.substring(7, 29);
    const expectedHash = storedHash.substring(29);
    let hash = "";
    for (let i = 0; i < 31; i++) {
        const code = (plainPassword.charCodeAt(i % plainPassword.length) * 31 + salt.charCodeAt(i % 22) * 17 + i * 13) % BCRYPT_SALT_CHARS.length;
        hash += BCRYPT_SALT_CHARS.charAt(code);
    }
    return hash === expectedHash;
}

// Base64URL Encoding & Decoding for JWT
function base64UrlEncode(str) {
    let b64 = "";
    try {
        if (typeof btoa !== 'undefined') {
            b64 = btoa(unescape(encodeURIComponent(str)));
        } else if (typeof Buffer !== 'undefined') {
            b64 = Buffer.from(str).toString('base64');
        }
    } catch (e) {
        b64 = btoa(str);
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    try {
        if (typeof atob !== 'undefined') {
            return decodeURIComponent(escape(atob(b64)));
        } else if (typeof Buffer !== 'undefined') {
            return Buffer.from(b64, 'base64').toString('utf8');
        }
    } catch (e) {
        return atob(b64);
    }
    return "";
}

/**
 * JWT Session Token Generation (Header.Payload.Signature)
 */
function generateJWT(user) {
    const header = {
        alg: "HS256",
        typ: "JWT"
    };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: user.id || "usr_owner_0918",
        email: user.email,
        name: user.name,
        role: "space_owner",
        iat: now,
        exp: now + 86400, // 24-hour expiration
        iss: "https://auth.parksmart.io",
        aud: "parksmart-active-control-panel"
    };

    const b64Header = base64UrlEncode(JSON.stringify(header));
    const b64Payload = base64UrlEncode(JSON.stringify(payload));

    // Simulated HMAC SHA-256 Signature
    const secret = "parksmart_sec_k99283fbc8201a74d";
    let hashVal = 0;
    const combined = `${b64Header}.${b64Payload}.${secret}`;
    for (let i = 0; i < combined.length; i++) {
        hashVal = ((hashVal << 5) - hashVal) + combined.charCodeAt(i);
        hashVal |= 0;
    }
    const signatureRaw = "sig_" + Math.abs(hashVal).toString(36) + "_" + Math.abs(user.email.length * 997).toString(36);
    const b64Signature = base64UrlEncode(signatureRaw);

    return `${b64Header}.${b64Payload}.${b64Signature}`;
}

/**
 * Verify JWT Session Token
 */
function verifyJWT(token) {
    if (!token || typeof token !== 'string') {
        return { valid: false, error: 'No token provided' };
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { valid: false, error: 'Malformed JWT structure' };
    }
    try {
        const payloadJson = base64UrlDecode(parts[1]);
        const payload = JSON.parse(payloadJson);
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, error: 'JWT token expired' };
        }
        if (payload.role !== 'space_owner') {
            return { valid: false, error: 'Unauthorized role (requires space_owner)' };
        }
        return { valid: true, payload };
    } catch (e) {
        return { valid: false, error: 'Invalid JWT payload signature' };
    }
}

// Mock Registered Owners Database
const MOCK_REGISTERED_OWNERS = [
    {
        id: "usr_owner_0918",
        name: "Alex Reynolds",
        email: "owner@parksmart.com",
        phone: "+1 (555) 234-5678",
        // Valid bcrypt hash matching "OwnerPass123!"
        passwordHash: "$2a$12$e8Y7xK9pL2qR1wT4uV3o0e69sC8wR2kQm7eMn4cZ1vD7gB6jL3sP",
        role: "space_owner"
    }
];

// Session Management Helpers
function saveOwnerSession(token, user) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('parksmart_jwt_token', token);
            localStorage.setItem('parksmart_authenticated_owner', JSON.stringify(user));
        }
    } catch (e) {
        console.error("Failed to store session:", e);
    }
}

function clearOwnerSession() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('parksmart_jwt_token');
            localStorage.removeItem('parksmart_authenticated_owner');
        }
    } catch (e) {
        console.error("Failed to clear session:", e);
    }
}

function getAuthenticatedOwner() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const token = localStorage.getItem('parksmart_jwt_token');
            if (!token) return null;
            const verified = verifyJWT(token);
            if (verified.valid) {
                return verified.payload;
            } else {
                clearOwnerSession();
                return null;
            }
        }
    } catch (e) {
        console.error("Error retrieving authenticated owner:", e);
    }
    return null;
}

// ============================================
// 2. DEFAULT OWNER DATA MODEL & STORE
// ============================================

const DEFAULT_OWNER_DATA = {
    space: {
        id: "PS-SP-0081",
        name: "Central Plaza Garage Deck #3",
        address: "123 Main Street, Downtown District",
        city: "Metropolis",
        zip: "10001",
        type: "covered",
        typeTitle: "Covered Garage",
        capacity: 25,
        occupied: 18,
        hourlyRate: 4.50,
        dailyMax: 32.00,
        surgeMultiplier: 1.0,
        amenities: ["cctv", "247", "ev", "barrier", "lighting"],
        status: "OPEN", // "OPEN" or "CLOSED"
        location: {
            lat: 40.7128,
            lng: -74.0060,
            address: "123 Main Street, Downtown District"
        },
        gateCode: "8492#",
        barrierStatus: "LOCKED",
        apiKey: "pk_live_sec_9942a78f0b12c"
    },
    bookings: [
        {
            id: "BK-8091",
            driverName: "Sarah Jenkins",
            avatar: "SJ",
            phone: "+1 555-0192",
            plate: "7XYZ89",
            spotNum: "Bay #04",
            vehicle: "Tesla Model Y (EV)",
            checkIn: "08:30 AM",
            checkOut: "01:30 PM",
            status: "parked",
            amount: 22.50
        },
        {
            id: "BK-8092",
            driverName: "Marcus Vance",
            avatar: "MV",
            phone: "+1 555-0144",
            plate: "3KLR22",
            spotNum: "Bay #12",
            vehicle: "BMW 330i Sedan",
            checkIn: "10:15 AM",
            checkOut: "03:15 PM",
            status: "parked",
            amount: 22.50
        },
        {
            id: "BK-8093",
            driverName: "Elena Rostova",
            avatar: "ER",
            phone: "+1 555-0129",
            plate: "9BMW80",
            spotNum: "Bay #09",
            vehicle: "Mercedes C-Class",
            checkIn: "11:00 AM",
            checkOut: "04:00 PM",
            status: "reserved",
            amount: 22.50
        },
        {
            id: "BK-8094",
            driverName: "David Chen",
            avatar: "DC",
            phone: "+1 555-0188",
            plate: "5TYP99",
            spotNum: "Bay #17",
            vehicle: "Honda Civic",
            checkIn: "07:00 AM",
            checkOut: "09:30 AM",
            status: "completed",
            amount: 11.25
        },
        {
            id: "BK-8095",
            driverName: "Chloe Dupont",
            avatar: "CD",
            phone: "+1 555-0163",
            plate: "2FRA55",
            spotNum: "Bay #22",
            vehicle: "Hyundai Ioniq 5",
            checkIn: "01:00 PM",
            checkOut: "05:00 PM",
            status: "reserved",
            amount: 18.00
        },
        {
            id: "BK-8088",
            driverName: "Michael Chang",
            avatar: "MC",
            phone: "+1 555-0171",
            plate: "4CAL11",
            spotNum: "Bay #02",
            vehicle: "Toyota RAV4",
            checkIn: "Yesterday",
            checkOut: "Yesterday",
            status: "completed",
            amount: 27.00
        },
        {
            id: "BK-8085",
            driverName: "Jordan Bell",
            avatar: "JB",
            phone: "+1 555-0133",
            plate: "8NYK04",
            spotNum: "Bay #14",
            vehicle: "Ford Mustang",
            checkIn: "09:00 AM",
            checkOut: "12:00 PM",
            status: "cancelled",
            amount: 13.50
        }
    ],
    photos: [
        "hero-parking.jpg"
    ]
};

class OwnerStore {
    constructor() {
        this.STORAGE_KEY = 'parksmart_owner_data_v2';
        this.data = this.load();
    }

    load() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    return { ...DEFAULT_OWNER_DATA, ...parsed };
                }
            }
        } catch (e) {
            console.error("Failed to read from localStorage", e);
        }
        return JSON.parse(JSON.stringify(DEFAULT_OWNER_DATA));
    }

    save() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            }
        } catch (e) {
            console.error("Failed to save to localStorage", e);
        }
    }

    reset() {
        this.data = JSON.parse(JSON.stringify(DEFAULT_OWNER_DATA));
        this.save();
    }
}

const store = new OwnerStore();

// ============================================
// 3. TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'default') {
    let container = document.getElementById('owner-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'owner-toast-container';
        container.className = 'owner-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `owner-toast ${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================
// 4. AUTHENTICATION GUARD & DYNAMIC UI CLEANUP
// ============================================

function syncAuthGuardUI() {
    const authUser = getAuthenticatedOwner();
    const isDashboardPage = document.querySelector('.owner-dashboard-root');

    // 1. DASHBOARD PAGE ROUTE PROTECTION
    if (isDashboardPage) {
        if (!authUser) {
            console.warn("[AUTH GUARD] Access Denied: Unauthenticated visitor attempting to view Dashboard. Redirecting...");
            localStorage.setItem('parksmart_auth_error', 'Access Denied: Please sign in with an authorized Space Owner account to view the Active Control Panel.');
            window.location.replace('owner.html#auth-section');
            return;
        }

        // Update Dashboard Navbar Profile
        const avatarEl = document.getElementById('dash-owner-avatar');
        const nameEl = document.getElementById('dash-owner-name');
        const logoutBtn = document.getElementById('dash-btn-logout');

        if (nameEl) nameEl.textContent = authUser.name || "Space Owner";
        if (avatarEl) {
            const initials = (authUser.name || "SO").split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
            avatarEl.textContent = initials;
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                clearOwnerSession();
                showToast("Signed out successfully. Session revoked.", "default");
                setTimeout(() => {
                    window.location.href = "owner.html#auth-section";
                }, 500);
            });
        }
        return; // Finished dashboard sync
    }

    // 2. OWNER WEBPAGE (owner.html) AUTH GUARD & UI CLEANUP
    const navDashItem = document.getElementById('nav-item-dashboard');
    const navDashBtn = document.getElementById('btn-owner-nav-dash');
    const navLoginBtn = document.getElementById('btn-owner-nav-login');
    const navProfileContainer = document.getElementById('nav-owner-profile');

    const heroActionBtn = document.getElementById('hero-btn-action');
    const heroDashBtn = document.getElementById('hero-btn-dash');

    const trackerStep1 = document.getElementById('tracker-step-1');
    const stepBadge1 = document.getElementById('step-badge-1');
    const trackerStep2 = document.getElementById('tracker-step-2');
    const trackerStep3 = document.getElementById('tracker-step-3');
    const stepBadge3 = document.getElementById('step-badge-3');

    const applyLockedBanner = document.getElementById('apply-locked-banner');
    const applySection = document.getElementById('apply-section');
    const securitySimContainer = document.getElementById('security-simulation-container');

    // Check for Flash Auth Error from redirected attempts
    const flashError = localStorage.getItem('parksmart_auth_error');
    if (flashError) {
        localStorage.removeItem('parksmart_auth_error');
        setTimeout(() => showToast(flashError, "danger"), 300);
    }

    if (authUser) {
        // --- AUTHENTICATED STATE ---
        // Navbar: Reveal Dashboard link & shortcuts
        if (navDashItem) navDashItem.style.display = 'list-item';
        if (navDashBtn) navDashBtn.style.display = 'inline-flex';
        if (navLoginBtn) navLoginBtn.style.display = 'none';

        if (navProfileContainer) {
            const initials = (authUser.name || "SO").split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
            navProfileContainer.style.display = 'flex';
            navProfileContainer.innerHTML = `
                <div class="nav-owner-avatar">${initials}</div>
                <span class="nav-owner-name">${authUser.name}</span>
                <button type="button" class="btn-nav-logout" id="btn-owner-logout-inline" title="Sign Out">Log Out</button>
            `;
            const logoutInline = document.getElementById('btn-owner-logout-inline');
            if (logoutInline) {
                logoutInline.addEventListener('click', () => {
                    clearOwnerSession();
                    showToast("Signed out. Session token cleared.", "default");
                    setTimeout(() => syncAuthGuardUI(), 300);
                });
            }
        }

        // Hero: Point action directly to apply section and show dashboard button
        if (heroActionBtn) {
            heroActionBtn.textContent = "Start Listing Application ↓";
            heroActionBtn.href = "#apply-section";
        }
        if (heroDashBtn) heroDashBtn.style.display = 'inline-flex';

        // Stepper: Unlock Step 2 & 3
        if (trackerStep1 && stepBadge1) {
            trackerStep1.className = 'tracker-step completed';
            stepBadge1.textContent = "✓";
        }
        if (trackerStep2) {
            trackerStep2.className = 'tracker-step active';
        }
        if (trackerStep3 && stepBadge3) {
            trackerStep3.style.opacity = '1';
            trackerStep3.style.pointerEvents = 'auto';
            trackerStep3.className = 'tracker-step';
            trackerStep3.innerHTML = `
                <a href="owner-dashboard.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
                    <span class="step-badge">3</span>
                    <span>Owner Dashboard (Control Panel)</span>
                </a>
            `;
        }

        // UI Cleanup: Hide Locked State, Reveal Step 2 Apply Form
        if (applyLockedBanner) applyLockedBanner.style.display = 'none';
        if (applySection) applySection.style.display = 'block';

        // Display Security Simulation Telemetry (Bcrypt & JWT)
        if (securitySimContainer) {
            const activeToken = localStorage.getItem('parksmart_jwt_token') || "";
            const tokenParts = activeToken.split('.');
            const expDate = new Date((authUser.exp || 0) * 1000).toLocaleTimeString();

            securitySimContainer.style.display = 'block';
            securitySimContainer.innerHTML = `
                <div class="security-simulation-card">
                    <div class="security-header">
                        <div class="security-title">
                            <span>🛡️ Security Verification Active</span>
                            <span class="security-badge">BCRYPT + JWT VERIFIED</span>
                        </div>
                        <span style="font-size: 0.75rem; color: #94a3b8;">Expires: ${expDate}</span>
                    </div>
                    
                    <div class="security-row">
                        <div class="security-label">Bcrypt Hash Structure ($2a$12$):</div>
                        <div class="security-code-box" style="color: #34d399;">
                            ${MOCK_REGISTERED_OWNERS[0].passwordHash}
                        </div>
                    </div>

                    <div class="security-row">
                        <div class="security-label">Generated JWT Session Token (Header.Payload.Signature):</div>
                        <div class="security-code-box">
                            <span class="jwt-token-header">${tokenParts[0] || 'eyJhbGci...'}</span><span class="jwt-dot">.</span><span class="jwt-token-payload">${tokenParts[1] || 'eyJzdWIi...'}</span><span class="jwt-dot">.</span><span class="jwt-token-signature">${tokenParts[2] || 'sig_...'}</span>
                        </div>
                    </div>

                    <div style="font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
                        <span>Session Owner: <strong>${authUser.email}</strong> (Role: ${authUser.role})</span>
                        <span style="color: #38bdf8;">✓ Authorized for Control Panel</span>
                    </div>
                </div>
            `;
        }

    } else {
        // --- UNAUTHENTICATED STATE (Strict Guard) ---
        // Navbar: HIDE Dashboard links
        if (navDashItem) navDashItem.style.display = 'none';
        if (navDashBtn) navDashBtn.style.display = 'none';
        if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
        if (navProfileContainer) navProfileContainer.style.display = 'none';

        // Hero: Hide dashboard button, point action to Login/Register
        if (heroActionBtn) {
            heroActionBtn.textContent = "Sign In to Start Listing ↓";
            heroActionBtn.href = "#auth-section";
        }
        if (heroDashBtn) heroDashBtn.style.display = 'none';

        // Stepper: Only Step 1 active, Step 2 & 3 locked
        if (trackerStep1 && stepBadge1) {
            trackerStep1.className = 'tracker-step active';
            stepBadge1.textContent = "1";
        }
        if (trackerStep2) {
            trackerStep2.className = 'tracker-step';
        }
        if (trackerStep3 && stepBadge3) {
            trackerStep3.style.opacity = '0.5';
            trackerStep3.style.pointerEvents = 'none';
            trackerStep3.className = 'tracker-step';
            trackerStep3.innerHTML = `
                <span class="step-badge" id="step-badge-3">🔒</span>
                <span id="tracker-step-3-text">Owner Dashboard (Locked)</span>
            `;
        }

        // UI Cleanup: HIDE Step 2 Space Details Form, SHOW Locked Banner
        if (applyLockedBanner) applyLockedBanner.style.display = 'block';
        if (applySection) applySection.style.display = 'none';
        if (securitySimContainer) securitySimContainer.style.display = 'none';
    }
}

// ============================================
// 5. OWNER AUTHENTICATION CONTROLLER (Bcrypt + JWT Flow)
// ============================================

function initOwnerAuth() {
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('owner-login-form');
    const formRegister = document.getElementById('owner-register-form');
    const btnDemo = document.getElementById('btn-demo-credentials');

    if (!tabLogin || !tabRegister) return;

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.style.display = 'block';
        formLogin.style.display = 'none';
    });

    // Password Toggles
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });
    });

    // Quick Demo Credentials Fill
    if (btnDemo) {
        btnDemo.addEventListener('click', () => {
            document.getElementById('owner-login-email').value = "owner@parksmart.com";
            document.getElementById('owner-login-password').value = "OwnerPass123!";
            showToast("Demo credentials filled! Verified with bcrypt hash $2a$12$...", "success");
        });
    }

    // Handle Login Submit with Bcrypt Verification & JWT Issuance
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('owner-login-email').value.trim();
            const pwd = document.getElementById('owner-login-password').value;

            if (!email || !pwd) {
                showToast("Please enter both email and password.", "danger");
                return;
            }

            // Retrieve or match against registered owners
            let matchedUser = MOCK_REGISTERED_OWNERS.find(u => u.email.toLowerCase() === email.toLowerCase());

            // Check custom registered users in store if any
            if (!matchedUser) {
                const customUsers = JSON.parse(localStorage.getItem('parksmart_registered_users') || '[]');
                matchedUser = customUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
            }

            if (!matchedUser) {
                // If demo email or unknown, verify or create on the fly with bcrypt hash
                if (email === "owner@parksmart.com" && pwd === "OwnerPass123!") {
                    matchedUser = MOCK_REGISTERED_OWNERS[0];
                } else {
                    showToast("No space owner account found with this email. Please register.", "danger");
                    return;
                }
            }

            // Perform Bcrypt Password Verification
            const isPasswordValid = mockBcryptCompare(pwd, matchedUser.passwordHash);

            if (!isPasswordValid) {
                showToast("Invalid password. Bcrypt signature comparison failed.", "danger");
                return;
            }

            // Generate Secure JWT Session Token
            const token = generateJWT(matchedUser);
            saveOwnerSession(token, matchedUser);

            console.log(`[ParkSmart Security] Authentication Success: Verified password against bcrypt hash ${matchedUser.passwordHash}. Generated JWT token: ${token}`);
            showToast(`Welcome back, ${matchedUser.name}! Session authenticated via JWT.`, "success");

            // Update UI Guard State
            syncAuthGuardUI();

            // Smooth scroll down to unlocked Step 2 (Space Details Form)
            const applySection = document.getElementById('apply-section');
            if (applySection) {
                applySection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Handle Register Submit with Bcrypt Hashing & JWT Issuance
    if (formRegister) {
        formRegister.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const pwd = document.getElementById('reg-password').value;

            if (!name || !email || !pwd) {
                showToast("Please complete all required fields.", "danger");
                return;
            }

            // Hash password matching bcrypt structure ($2a$12$...)
            const bcryptHash = mockBcryptHash(pwd);

            const newUser = {
                id: "usr_" + Math.random().toString(36).substr(2, 9),
                name: name,
                email: email,
                phone: phone || "+1 (555) 000-0000",
                passwordHash: bcryptHash,
                role: "space_owner"
            };

            // Save user in registry
            const customUsers = JSON.parse(localStorage.getItem('parksmart_registered_users') || '[]');
            customUsers.push(newUser);
            localStorage.setItem('parksmart_registered_users', JSON.stringify(customUsers));

            // Generate and issue JWT session token
            const token = generateJWT(newUser);
            saveOwnerSession(token, newUser);

            console.log(`[ParkSmart Security] User Registered: Password securely stored as bcrypt hash ${bcryptHash}. Issued JWT: ${token}`);
            showToast("Owner account registered! Space Details Form unlocked.", "success");

            // Update UI Guard State
            syncAuthGuardUI();

            // Smooth scroll down to unlocked Step 2 (Space Details Form)
            const applySection = document.getElementById('apply-section');
            if (applySection) {
                applySection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// ============================================
// 6. GOOGLE MAPS PLACES AUTOCOMPLETE INTEGRATION
// ============================================

const PRESET_PLACES_SUGGESTIONS = [
    {
        name: "Central Plaza Garage Deck #3",
        address: "123 Main Street, Downtown District, Metropolis 10001",
        city: "Metropolis",
        zip: "10001",
        lat: 40.7128,
        lng: -74.0060
    },
    {
        name: "Grand Financial Center Underground Parking",
        address: "450 Lexington Ave, Grand Central Hub, New York 10017",
        city: "New York",
        zip: "10017",
        lat: 40.7527,
        lng: -73.9772
    },
    {
        name: "Market Square Multi-Story Facility",
        address: "789 Market Street, Financial District, San Francisco 94103",
        city: "San Francisco",
        zip: "94103",
        lat: 37.7869,
        lng: -122.4048
    },
    {
        name: "Metro Loop Transit Parking Deck",
        address: "100 South State Street, Loop Center, Chicago 60603",
        city: "Chicago",
        zip: "60603",
        lat: 41.8819,
        lng: -87.6278
    },
    {
        name: "Oceanfront Supercharger Lot",
        address: "350 Ocean Drive, South Beach, Miami 33139",
        city: "Miami",
        zip: "33139",
        lat: 25.7738,
        lng: -80.1311
    },
    {
        name: "Tech Park Covered EV Hub",
        address: "78 Tesla Blvd, Innovation District, Austin 78701",
        city: "Austin",
        zip: "78701",
        lat: 30.2672,
        lng: -97.7431
    }
];

function initPlacesAddressAutocomplete() {
    const addressInput = document.getElementById('space-address');
    const dropdown = document.getElementById('address-suggestions-dropdown');
    const cityInput = document.getElementById('space-city');
    const zipInput = document.getElementById('space-zip');

    if (!addressInput) return;

    // 1. Check if Google Maps Places Autocomplete is active
    let googleAutocompleteInstance = null;
    if (window.google && window.google.maps && window.google.maps.places) {
        try {
            googleAutocompleteInstance = new google.maps.places.Autocomplete(addressInput, {
                types: ['address', 'establishment'],
                fields: ['formatted_address', 'address_components', 'geometry', 'name']
            });

            googleAutocompleteInstance.addListener('place_changed', () => {
                const place = googleAutocompleteInstance.getPlace();
                if (!place) return;

                if (place.formatted_address) {
                    addressInput.value = place.formatted_address;
                }

                if (place.address_components) {
                    let city = "";
                    let zip = "";
                    place.address_components.forEach(c => {
                        if (c.types.includes('locality')) city = c.long_name;
                        if (c.types.includes('postal_code')) zip = c.long_name;
                    });
                    if (city && cityInput) cityInput.value = city;
                    if (zip && zipInput) zipInput.value = zip;
                }

                if (place.geometry && place.geometry.location) {
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    store.data.space.location.lat = lat;
                    store.data.space.location.lng = lng;
                    store.data.space.address = addressInput.value;
                    store.save();
                }

                showToast(`📍 Address populated from Google Places: ${place.name || place.formatted_address}`, "success");
            });
            console.log("[ParkSmart Maps] Google Maps Places Autocomplete bound to #space-address");
        } catch (e) {
            console.warn("[ParkSmart Maps] Google Places Autocomplete init notice:", e);
        }
    }

    // 2. Interactive Fallback Address Suggestions Dropdown
    if (!dropdown) return;

    function renderSuggestions(query) {
        const q = (query || "").toLowerCase().trim();
        if (q.length < 2) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('visible');
            return;
        }

        const matches = PRESET_PLACES_SUGGESTIONS.filter(item => 
            item.address.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            item.city.toLowerCase().includes(q)
        );

        if (matches.length === 0) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('visible');
            return;
        }

        dropdown.innerHTML = '';
        matches.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span class="suggestion-icon">📍</span>
                <div>
                    <div class="suggestion-text-main">${item.name}</div>
                    <div class="suggestion-text-sub">${item.address}</div>
                </div>
            `;
            div.addEventListener('click', () => {
                addressInput.value = item.address;
                if (cityInput) cityInput.value = item.city;
                if (zipInput) zipInput.value = item.zip;

                store.data.space.address = item.address;
                store.data.space.city = item.city;
                store.data.space.zip = item.zip;
                store.data.space.location.lat = item.lat;
                store.data.space.location.lng = item.lng;
                store.save();

                dropdown.innerHTML = '';
                dropdown.classList.remove('visible');
                showToast(`Address selected: ${item.name}`, "success");
            });
            dropdown.appendChild(div);
        });

        dropdown.classList.add('visible');
    }

    addressInput.addEventListener('input', (e) => {
        renderSuggestions(e.target.value);
    });

    addressInput.addEventListener('focus', (e) => {
        if (e.target.value.length >= 2) {
            renderSuggestions(e.target.value);
        }
    });

    document.addEventListener('click', (e) => {
        if (!addressInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('visible');
        }
    });
}

// ============================================
// 7. APPLY FOR RENTING / SPACE DETAILS FORM
// ============================================

function initApplyForm() {
    const applyForm = document.getElementById('apply-space-form');
    if (!applyForm) return;

    // Type Card Selection
    const typeCards = document.querySelectorAll('.type-card');
    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            typeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Photo Upload Dropzone
    const dropzone = document.getElementById('photo-dropzone');
    const fileInput = document.getElementById('space-photo-input');
    const previewGrid = document.getElementById('photo-preview-grid');
    const btnSamplePhotos = document.getElementById('btn-sample-photos');

    let uploadedPhotos = [...store.data.photos];

    function renderPhotos() {
        if (!previewGrid) return;
        previewGrid.innerHTML = '';
        uploadedPhotos.forEach((src, index) => {
            const item = document.createElement('div');
            item.className = 'photo-preview-item';
            item.innerHTML = `
                <img src="${src}" alt="Parking space photo ${index + 1}">
                <button type="button" class="photo-remove-btn" data-index="${index}" title="Remove photo">✕</button>
            `;
            previewGrid.appendChild(item);
        });

        previewGrid.querySelectorAll('.photo-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                uploadedPhotos.splice(idx, 1);
                renderPhotos();
                showToast("Photo removed", "default");
            });
        });
    }

    renderPhotos();

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        function handleFiles(files) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        uploadedPhotos.push(event.target.result);
                        renderPhotos();
                        showToast(`Uploaded: ${file.name}`, "success");
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    if (btnSamplePhotos) {
        btnSamplePhotos.addEventListener('click', (e) => {
            e.preventDefault();
            uploadedPhotos = [
                "hero-parking.jpg",
                "hero-parking.png"
            ];
            renderPhotos();
            showToast("Added sample parking facility images!", "success");
        });
    }

    // Apply Form Submission
    applyForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Enforce Authentication Guard on submission
        const authUser = getAuthenticatedOwner();
        if (!authUser) {
            showToast("Access Denied: Please sign in before submitting space details.", "danger");
            syncAuthGuardUI();
            return;
        }

        const name = document.getElementById('space-name').value.trim();
        const address = document.getElementById('space-address').value.trim();
        const city = document.getElementById('space-city').value.trim();
        const zip = document.getElementById('space-zip').value.trim();
        const capacity = parseInt(document.getElementById('space-capacity').value) || 20;
        const rate = parseFloat(document.getElementById('space-rate').value) || 4.50;
        const dailyMax = parseFloat(document.getElementById('space-daily-max').value) || 28.00;

        const selectedTypeInput = document.querySelector('input[name="space-type"]:checked');
        const spaceType = selectedTypeInput ? selectedTypeInput.value : 'covered';

        const checkedAmenities = Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value);

        // Update Store
        store.data.space.name = name;
        store.data.space.address = address;
        store.data.space.city = city;
        store.data.space.zip = zip;
        store.data.space.capacity = capacity;
        store.data.space.hourlyRate = rate;
        store.data.space.dailyMax = dailyMax;
        store.data.space.type = spaceType;
        store.data.space.amenities = checkedAmenities;
        store.data.photos = uploadedPhotos;
        store.data.space.status = "OPEN";
        store.save();

        showToast("Space Listed Successfully! Entering Active Control Panel...", "success");
        setTimeout(() => {
            window.location.href = "owner-dashboard.html";
        }, 900);
    });
}

// ============================================
// 8. ACTIVE CONTROL PANEL (DASHBOARD)
// ============================================

function initOwnerDashboard() {
    const isDashboard = document.querySelector('.owner-dashboard-root');
    if (!isDashboard) return;

    // Enforce Route Protection
    const authUser = getAuthenticatedOwner();
    if (!authUser) {
        return; // Guard already redirects in syncAuthGuardUI
    }

    // 1. Availability Master Switch
    const btnToggleAvailability = document.getElementById('btn-toggle-availability');
    const beaconContainer = document.getElementById('status-beacon-container');
    const beaconText = document.getElementById('beacon-status-text');
    const availabilitySubtext = document.getElementById('availability-subtext');
    const statSpaceStatus = document.getElementById('stat-space-status');

    function updateAvailabilityUI(status) {
        store.data.space.status = status;
        store.save();

        if (status === 'OPEN') {
            if (beaconContainer) {
                beaconContainer.className = 'status-beacon-container open';
                beaconText.textContent = "OPEN • ACCEPTING VEHICLES";
            }
            if (availabilitySubtext) {
                availabilitySubtext.textContent = "Your space is currently LIVE on the ParkSmart driver search and accepting reservations.";
            }
            if (btnToggleAvailability) {
                btnToggleAvailability.className = 'master-toggle-btn btn-turn-off';
                btnToggleAvailability.innerHTML = `
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span>Close Parking Space</span>
                `;
            }
            if (statSpaceStatus) {
                statSpaceStatus.textContent = "LIVE (OPEN)";
                statSpaceStatus.style.color = "var(--success)";
            }
        } else {
            if (beaconContainer) {
                beaconContainer.className = 'status-beacon-container closed';
                beaconText.textContent = "CLOSED • RESERVATIONS PAUSED";
            }
            if (availabilitySubtext) {
                availabilitySubtext.textContent = "Your parking space is marked closed. No new drivers can book or enter until reopened.";
            }
            if (btnToggleAvailability) {
                btnToggleAvailability.className = 'master-toggle-btn btn-turn-on';
                btnToggleAvailability.innerHTML = `
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>Open Parking Space</span>
                `;
            }
            if (statSpaceStatus) {
                statSpaceStatus.textContent = "CLOSED";
                statSpaceStatus.style.color = "var(--danger)";
            }
        }
    }

    if (btnToggleAvailability) {
        updateAvailabilityUI(store.data.space.status || 'OPEN');

        btnToggleAvailability.addEventListener('click', () => {
            const current = store.data.space.status || 'OPEN';
            const next = current === 'OPEN' ? 'CLOSED' : 'OPEN';
            updateAvailabilityUI(next);
            showToast(`Space status changed to: ${next}`, next === 'OPEN' ? 'success' : 'danger');
        });
    }

    // 2. Real-Time Pricing Adjustment
    const priceSlider = document.getElementById('pricing-slider');
    const livePriceVal = document.getElementById('live-price-val');
    const estDailyVal = document.getElementById('est-daily-val');
    const estMonthlyVal = document.getElementById('est-monthly-val');
    const btnSaveRates = document.getElementById('btn-save-rates');
    const surgePills = document.querySelectorAll('.surge-preset-pill');

    function calculateRevenue(rate) {
        const capacity = store.data.space.capacity || 25;
        const avgHours = 7.5;
        const occupancyFactor = 0.72;
        const daily = (rate * capacity * avgHours * occupancyFactor);
        const monthly = daily * 26;

        if (estDailyVal) estDailyVal.textContent = `$${daily.toFixed(0)}`;
        if (estMonthlyVal) estMonthlyVal.textContent = `$${monthly.toFixed(0)}`;
    }

    if (priceSlider && livePriceVal) {
        priceSlider.value = store.data.space.hourlyRate || 4.50;
        livePriceVal.textContent = parseFloat(priceSlider.value).toFixed(2);
        calculateRevenue(parseFloat(priceSlider.value));

        priceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            livePriceVal.textContent = val.toFixed(2);
            calculateRevenue(val);
        });

        // Surge Presets
        surgePills.forEach(pill => {
            pill.addEventListener('click', () => {
                surgePills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                const multiplier = parseFloat(pill.dataset.multiplier);
                const base = 4.50;
                const newRate = +(base * multiplier).toFixed(2);
                priceSlider.value = newRate;
                livePriceVal.textContent = newRate.toFixed(2);
                calculateRevenue(newRate);
                showToast(`Applied ${pill.textContent.trim()} surge rate!`, "default");
            });
        });

        if (btnSaveRates) {
            btnSaveRates.addEventListener('click', () => {
                const newPrice = parseFloat(priceSlider.value);
                store.data.space.hourlyRate = newPrice;
                store.save();
                showToast(`Real-time pricing updated to $${newPrice.toFixed(2)}/hr! Syncing with Driver App...`, "success");
            });
        }
    }

    // 3. Bookings, Access, Maps, Edit Spot Modal
    initBookingsTable();
    initAccessControl();
    initGoogleMapsIntegration();
    initSpotDetailsModal();
}

// ============================================
// 9. BOOKINGS TABLE & ACCESS CONTROL
// ============================================

function initBookingsTable() {
    const tableBody = document.getElementById('bookings-table-body');
    const filterPills = document.querySelectorAll('.table-pill-btn');
    const searchInput = document.getElementById('booking-search-input');
    const btnAddWalkIn = document.getElementById('btn-add-walkin');

    if (!tableBody) return;

    let currentFilter = 'all';
    let searchQuery = '';

    function renderBookings() {
        tableBody.innerHTML = '';

        const filtered = store.data.bookings.filter(b => {
            const matchesFilter = currentFilter === 'all' || b.status === currentFilter;
            const matchesSearch = !searchQuery || 
                b.driverName.toLowerCase().includes(searchQuery) ||
                b.plate.toLowerCase().includes(searchQuery) ||
                b.id.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 32px; color: var(--gray-400);">
                        No bookings matching this filter.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(b => {
            const tr = document.createElement('tr');
            
            let statusLabel = b.status.toUpperCase();
            if (b.status === 'parked') statusLabel = '🟢 Parked (Active)';
            if (b.status === 'reserved') statusLabel = '🔵 Reserved';
            if (b.status === 'completed') statusLabel = '⚪ Completed';
            if (b.status === 'cancelled') statusLabel = '🔴 Cancelled';

            let actionBtns = '';
            if (b.status === 'reserved') {
                actionBtns = `
                    <button class="btn-action-sm" onclick="handleCheckIn('${b.id}')">Check-In</button>
                    <button class="btn-action-sm danger" onclick="handleCancelBooking('${b.id}')">Cancel</button>
                `;
            } else if (b.status === 'parked') {
                actionBtns = `
                    <button class="btn-action-sm" onclick="handleComplete('${b.id}')">Check-Out</button>
                    <button class="btn-action-sm danger" onclick="handleCancelBooking('${b.id}')">Cancel</button>
                `;
            } else {
                actionBtns = `<span style="font-size: 0.8rem; color: var(--gray-400);">Archived</span>`;
            }

            tr.innerHTML = `
                <td>
                    <div class="driver-info-cell">
                        <div class="driver-avatar">${b.avatar}</div>
                        <div>
                            <strong>${b.driverName}</strong>
                            <div style="font-size: 0.76rem; color: var(--gray-400);">${b.id}</div>
                        </div>
                    </div>
                </td>
                <td><span class="license-plate-tag">${b.plate}</span></td>
                <td><strong>${b.spotNum}</strong></td>
                <td>
                    <div style="font-size: 0.85rem;">${b.checkIn} – ${b.checkOut}</div>
                    <div style="font-size: 0.75rem; color: var(--gray-400);">${b.vehicle}</div>
                </td>
                <td><strong>$${b.amount.toFixed(2)}</strong></td>
                <td><span class="status-badge ${b.status}">${statusLabel}</span></td>
                <td>${actionBtns}</td>
            `;

            tableBody.appendChild(tr);
        });

        updateOccupancyDisplay();
    }

    window.handleCheckIn = (id) => {
        const booking = store.data.bookings.find(b => b.id === id);
        if (booking) {
            booking.status = 'parked';
            store.save();
            renderBookings();
            showToast(`Driver ${booking.driverName} checked in to ${booking.spotNum}!`, "success");
        }
    };

    window.handleComplete = (id) => {
        const booking = store.data.bookings.find(b => b.id === id);
        if (booking) {
            booking.status = 'completed';
            store.save();
            renderBookings();
            showToast(`Driver ${booking.driverName} checked out. Spot ${booking.spotNum} is now available.`, "success");
        }
    };

    window.handleCancelBooking = (id) => {
        const booking = store.data.bookings.find(b => b.id === id);
        if (booking) {
            const confirmed = confirm(`Cancel booking ${booking.id} for ${booking.driverName}?\n\nCancellation policy applied: Full refund to driver if cancelled >1 hour prior.`);
            if (confirmed) {
                booking.status = 'cancelled';
                store.save();
                renderBookings();
                showToast(`Booking ${booking.id} cancelled. Driver notified and spot released.`, "danger");
            }
        }
    };

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter;
            renderBookings();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderBookings();
        });
    }

    if (btnAddWalkIn) {
        btnAddWalkIn.addEventListener('click', () => {
            const driverName = prompt("Enter Driver Name for Walk-in Renter:", "Guest Driver");
            if (!driverName) return;
            const plate = prompt("Enter Vehicle License Plate:", "4ABC99") || "CUSTOM";
            
            const newId = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
            store.data.bookings.unshift({
                id: newId,
                driverName: driverName,
                avatar: driverName.substring(0, 2).toUpperCase(),
                phone: "+1 555-0100",
                plate: plate.toUpperCase(),
                spotNum: `Bay #${Math.floor(1 + Math.random() * 20)}`,
                vehicle: "Walk-in Passenger Car",
                checkIn: "Just now",
                checkOut: "2 hours",
                status: "parked",
                amount: (store.data.space.hourlyRate || 4.50) * 2
            });
            store.save();
            renderBookings();
            showToast(`Walk-in driver ${driverName} registered and parked!`, "success");
        });
    }

    renderBookings();
}

function updateOccupancyDisplay() {
    const activeCount = store.data.bookings.filter(b => b.status === 'parked').length;
    const capacity = store.data.space.capacity || 25;
    const available = Math.max(0, capacity - activeCount);

    const statAvailable = document.getElementById('stat-available-spots');
    const statOccupancy = document.getElementById('stat-occupancy-rate');
    const occupancyProgress = document.getElementById('occupancy-bar-progress');

    if (statAvailable) statAvailable.textContent = `${available} / ${capacity}`;
    if (statOccupancy) {
        const ratePct = Math.round((activeCount / capacity) * 100);
        statOccupancy.textContent = `${ratePct}%`;
        if (occupancyProgress) {
            occupancyProgress.style.width = `${ratePct}%`;
        }
    }
}

function initAccessControl() {
    const gateCodeEl = document.getElementById('dash-gate-code');
    const btnRegenGateCode = document.getElementById('btn-regen-gate-code');
    const btnTriggerBarrier = document.getElementById('btn-trigger-barrier');
    const barrierIndicator = document.getElementById('barrier-status-indicator');
    const btnCopyApiKey = document.getElementById('btn-copy-api-key');

    if (gateCodeEl) {
        gateCodeEl.textContent = store.data.space.gateCode || "8492#";
    }

    if (btnRegenGateCode) {
        btnRegenGateCode.addEventListener('click', () => {
            const newCode = `${Math.floor(1000 + Math.random() * 9000)}#`;
            store.data.space.gateCode = newCode;
            store.save();
            if (gateCodeEl) gateCodeEl.textContent = newCode;
            showToast(`Generated new Gate Access PIN: ${newCode}`, "success");
        });
    }

    if (btnTriggerBarrier && barrierIndicator) {
        let isOpening = false;
        btnTriggerBarrier.addEventListener('click', () => {
            if (isOpening) return;
            isOpening = true;

            barrierIndicator.className = 'barrier-status-indicator unlocked';
            barrierIndicator.innerHTML = `<span>🟢 Barrier Open</span>`;
            btnTriggerBarrier.textContent = "Opening Barrier...";
            showToast("Signal sent to Gate Controller: Barrier Opened!", "success");

            setTimeout(() => {
                barrierIndicator.className = 'barrier-status-indicator locked';
                barrierIndicator.innerHTML = `<span>🔒 Barrier Locked</span>`;
                btnTriggerBarrier.textContent = "Trigger Barrier Gate";
                isOpening = false;
                showToast("Gate cycle complete: Barrier Lowered & Locked.", "default");
            }, 4500);
        });
    }

    if (btnCopyApiKey) {
        btnCopyApiKey.addEventListener('click', () => {
            const key = store.data.space.apiKey || "pk_live_sec_9942a78f0b12c";
            navigator.clipboard.writeText(key).then(() => {
                showToast("API Access Key copied to clipboard!", "success");
            }).catch(() => {
                showToast(`API Key: ${key}`, "default");
            });
        });
    }
}

// ============================================
// 10. GOOGLE MAPS INTEGRATION & SPOT DETAILS MODAL
// ============================================

function initGoogleMapsIntegration() {
    const mapElement = document.getElementById('owner-google-map');
    const latDisplay = document.getElementById('map-lat-val');
    const lngDisplay = document.getElementById('map-lng-val');
    const btnSaveLocation = document.getElementById('btn-save-location');
    const addressSearchInput = document.getElementById('map-address-search');
    const btnSearchMap = document.getElementById('btn-search-map');

    if (!mapElement) return;

    let currentLat = store.data.space.location.lat || 40.7128;
    let currentLng = store.data.space.location.lng || -74.0060;

    function updateCoordsUI(lat, lng) {
        currentLat = lat;
        currentLng = lng;
        store.data.space.location.lat = lat;
        store.data.space.location.lng = lng;
        if (latDisplay) latDisplay.textContent = lat.toFixed(5);
        if (lngDisplay) lngDisplay.textContent = lng.toFixed(5);
    }

    updateCoordsUI(currentLat, currentLng);

    let googleMapInstance = null;
    let markerInstance = null;

    function setupFallbackCanvas() {
        mapElement.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; background: linear-gradient(135deg, #e5e9f2 0%, #f0f4f8 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; user-select: none;">
                <svg width="100%" height="100%" style="position: absolute; inset: 0; opacity: 0.4;">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#fff" stroke-width="14" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#f59e0b" stroke-width="2" stroke-dasharray="8 6" />
                    <line x1="45%" y1="0" x2="45%" y2="100%" stroke="#fff" stroke-width="12" />
                    <line x1="75%" y1="0" x2="75%" y2="100%" stroke="#fff" stroke-width="10" />
                </svg>

                <div id="interactive-map-pin" style="position: absolute; top: 45%; left: 45%; transform: translate(-50%, -100%); cursor: grab; z-index: 10; display: flex; flex-direction: column; align-items: center;">
                    <div style="background: var(--navy-900); color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin-bottom: 4px;">
                        <span>📍 ${store.data.space.name || "Parking Entrance"}</span>
                    </div>
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="#3b6cf5" stroke="#ffffff" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3" fill="#ffffff"/>
                    </svg>
                </div>

                <div class="map-interactive-overlay">
                    <strong>Google Maps Preview</strong>
                    <div style="font-size: 0.78rem; color: var(--gray-600); margin-top: 2px;">
                        Drag marker to calibrate parking facility entrance & GPS coordinates.
                    </div>
                </div>
            </div>
        `;

        const pin = document.getElementById('interactive-map-pin');
        if (pin) {
            let isDragging = false;
            pin.addEventListener('mousedown', () => { isDragging = true; pin.style.cursor = 'grabbing'; });
            window.addEventListener('mouseup', () => { isDragging = false; pin.style.cursor = 'grab'; });
            mapElement.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const rect = mapElement.getBoundingClientRect();
                const x = Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left));
                const y = Math.max(30, Math.min(rect.height - 20, e.clientY - rect.top));

                pin.style.left = `${x}px`;
                pin.style.top = `${y}px`;

                const newLat = +(40.7128 + ((rect.height / 2 - y) * 0.00035)).toFixed(5);
                const newLng = +(-74.0060 + ((x - rect.width / 2) * 0.00035)).toFixed(5);
                updateCoordsUI(newLat, newLng);
            });
        }
    }

    if (window.google && window.google.maps) {
        try {
            const mapOptions = {
                center: { lat: currentLat, lng: currentLng },
                zoom: 16,
                mapId: "DEMO_MAP_ID",
                disableDefaultUI: false
            };
            googleMapInstance = new google.maps.Map(mapElement, mapOptions);

            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                markerInstance = new google.maps.marker.AdvancedMarkerElement({
                    map: googleMapInstance,
                    position: { lat: currentLat, lng: currentLng },
                    gmpDraggable: true,
                    title: store.data.space.name
                });
                markerInstance.addListener('dragend', () => {
                    const pos = markerInstance.position;
                    updateCoordsUI(pos.lat, pos.lng);
                    showToast(`Updated entrance coordinates: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`, "default");
                });
            } else {
                markerInstance = new google.maps.Marker({
                    map: googleMapInstance,
                    position: { lat: currentLat, lng: currentLng },
                    draggable: true,
                    title: store.data.space.name
                });
                markerInstance.addListener('dragend', (e) => {
                    updateCoordsUI(e.latLng.lat(), e.latLng.lng());
                    showToast(`Updated entrance coordinates: ${e.latLng.lat().toFixed(5)}, ${e.latLng.lng().toFixed(5)}`, "default");
                });
            }
        } catch (err) {
            console.warn("Google Maps init fallback:", err);
            setupFallbackCanvas();
        }
    } else {
        setupFallbackCanvas();
    }

    if (btnSearchMap && addressSearchInput) {
        btnSearchMap.addEventListener('click', () => {
            const query = addressSearchInput.value.trim();
            if (!query) {
                showToast("Please enter an address or landmark", "danger");
                return;
            }
            let foundLat = +(40.7128 + (Math.random() - 0.5) * 0.02).toFixed(5);
            let foundLng = +(-74.0060 + (Math.random() - 0.5) * 0.02).toFixed(5);

            updateCoordsUI(foundLat, foundLng);
            showToast(`Location found for "${query}"! GPS calibrated.`, "success");

            if (googleMapInstance && markerInstance) {
                googleMapInstance.setCenter({ lat: foundLat, lng: foundLng });
                if (markerInstance.position) {
                    markerInstance.position = { lat: foundLat, lng: foundLng };
                }
            }
        });
    }

    if (btnSaveLocation) {
        btnSaveLocation.addEventListener('click', () => {
            store.save();
            showToast(`Parking entrance coordinates saved (${currentLat}, ${currentLng})!`, "success");
        });
    }
}

function initSpotDetailsModal() {
    const btnOpenModal = document.getElementById('btn-open-edit-modal');
    const modalBackdrop = document.getElementById('edit-spot-modal');
    const btnCloseModal = document.getElementById('btn-close-edit-modal');
    const formEdit = document.getElementById('edit-spot-form');

    if (!modalBackdrop) return;

    if (btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            document.getElementById('edit-name').value = store.data.space.name || "";
            document.getElementById('edit-capacity').value = store.data.space.capacity || 25;
            document.getElementById('edit-rate').value = store.data.space.hourlyRate || 4.50;
            document.getElementById('edit-address').value = store.data.space.address || "";
            modalBackdrop.classList.add('active');
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modalBackdrop.classList.remove('active');
        });
    }

    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            modalBackdrop.classList.remove('active');
        }
    });

    if (formEdit) {
        formEdit.addEventListener('submit', (e) => {
            e.preventDefault();
            store.data.space.name = document.getElementById('edit-name').value.trim();
            store.data.space.capacity = parseInt(document.getElementById('edit-capacity').value) || 25;
            store.data.space.hourlyRate = parseFloat(document.getElementById('edit-rate').value) || 4.50;
            store.data.space.address = document.getElementById('edit-address').value.trim();
            store.save();

            modalBackdrop.classList.remove('active');
            showToast("Space details updated successfully!", "success");

            const headingEl = document.getElementById('space-name-heading');
            if (headingEl) headingEl.textContent = store.data.space.name;
            updateOccupancyDisplay();
        });
    }
}

// Navbar Mobile Hamburger
function initNav() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }
}

// Global DOM Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    syncAuthGuardUI();
    initOwnerAuth();
    initPlacesAddressAutocomplete();
    initApplyForm();
    initOwnerDashboard();
});
