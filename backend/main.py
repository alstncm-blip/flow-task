import logging

from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .database import optional_setting
from .schemas import LoginRequest, Priority, SignupRequest, Status, Task, TaskCreate, TaskUpdate, User
from .store import SESSION_LIFETIME, DbSessionStore, DbTaskStore, DbUserStore, UsernameTakenError

app = FastAPI(title="Task Flow API")
store = DbTaskStore()
user_store = DbUserStore()
session_store = DbSessionStore()
logger = logging.getLogger(__name__)

TASK_NOT_FOUND = "할 일을 찾을 수 없습니다."
USERNAME_TAKEN = "이미 사용 중인 아이디입니다."
DATABASE_ERROR = "DB에 연결할 수 없거나 처리 중 오류가 발생했습니다."
LOGIN_FAILED = "아이디 또는 비밀번호가 올바르지 않습니다."
LOGIN_REQUIRED = "로그인이 필요합니다."

SESSION_COOKIE = "tf_session"
COOKIE_PATH = "/api"
# HTTPS를 쓰면 COOKIE_SECURE=true로 설정해 쿠키를 HTTPS에서만 보낸다.
COOKIE_SECURE = optional_setting("COOKIE_SECURE", "false").lower() == "true"


def current_user(tf_session: Annotated[str | None, Cookie()] = None) -> User:
    """세션 쿠키로 로그인한 사용자를 찾는다. 없거나 만료됐으면 401."""
    user = session_store.get_user(tf_session) if tf_session else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=LOGIN_REQUIRED)
    return user


@app.exception_handler(SQLAlchemyError)
def handle_database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
    """DB 오류는 내부 내용을 응답에 노출하지 않고 503으로 알린다. 자세한 내용은 서버 로그에 남긴다."""
    logger.error("DB 오류: %s %s: %s", request.method, request.url.path, error)
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": DATABASE_ERROR})


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    """인증 요청의 422 응답에는 보낸 값(input)을 넣지 않아 비밀번호가 응답에 나오지 않게 한다."""
    if not request.url.path.startswith("/api/auth/"):
        return await request_validation_exception_handler(request, error)
    errors = [{key: value for key, value in item.items() if key != "input"} for item in error.errors()]
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": jsonable_encoder(errors)})


@app.get("/api/health")
def health() -> dict[str, str]:
    """API 서버가 요청을 처리할 수 있는지 확인한다."""
    return {"status": "ok"}


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest) -> User:
    """회원가입한다. 로그인 쿠키는 발급하지 않는다."""
    try:
        return user_store.create(data.username, data.password)
    except UsernameTakenError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_TAKEN) from None


@app.post("/api/auth/login")
def login(data: LoginRequest, response: Response) -> User:
    """로그인하고 세션 쿠키를 발급한다. 아이디·비밀번호 중 무엇이 틀렸는지 알리지 않는다."""
    user = user_store.authenticate(data.username, data.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=LOGIN_FAILED)
    response.set_cookie(
        SESSION_COOKIE,
        session_store.create(user.id),
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path=COOKIE_PATH,
        secure=COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )
    return user


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, tf_session: Annotated[str | None, Cookie()] = None) -> None:
    """현재 세션을 서버에서 삭제하고 쿠키를 지운다. 세션이 없어도 204."""
    if tf_session:
        session_store.delete(tf_session)
    response.delete_cookie(SESSION_COOKIE, path=COOKIE_PATH, secure=COOKIE_SECURE, httponly=True, samesite="lax")


@app.get("/api/auth/me")
def me(user: Annotated[User, Depends(current_user)]) -> User:
    """로그인한 사용자 정보를 반환한다."""
    return user


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    status: Status | None = None,
    priority: Priority | None = None,
) -> list[Task]:
    """제목 검색(q)과 상태·우선순위 필터를 AND로 적용해 등록 순서로 반환한다."""
    return store.list(q=q, status=status, priority=priority)


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate) -> Task:
    """할 일을 등록한다. 상태는 항상 TODO로 시작한다."""
    return store.create(data)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate) -> Task:
    """보낸 필드만 수정하고 나머지는 유지한다."""
    task = store.update(task_id, data.changes())
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TASK_NOT_FOUND)
    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> None:
    """할 일을 삭제한다."""
    if not store.delete(task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TASK_NOT_FOUND)
