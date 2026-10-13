"use strict";

const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const DEFAULT_STATUS = "TODO";

const tasks = [];
// 저장값을 읽지 못하면 기존 값을 덮어쓰지 않도록 저장을 막는다.
let storageBlocked = false;
// 제목을 수정 중인 항목의 id. 한 번에 하나만 수정한다.
let editingId = null;
let editError = "";

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

function isValidStatus(status) {
  return STATUSES.some((item) => item.value === status);
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    (task.status === undefined || isValidStatus(task.status))
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
  return data.map((task) => ({ ...task, status: task.status === undefined ? DEFAULT_STATUS : task.status }));
}

function saveTasks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// 목록을 바꾸고 저장한다. 저장에 실패하면 바꾸기 전 목록으로 되돌린다.
function applyChange(change) {
  const snapshot = tasks.map((task) => ({ ...task }));
  change();
  try {
    saveTasks();
  } catch (saveError) {
    tasks.splice(0, tasks.length, ...snapshot);
    formError.textContent = `저장하지 못했습니다. (${saveError.message})`;
    return false;
  }
  formError.textContent = "";
  return true;
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function blockStorage(reason) {
  storageBlocked = true;
  titleInput.disabled = true;
  submitButton.disabled = true;
  storageError.textContent =
    `저장된 데이터(${STORAGE_KEY})를 읽을 수 없어 등록을 중지했습니다. ` +
    `기존 값은 변경하지 않았습니다. (${reason})`;
}

function changeStatus(id, status) {
  const task = findTask(id);
  if (!task || !isValidStatus(status)) {
    return;
  }
  applyChange(() => {
    task.status = status;
  });
  render();
}

function startEdit(id) {
  editingId = id;
  editError = "";
  render();
}

function cancelEdit() {
  editingId = null;
  editError = "";
  render();
}

function saveEdit(id, value) {
  const task = findTask(id);
  if (!task) {
    cancelEdit();
    return;
  }
  const title = value.trim();
  const error = validateTitle(title);
  if (error) {
    editError = error;
    render();
    return;
  }
  if (applyChange(() => {
    task.title = title;
  })) {
    editingId = null;
    editError = "";
  }
  render();
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 할 일을 삭제할까요?`)) {
    return;
  }
  applyChange(() => {
    tasks.splice(tasks.indexOf(task), 1);
  });
  if (editingId === id && !findTask(id)) {
    editingId = null;
    editError = "";
  }
  render();
}

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createStatusSelect(task) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "상태");
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status.value;
    option.textContent = status.label;
    select.appendChild(option);
  }
  select.value = task.status;
  select.addEventListener("change", () => changeStatus(task.id, select.value));
  return select;
}

function createEditRow(task) {
  const row = document.createElement("div");
  row.className = "task-edit";

  const input = document.createElement("input");
  input.type = "text";
  input.value = task.title;
  input.setAttribute("aria-label", "제목 수정");
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      saveEdit(task.id, input.value);
    } else if (event.key === "Escape") {
      cancelEdit();
    }
  });

  row.appendChild(input);
  row.appendChild(createButton("저장", () => saveEdit(task.id, input.value)));
  row.appendChild(createButton("취소", cancelEdit));
  return { row, input };
}

function createTaskItem(task) {
  const item = document.createElement("li");
  item.dataset.id = task.id;
  if (task.status === "DONE") {
    item.className = "done";
  }

  if (task.id === editingId) {
    const { row, input } = createEditRow(task);
    item.appendChild(row);
    if (editError) {
      const error = document.createElement("p");
      error.className = "form-error";
      error.textContent = editError;
      item.appendChild(error);
    }
    return { item, focusTarget: input };
  }

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.appendChild(createStatusSelect(task));
  actions.appendChild(createButton("수정", () => startEdit(task.id)));
  actions.appendChild(createButton("삭제", () => deleteTask(task.id)));

  main.appendChild(title);
  main.appendChild(actions);
  item.appendChild(main);
  return { item, focusTarget: null };
}

function render() {
  taskList.replaceChildren();
  let focusTarget = null;

  for (const task of tasks) {
    const created = createTaskItem(task);
    taskList.appendChild(created.item);
    if (created.focusTarget) {
      focusTarget = created.focusTarget;
    }
  }

  taskCount.textContent = `(${tasks.length})`;
  emptyMessage.hidden = tasks.length > 0;
  if (focusTarget) {
    focusTarget.focus();
  }
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

  const added = applyChange(() => {
    tasks.push({
      id: createId(),
      title,
      status: DEFAULT_STATUS,
      created_at: new Date().toISOString(),
    });
  });
  if (!added) {
    return;
  }

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
