let activeTask = null;
let startTime = null;
let pauseTime = null;
let totalPausedTime = 0;
let timerInterval = null;
let lastTimerCheck = null;
let translations = {};
let currentLang = 'sk';
const TRANSLATIONS_VERSION = '3.3.2';  // Pre kontrolu verzie prekladov
const APP_VERSION = '1.0.0';

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

// Helper funkcia pre tlačidlá - upravíme na class selektory
function getControlButtons(type) {
    const controls = document.querySelector(`.type-controls.type-${type}`);
    if (!controls) return null;  // Pridaná kontrola

    return {
        startBtn: controls.querySelector('.begin-btn'),
        stopBtn: controls.querySelector('.stop-btn'),
        pauseBtn: controls.querySelector('.pause-btn'),
        milkAmount: type === 'bottlefeeding' ? controls.querySelector('.milk-amount') : null
    };
}

// UI funkcie
function setActiveType(type) {
    if (activeTask && type !== activeTask && type !== 'nappy') {
        console.log('Timer is running, cannot switch type');
        return;
    }
    
    document.body.className = `type-${type}`;
    
    // Nastavíme nadpis podľa typu
    const title = document.querySelector('.stage-title');
    title.textContent = t('activities.' + type);
    
    // Nastavíme active class pre nav button
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(type));
    });
    
    // Skryjeme active-timer pre neaktívny typ
    document.querySelectorAll('.active-timer').forEach(timer => {
        timer.classList.remove('show');
        if (!activeTask) {
            // Ak nie je aktívna úloha, vyčistíme hodnoty
            timer.querySelector('.time').textContent = '';
            timer.querySelector('.duration').textContent = '';
        }
    });
    
    // Ak je aktívna úloha, zobrazíme active-timer pre aktívny typ
    if (activeTask === type) {
        const activeTimer = document.querySelector(`.type-controls.type-${type} .active-timer`);
        if (activeTimer) {
            activeTimer.classList.add('show');
        }
    }

    // Nastavíme event handlers pre tlačidlá
    const controls = document.querySelector(`.type-controls.type-${type}`);
    if (controls) {
        if (type === 'nappy') {
            // Event handlers pre nappy tlačidlá
            const peeBtn = controls.querySelector('[data-type="pee"]');
            const poopBtn = controls.querySelector('[data-type="poop"]');
            
            if (peeBtn) peeBtn.onclick = () => logNappy('pee');
            if (poopBtn) poopBtn.onclick = () => logNappy('poop');
        } else {
            // Event handlers pre ostatné typy
            const beginBtn = controls.querySelector('.begin-btn');
            const stopBtn = controls.querySelector('.stop-btn');
            const pauseBtn = controls.querySelector('.pause-btn');

            if (beginBtn) beginBtn.onclick = () => startTask(type);
            if (stopBtn) stopBtn.onclick = () => stopTask(type);
            if (pauseBtn) pauseBtn.onclick = () => pauseTask(type);
            
            // Nastavíme focus na milk-amount input pre bottle feeding
            if (type === 'bottlefeeding' && !activeTask) {
                const milkInput = controls.querySelector('.milk-amount');
                if (milkInput) {
                    setTimeout(() => milkInput.focus(), 100);
                }
            }
        }
    }
}

function updateTimer() {
    if (!startTime) return;
    
    let elapsed;
    if (pauseTime) {
        elapsed = pauseTime - startTime - totalPausedTime;
    } else {
        elapsed = new Date() - startTime - totalPausedTime;
    }
    
    // Aktualizujeme len aktívny timer
    const activeTimer = document.querySelector(`.type-controls.type-${activeTask} .active-timer`);
    if (activeTimer) {
        activeTimer.querySelector('.time').textContent = formatTimeOnly(startTime);
        activeTimer.querySelector('.duration').textContent = formatRelativeTime(elapsed, true).value;
        
        // Parameter pre bottle feeding
        const parameterEl = activeTimer.querySelector('.parameter');
        if (activeTask === 'bottlefeeding' && parameterEl) {
            const amount = document.querySelector(`.type-controls.type-${activeTask} .milk-amount`).value;
            parameterEl.textContent = `${amount}ml`;
        }
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
    
    // Nastavíme data atribúty pre typ a subtyp
    item.dataset.type = task.type;
    if (task.type === 'nappy') {
        item.dataset.subtype = task.subType;
    }
    
    // Odstránime timeline-dot
    item.querySelector('.timeline-dot').remove();
    
    // Pridáme ikonu podľa typu
    const icon = document.createElement('i');
    icon.className = getIconClass(task.type, task.subType);
    item.insertBefore(icon, item.firstChild);
    
    // Nastavíme text podľa typu aktivity
    const titleEl = item.querySelector('strong');
    if (task.type === 'bottlefeeding') {
        const amount = task.milkAmount !== null ? task.milkAmount : 0;
        titleEl.textContent = `${t('activities.' + task.type)} • ${amount}ml`;
    } else if (task.type === 'nappy') {
        titleEl.textContent = `${t('activities.' + task.type)} • ${task.subType === 'poop' ? 'Kakanie' : 'Cikanie'}`;
    } else {
        titleEl.textContent = t('activities.' + task.type);
    }
    
    // Nastavíme relatívny čas od konca aktivity
    const relativeTimeEl = item.querySelector('.timeline-info-details .relative-time');
    const endTime = task.type === 'nappy' ? taskTime : new Date(task.endTime);
    const relativeTime = formatRelativeTime(endTime);
    relativeTimeEl.querySelector('.label').textContent = t('time.before');
    relativeTimeEl.querySelector('.time').textContent = relativeTime.value;
    
    // Nastavíme čas začiatku aktivity
    const timeEl = item.querySelector('.timeline-info-details > .time');
    timeEl.textContent = formatTimeOnly(taskTime);
    
    // Nastavíme trvanie aktivity
    const durationEl = item.querySelector('.timeline-info-details .duration');
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
async function updateTimeline(activities = null) {
    const timelineEl = document.getElementById('timeline');
    if (!activities) {
        activities = await fetchActivities();
    }
    
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
    
    // Scrollujeme log panel na začiatok
    const logPanel = document.querySelector('.log-panel');
    logPanel.scrollTop = 0;
}

// Upravíme validáciu množstva mlieka
function validateMilkAmount() {
    const input = document.querySelector('.type-bottlefeeding .milk-amount');
    const amount = parseInt(input.value);
    const isValid = amount >= 30 && amount <= 500;
    
    input.classList.toggle('invalid', !isValid);
    
    return isValid;
}

// Upravíme funkciu startTask
async function startTask(type) {
    if (activeTask) return;
    
    if (type === 'bottlefeeding') {
        const input = document.querySelector('.type-bottlefeeding .milk-amount');
        if (!input.value || !validateMilkAmount()) {
            input.focus();
            return;
        }
        input.classList.add('hidden');
    }
    
    activeTask = type;
    startTime = new Date();
    totalPausedTime = 0;
    
    const buttons = getControlButtons(type);
    if (!buttons) return;

    // Okamžite nastavíme active-task triedu
    const controls = document.querySelector(`.type-controls.type-${type}`);
    controls.classList.add('active-task');

    // Nastavíme správnu ikonu pre pause tlačidlo (ikona play, keďže nie sme v pauze)
    buttons.pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    
    // Okamžite spustíme timer
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    
    // Disable milk amount input počas aktivity
    if (type === 'bottlefeeding') {
        const input = document.querySelector('.type-bottlefeeding .milk-amount');
        if (input) {
            input.disabled = true;
        }
    }
    
    // API volanie až na konci
    await saveActiveTimer();
    
    // Zobrazíme active-timer
    const activeTimer = document.querySelector(`.type-controls.type-${type} .active-timer`);
    if (activeTimer) {
        activeTimer.classList.add('show');
    }
}

async function pauseTask() {
    if (!activeTask) return;
    
    const buttons = getControlButtons(activeTask);  // Pridaný parameter activeTask
    if (!buttons) return;  // Pridaná kontrola
    
    if (pauseTime) {
        totalPausedTime += new Date() - pauseTime;
        pauseTime = null;
        buttons.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        pauseTime = new Date();
        buttons.pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
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
            const input = document.querySelector('.type-bottlefeeding .milk-amount');
            if (input) {
                const milkAmount = parseInt(input.value);
                if (!isNaN(milkAmount) && milkAmount >= 30 && milkAmount <= 500) {
                    data.milkAmount = milkAmount;
                }
            }
        }

        await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        // Odstránime active-task triedu
        const controls = document.querySelector(`.type-controls.type-${activeTask}`);
        if (controls) {
            controls.classList.remove('active-task');
        }
        
        // Reset milk amount input
        if (activeTask === 'bottlefeeding') {
            const input = document.querySelector('.type-bottlefeeding .milk-amount');
            if (input) {
                input.disabled = false;
                input.value = '';
                input.classList.remove('hidden');
            }
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
    
    // Skryjeme active-timer
    const activeTimer = document.querySelector(`.type-controls.type-${activeTask} .active-timer`);
    if (activeTimer) {
        activeTimer.classList.remove('show');
        activeTimer.querySelector('.time').textContent = '';
        activeTimer.querySelector('.duration').textContent = '';
    }
}

async function logNappy(type) {
    try {
        const data = {
            type: 'nappy',
            subType: type,  // 'pee' alebo 'poop'
            time: new Date().toISOString()
        };

        await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
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
            const data = {
                taskType: activeTask,
                startTime: startTime.toISOString(),
                pauseTime: pauseTime ? pauseTime.toISOString() : null,
                totalPausedTime: totalPausedTime
            };

            // Pridáme milk_amount pre bottle feeding
            if (activeTask === 'bottlefeeding') {
                const input = document.getElementById('milk-amount');
                if (input.value) {
                    data.milkAmount = parseInt(input.value);
                }
            }

            await fetch('api.php?action=active-timer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
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
            
            const controls = document.querySelector(`.type-controls.type-${activeTask}`);
            if (controls) {
                controls.classList.add('active-task');
            }
            
            const buttons = getControlButtons(activeTask);
            if (!buttons) return;
            
            buttons.pauseBtn.innerHTML = pauseTime ? 
                '<i class="fas fa-pause"></i>' :
                '<i class="fas fa-play"></i>';
            
            // Pridáme nastavenie pre bottle feeding
            if (activeTask === 'bottlefeeding') {
                const input = document.getElementById('milk-amount');
                input.value = timer.milk_amount || '';
                input.disabled = true;
                input.classList.add('hidden');
                
                // Aktualizujeme parameter v active-timer
                const parameterEl = document.querySelector('.active-timer .parameter');
                if (timer.milk_amount) {
                    parameterEl.textContent = `${timer.milk_amount}ml`;
                }
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
            
            const buttons = getControlButtons(activeTask);  // Pridaný parameter activeTask
            if (buttons) {  // Pridaná kontrola
                buttons.startBtn.classList.add('visible');
                buttons.stopBtn.classList.remove('visible');
                buttons.pauseBtn.classList.remove('visible');
            }
            
            await updateTimeline();
        }
    } catch (error) {
        console.error('Failed to check timer updates:', error);
    }
}

// Nová funkcia pre aktualizáciu časov posledných aktivít
async function updateLastActivities(activities = null) {
    if (!activities) {
        activities = await fetchActivities();
    }
    
    if (!activities || activities.length === 0) return;
    
    const lastActivities = {};
    activities.forEach(activity => {
        const type = activity.type;
        // Použijeme endTime pre aktivity s trvaním, time pre nappy
        const time = activity.type === 'nappy' ? 
            new Date(activity.time) : 
            new Date(activity.endTime);  // Zmenené zo startTime na endTime
        
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
    updateUITranslations();
    
    if (!activeTask) {
        setActiveType('breastfeeding');
    }
    
    await loadActiveTimer();
    
    const activities = await fetchActivities();
    await updateTimeline(activities);
    await updateLastActivities(activities);
    
    // Pridáme event listener pre milk-amount input
    const milkInput = document.querySelector('.type-bottlefeeding .milk-amount');
    if (milkInput) {
        milkInput.addEventListener('input', validateMilkAmount);
    }
});

// Polling len pre aktívny časovač
setInterval(checkTimerUpdates, 5000);

// Upravíme všetky API volania aby používali verziu
async function fetchFromAPI(params = {}) {
    try {
        const response = await fetch(`api.php?version=${APP_VERSION}&${new URLSearchParams(params)}`);
        // ... zvyšok funkcie zostáva nezmenený ...
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Modal functions
function showAddRecordModal(type) {
    const modal = document.getElementById('add-record-modal');
    modal.style.display = 'flex';
    
    // Nastavíme text typu aktivity
    const typeText = document.querySelector('.modal-type');
    typeText.textContent = t('activities.' + type);
    
    // Nastavíme predvolené hodnoty
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    
    // Formátujeme dátum a čas samostatne
    const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
    
    const startDateStr = fiveMinutesAgo.getFullYear() + '-' +
        String(fiveMinutesAgo.getMonth() + 1).padStart(2, '0') + '-' +
        String(fiveMinutesAgo.getDate()).padStart(2, '0');
    const startTimeStr = String(fiveMinutesAgo.getHours()).padStart(2, '0') + ':' +
        String(fiveMinutesAgo.getMinutes()).padStart(2, '0');
    
    document.getElementById('start-date').value = startDateStr;
    document.getElementById('start-time').value = startTimeStr;
    document.getElementById('end-date').value = dateStr;
    document.getElementById('end-time').value = timeStr;
    
    // Nastavíme typ aktivity
    const typeFields = document.getElementById('time-fields');
    const nappyFields = document.getElementById('nappy-fields');
    const bottleFields = document.getElementById('bottle-fields');
    
    typeFields.style.display = type !== 'nappy' ? 'block' : 'none';
    nappyFields.style.display = type === 'nappy' ? 'block' : 'none';
    bottleFields.style.display = type === 'bottlefeeding' ? 'block' : 'none';
    
    // Reset nappy type selection
    selectedNappyType = null;
    document.querySelectorAll('.nappy-type-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Uložíme typ do data atribútu pre použitie pri ukladaní
    modal.dataset.type = type;
}

function hideAddRecordModal() {
    document.getElementById('add-record-modal').style.display = 'none';
}

function handleRecordTypeChange() {
    const type = document.getElementById('record-type').value;
    const timeFields = document.getElementById('time-fields');
    const nappyFields = document.getElementById('nappy-fields');
    const bottleFields = document.getElementById('bottle-fields');
    
    timeFields.style.display = type !== 'nappy' ? 'block' : 'none';
    nappyFields.style.display = type === 'nappy' ? 'block' : 'none';
    bottleFields.style.display = type === 'bottlefeeding' ? 'block' : 'none';
}

let selectedNappyType = null;

function selectNappyType(type) {
    selectedNappyType = type;
    document.querySelectorAll('.nappy-type-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === type);
    });
}

async function saveRecord() {
    const type = document.getElementById('add-record-modal').dataset.type;
    let data = { type };
    
    if (type === 'nappy') {
        if (!selectedNappyType) {
            alert(t('modal.select_nappy_type'));
            return;
        }
        
        data = {
            type: 'nappy',
            subType: selectedNappyType,
            time: new Date().toISOString()
        };
        
        await logNappy(selectedNappyType);
    } else {
        const startDate = document.getElementById('start-date').value;
        const startTime = document.getElementById('start-time').value;
        const endDate = document.getElementById('end-date').value;
        const endTime = document.getElementById('end-time').value;
        
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        
        if (endDateTime <= startDateTime) {
            alert(t('modal.invalid_time_range'));
            return;
        }
        
        data = {
            type,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            duration: endDateTime - startDateTime,
            pausedTime: 0
        };
        
        if (type === 'bottlefeeding') {
            const amount = parseInt(document.getElementById('milk-amount').value);
            if (isNaN(amount) || amount < 30 || amount > 500) {
                alert(t('modal.invalid_milk_amount'));
                return;
            }
            data.milkAmount = amount;
        }
        
        await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
    
    await updateTimeline();
    await updateLastActivities();
    hideAddRecordModal();
}

// Pridáme event listener pre zatvorenie modalu pri kliknutí mimo obsahu
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('add-record-modal');
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideAddRecordModal();
        }
    });
});
