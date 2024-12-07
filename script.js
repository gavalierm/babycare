let activeTask = null;
let startTime = null;
let pauseTime = null;
let totalPausedTime = 0;
let timerInterval = null;
let lastTimerCheck = null;

const TASK_LABELS = {
    'breastfeeding': 'Breast Feeding',
    'bottlefeeding': 'Bottle Feeding',
    'sleep': 'Sleep',
    'nappy': 'Nappy Change'
};

// Pomocné funkcie pre formátovanie času
function formatTimeForDisplay(ms, showLabels = true) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (seconds < 60) {
        return showLabels ? `${seconds} seconds` : seconds.toString();
    }
    
    const time = `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    return showLabels ? `${time} minutes` : time;
}

function formatTimeOnly(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateForGrouping(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateWithoutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayWithoutTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    if (dateWithoutTime.getTime() === todayWithoutTime.getTime()) return 'Today';
    if (dateWithoutTime.getTime() === yesterdayWithoutTime.getTime()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper funkcia pre tlačidlá
function getControlButtons() {
    return {
        startBtn: document.getElementById('begin-btn'),
        stopBtn: document.getElementById('end-btn'),
        pauseBtn: document.getElementById('pause-btn')
    };
}

// UI funkcie
function setActiveType(type) {
    if (activeTask && type !== activeTask && type !== 'nappy') {
        console.log('Timer is running, cannot switch type');
        return;
    }

    document.body.className = `type-${type}`;
    
    const title = document.querySelector('.stage-title');
    title.textContent = TASK_LABELS[type] || 'Baby Care Tracker';

    if (type !== 'nappy') {
        // Nastavíme štýly pre begin tlačidlo
        const beginBtn = document.getElementById('begin-btn');
        if (beginBtn) {
            beginBtn.style.background = `var(--color-${type})`;
            beginBtn.style.color = type === 'bottlefeeding' ? '#000000' : '#ffffff';
            beginBtn.onclick = () => startTask(type);
        }
        
        // Nastavíme event listeners pre ostatné tlačidlá
        const endBtn = document.getElementById('end-btn');
        const pauseBtn = document.getElementById('pause-btn');
        
        if (endBtn) endBtn.onclick = () => stopTask(type);
        if (pauseBtn) pauseBtn.onclick = () => pauseTask(type);
    } else {
        // Nastavíme event listeners pre nappy tlačidlá
        const peeBtn = document.getElementById('pee-btn');
        const poopBtn = document.getElementById('poop-btn');
        
        if (peeBtn) peeBtn.onclick = () => logNappy('pee');
        if (poopBtn) poopBtn.onclick = () => logNappy('poop');
    }
}

function updateTimer() {
    if (!startTime || pauseTime) return;
    
    const elapsed = new Date() - startTime - totalPausedTime;
    const activeTimer = document.querySelector('.active-timer');
    
    activeTimer.querySelector('.time').textContent = formatTimeOnly(startTime);
    activeTimer.querySelector('.duration').textContent = formatTimeForDisplay(elapsed, false);
}

function updateActiveTaskDisplay() {
    const activeTimer = document.querySelector('.active-timer');
    
    if (activeTask && startTime) {
        const elapsed = new Date() - startTime - totalPausedTime;
        activeTimer.querySelector('.time').textContent = formatTimeOnly(startTime);
        activeTimer.querySelector('.duration').textContent = formatTimeForDisplay(elapsed);
    } else {
        activeTimer.querySelector('.time').textContent = '';
        activeTimer.querySelector('.duration').textContent = '';
    }
}

// Pridám novú pomocnú funkciu pre relatívny čas
function formatRelativeTime(date) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return { value: 'now', label: 'just' };
    if (diffInMinutes === 1) return { value: '1', label: 'minute ago' };
    if (diffInMinutes < 60) return { value: diffInMinutes, label: 'minutes ago' };
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return { value: '1', label: 'hour ago' };
    if (diffInHours < 24) return { value: diffInHours, label: 'hours ago' };
    
    return { value: formatTimeOnly(date), label: 'time' };
}

// Timeline funkcie
function createTimelineItem(task) {
    const template = document.getElementById('timeline-item-template');
    const element = template.content.cloneNode(true);
    const item = element.querySelector('.timeline-item');
    
    const taskTime = task.type === 'nappy' ? new Date(task.time) : new Date(task.startTime);
    
    if (task.type === 'nappy') {
        item.querySelector('.timeline-dot').classList.add(`nappy-${task.subType}`);
        item.querySelector('strong').textContent = `Nappy Change (${task.subType === 'poop' ? '💩' : 'PEE'})`;
        const relativeTime = formatRelativeTime(taskTime);
        item.querySelector('.time').textContent = `${formatTimeOnly(taskTime)} • ${relativeTime.value} ${relativeTime.label}`;
    } else {
        item.querySelector('.timeline-dot').classList.add(task.type);
        item.querySelector('strong').textContent = TASK_LABELS[task.type];
        item.querySelector('.duration').textContent = formatTimeForDisplay(task.duration);
        const relativeTime = formatRelativeTime(taskTime);
        item.querySelector('.time').textContent = `${formatTimeOnly(taskTime)} • ${relativeTime.value} ${relativeTime.label}`;
    }
    
    return item;
}

function createTimelineDay(date, tasks) {
    const template = document.getElementById('timeline-day-template');
    const element = template.content.cloneNode(true);
    const container = element.querySelector('.timeline-day');
    
    container.querySelector('.timeline-date').textContent = date;
    const itemsContainer = container.querySelector('.timeline-day-items');
    
    tasks.forEach(task => {
        itemsContainer.appendChild(createTimelineItem(task));
    });
    
    return container;
}

// Upravím updateUnifiedTimeline
async function updateUnifiedTimeline() {
    const timelineEl = document.getElementById('unified-timeline');
    const activities = await fetchActivities();
    
    if (!activities || activities.length === 0) {
        timelineEl.innerHTML = '<p class="no-activities">No activities yet</p>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    const groupedTasks = activities.reduce((groups, task) => {
        const date = new Date(task.type === 'nappy' ? task.time : task.startTime);
        const dateKey = formatDateForGrouping(date);
        
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(task);
        return groups;
    }, {});

    Object.entries(groupedTasks).forEach(([date, tasks]) => {
        fragment.appendChild(createTimelineDay(date, tasks));
    });

    timelineEl.innerHTML = '';
    timelineEl.appendChild(fragment);
}

// Task control funkcie
async function startTask(type) {
    if (activeTask) return;
    
    activeTask = type;
    startTime = new Date();
    totalPausedTime = 0;
    
    const buttons = getControlButtons();
    buttons.startBtn.classList.remove('visible');
    buttons.stopBtn.classList.add('visible');
    buttons.pauseBtn.classList.add('visible');
    
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    
    await saveActiveTimer();
}

async function pauseTask() {
    if (!activeTask) return;
    
    const buttons = getControlButtons();
    
    if (pauseTime) {
        totalPausedTime += new Date() - pauseTime;
        pauseTime = null;
        buttons.pauseBtn.textContent = 'Pause';
    } else {
        pauseTime = new Date();
        buttons.pauseBtn.textContent = 'Resume';
    }
    
    await saveActiveTimer();
}

async function stopTask() {
    if (!activeTask) return;
    
    clearInterval(timerInterval);
    const endTime = new Date();
    const duration = endTime - startTime - totalPausedTime;
    
    try {
        await fetch('api.php?action=active-timer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskType: null,
                startTime: null,
                pauseTime: null,
                totalPausedTime: 0
            })
        });

        await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: activeTask,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration: duration,
                pausedTime: totalPausedTime
            })
        });
        
        const buttons = getControlButtons();
        buttons.startBtn.classList.add('visible');
        buttons.stopBtn.classList.remove('visible');
        buttons.pauseBtn.classList.remove('visible');
        
        activeTask = null;
        startTime = null;
        pauseTime = null;
        totalPausedTime = 0;
        
        await updateUnifiedTimeline();
        await updateLastActivities();
    } catch (error) {
        console.error('Failed to save activity:', error);
    }
}

async function logNappy(type) {
    try {
        await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'nappy',
                subType: type,
                time: new Date().toISOString()
            })
        });
        
        await updateUnifiedTimeline();
        await updateLastActivities();
    } catch (error) {
        console.error('Failed to save nappy change:', error);
    }
}

// API funkcie
async function fetchActivities() {
    try {
        const response = await fetch('api.php');
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Failed to fetch activities:', error);
        return [];
    }
}

// Synchronizačné funkcie
async function saveActiveTimer() {
    if (activeTask && startTime) {
        try {
            await fetch('api.php?action=active-timer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskType: activeTask,
                    startTime: startTime.toISOString(),
                    pauseTime: pauseTime ? pauseTime.toISOString() : null,
                    totalPausedTime: totalPausedTime
                })
            });
        } catch (error) {
            console.error('Failed to save timer state:', error);
        }
    }
}

async function loadActiveTimer() {
    try {
        const response = await fetch('api.php?action=active-timer');
        const data = await response.json();
        const timer = data.data;
        
        if (timer) {
            activeTask = timer.task_type;
            startTime = new Date(timer.start_time);
            pauseTime = timer.pause_time ? new Date(timer.pause_time) : null;
            totalPausedTime = timer.total_paused_time;

            setActiveType(activeTask);
            
            const buttons = getControlButtons();
            buttons.startBtn.classList.remove('visible');
            buttons.stopBtn.classList.add('visible');
            buttons.pauseBtn.classList.add('visible');
            buttons.pauseBtn.textContent = pauseTime ? 'Resume' : 'Pause';
            
            updateTimer();
            if (!pauseTime) {
                timerInterval = setInterval(updateTimer, 1000);
            }
        }
    } catch (error) {
        console.error('Failed to load timer state:', error);
    }
}

async function checkTimerUpdates() {
    try {
        const response = await fetch('api.php?action=active-timer');
        const data = await response.json();
        const timer = data.data;
        
        if (timer) {
            const timerJson = JSON.stringify(timer);
            if (timerJson !== lastTimerCheck) {
                lastTimerCheck = timerJson;
                await loadActiveTimer();
            }
        } else if (lastTimerCheck !== null) {
            lastTimerCheck = null;
            activeTask = null;
            startTime = null;
            pauseTime = null;
            totalPausedTime = 0;
            clearInterval(timerInterval);
            
            const buttons = getControlButtons();
            if (buttons.startBtn) buttons.startBtn.classList.add('visible');
            if (buttons.stopBtn) buttons.stopBtn.classList.remove('visible');
            if (buttons.pauseBtn) buttons.pauseBtn.classList.remove('visible');
            
            await updateUnifiedTimeline();
        }
    } catch (error) {
        console.error('Failed to check timer updates:', error);
    }
    await updateLastActivities();
}

// Nová funkcia pre aktualizáciu časov posledných aktivít
async function updateLastActivities() {
    const activities = await fetchActivities();
    if (!activities || activities.length === 0) return;
    
    const lastActivities = {};
    activities.forEach(activity => {
        const type = activity.type;
        const time = activity.type === 'nappy' ? new Date(activity.time) : new Date(activity.startTime);
        
        if (!lastActivities[type] || time > new Date(lastActivities[type])) {
            lastActivities[type] = time;
        }
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        const button = item.querySelector('.nav-button');
        const type = button.getAttribute('onclick').match(/'([^']+)'/)[1];
        const lastActivity = lastActivities[type];
        
        const timeEl = item.querySelector('.last-activity .time');
        const labelEl = item.querySelector('.last-activity .label');
        
        if (lastActivity) {
            const relativeTime = formatRelativeTime(lastActivity);
            timeEl.textContent = relativeTime.value;
            labelEl.textContent = relativeTime.label;
        } else {
            timeEl.textContent = '--';
            labelEl.textContent = 'no activity';
        }
    });
}

// Inicializácia
document.addEventListener('DOMContentLoaded', async () => {
    if (!activeTask) {
        setActiveType('breastfeeding');
    }
    
    await loadActiveTimer();
    await updateUnifiedTimeline();
    await updateLastActivities();
});

// Polling
setInterval(checkTimerUpdates, 5000);
