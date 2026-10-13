"use strict";

const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";

const tasks = [];
// 저장값을 읽지 못하면 기존 값을 덮어쓰지 않도록 저장을 막는다.
let storageBlocked = false;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const submitButton = document.getElementById("submit-button");
const formError = document.getElementById("form-error");
const storageError = document.getElementById("storage-error");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 검증 실패 시 오류 메시지, 통과 시 null을 반환한다.
function validateTitle(title) {
  const length = Array.from(title).length;
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string"
  );
}

// 저장값이 없으면 빈 목록, 읽을 수 없거나 형식이 다르면 예외를 던진다.
function loadTasks() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(isValidTask)) {
    throw new Error("저장값 형식이 올바르지 않습니다.");
  }
  return data;
}

function saveTasks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function blockStorage(reason) {
  storageBlocked = true;
  titleInput.disabled = true;
  submitButton.disabled = true;
  storageError.textContent =
    `저장된 데이터(${STORAGE_KEY})를 읽을 수 없어 등록을 중지했습니다. ` +
    `기존 값은 변경하지 않았습니다. (${reason})`;
}

function render() {
  taskList.replaceChildren();

  for (const task of tasks) {
    const item = document.createElement("li");
    item.dataset.id = task.id;
    // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
    item.textContent = task.title;
    taskList.appendChild(item);
  }

  taskCount.textContent = `(${tasks.length})`;
  emptyMessage.hidden = tasks.length > 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (storageBlocked) {
    return;
  }

  const title = titleInput.value.trim();
  const error = validateTitle(title);
  if (error) {
    formError.textContent = error;
    titleInput.focus();
    return;
  }

  tasks.push({
    id: createId(),
    title,
    status: "TODO",
    created_at: new Date().toISOString(),
  });

  try {
    saveTasks();
  } catch (saveError) {
    // 저장에 실패한 항목은 화면에도 남기지 않는다.
    tasks.pop();
    formError.textContent = `저장하지 못했습니다. (${saveError.message})`;
    return;
  }

  formError.textContent = "";
  titleInput.value = "";
  titleInput.focus();
  render();
});

try {
  tasks.push(...loadTasks());
} catch (loadError) {
  blockStorage(loadError.message);
}
render();
