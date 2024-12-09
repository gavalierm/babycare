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

// Pridáme globálnu premennú pre editovaný záznam
let editedItemId = null;

// Pridáme globálnu premennú
let lastActivities = {};

// Pridáme funkciu pre načítanie detailov záznamu
async function fetchActivityDetails(id) {
    try {
        const response = await fetch(`api.php?id=${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch activity details');
        }
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.data;
    } catch (error) {
        console.error('Error fetching activity details:', error);
        throw error;
    }
}

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
    if (!startTime || !activeTask) return;
    
    let elapsed;
    if (pauseTime) {
        elapsed = pauseTime - startTime - totalPausedTime;
    } else {
        elapsed = new Date() - startTime - totalPausedTime;
    }
    
    // Aktualizujeme len aktívny timer
    const controls = document.querySelector(`.type-controls.type-${activeTask}`);
    if (!controls) return;

    const activeTimer = controls.querySelector('.active-timer');
    if (!activeTimer) return;

    const timeEl = activeTimer.querySelector('.time');
    const durationEl = activeTimer.querySelector('.duration');
    
    if (timeEl) timeEl.textContent = formatTimeOnly(startTime);
    if (durationEl) durationEl.textContent = formatRelativeTime(elapsed, true).value;
    
    // Parameter pre bottle feeding
    if (activeTask === 'bottlefeeding') {
        const parameterEl = activeTimer.querySelector('.parameter');
        const milkAmountEl = controls.querySelector('.milk-amount');
        if (parameterEl && milkAmountEl) {
            parameterEl.textContent = `${milkAmountEl.value}ml`;
        }
    }
}

function updateActiveTaskDisplay() {
    document.querySelectorAll('.type-controls').forEach(controls => {
        if (!controls?.classList) return;

        const typeClass = controls.classList[1];
        if (!typeClass?.startsWith('type-')) return;
        
        const type = typeClass.replace('type-', '');
        const activeTimer = controls.querySelector('.active-timer');
        if (!activeTimer) return;
        
        const buttons = getControlButtons(type);
        if (!buttons) return;
        
        // Reset stavu
        controls.classList.remove('active-task');
        activeTimer.classList.remove('show');
        
        if (buttons.startBtn) buttons.startBtn.style.display = 'block';
        if (buttons.stopBtn) buttons.stopBtn.style.display = 'none';
        if (buttons.pauseBtn) {
            buttons.pauseBtn.style.display = 'none';
            buttons.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }

        // Vyčistíme hodnoty ak nie je aktívna úloha
        if (!activeTask) {
            const timeEl = activeTimer.querySelector('.time');
            const durationEl = activeTimer.querySelector('.duration');
            const parameterEl = activeTimer.querySelector('.parameter');
            
            if (timeEl) timeEl.textContent = '';
            if (durationEl) durationEl.textContent = '';
            if (parameterEl) parameterEl.textContent = '';
            return;
        }

        // Nastavíme aktívny stav
        if (activeTask === type) {
            controls.classList.add('active-task');
            activeTimer.classList.add('show');
            
            if (buttons.startBtn) buttons.startBtn.style.display = 'none';
            if (buttons.stopBtn) buttons.stopBtn.style.display = 'block';
            if (buttons.pauseBtn) {
                buttons.pauseBtn.style.display = 'block';
                buttons.pauseBtn.innerHTML = pauseTime ? 
                    '<i class="fas fa-play"></i>' : 
                    '<i class="fas fa-pause"></i>';
            }
        }
    });
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
        
        // Pre hodiny použijeme formát Hh MMm
        return { value: `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`, label: '' };
    } else {
        // Pre relatívny čas
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        // Konverzia na čitateľnejší formát
        const minutes = Math.floor(diffInSeconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const remainingMinutes = minutes % 60;
        
        if (diffInSeconds < 60) {
            return { value: `${diffInSeconds}s`, label: '' };
        }
        
        if (minutes < 60) {
            return { value: `${minutes}m`, label: '' };
        }
        
        if (hours < 24) {
            // Pre hodiny použijeme formát Hh MMm
            return { value: `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`, label: '' };
        }
        
        return { value: `${days}d`, label: '' };
    }
}

// Timeline funkcie
function createTimelineItem(activity) {
    const template = document.getElementById('timeline-item-template');
    const item = template.content.cloneNode(true);
    const itemEl = item.querySelector('.timeline-item');
    
    itemEl.dataset.id = activity.id;
    itemEl.dataset.type = activity.type;
    if (activity.type === 'nappy') {
        itemEl.dataset.subType = activity.subType;
        itemEl.dataset.time = activity.time;
    } else {
        itemEl.dataset.startTime = activity.startTime;
        itemEl.dataset.endTime = activity.endTime;
    }
    
    // Pridáme ikonu podľa typu
    const icon = document.createElement('i');
    icon.className = getIconClass(activity.type, activity.subType);
    itemEl.insertBefore(icon, itemEl.firstChild);
    
    // Nastavíme text podľa typu aktivity
    const titleEl = itemEl.querySelector('strong');
    if (activity.type === 'bottlefeeding') {
        const amount = activity.milkAmount !== null ? activity.milkAmount : 0;
        titleEl.textContent = `${t('activities.' + activity.type)} • ${amount}ml`;
    } else if (activity.type === 'nappy') {
        titleEl.textContent = `${t('activities.' + activity.type)} • ${activity.subType === 'poop' ? 'Kakanie' : 'Cikanie'}`;
    } else {
        titleEl.textContent = t('activities.' + activity.type);
    }
    
    // Nastavíme relatívny čas od konca aktivity
    const relativeTimeEl = itemEl.querySelector('.timeline-info-details .relative-time');
    const endTime = activity.type === 'nappy' ? new Date(activity.time) : new Date(activity.endTime);
    const relativeTime = formatRelativeTime(endTime);
    relativeTimeEl.querySelector('.label').textContent = t('time.before');
    relativeTimeEl.querySelector('.time').textContent = relativeTime.value;
    
    // Nastavíme čas začiatku aktivity
    const timeEl = itemEl.querySelector('.timeline-info-details > .time');
    timeEl.textContent = formatTimeOnly(activity.type === 'nappy' ? new Date(activity.time) : new Date(activity.startTime));
    
    // Nastavíme trvanie aktivity
    const durationEl = itemEl.querySelector('.timeline-info-details .duration');
    if (activity.type === 'nappy') {
        // Pre nappy pridáme len ikonu
        const typeIcon = document.createElement('i');
        typeIcon.className = activity.subType === 'poop' ? 'fas fa-poo' : 'fas fa-water';
        durationEl.appendChild(typeIcon);
    } else {
        // Pre ostatné aktivity pridáme trvanie
        durationEl.textContent = formatRelativeTime(activity.duration, true).value;
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
function startTask(type) {
    if (activeTask) return;
    
    if (type === 'bottlefeeding') {
        const input = document.querySelector('.type-bottlefeeding .milk-amount');
        if (!input.value || !validateMilkAmount()) {
            input.focus();
            return;
        }
        input.classList.add('hidden');
        input.disabled = true;
    }
    
    // Okamžitá aktualizácia UI
    activeTask = type;
    startTime = new Date();
    totalPausedTime = 0;
    
    const controls = document.querySelector(`.type-controls.type-${type}`);
    controls.classList.add('active-task');
    
    const buttons = getControlButtons(type);
    if (buttons) {
        if (buttons.startBtn) buttons.startBtn.style.display = 'none';
        if (buttons.stopBtn) buttons.stopBtn.style.display = 'block';
        if (buttons.pauseBtn) {
            buttons.pauseBtn.style.display = 'block';
            buttons.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
    }
    
    // Spustíme timer okamžite
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    
    // Zobrazíme active-timer okamžite
    const activeTimer = document.querySelector(`.type-controls.type-${type} .active-timer`);
    if (activeTimer) {
        activeTimer.classList.add('show');
    }
    
    // API volanie na pozadí bez čakania
    saveActiveTimer().catch(error => {
        console.error('Failed to save timer state:', error);
    });
}

function pauseTask() {
    if (!activeTask) return;
    
    const buttons = getControlButtons(activeTask);
    if (!buttons?.pauseBtn) return;
    
    // Okamžitá aktualizácia UI
    if (pauseTime) {
        totalPausedTime += new Date() - pauseTime;
        pauseTime = null;
        buttons.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        pauseTime = new Date();
        buttons.pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    // API volanie na pozadí bez čakania
    saveActiveTimer().catch(error => {
        console.error('Failed to save timer state:', error);
    });
}

// Upravíme funkciu stopTask
function stopTask() {
    if (!activeTask) return;
    
    clearInterval(timerInterval);
    const endTime = new Date();
    const duration = endTime - startTime - totalPausedTime;
    
    // Pripravíme dáta pre API
    const data = {
        type: activeTask,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        pausedTime: totalPausedTime
    };

    if (activeTask === 'bottlefeeding') {
        const input = document.querySelector('.type-bottlefeeding .milk-amount');
        if (input?.value) {
            data.milkAmount = parseInt(input.value);
        }
    }

    // Uložíme si typ pred resetom
    const currentType = activeTask;

    // Okamžitá aktualizácia UI
    const controls = document.querySelector(`.type-controls.type-${currentType}`);
    if (controls) {
        controls.classList.remove('active-task');
        
        // Reset tlačidiel
        const buttons = getControlButtons(currentType);
        if (buttons) {
            if (buttons.startBtn) buttons.startBtn.style.display = 'block';
            if (buttons.stopBtn) buttons.stopBtn.style.display = 'none';
            if (buttons.pauseBtn) buttons.pauseBtn.style.display = 'none';
        }
    }
    
    if (currentType === 'bottlefeeding') {
        const input = document.querySelector('.type-bottlefeeding .milk-amount');
        if (input) {
            input.disabled = false;
            input.value = '';
            input.classList.remove('hidden');
        }
    }
    
    const activeTimer = document.querySelector(`.type-controls.type-${currentType} .active-timer`);
    if (activeTimer) {
        activeTimer.classList.remove('show');
        activeTimer.querySelector('.time').textContent = '';
        activeTimer.querySelector('.duration').textContent = '';
    }
    
    // Reset globálnych premenných
    activeTask = null;
    startTime = null;
    pauseTime = null;
    totalPausedTime = 0;
    
    // API volania na pozadí bez čakania
    Promise.all([
        fetch('api.php?action=active-timer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskType: null,
                startTime: null,
                pauseTime: null,
                totalPausedTime: 0
            })
        }),
        fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
    ])
    .then(() => {
        // Aktualizácie na pozadí
        updateTimeline().catch(console.error);
        updateLastActivities().catch(console.error);
    })
    .catch(error => {
        console.error('Failed to save activity:', error);
    });
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
                const input = document.querySelector('.type-bottlefeeding .milk-amount');
                if (input?.value) {
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
            
            buttons.pauseBtn.innerHTML = timer.pause_time ? 
                '<i class="fas fa-play"></i>' : 
                '<i class="fas fa-pause"></i>';
            
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
    
    // Resetujeme lastActivities
    lastActivities = {};
    
    // Aktualizujeme lastActivities
    activities.forEach(activity => {
        const type = activity.type;
        // Použijeme endTime pre aktivity s trvaním, time pre nappy
        const time = activity.type === 'nappy' ? 
            new Date(activity.time) : 
            new Date(activity.endTime);
        
        if (!lastActivities[type] || time > new Date(lastActivities[type])) {
            lastActivities[type] = time;
        }
    });
    
    // Aktualizujeme UI
    document.querySelectorAll('.nav-item').forEach(item => {
        const button = item.querySelector('.nav-button');
        const type = button.getAttribute('onclick').match(/'([^']+)'/)[1];
        const timeEl = item.querySelector('.last-activity .time');
        const labelEl = item.querySelector('.last-activity .label');
        
        if (lastActivities[type]) {
            const relativeTime = formatRelativeTime(lastActivities[type]);
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

    // Nastavíme title dokumentu
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
    // Reset editedItemId pri pridávaní nového záznamu
    editedItemId = null;
    
    const modal = document.getElementById('add-record-modal');
    delete modal.dataset.originalData;
    
    modal.classList.add('show');
    
    // Nastavíme text typu aktivity
    const typeText = modal.querySelector('.modal-type');
    typeText.textContent = t('activities.' + type);
    
    // Nastavíme typ aktivity
    modal.dataset.type = type;
    
    // Reset form-dirty class
    document.body.classList.remove('form-dirty');
    
    // Nastavíme správny titulok
    const modalTitle = modal.querySelector('.modal-subtitle');
    modalTitle.setAttribute('data-translate', 'modal.add_record');
    modalTitle.textContent = t('modal.add_record');
    
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
    
    // Nastavíme typ polí podľa typu aktivity
    const timeFields = document.getElementById('time-fields');
    const nappyFields = document.getElementById('nappy-fields');
    const bottleFields = document.getElementById('bottle-fields');
    
    timeFields.style.display = type !== 'nappy' ? 'block' : 'none';
    nappyFields.style.display = type === 'nappy' ? 'block' : 'none';
    bottleFields.style.display = type === 'bottlefeeding' ? 'block' : 'none';
    
    // Reset nappy type selection
    selectedNappyType = null;
    document.querySelectorAll('.nappy-type-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Reset milk amount
    const milkAmountInput = document.getElementById('milk-amount');
    if (milkAmountInput) {
        milkAmountInput.value = '';
    }
}

function hideAddRecordModal() {
    const modal = document.getElementById('add-record-modal');
    modal.classList.remove('show');
    editedItemId = null;
    
    // Odstránime data-original-data atribút
    delete modal.dataset.originalData;
    
    // Odstránime form-dirty class
    document.body.classList.remove('form-dirty');
}

function selectNappyType(type) {
    selectedNappyType = type;
    document.querySelectorAll('.nappy-type-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === type);
    });
}

async function saveRecord() {
    const modal = document.getElementById('add-record-modal');
    const type = modal.dataset.type;
    let data = { type };
    
    if (type === 'nappy') {
        if (!selectedNappyType) {
            alert(t('modal.select_nappy_type'));
            return;
        }
        data.subType = selectedNappyType;
        data.time = new Date().toISOString();
    } else {
        // Vytvoríme ISO dátumy pre začiatok a koniec
        const startDate = document.getElementById('start-date').value;
        const startTime = document.getElementById('start-time').value;
        const endDate = document.getElementById('end-date').value;
        const endTime = document.getElementById('end-time').value;
        
        if (!startDate || !startTime || !endDate || !endTime) {
            alert(t('modal.invalid_time_range'));
            return;
        }
        
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        
        if (endDateTime <= startDateTime) {
            alert(t('modal.invalid_time_range'));
            return;
        }
        
        data.startTime = startDateTime.toISOString();
        data.endTime = endDateTime.toISOString();
        data.duration = Math.floor((endDateTime - startDateTime) / 1000);
        
        if (type === 'bottlefeeding') {
            const amount = parseInt(document.getElementById('milk-amount').value);
            if (isNaN(amount) || amount < 30 || amount > 500) {
                alert(t('modal.invalid_milk_amount'));
                return;
            }
            data.milkAmount = amount;
        }
    }
    
    const method = editedItemId ? 'PUT' : 'POST';
    const url = editedItemId ? `api.php?id=${editedItemId}` : 'api.php';
    
    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Nepodarilo sa uložiť záznam');
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        await updateTimeline();
        await updateLastActivities();
        hideAddRecordModal();
        editedItemId = null;
        
        return result;  // Vrátime celý výsledok
    } catch (error) {
        console.error('Error saving record:', error);
        alert('Nepodarilo sa uložiť z��znam');
        throw error;  // Prehodíme chybu ďalej
    }
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

// Upravíme funkciu pre zobrazenie edit modalu
function showEditModal(button) {
    // Získame ID zo správneho atribútu
    const id = button.closest('.timeline-item').dataset.id;
    if (!id) {
        console.error('No ID found for edit');
        return;
    }
    
    try {
        openEditModal(id);  // Voláme novú funkciu
    } catch (error) {
        console.error('Error showing edit modal:', error);
        alert('Nepodarilo sa načítať údaje pre úpravu');
    }
}

// Vytvoríme novú funkciu pre otvorenie edit modalu
async function openEditModal(id) {
    try {
        const data = await fetchActivityDetails(id);
        const modal = document.getElementById('add-record-modal');
        
        // Uložíme originálne dáta do dataset modalu
        modal.dataset.originalData = JSON.stringify(data);
        
        // Nastavíme ID editovaného záznamu
        editedItemId = id;
        modal.dataset.type = data.type;
        
        // Nastavíme nadpis typu aktivity
        const typeText = modal.querySelector('.modal-type');
        typeText.textContent = t('activities.' + data.type);
        
        // Nastavíme typ polí podľa typu aktivity
        const timeFields = document.getElementById('time-fields');
        const nappyFields = document.getElementById('nappy-fields');
        const bottleFields = document.getElementById('bottle-fields');
        
        timeFields.style.display = data.type !== 'nappy' ? 'block' : 'none';
        nappyFields.style.display = data.type === 'nappy' ? 'block' : 'none';
        bottleFields.style.display = data.type === 'bottlefeeding' ? 'block' : 'none';

        if (data.type === 'nappy') {
            selectNappyType(data.subType);
            // Pre nappy použijeme time namiesto startTime
            const nappyTime = new Date(data.time);
            document.getElementById('start-date').value = nappyTime.toISOString().split('T')[0];
            document.getElementById('start-time').value = nappyTime.toTimeString().slice(0,5);
        } else {
            // Rozdelíme ISO dátum na dátum a čas pre začiatok
            if (data.startTime) {
                const startDate = new Date(data.startTime);
                document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
                document.getElementById('start-time').value = startDate.toTimeString().slice(0,5);
            }
            
            // Rozdelíme ISO dátum na dátum a čas pre koniec
            if (data.endTime) {
                const endDate = new Date(data.endTime);
                document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
                document.getElementById('end-time').value = endDate.toTimeString().slice(0,5);
            }
            
            // Nastavíme množstvo mlieka pre fľašu
            if (data.type === 'bottlefeeding' && data.milkAmount !== null) {
                const milkAmountInput = document.getElementById('milk-amount');
                if (milkAmountInput) {
                    milkAmountInput.value = data.milkAmount;
                }
            }
        }
        
        // Aktualizujeme titulok modálneho okna
        const modalTitle = modal.querySelector('.modal-subtitle');
        modalTitle.setAttribute('data-translate', 'modal.edit_record');
        modalTitle.textContent = t('modal.edit_record');
        
        // Nastavíme onclick handler pre delete tlačidlo
        const deleteBtn = modal.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => deleteRecord(id);
        }
        
        // Pridáme event listener na celý formulár
        const form = modal.querySelector('.modal-form');
        form.addEventListener('change', () => {
            document.body.classList.add('form-dirty');
        });
        
        // Pre input type="number" sledujeme aj input event
        const numberInputs = form.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('input', () => {
                document.body.classList.add('form-dirty');
            });
        });
        
        // Pre nappy type buttons
        const nappyButtons = form.querySelectorAll('.nappy-type-btn');
        nappyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.classList.add('form-dirty');
            });
        });
        
        // Inicializujeme stav - odstránime form-dirty class
        document.body.classList.remove('form-dirty');
        
        modal.classList.add('show');
    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert('Nepodarilo sa načítať údaje pre úpravu');
    }
}

// Pridáme funkciu pre aktualizáciu relatívnych časov
function updateRelativeTimes() {
    document.querySelectorAll('.timeline-item').forEach(item => {
        const relativeTimeEl = item.querySelector('.relative-time .time');
        const timeEl = item.querySelector('.timeline-info-details > .time');
        
        if (timeEl && relativeTimeEl) {
            const time = item.dataset.type === 'nappy' ? 
                new Date(item.dataset.time) : 
                new Date(item.dataset.endTime);
            
            const relativeTime = formatRelativeTime(time);
            relativeTimeEl.textContent = relativeTime.value;
        }
    });
    
    // Aktualizujeme aj časy v navigácii
    document.querySelectorAll('.nav-item').forEach(item => {
        const button = item.querySelector('.nav-button');
        const type = button.getAttribute('onclick').match(/'([^']+)'/)[1];
        const timeEl = item.querySelector('.last-activity .time');
        const lastActivity = lastActivities[type];
        
        if (lastActivity && timeEl) {
            const relativeTime = formatRelativeTime(lastActivity);
            timeEl.textContent = relativeTime.value;
        }
    });
}

// Pridáme interval pre aktualizáciu relatívnych časov
setInterval(updateRelativeTimes, 10000);  // 10 sekúnd

// Pridáme funkciu pre vymazanie záznamu
async function deleteRecord(id) {
    if (confirm(t('modal.confirm_delete'))) {
        try {
            const response = await fetch(`api.php?id=${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Nepodarilo sa vymazať záznam');
            }
            
            await updateTimeline();
            await updateLastActivities();
            hideAddRecordModal();
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('Nepodarilo sa vymazať záznam');
        }
    }
}

// Upravíme funkciu pre kontrolu aktívneho časovača
async function checkActiveTimer() {
    try {
        const response = await fetch('api.php?action=active-timer');
        if (!response.ok) throw new Error('Failed to fetch active timer');
        
        const data = await response.json();
        const timer = data.data;
        
        if (!timer || !timer.task_type) {
            // Ak nie je aktívny časovač, resetujeme všetky hodnoty
            activeTask = null;
            startTime = null;
            pauseTime = null;
            totalPausedTime = 0;
            updateActiveTaskDisplay();
            return;
        }
        
        // Aktualizujeme globálne premenné
        activeTask = timer.task_type;
        startTime = timer.start_time ? new Date(timer.start_time) : null;
        pauseTime = timer.pause_time ? new Date(timer.pause_time) : null;
        totalPausedTime = timer.total_paused_time || 0;
        
        // Aktualizujeme UI
        updateActiveTaskDisplay();
        updateTimer();
        
    } catch (error) {
        console.error('Error checking active timer:', error);
    }
}

// Zvýšime frekvenciu kontroly aktívneho časovača
setInterval(checkActiveTimer, 1000);  // Kontrola každú sekundu namiesto 10 sekúnd
