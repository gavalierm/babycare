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
    // Ak opúšťame aktívne okno a nie je aktívny časovač, vyčistíme timer
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        const currentId = currentScreen.id.replace('-screen', '');
        if (!activeTask && currentId !== screenId) {
            const timerEl = document.getElementById(`${currentId}-timer`);
            if (timerEl) timerEl.textContent = '...';
        }
    }
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(`${screenId}-screen`).classList.add('active');
    
    // Odstránime všetky aktívne stavy a timer-running
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active', 'timer-running');
    });
    
    // Nastavíme aktívne tlačidlo
    const activeButton = document.querySelector(`[onclick="showScreen('${screenId}')"]`);
    activeButton.classList.add('active');
    
    // Ak je aktívny časovač a sme v Log okne, zvýrazníme tlačidlo s časovačom
    if (screenId === 'statistics' && activeTask) {
        const timerButton = document.querySelector(`[onclick="showScreen('${activeTask}')"]`);
        timerButton.classList.add('timer-running');
    }
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
    const remainingSeconds = seconds % 60;
    
    if (seconds < 60) {
        return showLabels ? `${seconds} seconds` : seconds.toString();
    }
    
    const time = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    if (hours > 0) {
        return showLabels ? `${time} minutes` : time;
    }
    return showLabels ? `${time} minutes` : time;
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
        // Ak je to Log tlačidlo (statistics) alebo aktívne okno, nechaj ho aktívne
        if (btn.getAttribute('onclick').includes('statistics') || btn.getAttribute('onclick').includes(activeType)) {
            btn.style.pointerEvents = '';  // Povolíme klikanie
            btn.classList.remove('disabled');  // Odstránime priehľadnosť
        } else {
            btn.style.pointerEvents = 'none';  // Vypneme pointer-events pre ostatné tlačidlá
            btn.classList.add('disabled');  // Opacity len pre neaktívne tlačidlá
        }

        // Nastavíme timer-running pre tlačidlo aktívneho časovača
        if (btn.getAttribute('onclick').includes(activeType)) {
            btn.classList.add('timer-running');
        } else {
            btn.classList.remove('timer-running');
        }
    });
}

function enableScreenSwitching() {
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.style.pointerEvents = '';  // Zapneme pointer-events pre všetky tlačidlá
        btn.classList.remove('disabled', 'timer-running');  // Odstránime všetky špeciálne stavy
    });
}

async function saveActiveTimer() {
    if (activeTask && startTime) {
        try {
            await fetch('api.php?action=active-timer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

async function loadActiveTimer(isInitialLoad = true) {
    try {
        const response = await fetch('api.php?action=active-timer');
        const data = await response.json();
        const timer = data.data;
        
        if (timer) {
            activeTask = timer.task_type;
            startTime = new Date(timer.start_time);
            pauseTime = timer.pause_time ? new Date(timer.pause_time) : null;
            totalPausedTime = timer.total_paused_time;

            const taskType = activeTask;
            
            if (isInitialLoad) {
                showScreen(taskType);
            }
            
            const startBtn = document.getElementById(`${taskType}-start`);
            const stopBtn = document.getElementById(`${taskType}-stop`);
            const pauseBtn = document.getElementById(`${taskType}-pause`);
            const timerEl = document.getElementById(`${taskType}-timer`);
            
            startBtn.classList.remove('visible');
            stopBtn.classList.add('visible');
            pauseBtn.classList.add('visible');
            pauseBtn.textContent = pauseTime ? 'Resume' : 'Pause';
            
            // Vypočítame presný čas na základe startTime a totalPausedTime
            const currentTime = new Date();
            const elapsed = pauseTime ? 
                pauseTime - startTime - totalPausedTime : 
                currentTime - startTime - totalPausedTime;
            
            // Okamžite nastavíme správny čas
            timerEl.textContent = formatTimeForDisplay(elapsed, false);
            
            disableScreenSwitching(taskType);
            
            // Interval aktualizuje len lokálny čas
            if (!pauseTime) {
                clearInterval(timerInterval);  // Vyčistíme starý interval
                updateTimer(taskType);
                timerInterval = setInterval(() => updateTimer(taskType), 1000);
            }
        }
    } catch (error) {
        console.error('Failed to load timer state:', error);
    }
}

// Pridáme polling pre synchronizáciu
let lastTimerCheck = null;

async function checkTimerUpdates() {
    try {
        const response = await fetch('api.php?action=active-timer');
        const data = await response.json();
        const timer = data.data;
        
        if (timer) {
            const timerJson = JSON.stringify(timer);
            if (timerJson !== lastTimerCheck) {
                lastTimerCheck = timerJson;
                await loadActiveTimer(false);
            }
        } else if (lastTimerCheck !== null) {
            lastTimerCheck = null;
            // Vyčistíme stav časovača
            activeTask = null;
            startTime = null;
            pauseTime = null;
            totalPausedTime = 0;
            clearInterval(timerInterval);
            
            // Resetujeme tlačidlá pre všetky typy aktivít
            ['breastfeeding', 'bottlefeeding', 'soothing'].forEach(type => {
                const startBtn = document.getElementById(`${type}-start`);
                const stopBtn = document.getElementById(`${type}-stop`);
                const pauseBtn = document.getElementById(`${type}-pause`);
                
                if (startBtn) startBtn.classList.add('visible');
                if (stopBtn) stopBtn.classList.remove('visible');
                if (pauseBtn) pauseBtn.classList.remove('visible');
            });
            
            // Povolíme prepínanie okien
            enableScreenSwitching();
            
            // Aktualizujeme UI bez vymazania časovača
            await updateRecentActivities();
            await updateTimeline();
        }
    } catch (error) {
        console.error('Failed to check timer updates:', error);
    }
}

// Vrátime polling na 5 sekúnd
setInterval(checkTimerUpdates, 5000);

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
    
    saveActiveTimer();  // Uložíme stav časovača
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
    
    saveActiveTimer();  // Uložíme stav časovača
}

async function stopTask(taskType) {
    if (activeTask !== taskType) return;
    
    clearInterval(timerInterval);
    const endTime = new Date();
    const duration = endTime - startTime - totalPausedTime;
    
    try {
        // Najprv vymažeme aktívny časovač z databázy
        await fetch('api.php?action=active-timer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taskType: null,
                startTime: null,
                pauseTime: null,
                totalPausedTime: 0
            })
        });

        // Potom uložíme aktivitu do histórie
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: taskType,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration: duration,
                pausedTime: totalPausedTime
            })
        });
        
        if (!response.ok) throw new Error('Failed to save activity');
        
        const startBtn = document.getElementById(`${taskType}-start`);
        const stopBtn = document.getElementById(`${taskType}-stop`);
        const pauseBtn = document.getElementById(`${taskType}-pause`);
        const timerEl = document.getElementById(`${taskType}-timer`);
        
        startBtn.classList.add('visible');
        stopBtn.classList.remove('visible');
        pauseBtn.classList.remove('visible');
        // Zachováme posledný čas v timeri
        timerEl.textContent = formatTimeForDisplay(duration, false);
        
        activeTask = null;
        startTime = null;
        pauseTime = null;
        totalPausedTime = 0;
        
        enableScreenSwitching();
        
        await updateRecentActivities();
        await updateTimeline();
    } catch (error) {
        console.error('Failed to save activity:', error);
    }
}

async function logNappy(type) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'nappy',
                subType: type,
                time: new Date().toISOString()
            })
        });
        
        if (!response.ok) throw new Error('Failed to save nappy change');
        
        await updateRecentActivities();
        await updateTimeline();
    } catch (error) {
        console.error('Failed to save nappy change:', error);
    }
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

// Nová funkcia pre načítanie dát z API
async function fetchActivities(type = null) {
    try {
        const url = type ? 
            `api.php?type=${type}` : 
            'api.php';
        
        const response = await fetch(url);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Failed to fetch activities:', error);
        return [];
    }
}

// Upravená funkcia updateRecentActivities
async function updateRecentActivities() {
    ['breastfeeding', 'bottlefeeding', 'soothing'].forEach(async (type) => {
        const recentEl = document.getElementById(`${type}-recent`);
        if (!recentEl) return;
        
        // Aktualizujeme active slot
        updateActiveSlot(type);
        
        // Načítame históriu z API
        const historyItems = await fetchActivities(type);
        
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
        const historyItems = await fetchActivities('nappy');
        
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

// Upravená funkcia updateTimeline
async function updateTimeline() {
    const timelineEl = document.getElementById('timeline');
    const fragment = document.createDocumentFragment();
    
    const activities = await fetchActivities();
    
    if (!activities || activities.length === 0) {
        return;
    }
    
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

document.addEventListener('DOMContentLoaded', async () => {
    ['breastfeeding', 'bottlefeeding', 'soothing'].forEach(taskType => {
        document.getElementById(`${taskType}-start`).onclick = () => startTask(taskType);
        document.getElementById(`${taskType}-stop`).onclick = () => stopTask(taskType);
        document.getElementById(`${taskType}-pause`).onclick = () => pauseTask(taskType);
    });

    // Najprv načítame aktívny časovač
    await loadActiveTimer();
    
    // Ak nie je aktívny časovač, až potom zobrazíme default okno
    if (!activeTask) {
        showScreen('breastfeeding');
    }
    
    updateTimeline();
    updateRecentActivities();
});

window.addEventListener('storage', (e) => {
    if (e.key === 'activeTimer') {
        loadActiveTimer();  // Znovu načítame timer pri zmene v inom okne
    }
});
