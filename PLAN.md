# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  기록(2026-10-13): frontend/index.html, styles.css, app.js 생성.
  Node DOM 스텁 테스트 통과(두 항목 등록, 빈·공백 제목 거절, 101자 거절, 100자 등록, HTML 글자 표시).
  http.server 5500에서 세 파일 200 응답.
  Windows 브라우저(http://localhost:5500, WSL localhostForwarding)에서 사용자 확인 정상. 남은 오류 없음.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  기록(2026-10-13): frontend/app.js 저장·복원 추가, index.html에 저장 오류 영역·버튼 id 추가, styles.css 비활성 스타일.
  Node 스텁 테스트 통과(저장, 재실행 후 복원, 손상값 4종에서 등록 중지·원래 값 유지, 저장 실패 시 되돌림, T01 회귀).
  http.server 세 파일 200 응답.
  Windows 브라우저에서 사용자 확인 정상(새로고침 후 유지, 손상값 입력 시 등록 중지). 남은 오류 없음.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  기록(2026-10-13): frontend/app.js 상태 선택·제목 수정·삭제 확인 추가(id 기준), styles.css 항목 버튼·완료 스타일.
  설명 수정은 T04에서 다룬다. 저장 실패 시 변경을 되돌린다. status 없는 기존 저장값은 TODO로 읽는다.
  Node 스텁 테스트 12개 통과(상태 변경, 빈 제목 수정 거절, 수정·취소·Esc, 삭제 취소 유지, 삭제 시 해당 항목만, 재실행 후 유지, 저장 실패 되돌림, 회귀).
  Windows 브라우저에서 사용자 확인 정상(상태 변경·수정·삭제 취소·삭제, 새로고침 후 유지). 남은 오류 없음.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  기록(2026-10-13): index.html 등록 폼(우선순위·마감일·설명)과 검색·필터 영역 추가, app.js 필드·검증·수정 폼·필터·지연 표시, styles.css 배지·필터 스타일.
  수정 폼에서 제목·설명·우선순위·마감일을 함께 수정한다. 이전 단계 저장값은 빠진 필드를 기본값으로 읽는다.
  Node 스텁 테스트 통과: T04 12개(기본값, 검증, 지연 표시, 검색·필터 AND, 필터 중 수정·삭제, 호환·손상값, 새로고침 유지), T03 회귀 12개.
  Windows 브라우저에서 사용자 확인 정상(어제 마감 TODO 지연 표시, 필터 AND, 필터 중 수정·삭제, 새로고침 유지). 남은 오류 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  기록(2026-10-13): API-SPEC.md(T05~T08 계약), backend/__init__.py, backend/main.py, requirements.txt(fastapi 0.143.0, uvicorn 0.54.0), .gitignore 생성.
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 (Python 3.10.12)
  결과: curl -i /api/health → 200, {"status":"ok"}. /docs 200, 없는 경로 404. 남은 오류 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
  기록(2026-10-13): backend/schemas.py(TaskCreate·Task 검증), backend/store.py(메모리 저장소), backend/main.py에 GET·POST /api/tasks 추가.
  수정: due_date strict 검증이 "2026-10-20"까지 거절해 YYYY-MM-DD 형식 검사 후 날짜 변환하도록 변경.
  실행: 포트 8001에서 uvicorn 실행 후 urllib 스크립트로 확인. 26개 통과(기본값 201, 경계값 201, 위반 18종 422, GET id 순서, 재시작 후 빈 목록).
  /docs 화면에서 사용자 확인 정상(등록 201, 빈 제목 422, 등록 후 조회). 남은 오류 없음.
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
  기록(2026-10-13): backend/schemas.py TaskUpdate(보낸 필드만 수정, due_date만 null 허용), backend/store.py update·delete·필터, backend/main.py PATCH·DELETE와 q·status·priority 쿼리.
  실행: 포트 8001에서 uvicorn 실행 후 urllib 스크립트로 확인. T07 41개 통과(부분 수정 시 나머지·다른 항목 유지, due_date null 삭제, PATCH 위반 14종 422, 없는 id 404, 삭제 204·재삭제 404, q·status·priority AND, 잘못된 필터 422). T06 회귀 25개 통과.
  남은 오류 없음.
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
  기록(2026-10-13): frontend/app.js localStorage 제거, 목록·등록·상태 변경·수정·삭제를 /api 호출로 교체, 검색·필터는 API 쿼리(q·status·priority)로 조회, 지연 표시는 화면에서 계산.
  backend/main.py에 frontend 정적 파일 제공 추가(같은 주소, CORS 불필요), index.html 오류 영역 id를 api-error로 변경, API-SPEC.md에 화면 제공 방식 추가.
  실행: 포트 8001 uvicorn + Node 스텁(실제 HTTP 요청) 테스트 12개 통과(등록 후 화면·curl 목록 동일, 필터 중 수정·삭제, 404 안내, API 중지 시 오류 표시). T07 API 회귀 41개 통과.
  Windows 브라우저(http://localhost:8000)에서 사용자 확인 정상(화면·curl 목록 동일, API 중지 시 오류 표시). 남은 오류 없음.
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  기록(2026-10-13): MariaDB 10.6.23(127.0.0.1:3306). 사용자가 task_flow DB와 task_flow_app@localhost 생성, .env 작성. .env.example(가짜 값) 추가, .env 권한 600, .gitignore 대상 확인.
  결과: .env 정보로 mariadb 접속 성공(CURRENT_USER task_flow_app@localhost, DATABASE task_flow, utf8mb4_general_ci, 테이블 없음).
  참고: 권한이 ALL PRIVILEGES(DROP 포함)로 부여됨. 비밀번호가 짧아 서버 분리(T12) 전 변경 권장.
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
  기록(2026-10-13): requirements.txt에 SQLAlchemy 2.0.54, PyMySQL 1.2.3 추가. database.py(.env·환경변수 읽기, 엔진·세션), models.py(TaskRow), init_db.py(없는 테이블만 생성) 작성.
  실행: python -m backend.init_db 2회 → 1회차 생성, 2회차 "이미 있어 변경하지 않음".
  결과: DESCRIBE tasks로 id(AUTO_INCREMENT PK)·title varchar(100)·description varchar(2000)·status·priority ENUM·due_date date NULL·created_at datetime 확인. InnoDB, utf8mb4, 0행. 접속 정보 누락 시 안내 오류 확인. 남은 오류 없음.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
  기록(2026-10-13): backend/store.py를 DbTaskStore(MariaDB, 메서드 동일)로 교체, backend/main.py가 DbTaskStore 사용·DB 오류 시 503 응답. API-SPEC.md에 503 추가.
  실행: 포트 8001 uvicorn + urllib 스크립트. 31개 통과(등록·부분 수정·422·404·204, q·status·priority AND, q의 %·_ 글자 검색, 2000자 설명·이모지 저장).
  결과: 등록 행을 mariadb SELECT로 확인. API 재시작 후 같은 id·수정 내용 유지. 틀린 DB 비밀번호로 실행 시 /api/tasks 503, 로그에 비밀번호 미노출.
  테스트 항목([T11검증] 제목)은 확인 후 삭제해 tasks는 0행. AUTO_INCREMENT는 6부터 시작. 남은 오류 없음.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [x] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
  기록(2026-10-14): deploy/task-flow-api.service 작성(User mzcedu, .venv python -m uvicorn, 0.0.0.0:8000, Restart=on-failure). DB 접속 정보는 앱이 .env에서 읽고 unit 파일에는 비밀값 없음.
  설치: sudo cp deploy/task-flow-api.service /etc/systemd/system/ → daemon-reload → start. systemd-analyze verify 통과.
  가상환경은 Python 3.14.4로 다시 만들어 requirements.txt 버전과 일치 확인. .env 권한이 664로 바뀌어 있어 600으로 되돌림.
  수정: 첫 시작 시 수동 uvicorn이 8000 포트를 사용 중이라 Errno 98로 재시작 반복. 수동 프로세스 종료 후 정상.
  결과: 현재 PC(WSL)를 App 서버로 사용해 확인. active, /api/health 200 {"status":"ok"}, /api/tasks·/ 200.
  메인 프로세스 kill -9 후 자동 재시작되어 health 정상, 등록한 [T13검증] 항목 유지 확인 후 삭제(204).
  남은 작업: 부팅 시 자동 시작(sudo systemctl enable task-flow-api)은 미설정. T12(DB 서버 분리)는 미완료라 DB는 같은 PC의 MariaDB 사용.
- [x] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
  기록(2026-10-14): deploy/nginx/task-flow.conf 작성(80 default_server, root /var/www/task-flow, /api/ → 127.0.0.1:8000, nosniff, 요청 본문 64k 제한).
  /home/mzcedu가 750이라 www-data가 읽지 못해 화면 파일을 /var/www/task-flow에 복사. 기본 사이트는 sites-enabled 링크만 제거(sites-available/default 유지).
  설치: sudo cp frontend 세 파일 → /var/www/task-flow, 설정을 sites-available/task-flow에 복사·링크, nginx -t, reload. 프런트 코드는 상대 경로 /api라 변경 없음.
  사전 확인: 같은 설정을 8088 포트로 일반 사용자 실행. 화면 세 파일 200, /api/health·/api/tasks 200, 없는 경로 404, 70KB 본문 413, 빈 제목 422.
  결과: Nginx 1.28.3. 80 포트로 등록 201(id 3) → MariaDB SELECT로 행 확인 → systemctl restart task-flow-api(PID 변경) 후 같은 항목 조회 유지.
  Windows 브라우저 http://localhost 접속 확인(Nginx 접근 로그). 테스트 항목 삭제 204.
  추가(2026-10-14): backend/main.py에서 화면 파일 제공(StaticFiles) 제거, 8000은 /api만 응답. API-SPEC.md 화면 제공 항목 수정.
  확인: 서비스 재시작 후 8000의 / ·app.js·styles.css 404, /api/health·/api/tasks 200. 80(Nginx) 화면·API 200, 등록 201·삭제 204.
  5500(http.server)은 T01~T04 수동 실행용이라 현재 미실행. T08 이후 /api가 없어 사용하지 않음.
  참고: frontend 수정 시 /var/www/task-flow에 다시 복사해야 반영됨. App 분리 시 proxy_pass를 App 서버 사설 IP로 변경. T12 미완료로 Web·App·DB가 같은 PC에서 동작.
## 6장: 여러 사용자(PRD F10~F14)
- [x] T15: API-SPEC.md에 인증·사용자별 할 일 계약 추가. users·sessions 테이블과 tasks.user_id(NULL 허용) 추가.
  확인: python -m backend.init_db로 생성, 2회차 실행 시 변경 없음, 기존 tasks 행 유지(user_id NULL). 기존 API 동작 유지.
  기록(2026-10-14): PRD.md를 여러 사용자 앱으로 수정(F10~F14, 인증과 보안, 제외 기능 조정). 결정: 서버 세션 쿠키, 사용자 아이디 로그인, 소유자 없는 기존 행은 보존·숨김.
  API-SPEC.md에 User 객체, 세션 쿠키(tf_session, HttpOnly·SameSite=Lax·Path=/api·7일, 토큰은 SHA-256 해시만 저장), signup·login·logout·me, 할 일 API 로그인 적용, 401·409 추가.
  backend/models.py에 UserRow(users)·SessionRow(sessions, users 삭제 시 CASCADE)·TaskRow.user_id(FK users.id, NULL 허용, 인덱스) 추가.
  backend/init_db.py는 없는 테이블만 만들고, tasks에 user_id가 없을 때만 ALTER TABLE ADD COLUMN(삭제·초기화 없음). 새 패키지 없음.
  실행: python -m backend.init_db 2회 → 1회차 users·sessions 생성·tasks.user_id 추가, 2회차 모두 "변경하지 않음".
  결과: DESCRIBE로 세 테이블(InnoDB)·UNIQUE(username, token_hash)·FK 2개 확인. 기존 tasks 1행 실행 전후 값 동일, user_id NULL.
  포트 8001에서 바뀐 모델로 기존 API 회귀 17개 통과(등록·부분 수정·422·404·204·필터 AND·%_ 검색, 응답에 user_id 없음, user_id 필드 전송 시 422). 테스트 행 삭제.
  실행 중인 서비스(이전 코드)도 테이블 변경 후 8000·80에서 /api/tasks 200. 서비스 재시작은 T18 배포 반영 전까지 불필요. 남은 오류 없음.
  참고: T18 전까지 새로 등록한 할 일은 user_id NULL이라 T18 이후 보이지 않는다.
- [x] T16: 회원가입 API(POST /api/auth/signup). 비밀번호는 scrypt 해시로 저장.
  확인: 가입 201, 중복 아이디 409, 형식 위반 422, DB에 평문 비밀번호 없음.
  기록(2026-10-14): backend/security.py(hash_password: 16바이트 무작위 salt, scrypt N=2^14·r=8·p=1, 'scrypt$N$r$p$salt$hash' 형식), schemas.py SignupRequest·User, store.py DbUserStore(UNIQUE 위반 시 UsernameTakenError), main.py POST /api/auth/signup(409).
  수정: FastAPI 기본 422 응답이 보낸 값(input)을 담아 짧은 비밀번호가 응답에 나오므로 /api/auth/ 경로의 422에서만 input 제거. 할 일 API 422 형식은 유지. API-SPEC.md에 반영. 새 패키지 없음.
  실행: 포트 8001 uvicorn + urllib·SQL 스크립트. 47개 통과(가입 201·응답은 id·username·created_at만·쿠키 없음, 중복 409, 경계 4·30자 아이디와 8·64자·한글 비밀번호 201,
  위반 16종 422(3·31자, 대문자, 공백, 앞 공백, 하이픈, 한글, 끝 줄바꿈, 7·65자 비밀번호, 필드 누락, 추가 필드, 숫자·null 타입), 잘못된 JSON 422, 422 응답에 비밀번호 없음,
  동시 가입 6건 중 201 1건·409 5건, 해시 형식·재계산 일치·틀린 비밀번호 불일치, DB 평문 없음, 같은 비밀번호도 salt·해시 다름). 서버 로그에 비밀번호 없음.
  같은 비밀번호 검사는 테스트가 같은 DB 연결(REPEATABLE READ) 안에서 조회해 처음에 실패로 나왔으나, 새 연결로 확인해 정상. 할 일 API 회귀 17개 통과.
  테스트 사용자(t16_*) 7명 삭제해 users 0행. 실행 중인 서비스는 아직 이전 코드(재시작 시 반영). 남은 오류 없음.
- [x] T17: 로그인·로그아웃·내 정보 API(POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me). 세션 쿠키 발급·무효화.
  확인: 로그인 성공 시 HttpOnly 쿠키, 틀린 아이디·비밀번호 모두 같은 401, 로그아웃 후 같은 쿠키로 me 401, 만료 세션 401.
  기록(2026-10-14): security.py에 verify_password(일정 시간 비교)·세션 토큰(token_urlsafe 32바이트)·SHA-256 해시 추가. store.py에 DbUserStore.authenticate, DbSessionStore(create·get_user·delete, 7일 만료, 로그인 시 해당 사용자의 만료 세션 정리).
  main.py에 login(tf_session 쿠키: HttpOnly·SameSite=Lax·Path=/api·Max-Age=604800)·logout(세션 삭제·쿠키 제거, 항상 204)·me와 current_user 의존성(T18에서 재사용) 추가. schemas.py LoginRequest.
  database.py optional_setting 추가, .env.example에 COOKIE_SECURE=false 예시 추가. 새 패키지 없음.
  수정: DB 정렬 규칙(utf8mb4_general_ci)이 대소문자·끝 공백을 무시해 'T17_ALICE'·'t17_alice '로도 로그인되므로 아이디를 글자 그대로 다시 비교.
  보완: 없는 아이디도 더미 해시로 scrypt 비교해 응답 시간 차이를 줄임(측정 틀린 비밀번호 41.8ms / 없는 아이디 35.2ms).
  실행: 포트 8001 uvicorn + urllib·SQL 스크립트. T17 38개 통과(로그인 200·쿠키 속성·토큰 응답 미포함, DB에는 토큰 해시만·만료 7일, me 200/쿠키 없음·잘못된 토큰·해시값 쿠키 401,
  틀린 비밀번호·없는 아이디·대문자·끝 공백·다른 사람 비밀번호·빈 값 모두 같은 401 본문·쿠키 없음, 422 4종에 비밀번호 없음, 로그인마다 새 토큰,
  로그아웃 204·Max-Age=0·세션 행 삭제·이전 쿠키 401·다른 세션 유지·재로그아웃·쿠키 없이 204, 만료 세션 401·재로그인 시 정리, 사용자별 me 구분, health 로그인 불필요).
  포트 8002에서 COOKIE_SECURE=true 시 Secure 속성 확인. T16 회귀 47개(테스트의 같은 연결 조회 문제 수정 후), 할 일 회귀 17개 통과. 서버 로그에 비밀번호·토큰 없음.
  테스트 사용자(t16_*, t17_*)와 세션 삭제. 브라우저로 등록된 tasks id 10(user_id NULL)은 사용자 데이터라 유지. 실행 중인 서비스는 이전 코드. 남은 오류 없음.
- [x] T18: 할 일 API에 로그인 필수 적용과 사용자별 분리.
  확인: 미로그인 401, A의 목록에 B 항목 없음, B 항목 id로 A가 수정·삭제 시 404, user_id NULL 행은 아무에게도 안 보임.
  기록(2026-10-14): main.py 할 일 4개 경로에 CurrentUser(current_user 의존성) 적용. store.py DbTaskStore 모든 메서드에 user_id 인자, 목록은 user_id 조건, 수정·삭제는 owned_row(id와 user_id 동시 조건)로 조회해 다른 사용자·NULL 행은 404.
  등록 시 user_id 저장. 요청 본문의 user_id는 기존처럼 422. API-SPEC.md에 미로그인은 검증보다 먼저 401임을 추가. 화면은 T19 전까지 로그인 기능이 없어 401이 된다.
  실행: 포트 8001 uvicorn + urllib·SQL 스크립트. T18 31개 통과(미로그인 GET·필터·POST·PATCH·DELETE 401, 잘못된 본문도 401, 위조 쿠키 401, health 로그인 불필요, DB user_id 저장,
  A·B 목록 분리, 검색·필터도 자기 항목만, A가 B 항목 수정·삭제 404·B 행 그대로, 소유자 없는 행(테스트용으로 SQL 삽입 후 삭제) 숨김·수정·삭제 404·값 그대로, 자기 항목 수정, 로그아웃 후 401·다른 사용자 유지).
  회귀: 로그인 상태로 할 일 API 17개, T17 38개 통과. T16 47개 중 '미로그인 할 일 422 형식' 1개는 T18에서 401로 바뀐 것이 의도된 동작이고, 로그인 상태에서 422 형식(input 포함) 유지 확인.
  참고: 첫 실행은 사용자가 13:27 브라우저에서 id 1·10을 삭제해 NULL 행이 없어 테스트가 중단됨(코드 문제 아님). 테스트 데이터 삭제 후 tasks·users·sessions 0행.
  실행 중인 서비스는 이전 코드. T19 완료 전에 재시작하면 화면이 401로 동작하지 않는다. 남은 오류 없음.
- [ ] T19: 화면에 회원가입·로그인·로그아웃 추가. 미로그인 시 로그인 화면, 401 응답 시 로그인 화면으로 이동.
  확인: 브라우저에서 가입→로그인→등록→로그아웃→다른 사용자 로그인 시 이전 사용자 항목 안 보임. 입력값은 글자로 표시.
- [ ] T20: Web(Nginx)·App(systemd) 배포 반영.
  확인: Web 주소에서 두 사용자 분리 동작, App 재시작 후 로그인 상태와 데이터 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
T13~: sudo systemctl start task-flow-api (수동 uvicorn은 8000 대신 다른 포트 사용)
T14~: 화면은 http://localhost(Nginx), 8000은 API만 응답
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.