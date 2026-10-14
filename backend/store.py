from datetime import datetime, timedelta, timezone
from enum import Enum

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from .database import SessionLocal
from .models import SessionRow, TaskRow, UserRow
from .schemas import Priority, Status, Task, TaskCreate, User
from .security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)

SESSION_LIFETIME = timedelta(days=7)


def to_task(row: TaskRow) -> Task:
    """DB 행을 API 응답 모델로 바꾼다. created_at은 UTC로 저장되어 있다."""
    return Task(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        due_date=row.due_date,
        created_at=row.created_at.replace(tzinfo=timezone.utc),
    )


def to_user(row: UserRow) -> User:
    return User(id=row.id, username=row.username, created_at=row.created_at.replace(tzinfo=timezone.utc))


def utc_now() -> datetime:
    """DB에 저장할 UTC 일시(시간대 정보 없음, 초 단위)."""
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None)


def to_column_value(value: object) -> object:
    # Status·Priority 같은 Enum은 DB ENUM 컬럼에 맞게 문자열 값으로 저장한다.
    return value.value if isinstance(value, Enum) else value


class DbTaskStore:
    """MariaDB tasks 테이블에 할 일을 저장한다. API를 재시작해도 데이터가 유지된다."""

    def list(
        self,
        q: str | None = None,
        status: Status | None = None,
        priority: Priority | None = None,
    ) -> list[Task]:
        """조건을 모두 만족하는 할 일을 id 순서로 반환한다. None 조건은 무시한다."""
        statement = select(TaskRow).order_by(TaskRow.id)
        query = (q or "").strip().lower()
        if query:
            # %, _ 를 글자 그대로 검색하고, DB 정렬 규칙과 관계없이 소문자로 비교한다.
            statement = statement.where(
                func.lower(TaskRow.title).collate("utf8mb4_bin").contains(query, autoescape=True)
            )
        if status is not None:
            statement = statement.where(TaskRow.status == status.value)
        if priority is not None:
            statement = statement.where(TaskRow.priority == priority.value)
        with SessionLocal() as session:
            return [to_task(row) for row in session.scalars(statement)]

    def create(self, data: TaskCreate) -> Task:
        row = TaskRow(
            title=data.title,
            description=data.description,
            status=Status.TODO.value,
            priority=data.priority.value,
            due_date=data.due_date,
            created_at=utc_now(),
        )
        with SessionLocal() as session, session.begin():
            session.add(row)
            session.flush()
            return to_task(row)

    def update(self, task_id: int, changes: dict[str, object]) -> Task | None:
        """전달된 필드만 바꾼다. 없는 id는 None을 반환한다."""
        with SessionLocal() as session, session.begin():
            row = session.get(TaskRow, task_id)
            if row is None:
                return None
            for name, value in changes.items():
                setattr(row, name, to_column_value(value))
            session.flush()
            return to_task(row)

    def delete(self, task_id: int) -> bool:
        """삭제했으면 True, 없는 id면 False를 반환한다."""
        with SessionLocal() as session, session.begin():
            row = session.get(TaskRow, task_id)
            if row is None:
                return False
            session.delete(row)
            return True


class UsernameTakenError(Exception):
    """이미 사용 중인 아이디로 가입하려 할 때 발생한다."""


class DbUserStore:
    """MariaDB users 테이블에 사용자를 저장한다."""

    def create(self, username: str, password: str) -> User:
        """비밀번호를 해시해 저장한다. 같은 아이디가 있으면 UsernameTakenError."""
        row = UserRow(username=username, password_hash=hash_password(password), created_at=utc_now())
        try:
            with SessionLocal() as session, session.begin():
                session.add(row)
                session.flush()
                return to_user(row)
        except IntegrityError as error:
            # 동시에 같은 아이디로 가입해도 username UNIQUE 제약으로 한 명만 성공한다.
            raise UsernameTakenError(username) from error

    def authenticate(self, username: str, password: str) -> User | None:
        """아이디와 비밀번호가 일치하면 사용자를, 아니면 None을 반환한다."""
        with SessionLocal() as session:
            row = session.scalars(select(UserRow).where(UserRow.username == username)).one_or_none()
        # DB 정렬 규칙은 대소문자·끝 공백을 무시하므로 아이디가 글자 그대로 같은지 다시 확인한다.
        if row is not None and row.username != username:
            row = None
        # 없는 아이디도 해시 비교를 거쳐 응답 시간으로 아이디 존재 여부를 알 수 없게 한다.
        matched = verify_password(password, row.password_hash if row else DUMMY_PASSWORD_HASH)
        if row is None or not matched:
            return None
        return to_user(row)


class DbSessionStore:
    """MariaDB sessions 테이블에 로그인 세션을 저장한다. 토큰은 SHA-256 해시로만 저장한다."""

    def create(self, user_id: int) -> str:
        """새 세션을 만들고 쿠키에 넣을 토큰을 반환한다. 이 사용자의 만료된 세션은 정리한다."""
        token = new_session_token()
        now = utc_now()
        with SessionLocal() as session, session.begin():
            session.execute(delete(SessionRow).where(SessionRow.user_id == user_id, SessionRow.expires_at <= now))
            session.add(
                SessionRow(
                    token_hash=hash_session_token(token),
                    user_id=user_id,
                    created_at=now,
                    expires_at=now + SESSION_LIFETIME,
                )
            )
        return token

    def get_user(self, token: str) -> User | None:
        """만료되지 않은 세션의 사용자를 반환한다. 없거나 만료됐으면 None."""
        statement = (
            select(UserRow)
            .join(SessionRow, SessionRow.user_id == UserRow.id)
            .where(SessionRow.token_hash == hash_session_token(token), SessionRow.expires_at > utc_now())
        )
        with SessionLocal() as session:
            row = session.scalars(statement).one_or_none()
            return to_user(row) if row else None

    def delete(self, token: str) -> None:
        """세션을 삭제한다. 없는 세션이어도 오류 없이 끝난다."""
        with SessionLocal() as session, session.begin():
            session.execute(delete(SessionRow).where(SessionRow.token_hash == hash_session_token(token)))
