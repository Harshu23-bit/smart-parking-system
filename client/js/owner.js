let authenticatedOwner = null;

let pendingParkingLocation = {
    latitude: null,
    longitude: null,
};

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

async function refreshAuthenticatedOwner() {
    if (
        typeof window === 'undefined' ||
        !window.ParkSmartAPI ||
        !ParkSmartAPI.getAuthToken()
    ) {
        authenticatedOwner = null;
        return null;
    }

    try {
        const result = await ParkSmartAPI.getCurrentUser();
        const user = result?.user;

        if (!user || user.role !== 'owner') {
            ParkSmartAPI.logoutOwner();
            authenticatedOwner = null;
            return null;
        }

        authenticatedOwner = user;
        return user;
    } catch (error) {
        ParkSmartAPI.logoutOwner();
        authenticatedOwner = null;
        return null;
    }
}

function getAuthenticatedOwner() {
    return authenticatedOwner;
}

function clearOwnerSession() {
    if (window.ParkSmartAPI) {
        ParkSmartAPI.logoutOwner();
    }

    authenticatedOwner = null;
}

function getOwnerInitials(name) {
    return (name || 'SO')
        .split(' ')
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

// ============================================
// 2. EMAIL OTP VERIFICATION UI
// ============================================

function removeOtpVerificationDialog() {
    document.getElementById('owner-otp-overlay')?.remove();
}

function showOtpVerificationDialog(email) {
    removeOtpVerificationDialog();

    const overlay = document.createElement('div');

    overlay.id = 'owner-otp-overlay';

    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(15, 23, 42, 0.72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;

    overlay.innerHTML = `
        <div style="
            width: min(430px, 100%);
            background: #ffffff;
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 24px 70px rgba(0,0,0,.28);
        ">

            <h2 style="margin:0 0 8px;">
                Verify your email
            </h2>

            <p style="
                margin:0 0 20px;
                color:#64748b;
                line-height:1.5;
            ">
                Enter the 6-digit verification code for
                <strong>${email || 'your account'}</strong>.
            </p>

            <form id="owner-otp-form">

                <input
                    id="owner-otp-code"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    required
                    style="
                        box-sizing:border-box;
                        width:100%;
                        padding:14px 16px;
                        border:1px solid #cbd5e1;
                        border-radius:10px;
                        font-size:1.25rem;
                        letter-spacing:.35rem;
                        text-align:center;
                        margin-bottom:14px;
                    "
                >

                <button
                    type="submit"
                    style="
                        width:100%;
                        padding:13px 16px;
                        border:0;
                        border-radius:10px;
                        font-weight:700;
                        cursor:pointer;
                    "
                >
                    Verify Email
                </button>

            </form>

            <button
                id="owner-resend-otp"
                type="button"
                style="
                    width:100%;
                    margin-top:10px;
                    padding:11px 16px;
                    border:0;
                    background:transparent;
                    cursor:pointer;
                    font-weight:600;
                "
            >
                Resend code
            </button>

            <button
                id="owner-close-otp"
                type="button"
                style="
                    width:100%;
                    padding:8px 16px;
                    border:0;
                    background:transparent;
                    color:#64748b;
                    cursor:pointer;
                "
            >
                Close
            </button>

        </div>
    `;

    document.body.appendChild(overlay);

    const form =
        document.getElementById('owner-otp-form');

    const codeInput =
        document.getElementById('owner-otp-code');

    if (codeInput) {
        codeInput.value = '';
    }

    const resendButton =
        document.getElementById('owner-resend-otp');

    const closeButton =
        document.getElementById('owner-close-otp');

    codeInput?.focus();

    form?.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();

            const otp =
                codeInput.value.trim();

            if (!/^\d{6}$/.test(otp)) {
                showToast(
                    'Enter a valid 6-digit verification code.',
                    'danger'
                );

                return;
            }

            try {
                const result =
                    await ParkSmartAPI.verifyAccountOtp(
                        otp
                    );

                showToast(
                    result.message ||
                    'Email verified successfully.',
                    'success'
                );

                removeOtpVerificationDialog();

                await syncAuthGuardUI();

                const applySection =
                    document.getElementById(
                        'apply-section'
                    );

                if (applySection) {
                    applySection.scrollIntoView({
                        behavior: 'smooth'
                    });
                }

            } catch (error) {

                showToast(
                    error.message ||
                    'Email verification failed.',
                    'danger'
                );
            }
        }
    );

    resendButton?.addEventListener(
        'click',
        async () => {

            try {
                const result =
                    await ParkSmartAPI.sendVerificationOtp(
                        "email"
                    );

                showToast(
                    result.message ||
                    'Verification code generated.',
                    'success'
                );

            } catch (error) {

                showToast(
                    error.message ||
                    'Unable to resend verification code.',
                    'danger'
                );
            }
        }
    );

    closeButton?.addEventListener(
        'click',
        () => {

            removeOtpVerificationDialog();
        }
    );
}



// ============================================
// 4. TOAST NOTIFICATIONS
// ============================================

function showToast(
    message,
    type = 'default'
) {

    let container =
        document.getElementById(
            'owner-toast-container'
        );

    if (!container) {

        container =
            document.createElement(
                'div'
            );

        container.id =
            'owner-toast-container';

        container.className =
            'owner-toast-container';

        document.body.appendChild(
            container
        );
    }

    const toast =
        document.createElement(
            'div'
        );

    toast.className =
        `owner-toast ${type}`;

    let icon =
        '🔔';

    if (type === 'success') {
        icon = '✅';
    }

    if (type === 'danger') {
        icon = '⚠️';
    }

    toast.innerHTML =
        `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(
        toast
    );

    setTimeout(
        () => {

            toast.style.opacity =
                '0';

            toast.style.transform =
                'translateY(15px)';

            toast.style.transition =
                'all 0.3s ease';

            setTimeout(
                () => toast.remove(),
                300
            );

        },
        3500
    );
}

// ============================================
// 5. AUTHENTICATION GUARD & DYNAMIC UI
// ============================================

async function syncAuthGuardUI() {

    const authUser =
        await refreshAuthenticatedOwner();


    const isDashboardPage =
        document.querySelector(
            ".owner-dashboard-root"
        );


    const authSection =
        document.getElementById(
            "auth-section"
        );


    const applySection =
        document.getElementById(
            "apply-section"
        );


    const navDashItem =
        document.getElementById(
            "nav-item-dashboard"
        );


    const navDashBtn =
        document.getElementById(
            "btn-owner-nav-dash"
        );


    const navLoginBtn =
        document.getElementById(
            "btn-owner-nav-login"
        );


    const navProfileContainer =
        document.getElementById(
            "nav-owner-profile"
        );


    const heroActionBtn =
        document.getElementById(
            "hero-btn-action"
        );


    const heroDashBtn =
        document.getElementById(
            "hero-btn-dash"
        );


    // ========================================
    // DASHBOARD AUTH GUARD
    // ========================================

    if (isDashboardPage) {

        if (
            !authUser ||
            authUser.role !== "owner" ||
            !authUser.email_verified
        ) {

            sessionStorage.setItem(
                "parksmart_auth_error",

                !authUser
                    ? "Please sign in with your owner account."
                    : "Please verify your email before accessing the Owner Dashboard."
            );


            window.location.replace(
                "/pages/owner.html#auth-section"
            );


            return false;
        }


        // No top-navbar owner name/avatar/logout here.
        // The owner identity now belongs only to
        // the bottom-left account dock.

        return true;
    }


    // ========================================
    // OWNER PAGE FLASH MESSAGE
    // ========================================

    const flashError =
        sessionStorage.getItem(
            "parksmart_auth_error"
        );


    if (flashError) {

        sessionStorage.removeItem(
            "parksmart_auth_error"
        );


        setTimeout(
            () => {

                showToast(
                    flashError,
                    "danger"
                );

            },
            250
        );
    }


    const isVerifiedOwner =
        Boolean(
            authUser &&
            authUser.role === "owner" &&
            authUser.email_verified
        );


    // ========================================
    // VERIFIED OWNER
    // ========================================

    if (isVerifiedOwner) {

        // Hide login/register
        if (authSection) {
            authSection.style.display =
                "none";
        }


        // Show parking application
        if (applySection) {
            applySection.style.display =
                "";
        }


        // Hide normal login nav button
        if (navLoginBtn) {
            navLoginBtn.style.display =
                "none";
        }


        if (navProfileContainer) {

            navProfileContainer.style.display =
                "block";


            const ownerName =
                authUser.name ||
                "Parking Owner";


            const initials =
                getOwnerInitials(
                    ownerName
                );


            const avatar =
                document.getElementById(
                    "owner-navbar-avatar"
                );


            const menuAvatar =
                document.getElementById(
                    "owner-navbar-menu-avatar"
                );


            const menuName =
                document.getElementById(
                    "owner-navbar-menu-name"
                );


            if (avatar) {

                avatar.textContent =
                    initials;
            }


            if (menuAvatar) {

                menuAvatar.textContent =
                    initials;
            }


            if (menuName) {

                menuName.textContent =
                    ownerName;
            }
        }


        // Show dashboard links
        if (navDashItem) {
            navDashItem.style.display =
                "list-item";
        }


        if (navDashBtn) {
            navDashBtn.style.display =
                "inline-flex";
        }


        if (heroDashBtn) {
            heroDashBtn.style.display =
                "inline-flex";
        }


        if (heroActionBtn) {

            heroActionBtn.textContent =
                "List a Parking Space ↓";

            heroActionBtn.href =
                "#apply-section";
        }


        return true;
    }


    // ========================================
    // NOT LOGGED IN / NOT VERIFIED
    // ========================================

    // Show login/register
    if (authSection) {
        authSection.style.display =
            "";
    }


    // Hide parking application completely
    if (applySection) {
        applySection.style.display =
            "none";
    }


    // Hide dashboard links
    if (navDashItem) {
        navDashItem.style.display =
            "none";
    }


    if (navDashBtn) {
        navDashBtn.style.display =
            "none";
    }


    if (heroDashBtn) {
        heroDashBtn.style.display =
            "none";
    }


    // Show normal owner login nav link
    if (navLoginBtn) {
        navLoginBtn.style.display =
            "inline-flex";
    }


    // Do not inject user identity in navbar
    if (navProfileContainer) {

        navProfileContainer.style.display =
            "none";

        navProfileContainer.innerHTML =
            "";
    }


    if (heroActionBtn) {

        heroActionBtn.textContent =
            authUser
                ? "Verify Email to Continue ↓"
                : "Sign In to Start Listing ↓";

        heroActionBtn.href =
            "#auth-section";
    }


    return false;
}

// ============================================
// 6. OWNER AUTHENTICATION CONTROLLER
// REAL EXPRESS API
// ============================================

function initForgotPassword() {

    const openButton =
        document.getElementById(
            "owner-forgot-password"
        );


    const overlay =
        document.getElementById(
            "forgot-password-overlay"
        );


    if (
        !openButton ||
        !overlay
    ) {
        return;
    }


    const closeButton =
        document.getElementById(
            "forgot-password-close"
        );


    const description =
        document.getElementById(
            "forgot-password-description"
        );


    const emailForm =
        document.getElementById(
            "forgot-password-email-form"
        );


    const otpForm =
        document.getElementById(
            "forgot-password-otp-form"
        );


    const newPasswordForm =
        document.getElementById(
            "forgot-password-new-form"
        );


    let resetEmail =
        "";


    let resetToken =
        "";


    function closeResetDialog() {

        overlay.style.display =
            "none";


        document.body.style.overflow =
            "";


        emailForm.style.display =
            "";


        otpForm.style.display =
            "none";


        newPasswordForm.style.display =
            "none";


        resetEmail =
            "";


        resetToken =
            "";
    }


    openButton.addEventListener(
        "click",
        event => {

            event.preventDefault();


            const loginEmail =
                document
                    .getElementById(
                        "owner-login-email"
                    )
                    ?.value
                    .trim();


            const resetEmailInput =
                document.getElementById(
                    "forgot-password-email"
                );


            if (
                resetEmailInput &&
                loginEmail
            ) {
                resetEmailInput.value =
                    loginEmail;
            }


            overlay.style.display =
                "block";


            document.body.style.overflow =
                "hidden";
        }
    );


    closeButton?.addEventListener(
        "click",
        closeResetDialog
    );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {
                closeResetDialog();
            }
        }
    );


    emailForm?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            resetEmail =
                document
                    .getElementById(
                        "forgot-password-email"
                    )
                    .value
                    .trim()
                    .toLowerCase();


            try {

                const result =
                    await ParkSmartAPI
                        .forgotPassword(
                            resetEmail
                        );


                showToast(
                    result.message ||
                    "Reset code sent.",
                    "success"
                );


                emailForm.style.display =
                    "none";


                otpForm.style.display =
                    "";


                if (description) {

                    description.textContent =
                        "Enter the 6-digit password reset code sent to your email.";
                }


                document
                    .getElementById(
                        "forgot-password-otp"
                    )
                    ?.focus();


            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to send reset code.",
                    "danger"
                );
            }
        }
    );


    otpForm?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const otp =
                document
                    .getElementById(
                        "forgot-password-otp"
                    )
                    .value
                    .trim();


            if (
                !/^\d{6}$/.test(
                    otp
                )
            ) {

                showToast(
                    "Enter a valid 6-digit reset code.",
                    "danger"
                );

                return;
            }


            try {

                const result =
                    await ParkSmartAPI
                        .verifyResetOtp(
                            resetEmail,
                            otp
                        );


                resetToken =
                    result.reset_token;


                otpForm.style.display =
                    "none";


                newPasswordForm.style.display =
                    "";


                if (description) {

                    description.textContent =
                        "Create a new password for your ParkSmart account.";
                }


                document
                    .getElementById(
                        "forgot-password-new"
                    )
                    ?.focus();


            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to verify reset code.",
                    "danger"
                );
            }
        }
    );


    newPasswordForm
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const password =
                    document
                        .getElementById(
                            "forgot-password-new"
                        )
                        .value;


                const confirmPassword =
                    document
                        .getElementById(
                            "forgot-password-confirm"
                        )
                        .value;


                if (
                    password.length < 8
                ) {

                    showToast(
                        "Password must contain at least 8 characters.",
                        "danger"
                    );

                    return;
                }


                if (
                    password !==
                    confirmPassword
                ) {

                    showToast(
                        "Passwords do not match.",
                        "danger"
                    );

                    return;
                }


                try {

                    const result =
                        await ParkSmartAPI
                            .resetPassword(
                                resetToken,
                                password
                            );


                    closeResetDialog();


                    showToast(
                        result.message ||
                        "Password reset successfully.",
                        "success"
                    );


                    const loginEmail =
                        document
                            .getElementById(
                                "owner-login-email"
                            );


                    if (loginEmail) {
                        loginEmail.value =
                            resetEmail;
                    }


                    document
                        .getElementById(
                            "owner-login-password"
                        )
                        ?.focus();


                } catch (error) {

                    showToast(
                        error.message ||
                        "Unable to reset password.",
                        "danger"
                    );
                }
            }
        );
}

function initOwnerAuth() {

    const tabLogin =
        document.getElementById(
            'auth-tab-login'
        );

    const tabRegister =
        document.getElementById(
            'auth-tab-register'
        );

    const formLogin =
        document.getElementById(
            'owner-login-form'
        );

    const formRegister =
        document.getElementById(
            'owner-register-form'
        );

    // ========================================
    // LOGIN / REGISTER TAB SWITCHING
    // ========================================

    if (
        tabLogin &&
        tabRegister &&
        formLogin &&
        formRegister
    ) {

        tabLogin.addEventListener(
            'click',
            () => {

                tabLogin.classList.add(
                    'active'
                );

                tabRegister.classList.remove(
                    'active'
                );

                formLogin.style.display =
                    'block';

                formRegister.style.display =
                    'none';
            }
        );

        tabRegister.addEventListener(
            'click',
            () => {

                tabRegister.classList.add(
                    'active'
                );

                tabLogin.classList.remove(
                    'active'
                );

                formRegister.style.display =
                    'block';

                formLogin.style.display =
                    'none';
            }
        );
    }

    // ========================================
    // PASSWORD VISIBILITY BUTTONS
    // ========================================

    document
        .querySelectorAll(
            '.password-toggle-btn'
        )
        .forEach(
            btn => {

                btn.addEventListener(
                    'click',
                    () => {

                        const input =
                            btn.previousElementSibling;

                        if (!input) {
                            return;
                        }

                        if (
                            input.type ===
                            'password'
                        ) {

                            input.type =
                                'text';

                            btn.textContent =
                                '🙈';

                        } else {

                            input.type =
                                'password';

                            btn.textContent =
                                '👁️';
                        }
                    }
                );
            }
        );

    // ========================================
    // REAL OWNER LOGIN
    // ========================================

    if (formLogin) {

        formLogin.addEventListener(
            'submit',
            async (event) => {

                event.preventDefault();

                const email =
                    document
                        .getElementById(
                            'owner-login-email'
                        )
                        ?.value
                        .trim();

                const password =
                    document
                        .getElementById(
                            'owner-login-password'
                        )
                        ?.value;

                if (
                    !email ||
                    !password
                ) {

                    showToast(
                        'Please enter both email and password.',
                        'danger'
                    );

                    return;
                }

                try {

                    const result =
                        await ParkSmartAPI.loginOwner(
                            email,
                            password
                        );

                    // ====================================
                    // UNVERIFIED ACCOUNT
                    // ====================================

                    if (
                        !result.user
                            ?.email_verified
                    ) {

                        try {

                            await ParkSmartAPI.sendVerificationOtp(
                                "email"
                            );

                        } catch (error) {

                            // 429 means an OTP
                            // already exists recently.

                            if (
                                error.status !==
                                429
                            ) {

                                throw error;
                            }
                        }

                        await syncAuthGuardUI();

                        showToast(
                            'Login successful. Verify your email to continue.',
                            'success'
                        );

                        showOtpVerificationDialog(
                            result.user.email
                        );

                        return;
                    }

                    // ====================================
                    // VERIFIED OWNER
                    // ====================================

                    showToast(
                        `Welcome back, ${
                            result.user.name ||
                            'Space Owner'
                        }!`,
                        'success'
                    );

                    await syncAuthGuardUI();

                    const applySection =
                        document.getElementById(
                            'apply-section'
                        );

                    if (applySection) {

                        applySection.scrollIntoView({
                            behavior:
                                'smooth'
                        });
                    }

                } catch (error) {

                    showToast(
                        error.message ||
                        'Unable to sign in.',
                        'danger'
                    );
                }
            }
        );
    }

    // ========================================
    // REAL OWNER REGISTRATION
    // ========================================

    if (formRegister) {

        formRegister.addEventListener(
            'submit',
            async (event) => {

                event.preventDefault();

                const name =
                    document
                        .getElementById(
                            'reg-name'
                        )
                        ?.value
                        .trim();

                const email =
                    document
                        .getElementById(
                            'reg-email'
                        )
                        ?.value
                        .trim();

                const phone =
                    document
                        .getElementById(
                            'reg-phone'
                        )
                        ?.value
                        .trim();

                const password =
                    document
                        .getElementById(
                            'reg-password'
                        )
                        ?.value;

                if (
                    !name ||
                    !email ||
                    !password
                ) {

                    showToast(
                        'Please complete all required fields.',
                        'danger'
                    );

                    return;
                }

                try {

                    const registration =
                        await ParkSmartAPI
                            .registerOwner({
                                name,
                                email,
                                phone,
                                password
                            });

                    showToast(
                        registration.message ||
                        'Owner account created.',
                        'success'
                    );

                    // Login immediately after
                    // successful registration so
                    // the OTP endpoint has a JWT.

                    const login =
                        await ParkSmartAPI
                            .loginOwner(
                                email,
                                password
                            );

                    await syncAuthGuardUI();

                    if (
                        !login.user
                            ?.email_verified
                    ) {

                        try {

                            await ParkSmartAPI.sendVerificationOtp(
                                "email"
                            );

                        } catch (error) {

                            if (
                                error.status !==
                                429
                            ) {

                                throw error;
                            }
                        }

                        showOtpVerificationDialog(
                            login.user.email
                        );

                        return;
                    }

                    const applySection =
                        document.getElementById(
                            'apply-section'
                        );

                    if (applySection) {

                        applySection.scrollIntoView({
                            behavior:
                                'smooth'
                        });
                    }

                } catch (error) {

                    showToast(
                        error.message ||
                        'Unable to create owner account.',
                        'danger'
                    );
                }
            }
        );
    }
}

// ============================================
// 8. APPLY FOR RENTING / SPACE DETAILS
// ============================================

function initApplyForm() {

    const applyForm =
        document.getElementById(
            'apply-space-form'
        );

    if (!applyForm) {
        return;
    }

    // ========================================
    // PARKING TYPE
    // ========================================

    const typeCards =
        document.querySelectorAll(
            '.type-card'
        );

    typeCards.forEach(
        card => {

            card.addEventListener(
                'click',
                () => {

                    typeCards.forEach(
                        item => {

                            item.classList.remove(
                                'selected'
                            );
                        }
                    );

                    card.classList.add(
                        'selected'
                    );

                    const radio =
                        card.querySelector(
                            'input[type="radio"]'
                        );

                    if (radio) {

                        radio.checked =
                            true;
                    }
                }
            );
        }
    );

    // ========================================
    // PHOTO UPLOAD
    // ========================================

    const dropzone =
        document.getElementById(
            'photo-dropzone'
        );

    const fileInput =
        document.getElementById(
            'space-photo-input'
        );

    const previewGrid =
        document.getElementById(
            'photo-preview-grid'
        );

    let uploadedPhotos = [];

    function renderPhotos() {

    if (!previewGrid) {
        return;
    }


    previewGrid.innerHTML =
        "";


    uploadedPhotos.forEach(
        (
            file,
            index
        ) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "photo-preview-item";


            const image =
                document.createElement(
                    "img"
                );


            const objectUrl =
                URL.createObjectURL(
                    file
                );


            image.src =
                objectUrl;


            image.alt =
                `Parking space photo ${index + 1}`;


            image.onload =
                () => {

                    URL.revokeObjectURL(
                        objectUrl
                    );
                };


            const removeButton =
                document.createElement(
                    "button"
                );


            removeButton.type =
                "button";


            removeButton.className =
                "photo-remove-btn";


            removeButton.textContent =
                "✕";


            removeButton.title =
                "Remove photo";


            removeButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    uploadedPhotos.splice(
                        index,
                        1
                    );


                    renderPhotos();


                    showToast(
                        "Photo removed.",
                        "default"
                    );
                }
            );


            item.append(
                image,
                removeButton
            );


            previewGrid.appendChild(
                item
            );
        }
    );
}

    renderPhotos();

    if (
        dropzone &&
        fileInput
    ) {

        dropzone.addEventListener(
            'click',
            () => {

                fileInput.click();
            }
        );

        dropzone.addEventListener(
            'dragover',
            event => {

                event.preventDefault();

                dropzone.classList.add(
                    'dragover'
                );
            }
        );

        dropzone.addEventListener(
            'dragleave',
            () => {

                dropzone.classList.remove(
                    'dragover'
                );
            }
        );

        dropzone.addEventListener(
            'drop',
            event => {

                event.preventDefault();

                dropzone.classList.remove(
                    'dragover'
                );

                handleFiles(
                    event.dataTransfer.files
                );
            }
        );

        fileInput.addEventListener(
            'change',
            event => {

                handleFiles(
                    event.target.files
                );
            }
        );

        function handleFiles(
            files
        ) {

            const incomingFiles =
                Array.from(
                    files || []
                );


            for (
                const file of
                incomingFiles
            ) {

                if (
                    ![
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                    ].includes(
                        file.type
                    )
                ) {

                    showToast(
                        `${file.name}: only JPG, PNG, and WebP images are allowed.`,
                        "danger"
                    );

                    continue;
                }


                if (
                    file.size >
                    5 * 1024 * 1024
                ) {

                    showToast(
                        `${file.name}: image must be 5 MB or smaller.`,
                        "danger"
                    );

                    continue;
                }


                if (
                    uploadedPhotos.length >=
                    5
                ) {

                    showToast(
                        "You can select a maximum of 5 images while listing a parking space.",
                        "danger"
                    );

                    break;
                }


                uploadedPhotos.push(
                    file
                );
            }


            renderPhotos();
        }
    }

    // ========================================
    // APPLY FORM SUBMISSION
    // ========================================

    applyForm.addEventListener(
    'submit',
    async event => {

        event.preventDefault();

        // ========================================
        // AUTHENTICATION CHECK
        // ========================================

        const authUser =
            await refreshAuthenticatedOwner();

        if (!authUser) {

            showToast(
                "Access denied: please sign in before submitting space details.",
                "danger"
            );

            await syncAuthGuardUI();

            return;
        }

        if (!authUser.email_verified) {

            showToast(
                "Please verify your email before submitting space details.",
                "danger"
            );

            showOtpVerificationDialog(
                authUser.email
            );

            return;
        }


        // ========================================
        // READ FORM VALUES
        // ========================================

        const name =
            document
                .getElementById(
                    'space-name'
                )
                .value
                .trim();

        const address =
            document
                .getElementById(
                    'space-address'
                )
                .value
                .trim();

        const city =
            document
                .getElementById(
                    'space-city'
                )
                .value
                .trim();

        const zip =
            document
                .getElementById(
                    'space-zip'
                )
                .value
                .trim();

        const accessGate =
            document
                .getElementById(
                    'space-access-gate'
                )
                ?.value
                .trim() || null;

        const capacity =
            parseInt(
                document
                    .getElementById(
                        'space-capacity'
                    )
                    .value,
                10
            ) || 0;

        const standardBays =
            parseInt(
                document
                    .getElementById(
                        'space-standard-bays'
                    )
                    ?.value,
                10
            ) || 0;

        const compactBays =
            parseInt(
                document
                    .getElementById(
                        'space-compact-bays'
                    )
                    ?.value,
                10
            ) || 0;

        const evBays =
            parseInt(
                document
                    .getElementById(
                        'space-ev-bays'
                    )
                    ?.value,
                10
            ) || 0;

        const motorcycleBays =
            parseInt(
                document
                    .getElementById(
                        'space-motorcycle-bays'
                    )
                    ?.value,
                10
            ) || 0;

        const scooterBays =
            parseInt(
                document
                    .getElementById(
                        'space-scooter-bays'
                    )
                    ?.value,
                10
            ) || 0;

        const rate =
            parseFloat(
                document
                    .getElementById(
                        'space-rate'
                    )
                    .value
            );

        const dailyMaxInput =
            document
                .getElementById(
                    'space-daily-max'
                )
                ?.value;

        const dailyMax =
            dailyMaxInput
                ? parseFloat(
                    dailyMaxInput
                )
                : null;

        const scheduleType =
            document
                .getElementById(
                    'space-schedule'
                )
                ?.value ||
            '24-7';

        const selectedTypeInput =
            document.querySelector(
                'input[name="space-type"]:checked'
            );

        const spaceType =
            selectedTypeInput
                ? selectedTypeInput.value
                : 'covered';

        const checkedAmenities =
            Array.from(
                document.querySelectorAll(
                    'input[name="amenities"]:checked'
                )
            )
            .map(
                checkbox =>
                    checkbox.value
            );


            // ========================================
            // FRONTEND VALIDATION
            // ========================================

            if (
                pendingParkingLocation.latitude === null ||
                pendingParkingLocation.longitude === null ||
                pendingParkingLocation.latitude < -90 ||
                pendingParkingLocation.latitude > 90 ||
                pendingParkingLocation.longitude < -180 ||
                pendingParkingLocation.longitude > 180
            ) {

                showToast(
                    "Please select a valid parking address from the suggestions.",
                    "danger"
                );

                return;
            }

            if (
                standardBays +
                compactBays +
                evBays +
                motorcycleBays +
                scooterBays >
                capacity
            ) {

                showToast(
                    "The total number of car, EV, motorcycle, and scooter bays cannot exceed the parking capacity.",
                    "danger"
                );

                return;
            }

            if (
                !Number.isFinite(rate) ||
                rate < 0
            ) {

                showToast(
                    "Please enter a valid hourly rate.",
                    "danger"
                );

                return;
            }


            // ========================================
            // BUILD DATABASE PAYLOAD
            // ========================================

            const parkingPayload = {

                name,

                description:
                    null,

                address,

                city,

                postal_code:
                    zip,

                access_gate:
                    accessGate,

                latitude:
                    pendingParkingLocation.latitude,

                longitude:
                    pendingParkingLocation.longitude,

                parking_type:
                    spaceType,

                capacity,

                standard_bays:
                    standardBays,

                compact_bays:
                    compactBays,

                ev_bays:
                    evBays,

                motorcycle_bays:
                    motorcycleBays,

                scooter_bays:
                    scooterBays,

                price_per_hour:
                    rate,

                daily_max:
                    dailyMax,

                schedule_type:
                    scheduleType,

                amenities:
                    checkedAmenities,
            };


            // ========================================
            // SAVE THROUGH EXPRESS API
            // ========================================

            try {

                const result =
                    await ParkSmartAPI
                        .createParkingSpace(
                            parkingPayload
                        );


                const createdParking =
                    result.parking_space;


                if (!createdParking?.id) {

                    throw new Error(
                        "Parking space was created but no parking ID was returned."
                    );
                }


                // ========================================
                // UPLOAD REAL PARKING IMAGES
                // ========================================

                if (
                    uploadedPhotos.length >
                    0
                ) {

                    try {

                        const imageResult =
                            await ParkSmartAPI
                                .uploadOwnerParkingImages(
                                    createdParking.id,
                                    uploadedPhotos
                                );


                        showToast(
                            imageResult.message ||
                            "Parking images uploaded successfully.",
                            "success"
                        );


                    } catch (imageError) {

                        console.error(
                            "Parking created, but image upload failed:",
                            imageError
                        );


                        showToast(
                            "Parking space was created, but some images could not be uploaded. You can add them from the dashboard.",
                            "danger"
                        );
                    }
                }


                showToast(
                    "Parking space listed successfully.",
                    "success"
                );


                window.location.href =
                    `/pages/owner-dashboard.html?space=${encodeURIComponent(
                        createdParking.id
                    )}`;


            } catch (error) {

                console.error(
                    "Parking application submission failed:",
                    error
                );


                showToast(
                    error.message ||
                    "Unable to submit parking space.",
                    "danger"
                );
            }
        }
    );
}

// ============================================
// 9. REAL OWNER DASHBOARD
// ============================================

let ownerParkingSpaces = [];
let activeOwnerParkingSpace = null;
let activeOwnerBookings = [];
let activeBookingFilter = "all";


function parkingTypeLabel(
    type
) {

    const labels = {
        covered:
            "Covered Garage",

        open:
            "Open-Air Parking",

        ev:
            "EV Parking",

        valet:
            "Valet / VIP Parking",
    };

    return labels[type] ||
        type ||
        "Parking Space";
}


function parkingScheduleLabel(
    schedule
) {

    const labels = {
        "24-7":
            "24/7 Access",

        business:
            "Business Hours",

        night:
            "Overnight",

        weekend:
            "Weekends",
    };

    return labels[schedule] ||
        schedule ||
        "";
}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.textContent =
            value;
    }
}

    // ============================================
    // REAL OWNER BOOKING MANAGEMENT
    // ============================================

    function formatOwnerCurrency(
        value
    ) {

        const amount =
            Number(value) || 0;


        return new Intl.NumberFormat(
            "en-IN",
            {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 2,
            }
        ).format(amount);
    }


    function formatOwnerDateTime(
        value
    ) {

        if (!value) {
            return "—";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }


        return date.toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "short",
            }
        );
    }


    function getOwnerBookingDisplayStatus(
        booking
    ) {

        const status =
            String(
                booking.status || ""
            ).toLowerCase();


        if (
            status === "cancelled"
        ) {
            return "cancelled";
        }


        if (
            status === "completed"
        ) {
            return "completed";
        }


        if (
            status === "active"
        ) {
            return "active";
        }


        const now =
            Date.now();


        const start =
            new Date(
                booking.start_time
            ).getTime();


        const end =
            new Date(
                booking.end_time
            ).getTime();


        if (
            Number.isFinite(start) &&
            Number.isFinite(end)
        ) {

            if (
                start <= now &&
                end > now &&
                (
                    status === "confirmed" ||
                    status === "pending"
                )
            ) {
                return "active";
            }


            if (
                start > now &&
                (
                    status === "confirmed" ||
                    status === "pending"
                )
            ) {
                return "upcoming";
            }
        }


        return status || "pending";
    }


    function createBookingBadge(
        text,
        type = "default"
    ) {

        const badge =
            document.createElement(
                "span"
            );


        badge.className =
            `booking-status-badge ${type}`;


        badge.textContent =
            text;


        return badge;
    }


    function getVehicleDescription(
        booking
    ) {

        const manufacturer =
            booking.manufacturer ||
            "";


        const model =
            booking.model ||
            "";


        const vehicleName =
            [
                manufacturer,
                model,
            ]
            .filter(Boolean)
            .join(" ");


        return vehicleName ||
            booking.vehicle_type ||
            "Vehicle";
    }


    function renderOwnerBookings(
        bookings
    ) {

        const body =
            document.getElementById(
                "owner-bookings-table-body"
            );


        const wrapper =
            document.getElementById(
                "owner-bookings-table-wrapper"
            );


        const empty =
            document.getElementById(
                "owner-bookings-empty"
            );


        const count =
            document.getElementById(
                "owner-booking-count"
            );


        if (
            !body ||
            !wrapper ||
            !empty
        ) {
            return;
        }


        body.innerHTML =
            "";


        if (count) {

            count.textContent =
                `${bookings.length} ${
                    bookings.length === 1
                        ? "Booking"
                        : "Bookings"
                }`;
        }


        if (
            bookings.length === 0
        ) {

            wrapper.style.display =
                "none";


            empty.style.display =
                "";


            return;
        }


        empty.style.display =
            "none";


        wrapper.style.display =
            "";


        bookings.forEach(
            booking => {

                const row =
                    document.createElement(
                        "tr"
                    );


                // ====================================
                // DRIVER
                // ====================================

                const driverCell =
                    document.createElement(
                        "td"
                    );


                const driverName =
                    document.createElement(
                        "strong"
                    );


                driverName.textContent =
                    booking.driver_name ||
                    "Driver";


                const driverPhone =
                    document.createElement(
                        "div"
                    );


                driverPhone.className =
                    "booking-secondary-text";


                driverPhone.textContent =
                    booking.driver_phone ||
                    "Phone unavailable";


                driverCell.append(
                    driverName,
                    driverPhone
                );


                // ====================================
                // VEHICLE
                // ====================================

                const vehicleCell =
                    document.createElement(
                        "td"
                    );


                const registration =
                    document.createElement(
                        "strong"
                    );


                registration.textContent =
                    booking.registration_number ||
                    "—";


                const vehicleDescription =
                    document.createElement(
                        "div"
                    );


                vehicleDescription.className =
                    "booking-secondary-text";


                vehicleDescription.textContent =
                    [
                        getVehicleDescription(
                            booking
                        ),
                        booking.color,
                        booking.vehicle_type,
                    ]
                    .filter(Boolean)
                    .join(" • ");


                vehicleCell.append(
                    registration,
                    vehicleDescription
                );


                // ====================================
                // BOOKING REFERENCE
                // ====================================

                const bookingCell =
                    document.createElement(
                        "td"
                    );


                const bookingReference =
                    document.createElement(
                        "strong"
                    );


                bookingReference.textContent =
                    booking.booking_reference ||
                    String(
                        booking.id ||
                        ""
                    ).slice(
                        0,
                        8
                    );


                bookingCell.appendChild(
                    bookingReference
                );


                // ====================================
                // SCHEDULE
                // ====================================

                const scheduleCell =
                    document.createElement(
                        "td"
                    );


                const start =
                    document.createElement(
                        "div"
                    );


                start.textContent =
                    formatOwnerDateTime(
                        booking.start_time
                    );


                const end =
                    document.createElement(
                        "div"
                    );


                end.className =
                    "booking-secondary-text";


                end.textContent =
                    `to ${formatOwnerDateTime(
                        booking.end_time
                    )}`;


                scheduleCell.append(
                    start,
                    end
                );


                // ====================================
                // BAY TYPE
                // ====================================

                const bayCell =
                    document.createElement(
                        "td"
                    );


                bayCell.textContent =
                    booking.reserved_bay_type
                        ? booking
                            .reserved_bay_type
                            .replace(
                                /_/g,
                                " "
                            )
                        : "—";


                // ====================================
                // AMOUNT
                // ====================================

                const amountCell =
                    document.createElement(
                        "td"
                    );


                amountCell.textContent =
                    formatOwnerCurrency(
                        booking.total_amount
                    );


                // ====================================
                // BOOKING STATUS
                // ====================================

                const statusCell =
                    document.createElement(
                        "td"
                    );


                const displayStatus =
                    getOwnerBookingDisplayStatus(
                        booking
                    );


                statusCell.appendChild(
                    createBookingBadge(
                        displayStatus
                            .replace(
                                /_/g,
                                " "
                            )
                            .toUpperCase(),
                        displayStatus
                    )
                );


                // ====================================
                // PAYMENT STATUS
                // ====================================

                const paymentCell =
                    document.createElement(
                        "td"
                    );


                const paymentStatus =
                    String(
                        booking.payment_status ||
                        "unpaid"
                    ).toLowerCase();


                paymentCell.appendChild(
                    createBookingBadge(
                        paymentStatus
                            .replace(
                                /_/g,
                                " "
                            )
                            .toUpperCase(),
                        paymentStatus ===
                            "paid"
                            ? "paid"
                            : paymentStatus
                    )
                );

                // ====================================
                // OWNER ACTIONS
                // ====================================

                const actionCell =
                    document.createElement(
                        "td"
                    );


                const bookingStatus =
                    String(
                        booking.status || ""
                    ).toLowerCase();


                const bookingPaymentStatus =
                    String(
                        booking.payment_status ||
                        ""
                    ).toLowerCase();


                if (
                    bookingStatus ===
                        "confirmed" &&
                    bookingPaymentStatus ===
                        "paid"
                ) {

                    const startButton =
                        document.createElement(
                            "button"
                        );


                    startButton.type =
                        "button";


                    startButton.className =
                        "btn-primary";


                    startButton.textContent =
                        "Start Parking";


                    startButton.dataset
                        .ownerBookingAction =
                        "active";


                    startButton.dataset
                        .bookingId =
                        booking.id;


                    actionCell.appendChild(
                        startButton
                    );

                } else if (
                    bookingStatus ===
                    "active"
                ) {

                    const completeButton =
                        document.createElement(
                            "button"
                        );


                    completeButton.type =
                        "button";


                    completeButton.className =
                        "btn-primary";


                    completeButton.textContent =
                        "Complete";


                    completeButton.dataset
                        .ownerBookingAction =
                        "completed";


                    completeButton.dataset
                        .bookingId =
                        booking.id;


                    actionCell.appendChild(
                        completeButton
                    );

                } else {

                    const noAction =
                        document.createElement(
                            "span"
                        );


                    noAction.className =
                        "booking-secondary-text";


                    if (
                        bookingStatus ===
                            "pending" &&
                        bookingPaymentStatus !==
                            "paid"
                    ) {

                        noAction.textContent =
                            "Awaiting payment";

                    } else if (
                        bookingStatus ===
                        "completed"
                    ) {

                        noAction.textContent =
                            "Completed";

                    } else if (
                        bookingStatus ===
                        "cancelled"
                    ) {

                        noAction.textContent =
                            "Cancelled";

                    } else {

                        noAction.textContent =
                            "—";
                    }


                    actionCell.appendChild(
                        noAction
                    );
                }

                row.append(
                    driverCell,
                    vehicleCell,
                    bookingCell,
                    scheduleCell,
                    bayCell,
                    amountCell,
                    statusCell,
                    paymentCell,
                    actionCell
                );


                body.appendChild(
                    row
                );
            }
        );
    }


    function applyOwnerBookingFilters() {

        const searchInput =
            document.getElementById(
                "owner-booking-search"
            );


        const search =
            String(
                searchInput?.value ||
                ""
            )
            .trim()
            .toLowerCase();


        const filtered =
            activeOwnerBookings.filter(
                booking => {

                    const displayStatus =
                        getOwnerBookingDisplayStatus(
                            booking
                        );


                    const statusMatches =
                        activeBookingFilter ===
                            "all" ||
                        displayStatus ===
                            activeBookingFilter;


                    if (!statusMatches) {
                        return false;
                    }


                    if (!search) {
                        return true;
                    }


                    const searchable =
                        [
                            booking.driver_name,
                            booking.driver_phone,
                            booking.registration_number,
                            booking.manufacturer,
                            booking.model,
                            booking.color,
                            booking.vehicle_type,
                            booking.booking_reference,
                            booking.reserved_bay_type,
                        ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    return searchable.includes(
                        search
                    );
                }
            );


        renderOwnerBookings(
            filtered
        );
    }


    function updateOwnerDashboardMetrics(
        bookings
    ) {

        if (
            !activeOwnerParkingSpace
        ) {
            return;
        }


        const capacity =
            Number(
                activeOwnerParkingSpace
                    .capacity
            ) || 0;


        const now =
            Date.now();


        const activeBookings =
            bookings.filter(
                booking => {

                    if (
                        booking.status ===
                            "cancelled" ||
                        booking.status ===
                            "completed"
                    ) {
                        return false;
                    }


                    const start =
                        new Date(
                            booking.start_time
                        ).getTime();


                    const end =
                        new Date(
                            booking.end_time
                        ).getTime();


                    return (
                        Number.isFinite(
                            start
                        ) &&
                        Number.isFinite(
                            end
                        ) &&
                        start <= now &&
                        end > now
                    );
                }
            );


        const occupied =
            activeBookings.length;


        const available =
            Math.max(
                capacity -
                occupied,
                0
            );


        const occupancyRate =
            capacity > 0
                ? Math.min(
                    Math.round(
                        (
                            occupied /
                            capacity
                        ) *
                        100
                    ),
                    100
                )
                : 0;


        setText(
            "stat-available-spots",
            `${available} / ${capacity}`
        );


        setText(
            "stat-occupancy-rate",
            `${occupancyRate}%`
        );


        const progress =
            document.getElementById(
                "occupancy-bar-progress"
            );


        if (progress) {

            progress.style.width =
                `${occupancyRate}%`;
        }


        // ========================================
        // TODAY'S REAL PAID BOOKING REVENUE
        // ========================================

        const today =
            new Date();


        const todayYear =
            today.getFullYear();

        const todayMonth =
            today.getMonth();

        const todayDate =
            today.getDate();


        const todaysRevenue =
            bookings.reduce(
                (
                    total,
                    booking
                ) => {

                    if (
                        booking.payment_status !==
                        "paid"
                    ) {
                        return total;
                    }


                    const bookingDate =
                        new Date(
                            booking.start_time
                        );


                    if (
                        bookingDate.getFullYear() !==
                            todayYear ||
                        bookingDate.getMonth() !==
                            todayMonth ||
                        bookingDate.getDate() !==
                            todayDate
                    ) {
                        return total;
                    }


                    return total +
                        (
                            Number(
                                booking.total_amount
                            ) || 0
                        );
                },
                0
            );


        setText(
            "stat-today-revenue",
            formatOwnerCurrency(
                todaysRevenue
            )
        );
    }


    async function loadOwnerBookingsForSpace(
        parkingSpaceId
    ) {

        if (!parkingSpaceId) {

            activeOwnerBookings =
                [];


            renderOwnerBookings(
                []
            );


            updateOwnerDashboardMetrics(
                []
            );


            renderOwnerRecentActivity(
                []
            );


            renderOwnerNotifications(
                []
            );


            return;
        }


        const loading =
            document.getElementById(
                "owner-bookings-loading"
            );


        const wrapper =
            document.getElementById(
                "owner-bookings-table-wrapper"
            );


        const empty =
            document.getElementById(
                "owner-bookings-empty"
            );


        if (loading) {
            loading.style.display =
                "";
        }


        if (wrapper) {
            wrapper.style.display =
                "none";
        }


        if (empty) {
            empty.style.display =
                "none";
        }


        try {

            const result =
                await ParkSmartAPI
                    .getOwnerBookings(
                        parkingSpaceId
                    );


            activeOwnerBookings =
                Array.isArray(
                    result.bookings
                )
                    ? result.bookings
                    : [];


            applyOwnerBookingFilters();


            updateOwnerDashboardMetrics(
                activeOwnerBookings
            );


            renderOwnerRecentActivity(
                activeOwnerBookings
            );


            renderOwnerNotifications(
                activeOwnerBookings
            );


        } catch (error) {

            console.error(
                "Unable to load owner bookings:",
                error
            );


            activeOwnerBookings =
                [];


            renderOwnerBookings(
                []
            );


            showToast(
                error.message ||
                "Unable to load bookings.",
                "danger"
            );


        } finally {

            if (loading) {
                loading.style.display =
                    "none";
            }
        }
    }


    // ============================================
    // OWNER EARNINGS & PAYMENT HISTORY
    // ============================================

    function renderOwnerPaymentHistory(
        transactions
    ) {

        const body =
            document.getElementById(
                "owner-payments-table-body"
            );


        const wrapper =
            document.getElementById(
                "owner-payments-table-wrapper"
            );


        const empty =
            document.getElementById(
                "owner-payments-empty"
            );


        if (
            !body ||
            !wrapper ||
            !empty
        ) {
            return;
        }


        body.innerHTML =
            "";


        if (
            !Array.isArray(
                transactions
            ) ||
            transactions.length ===
                0
        ) {

            wrapper.style.display =
                "none";

            empty.style.display =
                "";

            return;
        }


        empty.style.display =
            "none";

        wrapper.style.display =
            "";


        transactions.forEach(
            transaction => {

                const row =
                    document.createElement(
                        "tr"
                    );


                // ====================================
                // BOOKING
                // ====================================

                const bookingCell =
                    document.createElement(
                        "td"
                    );


                const bookingRef =
                    document.createElement(
                        "strong"
                    );


                bookingRef.textContent =
                    transaction.booking_reference ||
                    "—";


                const orderId =
                    document.createElement(
                        "div"
                    );


                orderId.className =
                    "booking-secondary-text";


                orderId.textContent =
                    transaction.provider_order_id ||
                    "No gateway order";


                bookingCell.append(
                    bookingRef,
                    orderId
                );


                // ====================================
                // DRIVER
                // ====================================

                const driverCell =
                    document.createElement(
                        "td"
                    );


                const driverName =
                    document.createElement(
                        "strong"
                    );


                driverName.textContent =
                    transaction.driver_name ||
                    "Driver";


                const driverPhone =
                    document.createElement(
                        "div"
                    );


                driverPhone.className =
                    "booking-secondary-text";


                driverPhone.textContent =
                    transaction.driver_phone ||
                    "Phone unavailable";


                driverCell.append(
                    driverName,
                    driverPhone
                );


                // ====================================
                // PARKING
                // ====================================

                const parkingCell =
                    document.createElement(
                        "td"
                    );


                parkingCell.textContent =
                    transaction.parking_space_name ||
                    "—";


                // ====================================
                // AMOUNT
                // ====================================

                const amountCell =
                    document.createElement(
                        "td"
                    );


                amountCell.textContent =
                    formatOwnerCurrency(
                        transaction.amount
                    );


                // ====================================
                // PAYMENT METHOD
                // ====================================

                const methodCell =
                    document.createElement(
                        "td"
                    );


                const method =
                    String(
                        transaction.payment_method ||
                        "—"
                    )
                        .replace(
                            /_/g,
                            " "
                        );


                methodCell.textContent =
                    method === "—"
                        ? "—"
                        : method
                            .charAt(0)
                            .toUpperCase() +
                        method.slice(1);


                // ====================================
                // PAID AT
                // ====================================

                const paidAtCell =
                    document.createElement(
                        "td"
                    );


                paidAtCell.textContent =
                    transaction.paid_at
                        ? formatOwnerDateTime(
                            transaction.paid_at
                        )
                        : "Not paid";


                // ====================================
                // STATUS
                // ====================================

                const statusCell =
                    document.createElement(
                        "td"
                    );


                const paymentStatus =
                    String(
                        transaction.status ||
                        "created"
                    )
                        .trim()
                        .toLowerCase();


                statusCell.appendChild(
                    createBookingBadge(
                        paymentStatus
                            .replace(
                                /_/g,
                                " "
                            )
                            .toUpperCase(),

                        paymentStatus ===
                            "paid"
                            ? "paid"
                            : paymentStatus
                    )
                );


                row.append(
                    bookingCell,
                    driverCell,
                    parkingCell,
                    amountCell,
                    methodCell,
                    paidAtCell,
                    statusCell
                );


                body.appendChild(
                    row
                );
            }
        );
    }


    async function loadOwnerEarningsForSpace(
        parkingSpaceId
    ) {

        if (!parkingSpaceId) {

            setText(
                "owner-today-earnings",
                formatOwnerCurrency(0)
            );

            setText(
                "owner-month-earnings",
                formatOwnerCurrency(0)
            );

            setText(
                "owner-total-paid-revenue",
                formatOwnerCurrency(0)
            );

            setText(
                "owner-payment-count",
                "0 Paid Transactions"
            );

            renderOwnerPaymentHistory(
                []
            );

            return;
        }


        const loading =
            document.getElementById(
                "owner-payments-loading"
            );


        const wrapper =
            document.getElementById(
                "owner-payments-table-wrapper"
            );


        const empty =
            document.getElementById(
                "owner-payments-empty"
            );


        if (loading) {
            loading.style.display =
                "";
        }


        if (wrapper) {
            wrapper.style.display =
                "none";
        }


        if (empty) {
            empty.style.display =
                "none";
        }


        try {

            const result =
                await ParkSmartAPI
                    .getOwnerEarnings(
                        parkingSpaceId
                    );


            const summary =
                result.summary ||
                {};


            const transactions =
                Array.isArray(
                    result.transactions
                )
                    ? result.transactions
                    : [];


            setText(
                "owner-today-earnings",
                formatOwnerCurrency(
                    summary.today_earnings
                )
            );


            setText(
                "owner-month-earnings",
                formatOwnerCurrency(
                    summary.month_earnings
                )
            );


            setText(
                "owner-total-paid-revenue",
                formatOwnerCurrency(
                    summary.total_paid_revenue
                )
            );


            const paidCount =
                Number(
                    summary
                        .paid_transaction_count
                ) || 0;


            setText(
                "owner-payment-count",

                `${paidCount} Paid ${
                    paidCount === 1
                        ? "Transaction"
                        : "Transactions"
                }`
            );


            // Keep the dashboard's top revenue
            // metric consistent with the real
            // payment ledger.

            setText(
                "stat-today-revenue",
                formatOwnerCurrency(
                    summary.today_earnings
                )
            );


            renderOwnerPaymentHistory(
                transactions
            );


        } catch (error) {

            console.error(
                "Unable to load owner earnings:",
                error
            );


            renderOwnerPaymentHistory(
                []
            );


            showToast(
                error.message ||
                "Unable to load earnings.",
                "danger"
            );


        } finally {

            if (loading) {
                loading.style.display =
                    "none";
            }
        }
    }


    function initOwnerBookingFilters() {

        const searchInput =
            document.getElementById(
                "owner-booking-search"
            );


        searchInput?.addEventListener(
            "input",
            applyOwnerBookingFilters
        );


        document
            .querySelectorAll(
                "[data-booking-filter]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            document
                                .querySelectorAll(
                                    "[data-booking-filter]"
                                )
                                .forEach(
                                    item =>
                                        item.classList
                                            .remove(
                                                "active"
                                            )
                                );


                            button.classList.add(
                                "active"
                            );


                            activeBookingFilter =
                                button.dataset
                                    .bookingFilter ||
                                "all";


                            applyOwnerBookingFilters();
                        }
                    );
                }
            );
    }

function initOwnerBookingActions() {

    const tableBody =
        document.getElementById(
            "owner-bookings-table-body"
        );


    if (!tableBody) {
        return;
    }


    tableBody.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-owner-booking-action]"
                );


            if (!button) {
                return;
            }


            const bookingId =
                button.dataset
                    .bookingId;


            const nextStatus =
                button.dataset
                    .ownerBookingAction;


            if (
                !bookingId ||
                !nextStatus
            ) {
                return;
            }


            try {

                button.disabled =
                    true;


                const originalText =
                    button.textContent;


                button.textContent =
                    nextStatus ===
                    "active"
                        ? "Starting..."
                        : "Completing...";


                const result =
                    await ParkSmartAPI
                        .updateOwnerBookingStatus(
                            bookingId,
                            nextStatus
                        );


                showToast(
                    result.message ||
                    "Booking updated.",
                    "success"
                );


                if (
                    activeOwnerParkingSpace
                        ?.id
                ) {

                    await loadOwnerBookingsForSpace(
                        activeOwnerParkingSpace.id
                    );
                }


                button.textContent =
                    originalText;


            } catch (error) {

                button.disabled =
                    false;


                showToast(
                    error.message ||
                    "Unable to update booking.",
                    "danger"
                );
            }
        }
    );
}

function updateOwnerSiteHealth() {

    const parking =
        activeOwnerParkingSpace;


    if (!parking) {
        return;
    }


    const availabilityDot =
        document.getElementById(
            "health-availability-dot"
        );


    const availabilityText =
        document.getElementById(
            "health-availability-text"
        );


    const capacityDot =
        document.getElementById(
            "health-capacity-dot"
        );


    const capacityText =
        document.getElementById(
            "health-capacity-text"
        );


    const locationDot =
        document.getElementById(
            "health-location-dot"
        );


    const locationText =
        document.getElementById(
            "health-location-text"
        );


    const pricingDot =
        document.getElementById(
            "health-pricing-dot"
        );


    const pricingText =
        document.getElementById(
            "health-pricing-text"
        );


    const overallStatus =
        document.getElementById(
            "site-health-status"
        );


    // Availability

    availabilityDot
        ?.classList.toggle(
            "good",
            Boolean(
                parking.is_available
            )
        );


    availabilityDot
        ?.classList.toggle(
            "warning",
            !parking.is_available
        );


    if (availabilityText) {

        availabilityText.textContent =
            parking.is_available
                ? "Open and accepting reservations"
                : "Reservations are currently paused";
    }


    // Capacity

    const capacity =
        Number(
            parking.capacity
        ) || 0;


    capacityDot
        ?.classList.toggle(
            "good",
            capacity > 0
        );


    capacityDot
        ?.classList.toggle(
            "warning",
            capacity <= 0
        );


    if (capacityText) {

        capacityText.textContent =
            capacity > 0
                ? `${capacity} configured parking bays`
                : "Parking capacity requires attention";
    }


    // Location

    const hasLocation =
        Number.isFinite(
            Number(
                parking.latitude
            )
        ) &&
        Number.isFinite(
            Number(
                parking.longitude
            )
        );


    locationDot
        ?.classList.toggle(
            "good",
            hasLocation
        );


    locationDot
        ?.classList.toggle(
            "warning",
            !hasLocation
        );


    if (locationText) {

        locationText.textContent =
            hasLocation
                ? "Verified geographic coordinates available"
                : "Location coordinates are missing";
    }


    // Pricing

    const hourlyRate =
        Number(
            parking.price_per_hour
        );


    const hasPricing =
        Number.isFinite(
            hourlyRate
        ) &&
        hourlyRate >= 0;


    pricingDot
        ?.classList.toggle(
            "good",
            hasPricing
        );


    pricingDot
        ?.classList.toggle(
            "warning",
            !hasPricing
        );


    if (pricingText) {

        pricingText.textContent =
            hasPricing
                ? `₹${hourlyRate.toFixed(2)} per hour`
                : "Pricing has not been configured";
    }


    const healthy =
        Boolean(
            parking.is_available
        ) &&
        capacity > 0 &&
        hasLocation &&
        hasPricing;


    if (overallStatus) {

        overallStatus.textContent =
            healthy
                ? "Operational"
                : "Needs Attention";


        overallStatus.classList.toggle(
            "healthy",
            healthy
        );


        overallStatus.classList.toggle(
            "warning",
            !healthy
        );
    }
}

function renderOwnerNotifications(
    bookings
) {

    const list =
        document.getElementById(
            "owner-notification-list"
        );


    const count =
        document.getElementById(
            "owner-notification-count"
        );


    if (!list) {
        return;
    }


    const items =
        Array.isArray(
            bookings
        )
            ? [...bookings]
            : [];


    items.sort(
        (a, b) => {

            const newer =
                new Date(
                    b.updated_at ||
                    b.created_at ||
                    b.start_time ||
                    0
                ).getTime();


            const older =
                new Date(
                    a.updated_at ||
                    a.created_at ||
                    a.start_time ||
                    0
                ).getTime();


            return newer - older;
        }
    );


    const recent =
        items.slice(
            0,
            5
        );


    if (count) {

        if (recent.length > 0) {

            count.style.display =
                "grid";

            count.textContent =
                recent.length;

        } else {

            count.style.display =
                "none";
        }
    }


    if (recent.length === 0) {

        list.innerHTML = `

            <div class="owner-notification-empty">
                No recent notifications.
            </div>

        `;

        return;
    }


    list.innerHTML =
        recent
            .map(
                booking => {

                    const status =
                        String(
                            booking.status ||
                            ""
                        )
                        .toLowerCase();


                    const paymentStatus =
                        String(
                            booking.payment_status ||
                            ""
                        )
                        .toLowerCase();


                    let title =
                        "Booking activity";


                    if (
                        paymentStatus ===
                        "paid"
                    ) {

                        title =
                            "₹ Payment received";

                    } else if (
                        status ===
                        "active"
                    ) {

                        title =
                            "🚗 Parking started";

                    } else if (
                        status ===
                        "completed"
                    ) {

                        title =
                            "✓ Booking completed";

                    } else if (
                        status ===
                        "cancelled"
                    ) {

                        title =
                            "Booking cancelled";

                    } else {

                        title =
                            "New booking";
                    }


                    const reference =
                        booking.booking_reference ||
                        String(
                            booking.id ||
                            ""
                        )
                        .slice(
                            0,
                            8
                        );


                    return `

                        <div class="owner-notification-item">

                            <strong>
                                ${escapeHtml(
                                    title
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    reference
                                )}
                            </span>

                        </div>

                    `;
                }
            )
            .join("");
}

function renderOwnerRecentActivity(
    bookings
) {

    const container =
        document.getElementById(
            "owner-activity-list"
        );


    const count =
        document.getElementById(
            "owner-activity-count"
        );


    if (!container) {
        return;
    }


    const items =
        Array.isArray(
            bookings
        )
            ? [...bookings]
            : [];


    items.sort(
        (a, b) => {

            const first =
                new Date(
                    b.updated_at ||
                    b.created_at ||
                    b.start_time ||
                    0
                ).getTime();


            const second =
                new Date(
                    a.updated_at ||
                    a.created_at ||
                    a.start_time ||
                    0
                ).getTime();


            return first - second;
        }
    );


    const recent =
        items.slice(
            0,
            20
        );


    if (count) {

        count.textContent =
            `${recent.length} ${
                recent.length === 1
                    ? "Event"
                    : "Events"
            }`;
    }


    if (
        recent.length === 0
    ) {

        container.innerHTML = `

            <div class="owner-activity-empty">
                No recent booking activity yet.
            </div>

        `;

        return;
    }


    container.innerHTML =
        recent
            .map(
                booking => {

                    const status =
                        String(
                            booking.status ||
                            "pending"
                        )
                        .toLowerCase();


                    const paymentStatus =
                        String(
                            booking.payment_status ||
                            ""
                        )
                        .toLowerCase();


                    let icon =
                        "🅿";


                    let title =
                        "Booking updated";


                    if (
                        status ===
                        "active"
                    ) {

                        icon =
                            "🚗";

                        title =
                            "Parking started";

                    } else if (
                        status ===
                        "completed"
                    ) {

                        icon =
                            "✓";

                        title =
                            "Parking completed";

                    } else if (
                        status ===
                        "cancelled"
                    ) {

                        icon =
                            "✕";

                        title =
                            "Booking cancelled";

                    } else if (
                        paymentStatus ===
                        "paid"
                    ) {

                        icon =
                            "₹";

                        title =
                            "Payment received";

                    } else {

                        icon =
                            "＋";

                        title =
                            "New booking";
                    }


                    const reference =
                        booking.booking_reference ||
                        String(
                            booking.id ||
                            ""
                        ).slice(
                            0,
                            8
                        );


                    const timestamp =
                        booking.updated_at ||
                        booking.created_at ||
                        booking.start_time;


                    return `

                        <div class="owner-activity-item">

                            <div class="owner-activity-icon">
                                ${icon}
                            </div>


                            <div class="owner-activity-content">

                                <strong>
                                    ${escapeHtml(
                                        title
                                    )}
                                </strong>


                                <span>

                                    ${escapeHtml(
                                        reference
                                    )}

                                    ${
                                        booking.driver_name
                                            ? ` • ${escapeHtml(
                                                booking.driver_name
                                            )}`
                                            : ""
                                    }

                                </span>


                                <span class="owner-activity-time">

                                    ${escapeHtml(
                                        formatOwnerDateTime(
                                            timestamp
                                        )
                                    )}

                                </span>

                            </div>

                        </div>

                    `;
                }
            )
            .join("");
}

function renderOwnerParkingSpace(
    parking
) {

    if (!parking) {
        return;
    }

    activeOwnerParkingSpace =
        parking;


    // ========================================
    // HEADER
    // ========================================

    setText(
        "space-name-heading",
        parking.name
    );

    setText(
        "dashboard-facility-id",
        `Facility ID: ${parking.id}`
    );

    setText(
        "dashboard-space-address",
        `📍 ${parking.address}`
    );

    setText(
        "dashboard-space-type",
        `${parkingTypeLabel(
            parking.parking_type
        )} • ${parkingScheduleLabel(
            parking.schedule_type
        )}`
    );

    // ========================================
    // STATUS
    // ========================================

    updateDashboardAvailabilityUI(
        parking.is_available
    );


    // ========================================
    // CAPACITY PLACEHOLDER
    //
    // Real availability / occupancy / revenue
    // are calculated after bookings load.
    // ========================================

    const capacity =
        Number(
            parking.capacity
        ) || 0;


    setText(
        "stat-available-spots",
        `${capacity} / ${capacity}`
    );


    setText(
        "stat-occupancy-rate",
        "0%"
    );


    setText(
        "stat-today-revenue",
        formatOwnerCurrency(0)
    );


    const progress =
        document.getElementById(
            "occupancy-bar-progress"
        );


    if (progress) {
        progress.style.width =
            "0%";
    }


    // ========================================
    // PRICING
    // ========================================

    const hourlyRate =
        Number(
            parking.price_per_hour
        ) || 0;

    const slider =
        document.getElementById(
            "pricing-slider"
        );

    const livePrice =
        document.getElementById(
            "live-price-val"
        );

    const basePreset =
        document.getElementById(
            "base-price-preset"
        );

    if (slider) {
        slider.value =
            hourlyRate;
    }

    if (livePrice) {
        livePrice.textContent =
            hourlyRate.toFixed(2);
    }

    if (basePreset) {
        basePreset.textContent =
            `Base (₹${hourlyRate.toFixed(0)})`;
    }


    // ========================================
    // LOCATION DETAILS
    // ========================================

    setText(
        "detail-location-address",
        parking.address || "—"
    );

    setText(
        "detail-location-city",
        [
            parking.city,
            parking.postal_code,
        ]
        .filter(Boolean)
        .join(" • ") ||
        "—"
    );

    const lat =
        Number(
            parking.latitude
        );

    const lng =
        Number(
            parking.longitude
        );

    setText(
        "detail-location-coordinates",
        Number.isFinite(lat) &&
        Number.isFinite(lng)
            ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            : "—"
    );

    setText(
        "detail-access-gate",
        parking.access_gate ||
        "Not specified"
    );


    // ========================================
    // VEHICLE CAPACITY
    // ========================================

    setText(
        "detail-standard-bays",
        Number(
            parking.standard_bays
        ) || 0
    );

    setText(
        "detail-compact-bays",
        Number(
            parking.compact_bays
        ) || 0
    );

    setText(
        "detail-ev-bays",
        Number(
            parking.ev_bays
        ) || 0
    );

    setText(
        "detail-motorcycle-bays",
        Number(
            parking.motorcycle_bays
        ) || 0
    );

    setText(
        "detail-scooter-bays",
        Number(
            parking.scooter_bays
        ) || 0
    );

    /*
    * Update the operational health card
    * using the parking site that was just rendered.
    */
    updateOwnerSiteHealth();

}


function updateDashboardAvailabilityUI(
    isAvailable
) {

    const status =
        Boolean(
            isAvailable
        );

    const beaconContainer =
        document.getElementById(
            "status-beacon-container"
        );

    const beaconText =
        document.getElementById(
            "beacon-status-text"
        );

    const subtext =
        document.getElementById(
            "availability-subtext"
        );

    const button =
        document.getElementById(
            "btn-toggle-availability"
        );

    const metric =
        document.getElementById(
            "stat-space-status"
        );

    const liveChip =
        document.getElementById(
            "owner-live-chip"
        );


    const liveText =
        document.getElementById(
            "owner-live-text"
        );


    const liveDot =
        document.getElementById(
            "owner-live-dot"
        );

    if (status) {

        if (beaconContainer) {
            beaconContainer.className =
                "status-beacon-container open";
        }

        if (beaconText) {
            beaconText.textContent =
                "OPEN • ACCEPTING VEHICLES";
        }

        if (subtext) {
            subtext.textContent =
                "Your parking space is open and available for reservations.";
        }

        if (button) {

            button.className =
                "master-toggle-btn btn-turn-off";

            button.innerHTML =
                "<span>Close Parking Space</span>";
        }

        if (metric) {

            metric.textContent =
                "LIVE (OPEN)";

            metric.style.color =
                "var(--success)";
        }

    } else {

        if (beaconContainer) {
            beaconContainer.className =
                "status-beacon-container closed";
        }

        if (beaconText) {
            beaconText.textContent =
                "CLOSED • RESERVATIONS PAUSED";
        }

        if (subtext) {
            subtext.textContent =
                "This parking space is currently unavailable for new reservations.";
        }

        if (button) {

            button.className =
                "master-toggle-btn btn-turn-on";

            button.innerHTML =
                "<span>Open Parking Space</span>";
        }

        if (metric) {

            metric.textContent =
                "CLOSED";

            metric.style.color =
                "var(--danger)";
        }
    }


    // ========================================
    // HEADER LIVE / CLOSED CHIP
    // ========================================

    if (liveChip) {

        liveChip.classList.toggle(
            "closed",
            !status
        );
    }


    if (liveText) {

        liveText.textContent =
            status
                ? "LIVE"
                : "CLOSED";
    }


    if (liveDot) {

        liveDot.classList.toggle(
            "closed",
            !status
        );
    }
}


function updateRevenueProjection(
    rate,
    capacity
) {

    // This is explicitly only a projection,
    // not recorded earnings.

    const estimatedOccupancy =
        0.50;

    const averageHours =
        4;

    const daily =
        rate *
        capacity *
        estimatedOccupancy *
        averageHours;

    const monthly =
        daily *
        30;

    setText(
        "est-daily-val",
        `₹${Math.round(
            daily
        ).toLocaleString(
            "en-IN"
        )}`
    );

    setText(
        "est-monthly-val",
        `₹${Math.round(
            monthly
        ).toLocaleString(
            "en-IN"
        )}`
    );
}


function updateOperatingHoursRowUI(
    row
) {

    if (!row) {
        return;
    }


    const closedInput =
        row.querySelector(
            ".operating-closed"
        );


    const openInput =
        row.querySelector(
            ".operating-open"
        );


    const closeInput =
        row.querySelector(
            ".operating-close"
        );


    const fullDayInput =
        row.querySelector(
            ".operating-24-hours"
        );


    const statusText =
        row.querySelector(
            ".day-status-text"
        );


    const isClosed =
        Boolean(
            closedInput?.checked
        );


    const is24Hours =
        Boolean(
            fullDayInput?.checked
        );


    if (statusText) {

        statusText.textContent =
            isClosed
                ? "Closed"
                : "Open";
    }


    row.classList.toggle(
        "closed-day",
        isClosed
    );


    if (fullDayInput) {

        fullDayInput.disabled =
            isClosed;
    }


    if (openInput) {

        openInput.disabled =
            isClosed ||
            is24Hours;
    }


    if (closeInput) {

        closeInput.disabled =
            isClosed ||
            is24Hours;
    }
}


function updateOperatingHoursSummary() {

    const rows =
        Array.from(
            document.querySelectorAll(
                ".operating-hours-row"
            )
        );


    const summary =
        document.getElementById(
            "operating-hours-summary"
        );


    if (
        !summary ||
        rows.length === 0
    ) {
        return;
    }


    const openRows =
        rows.filter(
            row =>
                !row.querySelector(
                    ".operating-closed"
                )?.checked
        );


    const all24 =
        openRows.length ===
            7 &&
        openRows.every(
            row =>
                row.querySelector(
                    ".operating-24-hours"
                )?.checked
        );


    if (all24) {

        summary.textContent =
            "Open 24/7";

        return;
    }


    const closedCount =
        rows.length -
        openRows.length;


    if (
        closedCount === 0
    ) {

        summary.textContent =
            "Open Every Day";

    } else {

        summary.textContent =
            `${openRows.length} Open • ${closedCount} Closed`;
    }
}


async function loadOwnerOperatingHours(
    parkingId
) {

    if (!parkingId) {
        return;
    }


    try {

        const result =
            await ParkSmartAPI
                .getOwnerOperatingHours(
                    parkingId
                );


        const hours =
            Array.isArray(
                result.operating_hours
            )
                ? result.operating_hours
                : [];


        hours.forEach(
            day => {

                const row =
                    document.querySelector(
                        `.operating-hours-row[data-day="${day.day_of_week}"]`
                    );


                if (!row) {
                    return;
                }


                const openInput =
                    row.querySelector(
                        ".operating-open"
                    );


                const closeInput =
                    row.querySelector(
                        ".operating-close"
                    );


                const closedInput =
                    row.querySelector(
                        ".operating-closed"
                    );


                const fullDayInput =
                    row.querySelector(
                        ".operating-24-hours"
                    );


                const isClosed =
                    Boolean(
                        day.is_closed
                    );


                const opening =
                    day.opening_time
                        ? String(
                            day.opening_time
                        ).slice(
                            0,
                            5
                        )
                        : "";


                const closing =
                    day.closing_time
                        ? String(
                            day.closing_time
                        ).slice(
                            0,
                            5
                        )
                        : "";


                const is24Hours =
                    !isClosed &&
                    opening === "00:00" &&
                    closing === "00:00";


                if (closedInput) {

                    closedInput.checked =
                        isClosed;
                }


                if (fullDayInput) {

                    fullDayInput.checked =
                        is24Hours;
                }


                if (openInput) {

                    openInput.value =
                        opening ||
                        "06:00";
                }


                if (closeInput) {

                    closeInput.value =
                        closing ||
                        "22:00";
                }


                updateOperatingHoursRowUI(
                    row
                );
            }
        );


        updateOperatingHoursSummary();


    } catch (error) {

        showToast(
            error.message ||
            "Unable to load operating hours.",
            "danger"
        );
    }
}


function initOwnerOperatingHours() {

    const list =
        document.getElementById(
            "owner-operating-hours-list"
        );


    const saveButton =
        document.getElementById(
            "btn-save-operating-hours"
        );


    if (
        !list ||
        !saveButton
    ) {
        return;
    }


    const rows =
        () =>
            Array.from(
                list.querySelectorAll(
                    ".operating-hours-row"
                )
            );


    // ========================================
    // DAY OPEN / CLOSED
    // ========================================

    list.addEventListener(
        "change",
        event => {

            const row =
                event.target.closest(
                    ".operating-hours-row"
                );


            if (!row) {
                return;
            }


            if (
                event.target.classList
                    .contains(
                        "operating-closed"
                    )
            ) {

                updateOperatingHoursRowUI(
                    row
                );


                updateOperatingHoursSummary();

                return;
            }


            if (
                event.target.classList
                    .contains(
                        "operating-24-hours"
                    )
            ) {

                if (
                    event.target.checked
                ) {

                    const openInput =
                        row.querySelector(
                            ".operating-open"
                        );


                    const closeInput =
                        row.querySelector(
                            ".operating-close"
                        );


                    if (openInput) {
                        openInput.value =
                            "00:00";
                    }


                    if (closeInput) {
                        closeInput.value =
                            "00:00";
                    }
                }


                updateOperatingHoursRowUI(
                    row
                );


                updateOperatingHoursSummary();
            }
        }
    );


    // ========================================
    // QUICK ACTION: OPEN 24/7
    // ========================================

    document
        .getElementById(
            "hours-set-24-7"
        )
        ?.addEventListener(
            "click",
            () => {

                rows().forEach(
                    row => {

                        const closed =
                            row.querySelector(
                                ".operating-closed"
                            );


                        const fullDay =
                            row.querySelector(
                                ".operating-24-hours"
                            );


                        const open =
                            row.querySelector(
                                ".operating-open"
                            );


                        const close =
                            row.querySelector(
                                ".operating-close"
                            );


                        if (closed) {
                            closed.checked =
                                false;
                        }


                        if (fullDay) {
                            fullDay.checked =
                                true;
                        }


                        if (open) {
                            open.value =
                                "00:00";
                        }


                        if (close) {
                            close.value =
                                "00:00";
                        }


                        updateOperatingHoursRowUI(
                            row
                        );
                    }
                );


                updateOperatingHoursSummary();
            }
        );


    // ========================================
    // QUICK ACTION: BUSINESS HOURS
    // ========================================

    document
        .getElementById(
            "hours-business"
        )
        ?.addEventListener(
            "click",
            () => {

                rows().forEach(
                    row => {

                        const day =
                            Number(
                                row.dataset.day
                            );


                        const weekday =
                            day >= 1 &&
                            day <= 5;


                        const closed =
                            row.querySelector(
                                ".operating-closed"
                            );


                        const fullDay =
                            row.querySelector(
                                ".operating-24-hours"
                            );


                        const open =
                            row.querySelector(
                                ".operating-open"
                            );


                        const close =
                            row.querySelector(
                                ".operating-close"
                            );


                        if (closed) {
                            closed.checked =
                                !weekday;
                        }


                        if (fullDay) {
                            fullDay.checked =
                                false;
                        }


                        if (open) {
                            open.value =
                                "06:00";
                        }


                        if (close) {
                            close.value =
                                "22:00";
                        }


                        updateOperatingHoursRowUI(
                            row
                        );
                    }
                );


                updateOperatingHoursSummary();
            }
        );


    // ========================================
    // QUICK ACTION: CLOSE WEEKENDS
    // ========================================

    document
        .getElementById(
            "hours-close-weekends"
        )
        ?.addEventListener(
            "click",
            () => {

                rows().forEach(
                    row => {

                        const day =
                            Number(
                                row.dataset.day
                            );


                        if (
                            day !== 0 &&
                            day !== 6
                        ) {
                            return;
                        }


                        const closed =
                            row.querySelector(
                                ".operating-closed"
                            );


                        if (closed) {

                            closed.checked =
                                true;
                        }


                        updateOperatingHoursRowUI(
                            row
                        );
                    }
                );


                updateOperatingHoursSummary();
            }
        );


    // ========================================
    // QUICK ACTION: COPY MONDAY
    // ========================================

    document
        .getElementById(
            "hours-copy-monday"
        )
        ?.addEventListener(
            "click",
            () => {

                const monday =
                    list.querySelector(
                        '.operating-hours-row[data-day="1"]'
                    );


                if (!monday) {
                    return;
                }


                const mondayClosed =
                    monday.querySelector(
                        ".operating-closed"
                    )?.checked ||
                    false;


                const monday24 =
                    monday.querySelector(
                        ".operating-24-hours"
                    )?.checked ||
                    false;


                const mondayOpen =
                    monday.querySelector(
                        ".operating-open"
                    )?.value ||
                    "06:00";


                const mondayClose =
                    monday.querySelector(
                        ".operating-close"
                    )?.value ||
                    "22:00";


                rows().forEach(
                    row => {

                        const day =
                            Number(
                                row.dataset.day
                            );


                        if (
                            day < 1 ||
                            day > 5
                        ) {
                            return;
                        }


                        const closed =
                            row.querySelector(
                                ".operating-closed"
                            );


                        const fullDay =
                            row.querySelector(
                                ".operating-24-hours"
                            );


                        const open =
                            row.querySelector(
                                ".operating-open"
                            );


                        const close =
                            row.querySelector(
                                ".operating-close"
                            );


                        if (closed) {
                            closed.checked =
                                mondayClosed;
                        }


                        if (fullDay) {
                            fullDay.checked =
                                monday24;
                        }


                        if (open) {
                            open.value =
                                mondayOpen;
                        }


                        if (close) {
                            close.value =
                                mondayClose;
                        }


                        updateOperatingHoursRowUI(
                            row
                        );
                    }
                );


                updateOperatingHoursSummary();
            }
        );


    // ========================================
    // SAVE REAL HOURS
    // ========================================

    saveButton.addEventListener(
        "click",
        async () => {

            if (
                !activeOwnerParkingSpace
            ) {

                showToast(
                    "No parking space is selected.",
                    "danger"
                );

                return;
            }


            const operatingHours =
                rows().map(
                    row => {

                        const isClosed =
                            row.querySelector(
                                ".operating-closed"
                            )?.checked ||
                            false;


                        const is24Hours =
                            row.querySelector(
                                ".operating-24-hours"
                            )?.checked ||
                            false;


                        let openingTime =
                            row.querySelector(
                                ".operating-open"
                            )?.value ||
                            null;


                        let closingTime =
                            row.querySelector(
                                ".operating-close"
                            )?.value ||
                            null;


                        if (
                            is24Hours &&
                            !isClosed
                        ) {

                            openingTime =
                                "00:00";

                            closingTime =
                                "00:00";
                        }


                        return {

                            day_of_week:
                                Number(
                                    row.dataset.day
                                ),

                            opening_time:
                                isClosed
                                    ? null
                                    : openingTime,

                            closing_time:
                                isClosed
                                    ? null
                                    : closingTime,

                            is_closed:
                                isClosed,
                        };
                    }
                );


            const invalidDay =
                operatingHours.find(
                    day =>
                        !day.is_closed &&
                        (
                            !day.opening_time ||
                            !day.closing_time
                        )
                );


            if (invalidDay) {

                showToast(
                    "Every open day must have opening and closing times.",
                    "danger"
                );

                return;
            }


            try {

                saveButton.disabled =
                    true;


                saveButton.textContent =
                    "Saving Schedule...";


                const result =
                    await ParkSmartAPI
                        .updateOwnerOperatingHours(
                            activeOwnerParkingSpace.id,
                            operatingHours
                        );


                showToast(
                    result.message ||
                    "Operating hours updated.",
                    "success"
                );


                await loadOwnerOperatingHours(
                    activeOwnerParkingSpace.id
                );


            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to save operating hours.",
                    "danger"
                );


            } finally {

                saveButton.disabled =
                    false;


                saveButton.textContent =
                    "Save Operating Hours";
            }
        }
    );
}


async function loadOwnerParkingImages(
    parkingId
) {

    const grid =
        document.getElementById(
            "owner-parking-images-grid"
        );


    const empty =
        document.getElementById(
            "owner-parking-images-empty"
        );


    const count =
        document.getElementById(
            "owner-parking-image-count"
        );


    if (
        !parkingId ||
        !grid
    ) {
        return;
    }


    try {

        const result =
            await ParkSmartAPI
                .getOwnerParkingImages(
                    parkingId
                );


        const images =
            Array.isArray(
                result.images
            )
                ? result.images
                : [];


        grid.innerHTML =
            "";


        if (count) {

            count.textContent =
                `${images.length} ${
                    images.length === 1
                        ? "Image"
                        : "Images"
                }`;
        }


        if (
            images.length === 0
        ) {

            if (empty) {
                empty.style.display =
                    "";
            }

            return;
        }


        if (empty) {
            empty.style.display =
                "none";
        }


        images.forEach(
            image => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "photo-preview-item";


                item.style.position =
                    "relative";


                const img =
                    document.createElement(
                        "img"
                    );


                img.src =
                    image.image_url;


                img.alt =
                    "Parking facility";


                const controls =
                    document.createElement(
                        "div"
                    );


                controls.style.cssText =
                    `
                    display:flex;
                    gap:8px;
                    margin-top:8px;
                    flex-wrap:wrap;
                    `;


                if (
                    image.is_primary
                ) {

                    const primary =
                        document.createElement(
                            "span"
                        );


                    primary.className =
                        "space-select-pill";


                    primary.textContent =
                        "Primary";


                    controls.appendChild(
                        primary
                    );

                } else {

                    const primaryButton =
                        document.createElement(
                            "button"
                        );


                    primaryButton.type =
                        "button";


                    primaryButton.className =
                        "btn-secondary";


                    primaryButton.textContent =
                        "Set Primary";


                    primaryButton.addEventListener(
                        "click",
                        async () => {

                            try {

                                await ParkSmartAPI
                                    .setPrimaryParkingImage(
                                        parkingId,
                                        image.id
                                    );


                                showToast(
                                    "Primary parking image updated.",
                                    "success"
                                );


                                await loadOwnerParkingImages(
                                    parkingId
                                );


                            } catch (error) {

                                showToast(
                                    error.message ||
                                    "Unable to set primary image.",
                                    "danger"
                                );
                            }
                        }
                    );


                    controls.appendChild(
                        primaryButton
                    );
                }


                const deleteButton =
                    document.createElement(
                        "button"
                    );


                deleteButton.type =
                    "button";


                deleteButton.className =
                    "btn-secondary";


                deleteButton.textContent =
                    "Delete";


                deleteButton.addEventListener(
                    "click",
                    async () => {

                        const confirmed =
                            window.confirm(
                                "Delete this parking image?"
                            );


                        if (!confirmed) {
                            return;
                        }


                        try {

                            const result =
                                await ParkSmartAPI
                                    .deleteOwnerParkingImage(
                                        parkingId,
                                        image.id
                                    );


                            showToast(
                                result.message ||
                                "Parking image deleted.",
                                "success"
                            );


                            await loadOwnerParkingImages(
                                parkingId
                            );


                        } catch (error) {

                            showToast(
                                error.message ||
                                "Unable to delete parking image.",
                                "danger"
                            );
                        }
                    }
                );


                controls.appendChild(
                    deleteButton
                );


                item.append(
                    img,
                    controls
                );


                grid.appendChild(
                    item
                );
            }
        );


    } catch (error) {

        console.error(
            "Unable to load parking images:",
            error
        );


        showToast(
            error.message ||
            "Unable to load parking images.",
            "danger"
        );
    }
}


function initOwnerParkingImages() {

    const input =
        document.getElementById(
            "dashboard-parking-image-input"
        );


    const button =
        document.getElementById(
            "btn-upload-parking-images"
        );


    if (
        !input ||
        !button
    ) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            input.click();
        }
    );


    input.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    input.files || []
                );


            if (
                files.length === 0 ||
                !activeOwnerParkingSpace
            ) {
                return;
            }


            try {

                button.disabled =
                    true;


                button.textContent =
                    "Uploading...";


                const result =
                    await ParkSmartAPI
                        .uploadOwnerParkingImages(
                            activeOwnerParkingSpace.id,
                            files
                        );


                showToast(
                    result.message ||
                    "Parking images uploaded.",
                    "success"
                );


                input.value =
                    "";


                await loadOwnerParkingImages(
                    activeOwnerParkingSpace.id
                );


            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to upload parking images.",
                    "danger"
                );


            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "＋ Add Parking Images";
            }
        }
    );
}


async function initOwnerDashboard() {

    const isDashboard =
        document.querySelector(
            ".owner-dashboard-root"
        );


    if (!isDashboard) {
        return;
    }


    const switchButton =
        document.getElementById(
            "owner-switch-site-button"
        );


    const switcher =
        document.getElementById(
            "owner-site-switcher"
        );


    const switchName =
        document.getElementById(
            "owner-switch-site-name"
        );


    try {

        const result =
            await ParkSmartAPI
                .getOwnerParkingSpaces();


        ownerParkingSpaces =
            Array.isArray(
                result.parking_spaces
            )
                ? result.parking_spaces
                : Array.isArray(
                    result.spaces
                )
                    ? result.spaces
                    : [];


        // ====================================
        // NO PARKING SITES
        // ====================================

        if (
            ownerParkingSpaces.length ===
            0
        ) {

            activeOwnerParkingSpace =
                null;


            setText(
                "space-name-heading",
                "No parking sites listed yet"
            );


            if (switchName) {

                switchName.textContent =
                    "No parking sites";
            }


            if (switchButton) {

                switchButton.disabled =
                    true;
            }


            if (switcher) {

                switcher.innerHTML =
                    "";
            }


            await loadOwnerBookingsForSpace(
                null
            );


            await loadOwnerEarningsForSpace(
                null
            );


            return;
        }


        // ====================================
        // BUILD SITE SWITCHER
        // ====================================

        if (switchButton) {

            switchButton.disabled =
                false;
        }


        if (switcher) {

            switcher.innerHTML =
                ownerParkingSpaces
                    .map(parking => `

                        <button
                            type="button"
                            class="owner-site-switch-item"
                            data-site-id="${escapeHtml(
                                parking.id
                            )}"
                        >

                            <strong>
                                ${escapeHtml(
                                    parking.name ||
                                    "Parking Site"
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    parking.city ||
                                    parking.address ||
                                    ""
                                )}
                            </span>

                        </button>

                    `)
                    .join("");
        }


        // ====================================
        // SELECT ACTIVE SITE
        // ====================================

        const query =
            new URLSearchParams(
                window.location.search
            );


        const requestedId =
            query.get(
                "space"
            );


        let selected =
            ownerParkingSpaces
                .find(
                    parking =>
                        parking.id ===
                        requestedId
                );


        if (!selected) {

            selected =
                ownerParkingSpaces[0];
        }


        if (!selected) {

            throw new Error(
                "No valid parking site could be selected."
            );
        }


        if (switchName) {

            switchName.textContent =
                selected.name ||
                "Parking Site";
        }


        // ====================================
        // LOAD / RENDER ACTIVE SITE
        // ====================================

        async function loadSelectedSite(
            parking,
            {
                updateUrl = true
            } = {}
        ) {

            if (!parking?.id) {
                return;
            }


            activeOwnerParkingSpace =
                parking;


            if (switchName) {

                switchName.textContent =
                    parking.name ||
                    "Parking Site";
            }


            renderOwnerParkingSpace(
                parking
            );


            await Promise.all([
                loadOwnerBookingsForSpace(
                    parking.id
                ),

                loadOwnerOperatingHours(
                    parking.id
                ),

                loadOwnerParkingImages(
                    parking.id
                ),

                loadOwnerEarningsForSpace(
                    parking.id
                ),
            ]);


            if (updateUrl) {

                const url =
                    new URL(
                        window.location.href
                    );


                url.searchParams.set(
                    "space",
                    parking.id
                );


                window.history.replaceState(
                    {},
                    "",
                    url
                );
            }
        }


        await loadSelectedSite(
            selected,
            {
                updateUrl:
                    requestedId !==
                    selected.id
            }
        );


        // ====================================
        // SITE SWITCHER EVENTS
        // ====================================

        switchButton?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                switcher?.classList.toggle(
                    "active"
                );
            }
        );


        switcher
            ?.querySelectorAll(
                ".owner-site-switch-item"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();
                        event.stopPropagation();


                        const siteId =
                            button.dataset.siteId;


                        const parking =
                            ownerParkingSpaces
                                .find(
                                    item =>
                                        item.id ===
                                        siteId
                                );


                        if (!parking) {

                            showToast(
                                "Unable to find that parking site.",
                                "danger"
                            );

                            return;
                        }


                        switcher.classList.remove(
                            "active"
                        );


                        await loadSelectedSite(
                            parking
                        );
                    }
                );
            });


        document.addEventListener(
            "click",
            event => {

                if (
                    switcher &&
                    !switcher.contains(
                        event.target
                    ) &&
                    !switchButton?.contains(
                        event.target
                    )
                ) {

                    switcher.classList.remove(
                        "active"
                    );
                }
            }
        );


        // ====================================
        // LIVE BOOKING REFRESH
        // ====================================

        setInterval(
            async () => {

                if (
                    activeOwnerParkingSpace?.id
                ) {

                    await loadOwnerBookingsForSpace(
                        activeOwnerParkingSpace.id
                    );
                }

            },
            10000
        );


        // ====================================
        // AVAILABILITY
        // ====================================

        const availabilityButton =
            document.getElementById(
                "btn-toggle-availability"
            );


        availabilityButton
            ?.addEventListener(
                "click",
                async () => {

                    if (
                        !activeOwnerParkingSpace
                    ) {
                        return;
                    }


                    const nextState =
                        !activeOwnerParkingSpace
                            .is_available;


                    try {

                        const updated =
                            await ParkSmartAPI
                                .updateParkingAvailability(
                                    activeOwnerParkingSpace
                                        .id,
                                    nextState
                                );


                        const parking =
                            updated.parking_space;


                        if (!parking) {

                            throw new Error(
                                "Updated parking data was not returned."
                            );
                        }


                        Object.assign(
                            activeOwnerParkingSpace,
                            parking
                        );


                        updateDashboardAvailabilityUI(
                            activeOwnerParkingSpace
                                .is_available
                        );


                        updateOwnerSiteHealth();


                        showToast(
                            updated.message ||
                            "Availability updated.",
                            "success"
                        );


                    } catch (error) {

                        showToast(
                            error.message ||
                            "Unable to update availability.",
                            "danger"
                        );
                    }
                }
            );


        // ====================================
        // PRICING
        // ====================================

        const slider =
            document.getElementById(
                "pricing-slider"
            );


        const livePrice =
            document.getElementById(
                "live-price-val"
            );


        const saveButton =
            document.getElementById(
                "btn-save-rates"
            );


        function syncPricingSliderDisplay() {

            if (!slider) {
                return;
            }


            const value =
                Number(
                    slider.value
                );


            if (
                !Number.isFinite(
                    value
                )
            ) {
                return;
            }


            if (livePrice) {

                livePrice.textContent =
                    value.toFixed(2);
            }
        }


        slider?.addEventListener(
            "input",
            syncPricingSliderDisplay
        );


        slider?.addEventListener(
            "change",
            syncPricingSliderDisplay
        );


        document
            .querySelectorAll(
                ".surge-preset-pill"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        if (
                            !activeOwnerParkingSpace ||
                            !slider
                        ) {
                            return;
                        }


                        document
                            .querySelectorAll(
                                ".surge-preset-pill"
                            )
                            .forEach(
                                item =>
                                    item.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        button.classList.add(
                            "active"
                        );


                        const base =
                            Number(
                                activeOwnerParkingSpace
                                    .price_per_hour
                            ) || 0;


                        const multiplier =
                            Number(
                                button.dataset
                                    .multiplier
                            ) || 1;


                        const newPrice =
                            Math.round(
                                base *
                                multiplier
                            );


                        slider.value =
                            newPrice;


                        if (livePrice) {

                            livePrice.textContent =
                                newPrice
                                    .toFixed(2);
                        }
                    }
                );
            });


        saveButton?.addEventListener(
            "click",
            async () => {

                if (
                    !activeOwnerParkingSpace ||
                    !slider
                ) {
                    return;
                }


                const newPrice =
                    Number(
                        slider.value
                    );


                if (
                    !Number.isFinite(
                        newPrice
                    ) ||
                    newPrice < 0
                ) {

                    showToast(
                        "Please enter a valid hourly rate.",
                        "danger"
                    );

                    return;
                }


                try {

                    const result =
                        await ParkSmartAPI
                            .updateParkingPricing(
                                activeOwnerParkingSpace
                                    .id,
                                {
                                    price_per_hour:
                                        newPrice,

                                    daily_max:
                                        activeOwnerParkingSpace
                                            .daily_max,
                                }
                            );


                    if (
                        !result.parking_space
                    ) {

                        throw new Error(
                            "Updated pricing data was not returned."
                        );
                    }


                    Object.assign(
                        activeOwnerParkingSpace,
                        result.parking_space
                    );


                    renderOwnerParkingSpace(
                        activeOwnerParkingSpace
                    );


                    showToast(
                        result.message ||
                        "Pricing updated.",
                        "success"
                    );


                } catch (error) {

                    showToast(
                        error.message ||
                        "Unable to update pricing.",
                        "danger"
                    );
                }
            }
        );


    } catch (error) {

        console.error(
            "Unable to load owner parking spaces:",
            error
        );


        showToast(
            error.message ||
            "Unable to load your parking spaces.",
            "danger"
        );
    }
}


// ============================================
// 15. MOBILE NAVIGATION
// ============================================

function initNav() {

    const hamburger =
        document.getElementById(
            'hamburger'
        );

    const navLinks =
        document.getElementById(
            'nav-links'
        );

    if (
        hamburger &&
        navLinks
    ) {

        hamburger.addEventListener(
            'click',
            () => {

                hamburger.classList.toggle(
                    'active'
                );

                navLinks.classList.toggle(
                    'active'
                );
            }
        );

        navLinks
            .querySelectorAll(
                '.nav-link'
            )
            .forEach(
                link => {

                    link.addEventListener(
                        'click',
                        () => {

                            hamburger.classList.remove(
                                'active'
                            );

                            navLinks.classList.remove(
                                'active'
                            );
                        }
                    );
                }
            );
    }
}

// ============================================
// 16. GLOBAL INITIALIZATION
// ============================================

function initEditParkingSpace() {

    const openButton =
        document.getElementById(
            "menu-edit-space"
        );


    const overlay =
        document.getElementById(
            "edit-space-overlay"
        );


    const closeButton =
        document.getElementById(
            "edit-space-close"
        );


    const cancelButton =
        document.getElementById(
            "edit-space-cancel"
        );


    const form =
        document.getElementById(
            "edit-space-form"
        );


    const saveButton =
        document.getElementById(
            "edit-space-save"
        );


    if (
        !openButton ||
        !overlay ||
        !form
    ) {
        return;
    }


    function closeEditor() {

        overlay.style.display =
            "none";


        document.body.style.overflow =
            "";
    }


    function openEditor() {

        if (
            !activeOwnerParkingSpace
        ) {

            showToast(
                "No parking space is currently selected.",
                "danger"
            );

            return;
        }


        const parking =
            activeOwnerParkingSpace;


        document.getElementById(
            "edit-space-name"
        ).value =
            parking.name || "";


        document.getElementById(
            "edit-space-type"
        ).value =
            parking.parking_type ||
            "covered";


        document.getElementById(
            "edit-space-address"
        ).value =
            parking.address || "";


        document.getElementById(
            "edit-space-city"
        ).value =
            parking.city || "";


        document.getElementById(
            "edit-space-postal-code"
        ).value =
            parking.postal_code || "";


        document.getElementById(
            "edit-space-access-gate"
        ).value =
            parking.access_gate || "";


        document.getElementById(
            "edit-space-schedule"
        ).value =
            parking.schedule_type ||
            "24-7";


        document.getElementById(
            "edit-space-latitude"
        ).value =
            parking.latitude ?? "";


        document.getElementById(
            "edit-space-longitude"
        ).value =
            parking.longitude ?? "";


        document.getElementById(
            "edit-space-capacity"
        ).value =
            Number(
                parking.capacity
            ) || 0;


        document.getElementById(
            "edit-standard-bays"
        ).value =
            Number(
                parking.standard_bays
            ) || 0;


        document.getElementById(
            "edit-compact-bays"
        ).value =
            Number(
                parking.compact_bays
            ) || 0;


        document.getElementById(
            "edit-ev-bays"
        ).value =
            Number(
                parking.ev_bays
            ) || 0;


        document.getElementById(
            "edit-motorcycle-bays"
        ).value =
            Number(
                parking.motorcycle_bays
            ) || 0;


        document.getElementById(
            "edit-scooter-bays"
        ).value =
            Number(
                parking.scooter_bays
            ) || 0;


        document.getElementById(
            "edit-space-rate"
        ).value =
            Number(
                parking.price_per_hour
            ) || 0;


        document.getElementById(
            "edit-space-daily-max"
        ).value =
            parking.daily_max ??
            "";


        overlay.style.display =
            "block";


        document.body.style.overflow =
            "hidden";
    }


    openButton.addEventListener(
        "click",
        () => {

            openEditor();
        }
    );


    closeButton?.addEventListener(
        "click",
        closeEditor
    );


    cancelButton?.addEventListener(
        "click",
        closeEditor
    );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {
                closeEditor();
            }
        }
    );


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (
                !activeOwnerParkingSpace
            ) {
                return;
            }


            const editLatitude =
                document
                    .getElementById(
                        "edit-space-latitude"
                    )
                    .value;

            const editLongitude =
                document
                    .getElementById(
                        "edit-space-longitude"
                    )
                    .value;


            if (
                !editLatitude ||
                !editLongitude
            ) {

                showToast(
                    "Please select a valid address from the suggestions.",
                    "danger"
                );

                return;
            }


            const payload = {

                name:
                    document
                        .getElementById(
                            "edit-space-name"
                        )
                        .value
                        .trim(),

                parking_type:
                    document
                        .getElementById(
                            "edit-space-type"
                        )
                        .value,

                address:
                    document
                        .getElementById(
                            "edit-space-address"
                        )
                        .value
                        .trim(),

                city:
                    document
                        .getElementById(
                            "edit-space-city"
                        )
                        .value
                        .trim(),

                postal_code:
                    document
                        .getElementById(
                            "edit-space-postal-code"
                        )
                        .value
                        .trim(),

                access_gate:
                    document
                        .getElementById(
                            "edit-space-access-gate"
                        )
                        .value
                        .trim(),

                schedule_type:
                    document
                        .getElementById(
                            "edit-space-schedule"
                        )
                        .value,

                latitude:
                    Number(editLatitude),

                longitude:
                    Number(editLongitude),

                capacity:
                    Number(
                        document
                            .getElementById(
                                "edit-space-capacity"
                            )
                            .value
                    ),

                standard_bays:
                    Number(
                        document
                            .getElementById(
                                "edit-standard-bays"
                            )
                            .value
                    ),

                compact_bays:
                    Number(
                        document
                            .getElementById(
                                "edit-compact-bays"
                            )
                            .value
                    ),

                ev_bays:
                    Number(
                        document
                            .getElementById(
                                "edit-ev-bays"
                            )
                            .value
                    ),

                motorcycle_bays:
                    Number(
                        document
                            .getElementById(
                                "edit-motorcycle-bays"
                            )
                            .value
                    ),

                scooter_bays:
                    Number(
                        document
                            .getElementById(
                                "edit-scooter-bays"
                            )
                            .value
                    ),

                price_per_hour:
                    Number(
                        document
                            .getElementById(
                                "edit-space-rate"
                            )
                            .value
                    ),

                daily_max:
                    document
                        .getElementById(
                            "edit-space-daily-max"
                        )
                        .value === ""
                            ? null
                            : Number(
                                document
                                    .getElementById(
                                        "edit-space-daily-max"
                                    )
                                    .value
                            ),
            };


            if (
                !payload.name ||
                !payload.address
            ) {

                showToast(
                    "Parking name and address are required.",
                    "danger"
                );

                return;
            }


            const assignedBays =
                payload.standard_bays +
                payload.compact_bays +
                payload.ev_bays +
                payload.motorcycle_bays +
                payload.scooter_bays;


            if (
                assignedBays >
                payload.capacity
            ) {

                showToast(
                    "Assigned bays cannot exceed total parking capacity.",
                    "danger"
                );

                return;
            }


            try {

                if (saveButton) {

                    saveButton.disabled =
                        true;

                    saveButton.textContent =
                        "Saving...";
                }


                const result =
                    await ParkSmartAPI
                        .updateParkingSpaceDetails(
                            activeOwnerParkingSpace
                                .id,
                            payload
                        );


                const updated =
                    result.parking_space;


                Object.assign(
                    activeOwnerParkingSpace,
                    updated
                );


                const storedParking =
                    ownerParkingSpaces.find(
                        parking =>
                            parking.id ===
                            updated.id
                    );


                if (storedParking) {

                    Object.assign(
                        storedParking,
                        updated
                    );
                }


                const switchName =
                    document.getElementById(
                        "owner-switch-site-name"
                    );


                if (
                    switchName &&
                    activeOwnerParkingSpace?.id ===
                    updated.id
                ) {

                    switchName.textContent =
                        updated.name ||
                        "Parking Site";
                }


                const siteButton =
                    document.querySelector(
                        `.owner-site-switch-item[data-site-id="${updated.id}"]`
                    );


                const siteButtonName =
                    siteButton?.querySelector(
                        "strong"
                    );


                const siteButtonLocation =
                    siteButton?.querySelector(
                        "span"
                    );


                if (siteButtonName) {

                    siteButtonName.textContent =
                        updated.name ||
                        "Parking Site";
                }


                if (siteButtonLocation) {

                    siteButtonLocation.textContent =
                        updated.city ||
                        updated.address ||
                        "";
                }


                renderOwnerParkingSpace(
                    activeOwnerParkingSpace
                );


                await loadOwnerBookingsForSpace(
                    activeOwnerParkingSpace
                        .id
                );


                closeEditor();


                showToast(
                    result.message ||
                    "Parking space updated successfully.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Parking space update failed:",
                    error
                );


                showToast(
                    error.message ||
                    "Unable to update parking space.",
                    "danger"
                );


            } finally {

                if (saveButton) {

                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Save Changes";
                }
            }
        }
    );
}

function initOwnerProfile() {

    const overlay =
        document.getElementById(
            "owner-profile-overlay"
        );


    const form =
        document.getElementById(
            "owner-profile-form"
        );


    const closeButton =
        document.getElementById(
            "owner-profile-close"
        );


    const cancelButton =
        document.getElementById(
            "owner-profile-cancel"
        );


    const saveButton =
        document.getElementById(
            "owner-profile-save"
        );


    const openButtons = [
        document.getElementById(
            "dock-profile"
        ),
        document.getElementById(
            "dock-account-settings"
        ),
        document.getElementById(
            "menu-owner-settings"
        ),
    ].filter(Boolean);


    if (
        !overlay ||
        !form
    ) {
        return;
    }


    function closeProfile() {

        overlay.style.display =
            "none";


        document.body.style.overflow =
            "";
    }


    async function openProfile() {

        try {

            const result =
                await ParkSmartAPI
                    .getCurrentUser();


            const user =
                result.user;


            if (!user) {

                throw new Error(
                    "Unable to load owner account."
                );
            }


            authenticatedOwner =
                user;


            document.getElementById(
                "owner-profile-name"
            ).value =
                user.name || "";


            document.getElementById(
                "owner-profile-email"
            ).value =
                user.email || "";


            document.getElementById(
                "owner-profile-phone"
            ).value =
                user.phone || "";


            const emailStatus =
                document.getElementById(
                    "owner-profile-email-status"
                );


            const phoneStatus =
                document.getElementById(
                    "owner-profile-phone-status"
                );


            if (emailStatus) {

                emailStatus.textContent =
                    user.email_verified
                        ? "✓ Email verified"
                        : "Email not verified";
            }


            if (phoneStatus) {

                phoneStatus.textContent =
                    user.phone_verified
                        ? "✓ Phone verified"
                        : user.phone
                            ? "Phone not verified"
                            : "No phone number added";
            }


            overlay.style.display =
                "block";


            document.body.style.overflow =
                "hidden";


        } catch (error) {

            showToast(
                error.message ||
                "Unable to load owner profile.",
                "danger"
            );
        }
    }


    openButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .getElementById(
                            "owner-account-menu"
                        )
                        ?.classList
                        .remove(
                            "active"
                        );
                    openProfile();
                }
            );
        }
    );


    closeButton?.addEventListener(
        "click",
        closeProfile
    );


    cancelButton?.addEventListener(
        "click",
        closeProfile
    );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {
                closeProfile();
            }
        }
    );


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const name =
                document
                    .getElementById(
                        "owner-profile-name"
                    )
                    .value
                    .trim();


            const phone =
                document
                    .getElementById(
                        "owner-profile-phone"
                    )
                    .value
                    .trim();


            if (
                name.length < 2
            ) {

                showToast(
                    "Please enter a valid owner name.",
                    "danger"
                );

                return;
            }


            try {

                if (saveButton) {

                    saveButton.disabled =
                        true;

                    saveButton.textContent =
                        "Saving...";
                }


                const result =
                    await ParkSmartAPI
                        .updateCurrentUser({
                            name,
                            phone:
                                phone || null,
                        });


                authenticatedOwner =
                    result.user;


                const ownerName =
                    authenticatedOwner.name ||
                    "Parking Owner";


                const initials =
                    getOwnerInitials(
                        ownerName
                    );


                const dockAvatar =
                    document.getElementById(
                        "dock-owner-avatar"
                    );


                const menuAvatar =
                    document.getElementById(
                        "owner-menu-avatar"
                    );


                const menuName =
                    document.getElementById(
                        "owner-menu-name"
                    );


                const accountButton =
                    document.getElementById(
                        "owner-account-button"
                    );


                if (dockAvatar) {
                    dockAvatar.textContent =
                        initials;
                }


                if (menuAvatar) {
                    menuAvatar.textContent =
                        initials;
                }


                if (menuName) {
                    menuName.textContent =
                        ownerName;
                }


                if (accountButton) {
                    accountButton.title =
                        ownerName;
                }


                closeProfile();


                showToast(
                    result.message ||
                    "Profile updated successfully.",
                    "success"
                );


            } catch (error) {

                showToast(
                    error.message ||
                    "Unable to update owner profile.",
                    "danger"
                );


            } finally {

                if (saveButton) {

                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Save Profile";
                }
            }
        }
    );

    const accountView =
        new URLSearchParams(
            window.location.search
        ).get(
            "account"
        );


    if (
        accountView === "profile" ||
        accountView === "settings"
    ) {

        setTimeout(
            () => {

                openProfile();

            },
            150
        );
    }
}

function initOwnerNotifications() {

    const button =
        document.getElementById(
            "owner-notification-button"
        );


    const menu =
        document.getElementById(
            "owner-notification-menu"
        );


    if (
        !button ||
        !menu
    ) {
        return;
    }


    button.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            const isOpen =
                menu.classList.toggle(
                    "active"
                );


            button.setAttribute(
                "aria-expanded",
                String(isOpen)
            );


            document
                .getElementById(
                    "owner-account-menu"
                )
                ?.classList
                .remove(
                    "active"
                );
        }
    );


    menu.addEventListener(
        "click",
        event => {

            event.stopPropagation();
        }
    );


    document.addEventListener(
        "click",
        () => {

            menu.classList.remove(
                "active"
            );


            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}

function initOwnerAccountDock() {

    const button =
        document.getElementById(
            "owner-account-button"
        );


    const menu =
        document.getElementById(
            "owner-account-menu"
        );


    const dockAvatar =
        document.getElementById(
            "dock-owner-avatar"
        );


    const menuAvatar =
        document.getElementById(
            "owner-menu-avatar"
        );


    const menuName =
        document.getElementById(
            "owner-menu-name"
        );


    if (!button || !menu) {
        return;
    }


    // ========================================
    // REAL OWNER IDENTITY
    // ========================================

    const ownerName =
        authenticatedOwner?.name ||
        "Parking Owner";


    const initials =
        getOwnerInitials(
            ownerName
        );


    if (dockAvatar) {
        dockAvatar.textContent =
            initials;
    }


    if (menuAvatar) {
        menuAvatar.textContent =
            initials;
    }


    if (menuName) {
        menuName.textContent =
            ownerName;
    }


    // Native browser tooltip on hover
    button.title =
        ownerName;


    // ========================================
    // OPEN / CLOSE ACCOUNT MENU
    // ========================================

    button.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            const isOpen =
                menu.classList.toggle(
                    "active"
                );


            document
                .getElementById(
                    "owner-notification-menu"
                )
                ?.classList
                .remove(
                    "active"
                );


            button.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        }
    );


    menu.addEventListener(
        "click",
        event => {

            event.stopPropagation();
        }
    );


    document.addEventListener(
        "click",
        () => {

            menu.classList.remove(
                "active"
            );


            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );


    // ========================================
    // SIGN OUT
    // ========================================

    document
        .getElementById(
            "dock-sign-out"
        )
        ?.addEventListener(
            "click",
            () => {

                window.ParkSmartAPI
                    ?.logoutOwner?.();


                window.location.href =
                    "/pages/owner.html#auth-section";
            }
        );
}

function initOwnerNavbarAccount() {

    const button =
        document.getElementById(
            "owner-navbar-account-button"
        );


    const menu =
        document.getElementById(
            "owner-navbar-account-menu"
        );


    const signOut =
        document.getElementById(
            "owner-navbar-sign-out"
        );


    if (
        !button ||
        !menu
    ) {
        return;
    }


    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();


            const isOpen =
                menu.classList.toggle(
                    "active"
                );


            button.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        }
    );


    menu.addEventListener(
        "click",
        event => {

            event.stopPropagation();
        }
    );


    document.addEventListener(
        "click",
        () => {

            menu.classList.remove(
                "active"
            );


            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );


    signOut?.addEventListener(
        "click",
        () => {

            clearOwnerSession();


            window.location.href =
                "/pages/owner.html#auth-section";
        }
    );
}

function initOwnerAddressAutocomplete() {

    const addressInput =
        document.getElementById(
            "space-address"
        );

    const suggestionsBox =
        document.getElementById(
            "owner-address-suggestions"
        );

    const cityInput =
        document.getElementById(
            "space-city"
        );

    const zipInput =
        document.getElementById(
            "space-zip"
        );

    const latitudeInput =
        document.getElementById(
            "space-latitude"
        );

    const longitudeInput =
        document.getElementById(
            "space-longitude"
        );


    if (
        !addressInput ||
        !suggestionsBox
    ) {
        return;
    }


    let debounceTimer;


    function clearSelectedLocation() {

        pendingParkingLocation.latitude =
            null;

        pendingParkingLocation.longitude =
            null;


        if (latitudeInput) {
            latitudeInput.value = "";
        }

        if (longitudeInput) {
            longitudeInput.value = "";
        }
    }


    addressInput.addEventListener(
        "input",
        () => {

            clearTimeout(
                debounceTimer
            );


            clearSelectedLocation();


            const query =
                addressInput
                    .value
                    .trim();


            if (query.length < 3) {

                suggestionsBox.innerHTML =
                    "";

                suggestionsBox.classList
                    .remove("visible");

                return;
            }


            debounceTimer =
                setTimeout(
                    async () => {

                        try {

                            const response =
                                await fetch(
                                    `/api/location/autocomplete?q=${
                                        encodeURIComponent(
                                            query
                                        )
                                    }`
                                );


                            const data =
                                await response.json();


                            if (
                                !response.ok
                            ) {
                                throw new Error(
                                    data.message
                                );
                            }


                            renderSuggestions(
                                data.suggestions || []
                            );


                        } catch (error) {

                            console.error(
                                "Address autocomplete error:",
                                error
                            );
                        }

                    },
                    300
                );
        }
    );


    function renderSuggestions(
        suggestions
    ) {

        if (!suggestions.length) {

            suggestionsBox
                .classList
                .remove("visible");

            suggestionsBox.innerHTML =
                "";

            return;
        }


        suggestionsBox.innerHTML =
            suggestions
                .map(
                    (item, index) => `

                        <button
                            type="button"
                            class="suggestion-item"
                            data-index="${index}"
                        >
                            <span class="suggestion-icon">
                                📍
                            </span>

                            <span>
                                ${escapeHtml(
                                    item.formatted
                                )}
                            </span>
                        </button>

                    `
                )
                .join("");


        suggestionsBox.classList
            .add("visible");


        suggestionsBox
            .querySelectorAll(
                ".suggestion-item"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const item =
                            suggestions[
                                Number(
                                    button.dataset.index
                                )
                            ];


                        addressInput.value =
                            item.formatted;


                        if (cityInput) {
                            cityInput.value =
                                item.city || "";
                        }


                        if (zipInput) {
                            zipInput.value =
                                item.postal_code || "";
                        }


                        pendingParkingLocation.latitude =
                            item.latitude;

                        pendingParkingLocation.longitude =
                            item.longitude;


                        if (latitudeInput) {
                            latitudeInput.value =
                                item.latitude;
                        }


                        if (longitudeInput) {
                            longitudeInput.value =
                                item.longitude;
                        }


                        suggestionsBox.innerHTML =
                            "";

                        suggestionsBox.classList
                            .remove("visible");
                    }
                );
            });
    }


    document.addEventListener(
        "click",
        event => {

            if (
                !addressInput.contains(
                    event.target
                ) &&
                !suggestionsBox.contains(
                    event.target
                )
            ) {

                suggestionsBox.classList
                    .remove("visible");
            }
        }
    );
}

function initEditAddressAutocomplete() {

    const addressInput =
        document.getElementById(
            "edit-space-address"
        );

    const suggestionsBox =
        document.getElementById(
            "edit-address-suggestions"
        );

    const cityInput =
        document.getElementById(
            "edit-space-city"
        );

    const postalInput =
        document.getElementById(
            "edit-space-postal-code"
        );

    const latitudeInput =
        document.getElementById(
            "edit-space-latitude"
        );

    const longitudeInput =
        document.getElementById(
            "edit-space-longitude"
        );


    if (
        !addressInput ||
        !suggestionsBox
    ) {
        return;
    }


    let timer;


    addressInput.addEventListener(
        "input",
        () => {

            clearTimeout(
                timer
            );


            latitudeInput.value =
                "";

            longitudeInput.value =
                "";


            const query =
                addressInput.value.trim();


            if (
                query.length < 3
            ) {

                suggestionsBox.innerHTML =
                    "";

                suggestionsBox.classList.remove(
                    "visible"
                );

                return;
            }


            timer =
                setTimeout(
                    async () => {

                        try {

                            const response =
                                await fetch(
                                    `/api/location/autocomplete?q=${
                                        encodeURIComponent(
                                            query
                                        )
                                    }`
                                );


                            const data =
                                await response.json();


                            if (!response.ok) {

                                throw new Error(
                                    data.message ||
                                    "Unable to search addresses."
                                );
                            }


                            const suggestions =
                                data.suggestions ||
                                [];


                            suggestionsBox.innerHTML =
                                suggestions
                                    .map(
                                        (
                                            item,
                                            index
                                        ) => `

                                            <button
                                                type="button"
                                                class="suggestion-item"
                                                data-index="${index}"
                                            >

                                                <span class="suggestion-icon">
                                                    📍
                                                </span>

                                                <span>
                                                    ${
                                                        escapeHtml(
                                                            item.formatted
                                                        )
                                                    }
                                                </span>

                                            </button>

                                        `
                                    )
                                    .join("");


                            suggestionsBox.classList.toggle(
                                "visible",
                                suggestions.length > 0
                            );


                            suggestionsBox
                                .querySelectorAll(
                                    ".suggestion-item"
                                )
                                .forEach(
                                    button => {

                                        button.addEventListener(
                                            "click",
                                            () => {

                                                const item =
                                                    suggestions[
                                                        Number(
                                                            button.dataset.index
                                                        )
                                                    ];


                                                addressInput.value =
                                                    item.formatted;


                                                cityInput.value =
                                                    item.city ||
                                                    "";


                                                postalInput.value =
                                                    item.postal_code ||
                                                    "";


                                                latitudeInput.value =
                                                    item.latitude;


                                                longitudeInput.value =
                                                    item.longitude;


                                                suggestionsBox.innerHTML =
                                                    "";


                                                suggestionsBox.classList.remove(
                                                    "visible"
                                                );
                                            }
                                        );
                                    }
                                );


                        } catch (error) {

                            console.error(
                                "Edit address autocomplete error:",
                                error
                            );
                        }

                    },
                    300
                );
        }
    );
}

function initOwnerDashboardAnimations() {

    const dashboard =
        document.querySelector(
            ".owner-dashboard-root"
        );


    if (!dashboard) {
        return;
    }


    const animatedElements =
        document.querySelectorAll(
            [
                ".dashboard-header-bar",
                ".metric-card",
                ".panel-card"
            ].join(",")
        );


    animatedElements.forEach(
        element => {

            element.classList.add(
                "owner-reveal"
            );
        }
    );


    if (
        !("IntersectionObserver" in window)
    ) {

        animatedElements.forEach(
            element => {

                element.classList.add(
                    "owner-visible"
                );
            }
        );

        return;
    }


    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (
                            !entry.isIntersecting
                        ) {
                            return;
                        }


                        entry.target.classList.add(
                            "owner-visible"
                        );


                        observer.unobserve(
                            entry.target
                        );
                    }
                );
            },
            {
                threshold:
                    0.08,

                rootMargin:
                    "0px 0px -40px 0px"
            }
        );


    animatedElements.forEach(
        element => {

            observer.observe(
                element
            );
        }
    );
}

function animateDashboardNumber(
    element,
    target,
    {
        prefix = "",
        suffix = "",
        decimals = 0
    } = {}
) {

    if (!element) {
        return;
    }


    const finalValue =
        Number(target);


    if (
        !Number.isFinite(
            finalValue
        )
    ) {
        return;
    }


    const duration =
        700;


    const startTime =
        performance.now();


    function update(
        currentTime
    ) {

        const progress =
            Math.min(
                (
                    currentTime -
                    startTime
                ) /
                duration,
                1
            );


        /*
         * Ease-out animation.
         */

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );


        const value =
            finalValue *
            eased;


        element.textContent =
            `${prefix}${
                value.toFixed(
                    decimals
                )
            }${suffix}`;


        if (
            progress < 1
        ) {

            requestAnimationFrame(
                update
            );
        }
    }


    requestAnimationFrame(
        update
    );
}

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        initNav();

        initOwnerNavbarAccount();

        initForgotPassword();

        initOwnerAuth();

        const authReady =
            await syncAuthGuardUI();

        // A dashboard redirect may already
        // be underway if authentication
        // failed.

        if (
            document.querySelector(
                '.owner-dashboard-root'
            ) &&
            !authReady
        ) {

            return;
        }

        initOwnerDashboardAnimations();

        initEditParkingSpace();

        initEditAddressAutocomplete();

        initApplyForm();

        initOwnerBookingFilters();

        initOwnerAddressAutocomplete();

        initOwnerBookingActions();

        initOwnerOperatingHours();

        initOwnerParkingImages();

        await initOwnerDashboard();

        initOwnerProfile();

        initOwnerAccountDock();

        initOwnerNotifications();
    }
);
