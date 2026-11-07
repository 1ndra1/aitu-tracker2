const firebaseConfig = {
 apiKey: "AIzaSyC7_YrJbvxm5J3wfnB4eJUnlHv3Lc0txIU",
 authDomain: "aitu-tracker.firebaseapp.com",
 projectId: "aitu-tracker",
 storageBucket: "aitu-tracker.firebasestorage.app",
 messagingSenderId: "100318909623",
 appId: "1:100318909623:web:2d89ea9da5d761b1afe932",
 measurementId: "G-YEQW415HFR"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let tasks = JSON.parse(localStorage.getItem('aitu_tasks')) || [];
let currentUser = null;
let isMigratingGuestData = false;
let unsubscribeTasks = null;
let unsubscribeSchedule = null;
let currentDate = getToday();
let authMode = 'login';
let toastTimer = null;
let reminderShown = false;
let editingId = null;
let calDate = new Date();
let subjectsMap = {};
const clickSound = new Audio('done.mp3');
const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const defaultSchedule = [
 { day: "Понедельник", classes: [{ time: "-", name: "Самостоятельное обучение", room: "-" }] },
 { day: "Вторник", classes: [
 { time: "08:00-10:00", name: "Иностранный язык 1 (B2)", room: "C1.1.365" },
 { time: "10:00-12:00", name: "Линейная алгебра", room: "C1.3.234" }
 ]},
 { day: "Среда", classes: [
 { time: "08:00-09:00", name: "Линейная алгебра", room: "C1.3.234" },
 { time: "10:00-12:00", name: "Введение в программирование", room: "C1.1.353" },
 { time: "12:00-14:00", name: "Математический анализ", room: "C1.3.365" },
 { time: "20:00-22:00", name: "ИКТ", room: "Онлайн" }
 ]},
 { day: "Четверг", classes: [
 { time: "08:00", name: "Культурология", room: "C1.1.254" },
 { time: "11:00", name: "ИКТ", room: "-" },
 { time: "14:00", name: "Физическая культура (Волейбол)", room: "Спортзал" },
 { time: "20:00", name: "Введение в программирование", room: "Онлайн" }
 ]},
 { day: "Пятница", classes: [
 { time: "08:00", name: "Иностранный язык 1 (B2)", room: "-" },
 { time: "10:00", name: "Культурология", room: "-" },
 { time: "11:00", name: "Введение в программирование", room: "-" },
 { time: "20:00", name: "ИКТ", room: "Онлайн" }
 ]},
 { day: "Суббота", classes: [] },
 { day: "Воскресенье", classes: [] }
];

let scheduleData = JSON.parse(localStorage.getItem('aitu_schedule')) || defaultSchedule;

function init() {
 initTheme();
 initCustomSelects();
 loadSubjects();
 updateAuthUI();
 document.getElementById('datePicker').value = currentDate;
 updateDateLabel();
 renderTasks();
 renderSchedule();
}

function getToday() {
 return dateToString(new Date());
}

function dateToString(d) {
 let month = String(d.getMonth() + 1).padStart(2, '0');
 let day = String(d.getDate()).padStart(2, '0');
 return d.getFullYear() + '-' + month + '-' + day;
}

function userDoc() {
 return db.collection('users').doc(currentUser.uid);
}

function loadSubjects() {
 db.collection('subjects').get().then(function (snap) {
 let select = document.getElementById('taskSubject');
 select.innerHTML = '<option value="" disabled selected>Выберите предмет</option>';
 snap.forEach(function (d) {
 subjectsMap[d.id] = d.data();
 select.innerHTML += '<option value="' + d.id + '">' + escapeHTML(d.data().subject_name) + '</option>';
 });
 enhanceSelect(select);

 let filter = document.getElementById('filterSubject');
 filter.innerHTML = '<option value="">Все предметы</option>';
 snap.forEach(function (d) {
 filter.innerHTML += '<option value="' + d.id + '">' + escapeHTML(d.data().subject_name) + '</option>';
 });
 enhanceSelect(filter);
 renderTasks();
 });
}

function saveTasks() {
 if (!currentUser) {
 localStorage.setItem('aitu_tasks', JSON.stringify(tasks));
 }
}

function saveSchedule() {
 if (currentUser) {
 userDoc().collection('settings').doc('schedule').set({ days: scheduleData }).catch(showCloudError);
 } else {
 localStorage.setItem('aitu_schedule', JSON.stringify(scheduleData));
 }
 renderSchedule();
}

function showCloudError(error) {
 console.error('Firebase error:', error);
 alert('Не удалось сохранить в облако: ' + error.message);
}

function startCloudSync() {
 unsubscribeTasks = db.collection('tasks')
 .where('user_id', '==', currentUser.uid)
 .onSnapshot(function (snapshot) {
 tasks = snapshot.docs.map(function (d) {
 return Object.assign({ id: d.id }, d.data());
 });
 renderTasks();
 }, showCloudError);

 unsubscribeSchedule = userDoc().collection('settings').doc('schedule').onSnapshot(function (doc) {
 if (doc.exists) {
 scheduleData = doc.data().days;
 } else if (!doc.metadata.fromCache && !isMigratingGuestData) {
    scheduleData = JSON.parse(JSON.stringify(defaultSchedule));
    doc.ref.set({ days: scheduleData });
}
 renderSchedule();
 }, showCloudError);
}

function stopCloudSync() {
 if (unsubscribeTasks) unsubscribeTasks();
 if (unsubscribeSchedule) unsubscribeSchedule();
 unsubscribeTasks = null;
 unsubscribeSchedule = null;

 tasks = JSON.parse(localStorage.getItem('aitu_tasks')) || [];
 scheduleData = JSON.parse(localStorage.getItem('aitu_schedule')) || defaultSchedule;
 renderTasks();
 renderSchedule();
}

auth.languageCode = 'ru';

auth.onAuthStateChanged(function (user) {
 if (user && !user.emailVerified) {
 return;
 }
 if (user) {
 currentUser = {
    uid: user.uid,
    name: user.displayName || user.email,
    email: user.email,
    createdAt: user.metadata.creationTime
};
 startCloudSync();
 } else {
 let wasLoggedIn = (currentUser !== null);
 currentUser = null;
 if (wasLoggedIn) stopCloudSync();
 }
 updateAuthUI();
});

function switchTab(tabId, btn) {
 let contents = document.querySelectorAll('.tab-content');
 let buttons = document.querySelectorAll('.tab-btn');
 contents.forEach(el => el.classList.remove('active'));
 buttons.forEach(el => el.classList.remove('active'));

 document.getElementById('tab-' + tabId).classList.add('active');
 btn.classList.add('active');
}

function setDate(dateStr) {
 if (!dateStr) return;
 currentDate = dateStr;
 updateDateLabel();
 renderTasks();
}

function changeDate(days) {
 let d = new Date(currentDate + 'T00:00:00');
 d.setDate(d.getDate() + days);
 currentDate = dateToString(d);
 document.getElementById('datePicker').value = currentDate;
 updateDateLabel();
 renderTasks();
}

function updateDateLabel() {
 let d = new Date(currentDate + 'T00:00:00');
 let dayName = daysOfWeek[d.getDay()];
 let text = dayName;
 if (currentDate === getToday()) {
 text = text + ' (Сегодня)';
 }
 document.getElementById('dateLabel').innerText = text;
}

function renderTasks() {
 if (currentUser) {
    renderProfile();
}
 renderStreak();
 renderReminders();
 renderCalendar();

 let list = document.getElementById('taskList');
 list.innerHTML = '';

 let search = document.getElementById('searchInput').value.trim().toLowerCase();
 let subjectFilter = document.getElementById('filterSubject').value;
 let sortBy = document.getElementById('sortBy').value;

 // 1) Which tasks: if the user is searching, look in ALL days; otherwise only the chosen day
 let shown = tasks.filter(t => search ? true : t.date === currentDate);

 // 2) Search by title
 if (search) {
 shown = shown.filter(t => t.title.toLowerCase().includes(search));
 }

 // 3) Filter by subject
 if (subjectFilter) {
 shown = shown.filter(t => t.subject_id === subjectFilter);
 }

 if (shown.length === 0) {
 list.innerHTML = '<div class="empty-state"><img src="empty-state.svg" width="64" height="64" alt=""><p>' +
 (search || subjectFilter ? 'Ничего не найдено.' : 'На этот день задач нет. Добавьте новую задачу ниже.') + '</p></div>';
 return;
 }

 // 4) Sorting
 shown.sort(function (a, b) {
 if (sortBy === 'status') {
 return Number(a.done) - Number(b.done);
 }
 if (sortBy === 'subject') {
 return subjectName(a).localeCompare(subjectName(b));
 }
 return (a.time || "24:00").localeCompare(b.time || "24:00");
 });
 if (search) {
 shown.sort((a, b) => a.date.localeCompare(b.date));
 }

 shown.forEach(task => {
 if (task.id === editingId) {
 list.appendChild(buildEditForm(task));
 return;
 }
 let item = document.createElement('div');
 item.className = 'task-item' + (task.done ? ' completed' : '');

 item.innerHTML =
 `<input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask('${task.id}')">` +
 `<div class="task-content">` +
 `<div class="task-title">${escapeHTML(task.title)}</div>` +
 `<div class="task-meta">` +
 `<span class="task-subject">${escapeHTML(subjectName(task))}</span>` +
 (search ? `<span>${task.date}</span>` : '') +
 (task.time ? `<span>Время: ${task.time}</span>` : '') +
 `</div>` +
 `</div>` +
 `<button class="task-edit" onclick="editTask('${task.id}')" title="Изменить" aria-label="Изменить задачу">&#9998;</button>` +
 `<button class="task-delete" onclick="deleteTask('${task.id}')" title="Удалить">&times;</button>`;

 list.appendChild(item);
 });
}

function subjectName(task) {
 return subjectsMap[task.subject_id] ? subjectsMap[task.subject_id].subject_name : '';
}

// FR-05: edit a task right inside its card (title, subject, time)
function editTask(id) {
 editingId = id;
 renderTasks();
 let input = document.getElementById('editTitle');
 if (input) input.focus();
}

function cancelEdit() {
 editingId = null;
 renderTasks();
}

function buildEditForm(task) {
 let parts = (task.time || '').split(':');
 let hour = parts[0] || '';
 let minute = parts[1] || '';

 let subjectOptions = '';
 Object.keys(subjectsMap).forEach(function (sid) {
 subjectOptions += '<option value="' + sid + '"' + (sid === task.subject_id ? ' selected' : '') + '>' +
 escapeHTML(subjectsMap[sid].subject_name) + '</option>';
 });

 let hourOptions = '<option value="">ЧЧ</option>';
 for (let h = 0; h < 24; h++) {
 let v = String(h).padStart(2, '0');
 hourOptions += '<option value="' + v + '"' + (v === hour ? ' selected' : '') + '>' + v + '</option>';
 }

 let minuteOptions = '<option value="">ММ</option>';
 for (let m = 0; m < 60; m++) {
 let v = String(m).padStart(2, '0');
 minuteOptions += '<option value="' + v + '"' + (v === minute ? ' selected' : '') + '>' + v + '</option>';
 }

 let item = document.createElement('div');
 item.className = 'task-item editing';
 item.innerHTML =
 '<div class="edit-form">' +
 '<input type="text" id="editTitle" value="' + escapeHTML(task.title) + '" maxlength="200" ' +
 'onkeydown="if(event.key===\'Enter\')saveEdit(\'' + task.id + '\');if(event.key===\'Escape\')cancelEdit();">' +
 '<div class="edit-row">' +
 '<select id="editSubject">' + subjectOptions + '</select>' +
 '<select id="editHour" aria-label="Часы">' + hourOptions + '</select>' +
 '<span>:</span>' +
 '<select id="editMinute" aria-label="Минуты">' + minuteOptions + '</select>' +
 '</div>' +
 '<div class="edit-row">' +
 '<button class="btn btn-primary" onclick="saveEdit(\'' + task.id + '\')">Сохранить</button>' +
 '<button class="btn btn-outline" onclick="cancelEdit()">Отмена</button>' +
 '</div>' +
 '</div>';
 return item;
}

function saveEdit(id) {
 let task = tasks.find(t => t.id === id);
 if (!task) return;

 let title = document.getElementById('editTitle').value.trim();
 let subject = document.getElementById('editSubject').value;
 let hour = document.getElementById('editHour').value;
 let minute = document.getElementById('editMinute').value;

 if (title === '') {
 showToast('Название не может быть пустым');
 return;
 }
 let time = hour ? hour + ':' + (minute || '00') : '';

 editingId = null;
 if (currentUser) {
 db.collection('tasks').doc(id).update({ title: title, subject_id: subject, time: time }).catch(showCloudError);
 } else {
 task.title = title;
 task.subject_id = subject;
 task.time = time;
 saveTasks();
 renderTasks();
 }
 showToast('Задача изменена');
}

// FR-03: streak = how many days in a row (up to today) have at least one completed task
function calcStreak() {
 let days = {};
 tasks.forEach(function (t) {
 if (!t.done) return;
 let d = getCompletedDate(t);
 if (d) days[dateToString(d)] = true;
 });

 let day = new Date();
 // if nothing is done today yet, the streak is still alive until the end of today
 if (!days[dateToString(day)]) {
 day.setDate(day.getDate() - 1);
 }

 let streak = 0;
 while (days[dateToString(day)]) {
 streak++;
 day.setDate(day.getDate() - 1);
 }
 return streak;
}

function renderStreak() {
 let stat = document.getElementById('statStreak');
 if (stat) stat.textContent = calcStreak();
}

function dayWord(n) {
 let last = n % 10, two = n % 100;
 if (two >= 11 && two <= 14) return 'дней';
 if (last === 1) return 'день';
 if (last >= 2 && last <= 4) return 'дня';
 return 'дней';
}

// Reminders: show unfinished tasks that are overdue, due today or due tomorrow
// Reminders (bell in the header): unfinished tasks that are overdue, due today or due tomorrow
function renderReminders() {
 let today = getToday();
 let t = new Date();
 t.setDate(t.getDate() + 1);
 let tomorrow = dateToString(t);

 let items = [];
 tasks.forEach(function (task) {
 if (task.done) return;
 if (task.date === today) items.push({ task: task, type: 'today', order: 0 });
 else if (task.date === tomorrow) items.push({ task: task, type: 'tomorrow', order: 1 });
 else if (task.date < today) items.push({ task: task, type: 'overdue', order: 2 });
 });

 // today first, then tomorrow, then overdue (the newest overdue first)
 items.sort(function (a, b) {
 if (a.order !== b.order) return a.order - b.order;
 return a.type === 'overdue' ? b.task.date.localeCompare(a.task.date) : (a.task.time || '').localeCompare(b.task.time || '');
 });

 let labels = { overdue: 'Просрочено', today: 'Сегодня', tomorrow: 'Завтра' };
 let html = '';
 items.forEach(function (it) {
 html += '<div class="notif-item" onclick="openFromNotif(\'' + it.task.date + '\')">' +
 '<span class="chip chip-' + it.type + '">' + labels[it.type] + '</span>' +
 '<div class="notif-title">' + escapeHTML(it.task.title) + '</div>' +
 '<div class="notif-meta">' + escapeHTML(subjectName(it.task)) + ' · ' + it.task.date +
 (it.task.time ? ' ' + it.task.time : '') + '</div>' +
 '</div>';
 });
 if (items.length === 0) html = '<div class="notif-empty">Нет напоминаний</div>';
 document.getElementById('notifList').innerHTML = html;

 let badge = document.getElementById('notifBadge');
 badge.textContent = items.length > 99 ? '99+' : items.length;
 badge.style.display = items.length ? 'block' : 'none';

 if (items.length && !reminderShown) {
 reminderShown = true;
 showToast('У вас напоминания: ' + items.length);
 }
}

function toggleNotif(e) {
 e.stopPropagation();
 document.getElementById('notifPanel').classList.toggle('open');
}

function closeNotif() {
 document.getElementById('notifPanel').classList.remove('open');
}

function openFromNotif(dateStr) {
 closeNotif();
 openCalendarDay(dateStr);
}

document.addEventListener('click', function (e) {
 if (!e.target.closest('.notif-wrap')) closeNotif();
});

// Calendar tab
function renderCalendar() {
 let grid = document.getElementById('calGrid');
 if (!grid) return;

 let year = calDate.getFullYear();
 let month = calDate.getMonth();
 let title = new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
 document.getElementById('calTitle').textContent = title;

 let html = '';
 ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(function (d) {
 html += '<div class="cal-head">' + d + '</div>';
 });

 // empty cells before the 1st (week starts on Monday)
 let offset = (new Date(year, month, 1).getDay() + 6) % 7;
 for (let i = 0; i < offset; i++) html += '<div></div>';

 let daysInMonth = new Date(year, month + 1, 0).getDate();
 for (let day = 1; day <= daysInMonth; day++) {
 let dateStr = dateToString(new Date(year, month, day));
 let count = tasks.filter(t => t.date === dateStr).length;
 let cls = 'cal-day';
 if (dateStr === getToday()) cls += ' today';
 if (dateStr === currentDate) cls += ' selected';
 html += '<button class="' + cls + '" onclick="openCalendarDay(\'' + dateStr + '\')">' + day +
 (count ? '<span class="cal-count">' + count + '</span>' : '') + '</button>';
 }
 grid.innerHTML = html;
}

function changeMonth(step) {
 calDate = new Date(calDate.getFullYear(), calDate.getMonth() + step, 1);
 renderCalendar();
}

function openCalendarDay(dateStr) {
 document.getElementById('datePicker').value = dateStr;
 setDate(dateStr);
 switchTab('tasks', document.querySelector('.tab-btn'));
}

function addTask(e) {
 e.preventDefault();
 let title = document.getElementById('taskTitle').value.trim();
 let subject = document.getElementById('taskSubject').value;
 let time = document.getElementById('taskTime').value;

 if (!title || !subject) return;


 let addSound = document.getElementById('add-sound');
 if (addSound) {
  addSound.currentTime = 0;
  addSound.play().catch(err => console.log("Sound error:", err));
 }

 showToast("Added!");
 let newTask = {
 title: title,
 subject_id: subject,
 time: time,
 date: currentDate,
 done: false
 };

 if (currentUser) {
 newTask.user_id = currentUser.uid;
 newTask.createdAt = firebase.firestore.FieldValue.serverTimestamp();
 db.collection('tasks').add(newTask).catch(showCloudError);
 } else {
 newTask.id = Date.now().toString();
 tasks.push(newTask);
 saveTasks();
 renderTasks();
 }

 document.getElementById('taskTitle').value = '';
 resetTimePicker();
}

function showToast(text) {
 let toast = document.getElementById('toast');
 toast.textContent = text;
 toast.classList.add('show');
 clearTimeout(toastTimer);
 toastTimer = setTimeout(function () {
 toast.classList.remove('show');
 }, 2500);
}

function toggleTask(id) {
    let task = tasks.find(t => t.id === id);
    if (!task) return;

    let newDone = !task.done;

    if (newDone) {
        showToast('Задача выполнена: ' + task.title);
    }

    if (currentUser) {
        db.collection('tasks').doc(id).update({
            done: newDone,
            completedAt: newDone
                ? firebase.firestore.FieldValue.serverTimestamp()
                : null
        }).catch(showCloudError);
    } else {
        task.done = newDone;
        task.completedAt = newDone ? new Date().toISOString() : null;
        saveTasks();
        renderTasks();
    }
}

function deleteTask(id) {
 if (currentUser) {
 db.collection('tasks').doc(id).delete().catch(showCloudError);
 } else {
 tasks = tasks.filter(t => t.id !== id);
 saveTasks();
 renderTasks();
 }
}

function renderSchedule() {
 let container = document.getElementById('scheduleContainer');
 let html = '';

 scheduleData.forEach((day, dayIndex) => {
 let classesHtml = '';

 if (day.classes.length === 0) {
 classesHtml = '<div class="class-item"><div class="day-off">Выходной</div></div>';
 } else {
 day.classes.forEach((c, classIndex) => {
 classesHtml +=
 '<div class="class-item">' +
 '<div class="class-time">' + escapeHTML(c.time) + '</div>' +
 '<div class="class-name">' + escapeHTML(c.name) + '</div>' +
 '<div class="class-room">' + escapeHTML(c.room) + '</div>' +
 '<button class="class-delete" onclick="deleteScheduleClass(' + dayIndex + ',' + classIndex + ')" title="Удалить">&times;</button>' +
 '</div>';
 });
 }

 html +=
 '<div class="day-card">' +
 '<div class="day-header">' + day.day + '</div>' +
 '<div class="day-body">' + classesHtml + '</div>' +
 '</div>';
 });

 container.innerHTML = html;
}

function addScheduleClass(e) {
 e.preventDefault();
 let dayName = document.getElementById('schedDay').value;
 let name = document.getElementById('schedName').value.trim();
 let room = document.getElementById('schedRoom').value.trim();
 let time = document.getElementById('schedTime').value.trim();

 if (!name || !room || !time) return;
 clickSound.currentTime = 0;
  clickSound.play();
 let dayObj = scheduleData.find(d => d.day === dayName);
 if (dayObj) {
 dayObj.classes.push({ time: time, name: name, room: room });
 saveSchedule();
 }

 document.getElementById('schedName').value = '';
 document.getElementById('schedRoom').value = '';
 document.getElementById('schedTime').value = '';
}

function deleteScheduleClass(dayIndex, classIndex) {
 scheduleData[dayIndex].classes.splice(classIndex, 1);
 saveSchedule();
}

function updateAuthUI() {
 let box = document.getElementById('authContainer');
 let profileTab = document.getElementById('profileTabBtn');

if (profileTab) {
    profileTab.style.display = currentUser ? 'block' : 'none';
}
 if (currentUser) {
 box.innerHTML =
 '<span style="font-weight: bold; font-size: 0.9rem;">' + escapeHTML(currentUser.name) + '</span>' +
 '<button class="btn btn-outline" onclick="logout()">Выйти</button>';
 } else {
 box.innerHTML =
 '<button class="btn btn-outline" onclick="openModal(\'login\')">Войти</button>' +
 '<button class="btn btn-primary" onclick="openModal(\'register\')">Регистрация</button>';
 }
}

function openModal(mode) {
 authMode = mode;
 clearErrors();

 if (mode === 'login') {
 document.getElementById('modalTitle').innerText = 'Вход';
 document.getElementById('authSubmitBtn').innerText = 'Войти';
 document.getElementById('authSwitch').innerText = 'Нет аккаунта? Зарегистрируйтесь';
 document.getElementById('nameGroup').style.display = 'none';
 } else {
 document.getElementById('modalTitle').innerText = 'Регистрация';
 document.getElementById('authSubmitBtn').innerText = 'Зарегистрироваться';
 document.getElementById('authSwitch').innerText = 'Уже есть аккаунт? Войдите';
 document.getElementById('nameGroup').style.display = 'block';
 }

 document.getElementById('authModal').classList.add('active');
}

function closeModal() {
 document.getElementById('authModal').classList.remove('active');
 document.getElementById('authForm').reset();
 document.getElementById('authPassword').type = 'password';
 clearErrors();
}

function toggleAuthMode() {
 openModal(authMode === 'login' ? 'register' : 'login');
}

function togglePassword() {
 let input = document.getElementById('authPassword');
 input.type = (input.type === 'password') ? 'text' : 'password';
}

function showError(boxId, errorId, message) {
 document.getElementById(boxId).classList.add('error');
 document.getElementById(errorId).innerText = message;
}

function clearErrors() {
 ['nameBox', 'emailBox', 'passBox'].forEach(id => document.getElementById(id).classList.remove('error'));
 ['nameError', 'emailError', 'passError'].forEach(id => document.getElementById(id).innerText = '');
}

async function migrateGuestData(uid) {
    const guestTasks = JSON.parse(
        localStorage.getItem('aitu_tasks') || '[]'
    );

    const guestSchedule = JSON.parse(
        localStorage.getItem('aitu_schedule') || 'null'
    ) || scheduleData;


    for (let i = 0; i < guestTasks.length; i += 450) {
        const batch = db.batch();
        const chunk = guestTasks.slice(i, i + 450);

        chunk.forEach((task, index) => {
            const taskId = task.id || `${i + index}`;
            

            const safeId = encodeURIComponent(String(taskId));
            const docId = `guest_${uid}_${safeId}`;

            const taskRef = db.collection('tasks').doc(docId);

            const taskData = { ...task };

            delete taskData.id;
            delete taskData.user_id;
            delete taskData.createdAt;

            taskData.user_id = uid;
            taskData.createdAt =
                firebase.firestore.FieldValue.serverTimestamp();

            batch.set(taskRef, taskData);
        });

        await batch.commit();
    }
 
    await db.collection('users')
        .doc(uid)
        .collection('settings')
        .doc('schedule')
        .set({
            days: guestSchedule
        });


    localStorage.removeItem('aitu_tasks');
    localStorage.removeItem('aitu_schedule');

    showToast('Гостевые данные перенесены в аккаунт!');
}


function handleAuth(e) {
    e.preventDefault();
    clearErrors();

    let name = document.getElementById('authName').value.trim();
    let email = document.getElementById('authEmail').value.trim().toLowerCase();
    let password = document.getElementById('authPassword').value;

    let ok = true;

    if (authMode === 'register' && name === '') {
        showError('nameBox', 'nameError', 'Введите имя');
        ok = false;
    }

    let emailPattern = /^[a-z0-9._%+-]{3,}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

    if (!emailPattern.test(email)) {
        showError('emailBox', 'emailError',
            'Введите правильный email, например student@aitu.edu.kz');
        ok = false;
    }

    if (password.length < 6) {
        showError('passBox', 'passError',
            'Пароль должен быть не короче 6 символов');
        ok = false;
    }

    if (!ok) return;

    let btn = document.getElementById('authSubmitBtn');
    btn.disabled = true;

    let request;

    if (authMode === 'register') {
        isMigratingGuestData = true;

        request = auth.createUserWithEmailAndPassword(email, password)
            .then(function (cred) {
                return db.collection('users').doc(cred.user.uid).set({
                    email: email,
                    name: name,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(function () {
                    return cred.user.updateProfile({
                        displayName: name
                    });
                }).then(function () {
                    return migrateGuestData(cred.user.uid);
                }).then(function () {
                    return cred.user.sendEmailVerification();
                }).then(function () {
                    return auth.signOut();
                }).then(function () {
                    alert('Мы отправили письмо на ' + email + '. Перейдите по ссылке в письме (проверьте и «Спам»), затем войдите.');
                });
            });
    } else {
        request = auth.signInWithEmailAndPassword(email, password)
            .then(function (cred) {
                if (!cred.user.emailVerified) {
                    return cred.user.sendEmailVerification().then(function () {
                        return auth.signOut();
                    }).then(function () {
                        throw { code: 'app/email-not-verified' };
                    });
                }
            });
    }

    request
        .then(function () {
            isMigratingGuestData = false;
            closeModal();
        })
        .catch(function (error) {
            isMigratingGuestData = false;
            showAuthError(error);
        })
        .then(function () {
            btn.disabled = false;
        });
}


function showAuthError(error) {
 let code = error.code;
 if (code === 'auth/email-already-in-use') {
 showError('emailBox', 'emailError', 'Этот email уже зарегистрирован');
 } else if (code === 'auth/invalid-email') {
 showError('emailBox', 'emailError', 'Введите правильный email');
 } else if (code === 'auth/weak-password') {
 showError('passBox', 'passError', 'Слишком простой пароль, минимум 6 символов');
 } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
 showError('passBox', 'passError', 'Неверный email или пароль');
 } else if (code === 'app/email-not-verified') {
 showError('emailBox', 'emailError', 'Email не подтверждён. Мы отправили новое письмо — перейдите по ссылке в нём.');
 } else if (code === 'auth/network-request-failed') {
 showError('passBox', 'passError', 'Нет интернета, попробуйте ещё раз');
 } else if (code === 'auth/too-many-requests') {
 showError('passBox', 'passError', 'Слишком много попыток, подождите немного');
 } else {
 showError('passBox', 'passError', 'Ошибка: ' + code);
 }
}
function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add("show");
  
  setTimeout(function() {
    toast.classList.remove("show");
  }, 3000);
}

function logout() {
 auth.signOut();
}

function initTheme() {
 if (localStorage.getItem('aitu_theme') === 'dark') {
 document.documentElement.setAttribute('data-theme', 'dark');
 }

 document.getElementById('themeToggle').addEventListener('click', function () {
 let now = document.documentElement.getAttribute('data-theme');
 let next = (now === 'dark') ? 'light' : 'dark';
 document.documentElement.setAttribute('data-theme', next);
 localStorage.setItem('aitu_theme', next);
 });
}

function escapeHTML(str) {
 return String(str).replace(/[&<>'"]/g, function (c) {
 return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
 });
}
let progressChart = null;

function renderProfile() {
    if (!currentUser) return;

    let total = tasks.length;
    let completed = tasks.filter(t => t.done).length;
    let pending = total - completed;
    let progress = total ? Math.round(completed / total * 100) : 0;

    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;

    document.getElementById('profileAvatar').textContent =
        (currentUser.name || 'U').charAt(0).toUpperCase();

    let registrationDate = currentUser.createdAt
        ? new Date(currentUser.createdAt).toLocaleDateString('ru-RU')
        : '—';

    document.getElementById('profileCreated').textContent = registrationDate;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statProgress').textContent = progress + '%';

    renderProfileChart();
    renderSubjectChart();
}

function getCompletedDate(task) {
    if (!task.completedAt) return null;

    if (task.completedAt.toDate) {
        return task.completedAt.toDate();
    }

    let date = new Date(task.completedAt);

    return isNaN(date.getTime()) ? null : date;
}

function renderProfileChart() {
    if (!currentUser || typeof Chart === 'undefined') return;

    let period = document.getElementById('statsPeriod').value;
    let now = new Date();

    let labels = [];
    let values = [];
    let keys = [];

    if (period === 'day') {
        for (let hour = 0; hour < 24; hour++) {
            labels.push(String(hour).padStart(2, '0') + ':00');
            keys.push(hour);
            values.push(0);
        }

        tasks.forEach(task => {
            if (!task.done) return;

            let date = getCompletedDate(task);

            if (
                date &&
                date.getFullYear() === now.getFullYear() &&
                date.getMonth() === now.getMonth() &&
                date.getDate() === now.getDate()
            ) {
                values[date.getHours()]++;
            }
        });
    }

    if (period === 'week') {
        for (let i = 6; i >= 0; i--) {
            let date = new Date(now);
            date.setDate(now.getDate() - i);

            let key = date.toDateString();

            keys.push(key);
            labels.push(date.toLocaleDateString('ru-RU', {
                weekday: 'short'
            }));
            values.push(0);
        }

        tasks.forEach(task => {
            if (!task.done) return;

            let date = getCompletedDate(task);
            if (!date) return;

            let index = keys.indexOf(date.toDateString());

            if (index !== -1) values[index]++;
        });
    }

    if (period === 'month') {
        for (let i = 29; i >= 0; i--) {
            let date = new Date(now);
            date.setDate(now.getDate() - i);

            keys.push(date.toDateString());
            labels.push(date.getDate() + '.' + (date.getMonth() + 1));
            values.push(0);
        }

        tasks.forEach(task => {
            if (!task.done) return;

            let date = getCompletedDate(task);
            if (!date) return;

            let index = keys.indexOf(date.toDateString());

            if (index !== -1) values[index]++;
        });
    }

    if (period === 'year') {
        for (let i = 11; i >= 0; i--) {
            let date = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );

            keys.push(date.getFullYear() + '-' + date.getMonth());

            labels.push(date.toLocaleDateString('ru-RU', {
                month: 'short'
            }));

            values.push(0);
        }

        tasks.forEach(task => {
            if (!task.done) return;

            let date = getCompletedDate(task);
            if (!date) return;

            let key = date.getFullYear() + '-' + date.getMonth();
            let index = keys.indexOf(key);

            if (index !== -1) values[index]++;
        });
    }

    let canvas = document.getElementById('progressChart');
    if (!canvas) return;

    if (progressChart) {
        progressChart.destroy();
    }

    let dark = document.documentElement.getAttribute('data-theme') === 'dark';

    progressChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Выполненные задачи',
                data: values,
                backgroundColor: '#0ea5e9',
                borderRadius: 6,
                maxBarThickness: 28
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: dark ? '#cbd5e1' : '#475569'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: dark ? '#cbd5e1' : '#475569'
                    },
                    grid: {
                        color: dark ? '#334155' : '#e2e8f0'
                    }
                }
            }
        }
    });
}

let subjectChart = null;

function renderSubjectChart() {
    if (!currentUser || typeof Chart === 'undefined') return;
    let canvas = document.getElementById('subjectChart');
    if (!canvas) return;

    // count total and done tasks for every subject
    let stats = {};
    tasks.forEach(function (t) {
        let name = subjectName(t) || 'Без предмета';
        if (!stats[name]) stats[name] = { total: 0, done: 0 };
        stats[name].total++;
        if (t.done) stats[name].done++;
    });

    let labels = Object.keys(stats);
    let totals = labels.map(n => stats[n].total);
    let dones = labels.map(n => stats[n].done);

    if (subjectChart) subjectChart.destroy();
    let dark = document.documentElement.getAttribute('data-theme') === 'dark';
    let textColor = dark ? '#cbd5e1' : '#475569';

    subjectChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Всего', data: totals, backgroundColor: '#94a3b8', borderRadius: 6, maxBarThickness: 22 },
                { label: 'Выполнено', data: dones, backgroundColor: '#0ea5e9', borderRadius: 6, maxBarThickness: 22 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textColor } } },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: dark ? '#334155' : '#e2e8f0' } },
                y: { ticks: { color: textColor }, grid: { display: false } }
            }
        }
    });
}

// POMODORO TIMER

let pomodoroMode = 'work';
let pomodoroInterval = null;
let pomodoroRemaining = 25 * 60;
let pomodoroSessions = Number(localStorage.getItem('pomodoroSessions')) || 0;
const pomodoroSound = new Audio('ALARMPOMODORO.mp3');
const RING_LENGTH = 2 * Math.PI * 100;
const modeNames = { work: 'Работа', short: 'Короткий отдых', long: 'Длинный отдых' };

let pomodoroDurations = {
    work: 25,
    short: 5,
    long: 15
};

function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroRemaining / 60);
    const seconds = pomodoroRemaining % 60;

    document.getElementById('pomodoroTime').textContent =
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');

    document.getElementById('pomodoroSessions').textContent =
        pomodoroSessions;

    document.getElementById('pomodoroLabel').textContent =
        modeNames[pomodoroMode];


    const total = pomodoroDurations[pomodoroMode] * 60;
    const ring = document.getElementById('pomodoroRing');
    ring.style.strokeDasharray = RING_LENGTH;
    ring.style.strokeDashoffset = RING_LENGTH * (1 - pomodoroRemaining / total);


    document.querySelectorAll('.pomodoro-modes button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === pomodoroMode);
    });
}

function stopPomodoroSound() {
    pomodoroSound.pause();
    pomodoroSound.currentTime = 0;
}

function setPomodoroMode(mode) {
    pausePomodoro();
    stopPomodoroSound();

    pomodoroMode = mode;
    pomodoroRemaining = pomodoroDurations[mode] * 60;

    updatePomodoroDisplay();
}

function startPomodoro() {
    if (pomodoroInterval !== null) return;

    stopPomodoroSound();

    pomodoroInterval = setInterval(() => {
        pomodoroRemaining--;

        if (pomodoroRemaining <= 0) {
            pomodoroRemaining = 0;
            pausePomodoro();

            if (pomodoroMode === 'work') {
                pomodoroSessions++;
                localStorage.setItem(
                    'pomodoroSessions',
                    pomodoroSessions
                );
            }

            pomodoroSound.currentTime = 0;
            pomodoroSound.play().catch(err => console.log('Sound error:', err));
            showToast('Время вышло!');
        }

        updatePomodoroDisplay();
    }, 1000);
}

function pausePomodoro() {
    if (pomodoroInterval !== null) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
}

function resetPomodoro() {
    pausePomodoro();
    stopPomodoroSound();
    pomodoroRemaining = pomodoroDurations[pomodoroMode] * 60;
    updatePomodoroDisplay();
}

function savePomodoroSettings() {
    const work = Number(document.getElementById('workDuration').value);
    const short = Number(document.getElementById('shortDuration').value);
    const long = Number(document.getElementById('longDuration').value);

    if (
        !Number.isInteger(work) || work < 1 || work > 120 ||
        !Number.isInteger(short) || short < 1 || short > 60 ||
        !Number.isInteger(long) || long < 1 || long > 60
    ) {
        showToast('Введи корректное время в указанных пределах.');
        return;
    }

    pomodoroDurations = {
        work: work,
        short: short,
        long: long
    };

    Object.keys(pomodoroDurations).forEach(mode => {
        localStorage.setItem(
            'pomodoro_' + mode,
            pomodoroDurations[mode]
        );
    });

    resetPomodoro();
    showToast('Настройки сохранены!');
}

function initPomodoro() {
    ['work', 'short', 'long'].forEach(mode => {
        const saved = Number(localStorage.getItem('pomodoro_' + mode));

        if (saved > 0) {
            pomodoroDurations[mode] = saved;
        }
    });

    document.getElementById('workDuration').value = pomodoroDurations.work;
    document.getElementById('shortDuration').value = pomodoroDurations.short;
    document.getElementById('longDuration').value = pomodoroDurations.long;

    pomodoroRemaining = pomodoroDurations.work * 60;
    updatePomodoroDisplay();
}

initPomodoro();


function enhanceSelect(select) {
    let wrap = select._wrap;

    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'cselect';
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        select.classList.add('native-hidden');
        select.tabIndex = -1;

        let btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cselect-btn';
        btn.addEventListener('click', function () {
            let isOpen = wrap.classList.contains('open');
            closeAllSelects();
            if (!isOpen) wrap.classList.add('open');
        });
        wrap.appendChild(btn);

        let list = document.createElement('div');
        list.className = 'cselect-list';
        wrap.appendChild(list);

        select.addEventListener('change', function () {
            refreshSelectText(select);
        });

        select._wrap = wrap;
        select._btn = btn;
        select._list = list;
    }

    select._list.innerHTML = '';
    Array.from(select.options).forEach(function (opt) {
        if (opt.disabled) return;
        let item = document.createElement('button');
        item.type = 'button';
        item.className = 'cselect-item';
        item.textContent = opt.textContent;
        item.addEventListener('click', function () {
            select.value = opt.value;
            select.dispatchEvent(new Event('change'));
            closeAllSelects();
        });
        select._list.appendChild(item);
    });

    refreshSelectText(select);
}

function refreshSelectText(select) {
    let opt = select.options[select.selectedIndex];
    select._btn.textContent = opt ? opt.textContent : '';
    select._btn.classList.toggle('placeholder', !select.value);

    let items = select._list.children;
    Array.from(select.options).filter(o => !o.disabled).forEach(function (o, i) {
        if (items[i]) items[i].classList.toggle('selected', o.value === select.value && select.value !== '');
    });
}

function closeAllSelects() {
    document.querySelectorAll('.cselect.open').forEach(el => el.classList.remove('open'));
}

function updateTimeValue() {
    let h = document.getElementById('taskHour').value;
    let m = document.getElementById('taskMinute').value;
    let result = '';
    if (h) result = h + ':' + (m || '00');
    document.getElementById('taskTime').value = result;
}

function resetTimePicker() {
    document.getElementById('taskHour').value = '';
    document.getElementById('taskMinute').value = '';
    document.getElementById('taskTime').value = '';
    refreshSelectText(document.getElementById('taskHour'));
    refreshSelectText(document.getElementById('taskMinute'));
}

function initCustomSelects() {
    ['taskSubject', 'schedDay', 'statsPeriod', 'taskHour', 'taskMinute', 'filterSubject', 'sortBy'].forEach(function (id) {
        enhanceSelect(document.getElementById(id));
    });

    document.getElementById('taskHour').addEventListener('change', updateTimeValue);
    document.getElementById('taskMinute').addEventListener('change', updateTimeValue);

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.cselect')) closeAllSelects();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAllSelects();
    });
}

window.onload = init;
