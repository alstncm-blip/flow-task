from datetime import date, datetime

from sqlalchemy import CHAR, Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}


class UserRow(Base):
    """users 테이블. 비밀번호는 scrypt 해시만 저장한다."""

    __tablename__ = "users"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # UTC 기준 가입 일시
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SessionRow(Base):
    """sessions 테이블. 쿠키의 세션 토큰은 SHA-256 해시(16진수 64자)로만 저장한다."""

    __tablename__ = "sessions"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # UTC 기준 발급·만료 일시
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class TaskRow(Base):
    """tasks 테이블. 값 규칙은 API-SPEC.md의 Task 객체와 같다."""

    __tablename__ = "tasks"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(
        Enum("TODO", "DOING", "DONE", name="task_status"),
        nullable=False,
        default="TODO",
        server_default="TODO",
    )
    priority: Mapped[str] = mapped_column(
        Enum("HIGH", "NORMAL", "LOW", name="task_priority"),
        nullable=False,
        default="NORMAL",
        server_default="NORMAL",
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # UTC 기준 등록 일시. 시간대 정보 없이 저장하고 API 응답에서 UTC로 표시한다.
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # 소유자. T15 이전에 만든 행은 NULL로 보존하며 어떤 사용자에게도 보이지 않는다.
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
