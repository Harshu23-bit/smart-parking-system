ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS auth_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    otp_hash TEXT NOT NULL,

    purpose VARCHAR(30) NOT NULL CHECK (
        purpose IN (
            'account_verification',
            'password_reset'
        )
    ),

    channel VARCHAR(10) NOT NULL CHECK (
        channel IN (
            'email',
            'sms',
            'voice'
        )
    ),

    destination VARCHAR(255) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_user_id
ON auth_otps(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_otps_purpose
ON auth_otps(user_id, purpose, channel);

CREATE INDEX IF NOT EXISTS idx_auth_otps_expires_at
ON auth_otps(expires_at);\
