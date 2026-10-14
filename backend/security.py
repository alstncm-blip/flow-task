"""비밀번호 해시. 사용자별 무작위 salt와 scrypt를 쓰며 평문 비밀번호는 저장하지 않는다."""

import base64
import hashlib
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SALT_BYTES = 16
HASH_BYTES = 64


def b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def hash_password(password: str) -> str:
    """'scrypt$N$r$p$salt$hash' 형식 문자열을 반환한다. salt와 hash는 base64이다."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=HASH_BYTES
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${b64encode(salt)}${b64encode(digest)}"
