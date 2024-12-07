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

const DB_FILE = 'baby_tracker.sqlite';
const APP_VERSION = '1.0.0';

// Spracovanie OPTIONS requestu pre CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode([]);
    exit(0);
}

// Inicializácia SQLite databázy
function initDatabase() {
    try {
        $db = new SQLite3(DB_FILE);
        
        // Vytvorenie tabuľky pre históriu aktivít
        $db->exec('
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                duration INTEGER,
                paused_time INTEGER,
                sub_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ');
        
        // Kontrola či existujú nejaké záznamy
        $count = $db->querySingle('SELECT COUNT(*) FROM activities');
        
        // Ak nie sú žiadne záznamy, pridáme testovací
        if ($count === 0) {
            $now = date('c'); // ISO 8601 formát
            $fiveMinutesAgo = date('c', strtotime('-5 minutes'));
            $duration = 5 * 60 * 1000; // 5 minút v milisekundách
            
            $db->exec("
                INSERT INTO activities (
                    type, 
                    start_time, 
                    end_time, 
                    duration, 
                    paused_time
                ) VALUES (
                    'breastfeeding',
                    '$fiveMinutesAgo',
                    '$now',
                    $duration,
                    0
                )
            ");
        }
        
        $db->exec('
            CREATE TABLE IF NOT EXISTS active_timer (
                id INTEGER PRIMARY KEY,
                task_type TEXT,
                start_time TEXT,
                pause_time TEXT,
                total_paused_time INTEGER
            )
        ');
        
        return $db;
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database initialization failed', 'data' => []]);
        exit;
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
                $response['data'] = $timer ?? null;
                break;
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
                            id, task_type, start_time, pause_time, total_paused_time
                        ) VALUES (
                            1, :type, :startTime, :pauseTime, :totalPausedTime
                        )
                    ');
                    
                    $stmt->bindValue(':type', $input['taskType'], SQLITE3_TEXT);
                    $stmt->bindValue(':startTime', $input['startTime'], SQLITE3_TEXT);
                    $stmt->bindValue(':pauseTime', $input['pauseTime'], SQLITE3_TEXT);
                    $stmt->bindValue(':totalPausedTime', $input['totalPausedTime'], SQLITE3_INTEGER);
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
                    INSERT INTO activities (type, start_time, end_time, duration, paused_time)
                    VALUES (:type, :startTime, :endTime, :duration, :pausedTime)
                ');
                
                $stmt->bindValue(':type', $input['type'], SQLITE3_TEXT);
                $stmt->bindValue(':startTime', $input['startTime'], SQLITE3_TEXT);
                $stmt->bindValue(':endTime', $input['endTime'], SQLITE3_TEXT);
                $stmt->bindValue(':duration', $input['duration'], SQLITE3_INTEGER);
                $stmt->bindValue(':pausedTime', $input['pausedTime'], SQLITE3_INTEGER);
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