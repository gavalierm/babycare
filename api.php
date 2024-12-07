<?php
// Vypneme zobrazovanie PHP chýb
error_reporting(0);
ini_set('display_errors', 0);

// Nastavíme hlavičky
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Pridáme error handler
function handleError($errno, $errstr, $errfile, $errline) {
    $response = [
        'error' => $errstr,  // Vypíšeme konkrétnu chybu
        'details' => [
            'file' => $errfile,
            'line' => $errline
        ],
        'data' => []
    ];
    http_response_code(500);  // Internal Server Error
    echo json_encode($response);
    exit;
}
set_error_handler('handleError');

// Pridáme exception handler
function handleException($e) {
    $response = [
        'error' => $e->getMessage(),
        'details' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ],
        'data' => []
    ];
    
    // Nastavíme správny HTTP status kód
    if ($e instanceof InvalidArgumentException) {
        http_response_code(400);  // Bad Request
    } else {
        http_response_code(500);  // Internal Server Error
    }
    
    echo json_encode($response);
    exit;
}
set_exception_handler('handleException');

// Pridáme konštantu pre verziu a upravíme názov databázy
const DB_FILE = 'baby_tracker.sqlite';
const DB_VERSION = 3;  // Zvýšime verziu databázy
const APP_VERSION = '1.0.0';

// Spracovanie OPTIONS requestu pre CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode([]);
    exit(0);
}

// Funkcia pre kontrolu a vykonanie migrácií
function checkAndMigrate($db) {
    // Vytvoríme tabuľku pre sledovanie verzie databázy
    $db->exec('
        CREATE TABLE IF NOT EXISTS db_version (
            version INTEGER PRIMARY KEY
        )
    ');
    
    // Zistíme aktuálnu verziu databázy
    $currentVersion = $db->querySingle('SELECT version FROM db_version LIMIT 1') ?: 0;
    
    // Ak je verzia nižšia ako požadovaná, spustíme migrácie
    if ($currentVersion < DB_VERSION) {
        // Migrácie vykonávame postupne
        if ($currentVersion < 1) {
            // Základná štruktúra - už existuje v initDatabase
            $currentVersion = 1;
        }
        
        if ($currentVersion < 2) {
            // Pridanie stĺpca milk_amount do activities
            try {
                $db->exec('ALTER TABLE activities ADD COLUMN milk_amount INTEGER DEFAULT NULL');
                $currentVersion = 2;
            } catch (Exception $e) {
                error_log('Migration 2 (activities.milk_amount) failed: ' . $e->getMessage());
            }
        }
        
        if ($currentVersion < 3) {
            // Pridanie stĺpca milk_amount do active_timer
            try {
                $db->exec('ALTER TABLE active_timer ADD COLUMN milk_amount INTEGER DEFAULT NULL');
                $currentVersion = 3;
            } catch (Exception $e) {
                error_log('Migration 3 (active_timer.milk_amount) failed: ' . $e->getMessage());
            }
        }
        
        // Aktualizujeme verziu v databáze
        $db->exec('DELETE FROM db_version');
        $db->exec("INSERT INTO db_version (version) VALUES ($currentVersion)");
    }
}

// Upravíme inicializáciu databázy
function initDatabase() {
    try {
        // Vytvoríme pripojenie k databáze
        $db = new SQLite3(DB_FILE);
        
        if (!file_exists(DB_FILE)) {
            // Vytvoríme/aktualizujeme schému databázy
            $db->exec('CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                subtype TEXT,
                start_time INTEGER,
                end_time INTEGER,
                duration INTEGER,
                amount INTEGER,
                created_at INTEGER DEFAULT (strftime(\'%s\',\'now\'))
            )');
            
            $db->exec('CREATE TABLE IF NOT EXISTS active_timer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                start_time INTEGER,
                paused_at INTEGER,
                total_pause_duration INTEGER DEFAULT 0,
                amount INTEGER
            )');
        }
        
        // Kontrola a vykonanie migrácií
        checkAndMigrate($db);
        
        return $db;
    } catch (Exception $e) {
        throw new Exception('Database initialization failed: ' . $e->getMessage());
    }
}

// Predvolená odpoveď
$response = ['data' => []];

// Spracovanie requestu
try {
    $db = initDatabase();
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $type = $_GET['type'] ?? null;
            $action = $_GET['action'] ?? null;
            
            if ($action === 'active-timer') {
                // Vrátime aktívny časovač
                $stmt = $db->prepare('
                    SELECT * FROM active_timer 
                    WHERE id = 1
                ');
                $result = $stmt->execute();
                $timer = $result->fetchArray(SQLITE3_ASSOC);
                
                // Konvertujeme názvy stĺpcov na camelCase pre JavaScript
                if ($timer) {
                    $response['data'] = [
                        'task_type' => $timer['task_type'],
                        'start_time' => $timer['start_time'],
                        'pause_time' => $timer['pause_time'] ? $timer['pause_time'] : null,
                        'total_paused_time' => (int)$timer['total_paused_time'],
                        'milk_amount' => isset($timer['milk_amount']) ? (int)$timer['milk_amount'] : null
                    ];
                } else {
                    $response['data'] = null;
                }
                
                echo json_encode($response);
                exit;
            }
            
            if ($type === '') {  // Prázdny parameter
                throw new InvalidArgumentException('Type parameter cannot be empty');
            }
            
            if ($type) {
                // Načítanie histórie pre konkrétny typ
                $stmt = $db->prepare('
                    SELECT * FROM activities 
                    WHERE type = :type 
                    ORDER BY created_at DESC 
                    LIMIT 6
                ');
                $stmt->bindValue(':type', $type, SQLITE3_TEXT);
            } else {
                // Načítanie celej histórie za posledných 30 dní
                $thirtyDaysAgo = date('c', strtotime('-30 days'));
                $stmt = $db->prepare('
                    SELECT * FROM activities 
                    WHERE (start_time IS NOT NULL AND start_time >= :date) 
                       OR (created_at >= :date)  /* Len created_at a start_time */
                    ORDER BY created_at DESC
                ');
                $stmt->bindValue(':date', $thirtyDaysAgo, SQLITE3_TEXT);
            }
            
            $result = $stmt->execute();
            $activities = [];
            
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                // Konverzia na formát kompatibilný s aplikáciou
                $activity = [
                    'type' => $row['type'],
                    'startTime' => $row['start_time'],
                    'endTime' => $row['end_time'],
                    'duration' => (int)$row['duration'],
                    'pausedTime' => (int)$row['paused_time']
                ];
                
                if ($row['type'] === 'nappy') {
                    $activity['subType'] = $row['sub_type'];
                    $activity['time'] = $row['start_time'];
                }
                
                // Pridáme milk_amount pre bottle feeding
                if ($row['type'] === 'bottlefeeding') {
                    $activity['milkAmount'] = isset($row['milk_amount']) ? (int)$row['milk_amount'] : null;
                }
                
                $activities[] = $activity;
            }
            
            $response['data'] = $activities;
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Kontrola vstupných dát
            if (!$input) {
                throw new Exception('Invalid input data');
            }
            
            $action = $_GET['action'] ?? null;
            
            if ($action === 'active-timer') {
                if ($input['taskType'] === null) {
                    // Vymažeme aktívny časovač
                    $stmt = $db->prepare('DELETE FROM active_timer WHERE id = 1');
                } else {
                    // Uložíme aktívny časovač
                    $stmt = $db->prepare('
                        INSERT OR REPLACE INTO active_timer (
                            id, 
                            task_type, 
                            start_time, 
                            pause_time, 
                            total_paused_time,
                            milk_amount
                        ) VALUES (
                            1, 
                            :type, 
                            :startTime, 
                            :pauseTime, 
                            :totalPausedTime,
                            :milkAmount
                        )
                    ');
                    
                    $stmt->bindValue(':type', $input['taskType'], SQLITE3_TEXT);
                    $stmt->bindValue(':startTime', $input['startTime'], SQLITE3_TEXT);
                    $stmt->bindValue(':pauseTime', $input['pauseTime'], SQLITE3_TEXT);
                    $stmt->bindValue(':totalPausedTime', $input['totalPausedTime'], SQLITE3_INTEGER);
                    $stmt->bindValue(':milkAmount', $input['milkAmount'] ?? null, SQLITE3_INTEGER);
                }
                
                $result = $stmt->execute();
                $response['success'] = true;
                break;
            }
            
            if ($input['type'] === 'nappy') {
                $stmt = $db->prepare('
                    INSERT INTO activities (type, start_time, sub_type)
                    VALUES (:type, :time, :subType)
                ');
                
                $stmt->bindValue(':type', $input['type'], SQLITE3_TEXT);
                $stmt->bindValue(':time', $input['time'], SQLITE3_TEXT);
                $stmt->bindValue(':subType', $input['subType'], SQLITE3_TEXT);
            } else {
                $stmt = $db->prepare('
                    INSERT INTO activities (
                        type, 
                        start_time, 
                        end_time, 
                        duration, 
                        paused_time,
                        milk_amount
                    )
                    VALUES (
                        :type, 
                        :startTime, 
                        :endTime, 
                        :duration, 
                        :pausedTime,
                        :milkAmount
                    )
                ');
                
                $stmt->bindValue(':type', $input['type'], SQLITE3_TEXT);
                $stmt->bindValue(':startTime', $input['startTime'], SQLITE3_TEXT);
                $stmt->bindValue(':endTime', $input['endTime'], SQLITE3_TEXT);
                $stmt->bindValue(':duration', $input['duration'], SQLITE3_INTEGER);
                $stmt->bindValue(':pausedTime', $input['pausedTime'], SQLITE3_INTEGER);
                
                // Pridáme milk_amount pre bottle feeding
                if ($input['type'] === 'bottlefeeding' && isset($input['milkAmount'])) {
                    $stmt->bindValue(':milkAmount', $input['milkAmount'], SQLITE3_INTEGER);
                } else {
                    $stmt->bindValue(':milkAmount', null, SQLITE3_NULL);
                }
            }
            
            $result = $stmt->execute();
            
            if ($result) {
                $response = [
                    'success' => true,
                    'id' => $db->lastInsertRowID(),
                    'data' => []
                ];
            } else {
                throw new Exception('Failed to save activity');
            }
            break;
            
        default:
            $response = ['error' => 'Method not allowed', 'data' => []];
    }
    
} catch (Exception $e) {
    $response = ['error' => $e->getMessage(), 'data' => []];
}

if (isset($db)) {
    $db->close();
}

echo json_encode($response); 