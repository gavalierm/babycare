let activeTask = null;
let startTime = null;
let pauseTime = null;
let totalPausedTime = 0;
let timerInterval = null;

// Load history from localStorage
let taskHistory = JSON.parse(localStorage.getItem('babyTaskHistory')) || [];

const dateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
};

const timeFormat = {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    hour12: false
};

// Konštanty a cache pre templates
const TASK_LABELS = {
    'breastfeeding': 'Breast Feeding',
    'bottlefeeding': 'Bottle Feeding',
    'sleeping': 'Sleep'
};

const templates = {
    timelineItem: document.getElementById('timeline-item-template'),
    nappyItem: document.getElementById('nappy-item-template'),
    timelineDay: document.getElementById('timeline-day-template'),
    miniTimelineActive: document.getElementById('mini-timeline-active-template'),
    miniTimelineItem: document.getElementById('mini-timeline-item-template')
};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(`${screenId}-screen`).classList.add('active');
    
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="showScreen('${screenId}')"]`).classList.add('active');
}

function formatTime(ms) {
    const pad = (n) => n.toString().padStart(2, '0');
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor(ms / 1000 / 60 / 60);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatTimeOnly(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatTimeForDisplay(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    
    if (seconds < 60) {
        return `${seconds} seconds`;
    }
    if (hours > 0) {
        return `${hours}:${String(remainingMinutes).padStart(2, '0')} minutes`;
    }
    return `${minutes} minutes`;
}

function formatTimeRange(startTime, endTime) {
    return `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateForGrouping(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Nová pomocná funkcia pre aktualizáciu obsahu slotu
function updateSlotContent(slot, time, duration) {
    // Ak už slot obsahuje rovnaké hodnoty, nebudeme ho aktualizovať
    const timeEl = slot.querySelector('.time');
    const durationEl = slot.querySelector('.duration');
    
    if (timeEl.textContent === time && durationEl.textContent === duration) {
        return;
    }
    
    timeEl.textContent = time;
    durationEl.textContent = duration;
}

function updateActiveSlot(type) {
    const recentEl = document.getElementById(`${type}-recent`);
    if (!recentEl) return;
    
    const activeSlot = recentEl.querySelector('[data-slot="active"]');
    if (!activeSlot) return;
    
    if (activeTask === type && startTime) {
        const elapsed = new Date() - startTime - totalPausedTime;
        
        if (!activeSlot.classList.contains('active')) {
            activeSlot.className = 'mini-timeline-item active';
            activeSlot.classList.add(type);
        }
        
        updateSlotContent(activeSlot, formatTimeOnly(startTime), formatTime(elapsed));
    } else {
        activeSlot.className = 'mini-timeline-item';
    }
}

function updateTimer(taskType) {
    if (!startTime || pauseTime) return;
    
    const timerEl = document.getElementById(`${taskType}-timer`);
    const elapsed = new Date() - startTime - totalPausedTime;
    timerEl.textContent = formatTime(elapsed);
    
    // Aktualizujeme len aktívny slot
    updateActiveSlot(taskType);
}

function startTask(taskType) {
    if (activeTask) return;
    
    activeTask = taskType;
    startTime = new Date();
    totalPausedTime = 0;
    
    const startBtn = document.getElementById(`${taskType}-start`);
    const stopBtn = document.getElementById(`${taskType}-stop`);
    const pauseBtn = document.getElementById(`${taskType}-pause`);
    
    startBtn.classList.remove('visible');
    stopBtn.classList.add('visible');
    pauseBtn.classList.add('visible');
    pauseBtn.textContent = 'Pause';
    
    updateTimer(taskType);
    timerInterval = setInterval(() => updateTimer(taskType), 1000);
}

function pauseTask(taskType) {
    if (activeTask !== taskType) return;
    
    const pauseBtn = document.getElementById(`${taskType}-pause`);
    const startBtn = document.getElementById(`${taskType}-start`);
    
    if (pauseTime) {
        // Resume
        totalPausedTime += new Date() - pauseTime;
        pauseTime = null;
        pauseBtn.textContent = 'Pause';
        startBtn.classList.remove('visible');
    } else {
        // Pause
        pauseTime = new Date();
        pauseBtn.textContent = 'Resume';
        startBtn.classList.remove('visible');
    }
}

function stopTask(taskType) {
    if (activeTask !== taskType) return;
    
    clearInterval(timerInterval);
    const endTime = new Date();
    const duration = endTime - startTime - totalPausedTime;
    
    taskHistory.unshift({
        type: taskType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        pausedTime: totalPausedTime
    });

    const startBtn = document.getElementById(`${taskType}-start`);
    const stopBtn = document.getElementById(`${taskType}-stop`);
    const pauseBtn = document.getElementById(`${taskType}-pause`);
    const timerEl = document.getElementById(`${taskType}-timer`);
    
    startBtn.classList.add('visible');
    stopBtn.classList.remove('visible');
    pauseBtn.classList.remove('visible');
    timerEl.textContent = '00:00:00';
    
    activeTask = null;
    startTime = null;
    pauseTime = null;
    totalPausedTime = 0;
    
    saveToLocalStorage();
    updateTimeline();
    updateRecentActivities();
}

function logNappy(type) {
    taskHistory.unshift({
        type: 'nappy',
        subType: type,
        time: new Date().toISOString()
    });
    
    saveToLocalStorage();
    updateTimeline();
    updateRecentActivities();
}

function saveToLocalStorage() {
    localStorage.setItem('babyTaskHistory', JSON.stringify(taskHistory));
}

function createTimelineItem(task) {
    const template = task.type === 'nappy' ? templates.nappyItem : templates.timelineItem;
    const element = template.content.cloneNode(true);
    const item = element.querySelector('.timeline-item');
    
    if (task.type === 'nappy') {
        item.querySelector('.timeline-dot').classList.add(`nappy-${task.subType}`);
        item.querySelector('strong').textContent = `Nappy Change (${task.subType.toUpperCase()})`;
        item.querySelector('.time').textContent = formatTimeOnly(new Date(task.time));
    } else {
        item.querySelector('.timeline-dot').classList.add(task.type);
        item.querySelector('strong').textContent = TASK_LABELS[task.type];
        item.querySelector('.duration').textContent = `${formatTimeForDisplay(task.duration)} (${formatTimeForDisplay(task.pausedTime || 0)})`;
        item.querySelector('.time').textContent = formatTimeRange(new Date(task.startTime), new Date(task.endTime));
    }
    
    return item;
}

function createTimelineDay(date, tasks) {
    const element = templates.timelineDay.content.cloneNode(true);
    const container = element.querySelector('.timeline-day');
    
    container.querySelector('.timeline-date').textContent = date;
    const itemsContainer = container.querySelector('.timeline-day-items');
    
    tasks.forEach(task => {
        itemsContainer.appendChild(createTimelineItem(task));
    });
    
    return container;
}

function updateTimeline() {
    const timelineEl = document.getElementById('timeline');
    const fragment = document.createDocumentFragment();
    
    const groupedTasks = taskHistory.reduce((groups, task) => {
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

function updateRecentActivities() {
    ['breastfeeding', 'bottlefeeding', 'sleeping'].forEach(type => {
        const recentEl = document.getElementById(`${type}-recent`);
        if (!recentEl) return;
        
        // Aktualizujeme active slot
        updateActiveSlot(type);
        
        // Naplníme sloty históriou
        const historyItems = taskHistory
            .filter(task => task.type === type)
            .slice(0, 6);
            
        historyItems.forEach((task, index) => {
            const slot = recentEl.querySelector(`[data-slot="${index + 1}"]`);
            if (!slot) return;
            
            updateSlotContent(
                slot,
                formatTimeOnly(new Date(task.startTime)),
                formatTime(task.duration)
            );
        });
        
        // Vyčistíme nepoužité sloty
        for (let i = historyItems.length + 1; i <= 6; i++) {
            const slot = recentEl.querySelector(`[data-slot="${i}"]`);
            if (slot && slot.innerHTML !== '') {
                slot.innerHTML = '';
                slot.className = 'mini-timeline-item';
            }
        }
    });

    // Update nappy screen
    const nappyRecentEl = document.getElementById('nappy-recent');
    if (nappyRecentEl) {
        const historyItems = taskHistory
            .filter(task => task.type === 'nappy')
            .slice(0, 6);
            
        historyItems.forEach((task, index) => {
            const slot = nappyRecentEl.querySelector(`[data-slot="${index + 1}"]`);
            if (!slot) return;
            
            updateSlotContent(
                slot,
                formatTimeOnly(new Date(task.time)),
                task.subType.toUpperCase()
            );
        });
        
        // Vyčistíme nepoužité sloty
        for (let i = historyItems.length + 1; i <= 6; i++) {
            const slot = nappyRecentEl.querySelector(`[data-slot="${i}"]`);
            if (slot && slot.innerHTML !== '') {
                slot.innerHTML = '';
                slot.className = 'mini-timeline-item';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ['breastfeeding', 'bottlefeeding', 'sleeping'].forEach(taskType => {
        document.getElementById(`${taskType}-start`).onclick = () => startTask(taskType);
        document.getElementById(`${taskType}-stop`).onclick = () => stopTask(taskType);
        document.getElementById(`${taskType}-pause`).onclick = () => pauseTask(taskType);
    });

    updateTimeline();
    updateRecentActivities();
});
