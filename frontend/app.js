"use strict";

const TITLE_MAX_LENGTH = 100;

// T01: 메모리에만 보관한다. 새로고침하면 사라진다.
const tasks = [];

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const formError = document.getElementById("form-error");
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

  formError.textContent = "";
  titleInput.value = "";
  titleInput.focus();
  render();
});

render();
