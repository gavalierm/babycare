<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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
            // Načítanie histórie
            $stmt = $db->prepare('SELECT * FROM activities ORDER BY created_at DESC');
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
                
                // Pre nappy aktivity pridáme subType
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