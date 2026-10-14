"""비밀번호 해시와 세션 토큰. 평문 비밀번호와 세션 토큰은 DB에 저장하지 않는다."""

import base64
import hashlib
import hmac
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SALT_BYTES = 16
HASH_BYTES = 64
SESSION_TOKEN_BYTES = 32


def b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=HASH_BYTES)


def hash_password(password: str) -> str:
    """'scrypt$N$r$p$salt$hash' 형식 문자열을 반환한다. salt와 hash는 base64이다."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = scrypt(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${b64encode(salt)}${b64encode(digest)}"


def verify_password(password: str, stored: str) -> bool:
    """저장된 해시와 같은 비밀번호인지 일정한 시간으로 비교한다. 형식이 잘못된 해시는 False."""
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest, validate=True)
        actual = scrypt(password, base64.b64decode(salt, validate=True), int(n), int(r), int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


# 없는 아이디로 로그인할 때도 같은 시간이 걸리도록 비교에 쓰는 해시. 어떤 비밀번호와도 일치하지 않는다.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> str:
    """쿠키에 넣을 무작위 세션 토큰(URL에 안전한 문자열)."""
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """DB sessions.token_hash에 저장·조회하는 SHA-256 16진수 64자."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
