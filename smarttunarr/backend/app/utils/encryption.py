"""Credential encryption utilities."""

import base64
import logging
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    """Get or create Fernet instance for encryption."""
    global _fernet

    if _fernet is None:
        settings = get_settings()
        secret_key = settings.secret_key.encode()

        # Derive a key from the secret
        salt = b"smarttunarr_salt"  # In production, use a proper random salt
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret_key))
        _fernet = Fernet(key)

    return _fernet


def encrypt_value(value: str) -> str:
    """
    Encrypt a string value.

    Args:
        value: Plain text value to encrypt

    Returns:
        Base64-encoded encrypted value
    """
    if not value:
        return ""

    fernet = _get_fernet()
    encrypted = fernet.encrypt(value.encode())
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt an encrypted string value.

    Args:
        encrypted_value: Base64-encoded encrypted value

    Returns:
        Decrypted plain text value
    """
    if not encrypted_value:
        return ""

    try:
        fernet = _get_fernet()
        decoded = base64.urlsafe_b64decode(encrypted_value.encode())
        decrypted = fernet.decrypt(decoded)
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return ""


def rotate_encryption_key(old_secret: str, new_secret: str) -> None:
    """
    Rotate encryption key for all stored credentials.

    This function would need to:
    1. Decrypt all credentials with old key
    2. Re-encrypt with new key
    3. Update database

    Note: This is a placeholder - actual implementation would need
    database access to update all encrypted values.
    """
    raise NotImplementedError("Key rotation requires database migration")
