"""users·sessions·tasks 테이블을 만든다. 이미 있는 테이블과 데이터는 삭제하지 않는다.

T15 이전에 만든 tasks 테이블에는 user_id(NULL 허용) 컬럼만 추가하고 기존 행은 그대로 둔다.
실행: python -m backend.init_db
"""

from sqlalchemy import inspect, text

from .database import Base, engine
from .models import SessionRow, TaskRow, UserRow

# 기존 tasks에 소유자 컬럼을 붙인다. 기존 행은 user_id NULL로 남는다.
ADD_TASK_OWNER = (
    "ALTER TABLE tasks"
    " ADD COLUMN user_id INTEGER NULL,"
    " ADD INDEX ix_tasks_user_id (user_id),"
    " ADD CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users (id)"
)


def main() -> None:
    tables = [UserRow.__tablename__, SessionRow.__tablename__, TaskRow.__tablename__]
    existed = {table: inspect(engine).has_table(table) for table in tables}
    # create_all은 없는 테이블만 만든다.
    Base.metadata.create_all(engine)
    for table in tables:
        if existed[table]:
            print(f"{table} 테이블이 이미 있어 새로 만들지 않았습니다.")
        else:
            print(f"{table} 테이블을 만들었습니다.")

    task_columns = {column["name"] for column in inspect(engine).get_columns(TaskRow.__tablename__)}
    if "user_id" in task_columns:
        print("tasks.user_id 컬럼이 이미 있어 변경하지 않았습니다.")
    else:
        with engine.begin() as connection:
            connection.execute(text(ADD_TASK_OWNER))
        print("tasks.user_id 컬럼을 추가했습니다. 기존 행은 user_id NULL로 보존합니다.")


if __name__ == "__main__":
    main()
