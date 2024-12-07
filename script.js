let activeTask = null;
let startTime = null;
let pauseTime = null;
let totalPausedTime = 0;
let timerInterval = null;
let lastTimerCheck = null;
let translations = {};
let currentLang = 'sk';
const TRANSLATIONS_VERSION = '3.3.1';  // Pre kontrolu verzie prekladov

// Optimalizované načítanie prekladov
async function loadTranslations() {
    try {
        // Skontrolujeme localStorage
        const cachedTranslations = localStorage.getItem('translations');
        const cachedVersion = localStorage.getItem('translationsVersion');
        
        // Ak máme cached verziu a je aktuálna
        if (cachedTranslations && cachedVersion === TRANSLATIONS_VERSION) {
            translations = JSON.parse(cachedTranslations);
            console.log('Using cached translations');
            return;
        }
        
        // Ak nemáme cache alebo je neaktuálna, načítame zo súboru
        const response = await fetch('translations.json');
        translations = await response.json();
        
        // Uložíme do localStorage
        localStorage.setItem('translations', JSON.stringify(translations));
        localStorage.setItem('translationsVersion', TRANSLATIONS_VERSION);
        console.log('Translations cached');
    } catch (error) {
        console.error('Failed to load translations:', error);
    }
}

// Funkcia pre zmenu jazyka
async function changeLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('currentLanguage', lang);
        
        // Aktualizujeme UI
        document.querySelector('.stage-title').textContent = t('app_title');
        // ... aktualizácia ostatných elementov
        
        await updateTimeline();
        await updateLastActivities();
    }
}

// Helper funkcia pre preklady
function t(key, section = null) {
    try {
        const keys = key.split('.');
        let value = translations[currentLang];
        
        if (section) {
            value = value[section];
        }
        
        for (const k of keys) {
            value = value[k];
        }
        
        return value || key;
    } catch (error) {
        return key;
    }
}

const TASK_LABELS = {
    'breastfeeding': t('activities.breastfeeding'),
    'bottlefeeding': t('activities.bottlefeeding'),
    'sleep': t('activities.sleep'),
    'nappy': t('activities.nappy')
};

// Pomocné funkcie pre formátovanie času
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
    
    if (dateWithoutTime.getTime() === todayWithoutTime.getTime()) return t('time.today');
    if (dateWithoutTime.getTime() === yesterdayWithoutTime.getTime()) return t('time.yesterday');
    
    return date.toLocaleDateString(currentLang === 'sk' ? 'sk-SK' : 'en-US', {
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
    title.textContent = t('activities.' + type);

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
        
        // Pridáme focus na input pre bottle feeding
        if (type === 'bottlefeeding') {
            const input = document.getElementById('milk-amount');
            if (!activeTask) {  // Len ak nie je aktívna úloha
                setTimeout(() => input.focus(), 100);  // Počkáme na CSS transition
            }
        }
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
    activeTimer.querySelector('.duration').textContent = formatRelativeTime(elapsed, true).value;
    
    // Pridáme parameter pre bottle feeding
    const parameterEl = activeTimer.querySelector('.parameter');
    if (activeTask === 'bottlefeeding') {
        const amount = document.getElementById('milk-amount').value;
        parameterEl.textContent = `${amount}ml`;
    } else {
        parameterEl.textContent = '';
    }
}

function updateActiveTaskDisplay() {
    const activeTimer = document.querySelector('.active-timer');
    
    if (activeTask && startTime) {
        const elapsed = new Date() - startTime - totalPausedTime;
        activeTimer.querySelector('.time').textContent = formatTimeOnly(startTime);
        activeTimer.querySelector('.duration').textContent = formatRelativeTime(elapsed).value;
    } else {
        activeTimer.querySelector('.time').textContent = '';
        activeTimer.querySelector('.duration').textContent = '';
    }
}

// Pridám novú pomocnú funkciu pre relatívny čas
function formatRelativeTime(date, isDuration = false) {
    if (isDuration) {
        // Pre duration počítame priamo z milisekúnd
        const seconds = Math.floor(date / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;
        
        if (seconds < 60) {
            return { value: `${seconds}s`, label: '' };
        }
        
        if (minutes < 60) {
            // Pre rozsah 1-60 minút zobrazíme aj sekundy
            return { value: `${minutes}m ${remainingSeconds}s`, label: '' };
        }
        
        if (remainingMinutes === 0) {
            return { value: `${hours}h`, label: '' };
        }
        return { value: `${hours}h ${remainingMinutes}m`, label: '' };
    } else {
        // Pôvodná logika pre relatívny čas
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return { value: `${diffInSeconds}s`, label: '' };
        }
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const remainingSeconds = diffInSeconds % 60;
        
        if (diffInMinutes < 60) {
            // Pre rozsah 1-60 minút zobrazíme aj sekundy
            return { value: `${diffInMinutes}m ${remainingSeconds}s`, label: '' };
        }
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        const remainingMinutes = diffInMinutes % 60;
        
        if (diffInHours < 24) {
            if (remainingMinutes === 0) {
                return { value: `${diffInHours}h`, label: '' };
            }
            return { value: `${diffInHours}h ${remainingMinutes}m`, label: '' };
        }
        
        const diffInDays = Math.floor(diffInHours / 24);
        return { value: `${diffInDays}d`, label: '' };
    }
}

// Timeline funkcie
function createTimelineItem(task) {
    const template = document.getElementById('timeline-item-template');
    const element = template.content.cloneNode(true);
    const item = element.querySelector('.timeline-item');
    
    const taskTime = task.type === 'nappy' ? new Date(task.time) : new Date(task.startTime);
    
    // Odstránime timeline-dot
    item.querySelector('.timeline-dot').remove();
    
    // Pridáme ikonu podľa typu
    const icon = document.createElement('i');
    icon.className = getIconClass(task.type, task.subType);
    icon.style.color = task.type === 'nappy' ? 
        (task.subType === 'poop' ? 'var(--color-nappy-poop)' : 'var(--color-nappy-pee)') :
        `var(--color-${task.type})`;
    item.insertBefore(icon, item.firstChild);
    
    // Nastavíme text podľa typu aktivity
    const titleEl = item.querySelector('strong');
    if (task.type === 'bottlefeeding') {
        const amount = task.milkAmount !== null ? task.milkAmount : 0;
        titleEl.textContent = `${t('activities.' + task.type)} • ${amount}ml`;
    } else {
        titleEl.textContent = t('activities.' + task.type);
    }
    
    // Nastavíme čas a trvanie
    const timeEl = item.querySelector('.time');
    const durationEl = item.querySelector('.duration');
    const relativeTime = formatRelativeTime(taskTime);
    
    // Zobrazíme čas a relatívny čas bez labelu
    timeEl.textContent = `${formatTimeOnly(taskTime)} • ${relativeTime.value}`;
    
    if (task.type === 'nappy') {
        // Pre nappy pridáme len ikonu
        const typeIcon = document.createElement('i');
        typeIcon.className = task.subType === 'poop' ? 'fas fa-poo' : 'fas fa-water';
        durationEl.appendChild(typeIcon);
    } else {
        // Pre ostatné aktivity pridáme trvanie
        durationEl.textContent = formatRelativeTime(task.duration, true).value;
    }
    
    return item;
}

// Helper funkcia pre získanie správnej ikony
function getIconClass(type, subType) {
    switch(type) {
        case 'breastfeeding':
            return 'fas fa-baby';
        case 'bottlefeeding':
            return 'fas fa-prescription-bottle';
        case 'sleep':
            return 'fas fa-moon';
        case 'nappy':
            return subType === 'poop' ? 'fas fa-poo' : 'fas fa-water';
        default:
            return 'fas fa-clock';
    }
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

// Upravíme updateTimeline
async function updateTimeline() {
    const timelineEl = document.getElementById('timeline');
    const activities = await fetchActivities();
    
    if (!activities || activities.length === 0) {
        timelineEl.innerHTML = `<p class="no-activities">${t('activities.no_activity')}</p>`;
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

// Pridáme validáciu množstva mlieka
function validateMilkAmount() {
    const input = document.getElementById('milk-amount');
    const amount = parseInt(input.value);
    const isValid = amount >= 30 && amount <= 500;
    
    // Nastavíme alebo odstránime triedu invalid podľa validácie
    input.classList.toggle('invalid', !isValid);
    
    return isValid;
}

// Upravíme funkciu startTask
async function startTask(type) {
    if (activeTask) return;
    
    // Pre bottle feeding kontrolujeme množstvo mlieka
    if (type === 'bottlefeeding') {
        const input = document.getElementById('milk-amount');
        if (!input.value || !validateMilkAmount()) {
            input.focus();
            return;
        }
        // Skryjeme input po začatí
        input.classList.add('hidden');
    }
    
    activeTask = type;
    startTime = new Date();
    totalPausedTime = 0;
    
    const buttons = getControlButtons();
    buttons.startBtn.classList.remove('visible');
    buttons.stopBtn.classList.add('visible');
    buttons.pauseBtn.classList.add('visible');
    
    // Disable milk amount input počas aktivity
    if (type === 'bottlefeeding') {
        document.getElementById('milk-amount').disabled = true;
    }
    
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
        buttons.pauseBtn.textContent = t('controls.pause');
    } else {
        pauseTime = new Date();
        buttons.pauseBtn.textContent = t('controls.resume');
    }
    
    await saveActiveTimer();
}

// Upravíme funkciu stopTask
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

        const data = {
            type: activeTask,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: duration,
            pausedTime: totalPausedTime
        };

        // Pridáme množstvo mlieka pre bottle feeding
        if (activeTask === 'bottlefeeding') {
            const milkInput = document.getElementById('milk-amount');
            const milkAmount = parseInt(milkInput.value);
            if (!isNaN(milkAmount) && milkAmount >= 30 && milkAmount <= 500) {
                data.milkAmount = milkAmount;
            }
        }

        await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const buttons = getControlButtons();
        buttons.startBtn.classList.add('visible');
        buttons.stopBtn.classList.remove('visible');
        buttons.pauseBtn.classList.remove('visible');
        
        // Reset milk amount input
        if (activeTask === 'bottlefeeding') {
            const input = document.getElementById('milk-amount');
            input.disabled = false;
            input.value = '';
            input.classList.remove('hidden');  // Zobrazíme input späť
        }
        
        activeTask = null;
        startTime = null;
        pauseTime = null;
        totalPausedTime = 0;
        
        await updateTimeline();
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
        
        await updateTimeline();
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
            buttons.pauseBtn.textContent = pauseTime ? t('controls.resume') : t('controls.pause');
            
            // Pridáme nastavenie pre bottle feeding
            if (activeTask === 'bottlefeeding' && timer.milk_amount) {
                const input = document.getElementById('milk-amount');
                input.value = timer.milk_amount;
                input.disabled = true;
                input.classList.add('hidden');
            }
            
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
            
            await updateTimeline();
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
            labelEl.textContent = t('time.before');
            timeEl.textContent = relativeTime.value;
        } else {
            labelEl.textContent = '';
            timeEl.textContent = t('activities.no_activity');
        }
    });
}

// Upravíme funkciu updateUITranslations
function updateUITranslations() {
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        element.textContent = t(key);
    });
    
    // Pridáme preklady pre placeholdery
    document.querySelectorAll('[data-translate]').forEach(element => {
        if (element.hasAttribute('placeholder')) {
            const key = element.getAttribute('data-translate');
            element.placeholder = t(key);
        }
    });
    
    // Aktualizujeme title
    document.title = t('app_title');
}

// Inicializácia
document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations();
    updateUITranslations();  // Aktualizujeme všetky preklady
    
    if (!activeTask) {
        setActiveType('breastfeeding');
    }
    
    await loadActiveTimer();
    await updateTimeline();
    await updateLastActivities();
});

// Polling
setInterval(checkTimerUpdates, 5000);

// Pridáme event listener pre input na real-time validáciu
document.addEventListener('DOMContentLoaded', () => {
    const milkInput = document.getElementById('milk-amount');
    milkInput.addEventListener('input', validateMilkAmount);
});
