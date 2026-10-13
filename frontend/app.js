"use strict";

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STORAGE_KEY = "task-flow-v1";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const PRIORITIES = [
  { value: "HIGH", label: "높음" },
  { value: "NORMAL", label: "보통" },
  { value: "LOW", label: "낮음" },
];
const DEFAULT_STATUS = "TODO";
const DEFAULT_PRIORITY = "NORMAL";

const tasks = [];
// 저장값을 읽지 못하면 기존 값을 덮어쓰지 않도록 저장을 막는다.
let storageBlocked = false;
// 수정 중인 항목의 id. 한 번에 하나만 수정한다.
let editingId = null;
let editError = "";
// 수정을 시작하거나 수정 오류가 났을 때만 수정 입력칸으로 포커스를 옮긴다.
let focusEditForm = false;
// 제목 검색, 상태, 우선순위 필터. 빈 값은 조건 없음이며 모두 AND로 적용한다.
const filters = { query: "", status: "", priority: "" };

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const priorityInput = document.getElementById("task-priority");
const dueInput = document.getElementById("task-due");
const submitButton = document.getElementById("submit-button");
const formError = document.getElementById("form-error");
const storageError = document.getElementById("storage-error");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function textLength(value) {
  return Array.from(value).length;
}

// 검증 실패 시 오류 메시지, 통과 시 null을 반환한다.
function validateTitle(title) {
  const length = textLength(title);
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

function validateDescription(description) {
  const length = textLength(description);
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `설명은 ${DESCRIPTION_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

// YYYY-MM-DD 형식이면서 실제 존재하는 날짜인지 확인한다.
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validateTaskInput(input) {
  return (
    validateTitle(input.title) ||
    validateDescription(input.description) ||
    (isValidPriority(input.priority) ? null : "우선순위가 올바르지 않습니다.") ||
    (input.due_date !== null && !isValidDate(input.due_date)
      ? "마감일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다."
      : null)
  );
}

// 입력값을 저장 형식으로 정리한다. 빈 마감일은 null이다.
function readTaskInput(title, description, priority, dueDate) {
  return {
    title: title.trim(),
    description,
    priority,
    due_date: dueDate === "" ? null : dueDate,
  };
}

function isValidStatus(status) {
  return STATUSES.some((item) => item.value === status);
}

function isValidPriority(priority) {
  return PRIORITIES.some((item) => item.value === priority);
}

function labelOf(list, value) {
  return list.find((item) => item.value === value).label;
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    (task.status === undefined || isValidStatus(task.status)) &&
    (task.description === undefined || typeof task.description === "string") &&
    (task.priority === undefined || isValidPriority(task.priority)) &&
    (task.due_date === undefined || task.due_date === null || isValidDate(task.due_date))
  );
}

function withDefault(value, fallback) {
  return value === undefined ? fallback : value;
}

// 저장값이 없으면 빈 목록, 읽을 수 없거나 형식이 다르면 예외를 던진다.
// 이전 단계에서 저장한 항목에 없는 필드는 PRD 기본값으로 채운다.
function loadTasks() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(isValidTask)) {
    throw new Error("저장값 형식이 올바르지 않습니다.");
  }
  return data.map((task) => ({
    ...task,
    status: withDefault(task.status, DEFAULT_STATUS),
    description: withDefault(task.description, ""),
    priority: withDefault(task.priority, DEFAULT_PRIORITY),
    due_date: withDefault(task.due_date, null),
  }));
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
  for (const control of [titleInput, descriptionInput, priorityInput, dueInput, submitButton]) {
    control.disabled = true;
  }
  storageError.textContent =
    `저장된 데이터(${STORAGE_KEY})를 읽을 수 없어 등록을 중지했습니다. ` +
    `기존 값은 변경하지 않았습니다. (${reason})`;
}

// 로컬 달력 기준 오늘 날짜(YYYY-MM-DD).
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isOverdue(task, today) {
  return task.due_date !== null && task.status !== "DONE" && task.due_date < today;
}

function matchesFilters(task) {
  const query = filters.query.trim().toLowerCase();
  return (
    (query === "" || task.title.toLowerCase().includes(query)) &&
    (filters.status === "" || task.status === filters.status) &&
    (filters.priority === "" || task.priority === filters.priority)
  );
}

function hasFilters() {
  return filters.query.trim() !== "" || filters.status !== "" || filters.priority !== "";
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
  focusEditForm = true;
  render();
}

function cancelEdit() {
  editingId = null;
  editError = "";
  render();
}

function saveEdit(id, input) {
  const task = findTask(id);
  if (!task) {
    cancelEdit();
    return;
  }
  const error = validateTaskInput(input);
  if (error) {
    editError = error;
    focusEditForm = true;
    render();
    return;
  }
  if (applyChange(() => {
    Object.assign(task, input);
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

function createSelect(options, value, ariaLabel) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", ariaLabel);
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function createStatusSelect(task) {
  const select = createSelect(STATUSES, task.status, "상태");
  select.addEventListener("change", () => changeStatus(task.id, select.value));
  return select;
}

function createEditForm(task) {
  const container = document.createElement("div");
  container.className = "task-edit";

  const titleField = document.createElement("input");
  titleField.type = "text";
  titleField.value = task.title;
  titleField.setAttribute("aria-label", "제목 수정");

  const descriptionField = document.createElement("textarea");
  descriptionField.rows = 3;
  descriptionField.value = task.description;
  descriptionField.setAttribute("aria-label", "설명 수정");
  descriptionField.placeholder = "설명 (최대 2000자)";

  const priorityField = createSelect(PRIORITIES, task.priority, "우선순위 수정");

  const dueField = document.createElement("input");
  dueField.type = "date";
  dueField.value = task.due_date === null ? "" : task.due_date;
  dueField.setAttribute("aria-label", "마감일 수정");

  const save = () =>
    saveEdit(
      task.id,
      readTaskInput(titleField.value, descriptionField.value, priorityField.value, dueField.value)
    );

  titleField.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      save();
    }
  });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancelEdit();
    }
  });

  const options = document.createElement("div");
  options.className = "form-row";
  options.appendChild(priorityField);
  options.appendChild(dueField);
  options.appendChild(createButton("저장", save));
  options.appendChild(createButton("취소", cancelEdit));

  container.appendChild(titleField);
  container.appendChild(descriptionField);
  container.appendChild(options);
  return { container, focusTarget: titleField };
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function createTaskItem(task, today) {
  const item = document.createElement("li");
  item.dataset.id = task.id;
  const classes = [];
  if (task.status === "DONE") {
    classes.push("done");
  }
  if (isOverdue(task, today)) {
    classes.push("overdue");
  }
  item.className = classes.join(" ");

  if (task.id === editingId) {
    const { container, focusTarget } = createEditForm(task);
    item.appendChild(container);
    if (editError) {
      const error = document.createElement("p");
      error.className = "form-error";
      error.textContent = editError;
      item.appendChild(error);
    }
    return { item, focusTarget };
  }

  const main = document.createElement("div");
  main.className = "task-main";

  const info = document.createElement("div");
  info.className = "task-info";

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.appendChild(
    createBadge(labelOf(PRIORITIES, task.priority), `priority-${task.priority.toLowerCase()}`)
  );
  if (task.due_date !== null) {
    meta.appendChild(createBadge(`마감 ${task.due_date}`, "due"));
  }
  if (isOverdue(task, today)) {
    meta.appendChild(createBadge("지연", "overdue-badge"));
  }

  info.appendChild(title);
  info.appendChild(meta);
  if (task.description !== "") {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    info.appendChild(description);
  }

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.appendChild(createStatusSelect(task));
  actions.appendChild(createButton("수정", () => startEdit(task.id)));
  actions.appendChild(createButton("삭제", () => deleteTask(task.id)));

  main.appendChild(info);
  main.appendChild(actions);
  item.appendChild(main);
  return { item, focusTarget: null };
}

function render() {
  taskList.replaceChildren();
  const today = todayString();
  const visible = tasks.filter(matchesFilters);
  let focusTarget = null;

  for (const task of visible) {
    const created = createTaskItem(task, today);
    taskList.appendChild(created.item);
    if (created.focusTarget) {
      focusTarget = created.focusTarget;
    }
  }

  taskCount.textContent = hasFilters()
    ? `(${visible.length} / 전체 ${tasks.length})`
    : `(${tasks.length})`;
  emptyMessage.hidden = visible.length > 0;
  emptyMessage.textContent =
    tasks.length === 0 ? "등록된 할 일이 없습니다." : "조건에 맞는 할 일이 없습니다.";
  if (focusTarget && focusEditForm) {
    focusTarget.focus();
  }
  focusEditForm = false;
}

function resetForm() {
  titleInput.value = "";
  descriptionInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueInput.value = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (storageBlocked) {
    return;
  }

  const input = readTaskInput(
    titleInput.value,
    descriptionInput.value,
    priorityInput.value,
    dueInput.value
  );
  const error = validateTaskInput(input);
  if (error) {
    formError.textContent = error;
    titleInput.focus();
    return;
  }

  const added = applyChange(() => {
    tasks.push({
      id: createId(),
      title: input.title,
      description: input.description,
      status: DEFAULT_STATUS,
      priority: input.priority,
      due_date: input.due_date,
      created_at: new Date().toISOString(),
    });
  });
  if (!added) {
    return;
  }

  resetForm();
  titleInput.focus();
  render();
});

searchInput.addEventListener("input", () => {
  filters.query = searchInput.value;
  render();
});
statusFilter.addEventListener("change", () => {
  filters.status = statusFilter.value;
  render();
});
priorityFilter.addEventListener("change", () => {
  filters.priority = priorityFilter.value;
  render();
});

try {
  tasks.push(...loadTasks());
} catch (loadError) {
  blockStorage(loadError.message);
}
render();
