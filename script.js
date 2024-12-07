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
    'soothing': 'Soothing'
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

function formatTimeForDisplay(ms, showLabels = true) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (seconds < 60) {
        return showLabels ? `${seconds} seconds` : seconds.toString();
    }
    if (hours > 0) {
        const time = `${hours}:${String(remainingMinutes).padStart(2, '0')}`;
        return showLabels ? `${time} minutes` : time;
    }
    return showLabels ? `${minutes} minutes` : minutes.toString();
}

function formatTimeRange(startTime, endTime) {
    return `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateForGrouping(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Porovnáme dátumy bez času
    const dateWithoutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayWithoutTime = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    if (dateWithoutTime.getTime() === todayWithoutTime.getTime()) {
        return 'Today';
    }
    
    if (dateWithoutTime.getTime() === yesterdayWithoutTime.getTime()) {
        return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Nová pomocná funkcia pre aktualizáciu obsahu slotu
function updateSlotContent(slot, time, duration) {
    const timeEl = slot.querySelector('.time');
    const durationEl = slot.querySelector('.duration');
    
    if (!timeEl || !durationEl) {
        return;
    }
    
    // Pre nappy screen používame subType namiesto duration
    const formattedDuration = typeof duration === 'string' ? 
        duration === 'POOP' ? '<i class="fas fa-poo"></i>' : '<i class="fa-solid fa-water"></i>' : // Pre nappy
        formatTimeForDisplay(duration); // Pre ostatné aktivity
    
    if (timeEl.textContent === time && durationEl.innerHTML === formattedDuration) {
        return;
    }
    
    timeEl.textContent = time;
    durationEl.innerHTML = formattedDuration;  // Použijeme innerHTML pre ikony
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
        
        updateSlotContent(activeSlot, formatTimeOnly(startTime), elapsed);
    } else {
        activeSlot.className = 'mini-timeline-item';
    }
}

function updateTimer(taskType) {
    if (!startTime || pauseTime) return;
    
    const timerEl = document.getElementById(`${taskType}-timer`);
    const elapsed = new Date() - startTime - totalPausedTime;
    timerEl.textContent = formatTimeForDisplay(elapsed, false);  // Bez labels
    
    updateActiveSlot(taskType);
}

function disableScreenSwitching(activeType) {
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.style.pointerEvents = 'none';  // Vypneme pointer-events pre všetky tlačidlá
        if (!btn.getAttribute('onclick').includes(activeType)) {
            btn.classList.add('disabled');  // Opacity len pre neaktívne tlačidlá
        }
    });
}

function enableScreenSwitching() {
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.style.pointerEvents = '';  // Zapneme pointer-events pre všetky tlačidlá
        btn.classList.remove('disabled');
    });
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
    
    disableScreenSwitching(taskType);
    
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
    timerEl.textContent = '...';
    
    activeTask = null;
    startTime = null;
    pauseTime = null;
    totalPausedTime = 0;
    
    enableScreenSwitching();
    
    updateRecentActivities();
    saveToLocalStorage();
    updateTimeline();
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
        item.querySelector('strong').textContent = `Nappy Change (${task.subType === 'poop' ? '💩' : 'PEE'})`;
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
    ['breastfeeding', 'bottlefeeding', 'soothing'].forEach(type => {
        const recentEl = document.getElementById(`${type}-recent`);
        if (!recentEl) return;
        
        // Aktualizujeme active slot
        updateActiveSlot(type);
        
        // Naplníme sloty históriou
        const historyItems = taskHistory
            .filter(task => task.type === type)
            .slice(0, 6);
            
        historyItems.forEach((task, index) => {
            const slotIndex = index + 1;
            const slot = recentEl.querySelector(`[data-slot="${slotIndex}"]`);
            if (!slot) return;
            
            updateSlotContent(
                slot,
                formatTimeOnly(new Date(task.startTime)),
                task.duration
            );
        });
        
        // Vyčistíme nepoužité sloty
        for (let i = historyItems.length + 1; i <= 6; i++) {
            const slot = recentEl.querySelector(`[data-slot="${i}"]`);
            if (slot) {
                const timeEl = slot.querySelector('.time');
                const durationEl = slot.querySelector('.duration');
                if (timeEl) timeEl.textContent = '';
                if (durationEl) durationEl.textContent = '';
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
            const slotIndex = index + 1;
            const slot = nappyRecentEl.querySelector(`[data-slot="${slotIndex}"]`);
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
            if (slot) {
                const timeEl = slot.querySelector('.time');
                const durationEl = slot.querySelector('.duration');
                if (timeEl) timeEl.textContent = '';
                if (durationEl) durationEl.textContent = '';
                slot.className = 'mini-timeline-item';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ['breastfeeding', 'bottlefeeding', 'soothing'].forEach(taskType => {
        document.getElementById(`${taskType}-start`).onclick = () => startTask(taskType);
        document.getElementById(`${taskType}-stop`).onclick = () => stopTask(taskType);
        document.getElementById(`${taskType}-pause`).onclick = () => pauseTask(taskType);
    });

    updateTimeline();
    updateRecentActivities();
});
