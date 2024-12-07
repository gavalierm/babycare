# Baby Care Tracker v3.3.1

A Progressive Web App for tracking baby's daily activities with real-time synchronization across devices.

## Core Features

- Activity Tracking:
  - Breast Feeding (Purple)
  - Bottle Feeding (Light Blue)
  - Sleep (Blue)
  - Nappy Changes (Yellow/Brown)
- Timer Functions:
  - Real-time countdown with pause/resume
  - Multi-device synchronization
  - Automatic state recovery
  - Pause time tracking
- History & Logs:
  - Daily timeline view
  - Last activity indicators
  - Duration tracking
  - Color-coded interface
  - Relative time display

## Technical Stack

- Frontend:
  - HTML5, CSS3, Pure JavaScript
  - Font Awesome icons
  - iOS safe area support
  - PWA with offline capabilities
  - Service Worker with cache control
  - Localization support

- Backend:
  - PHP with SQLite3
  - RESTful JSON API
  - Secure database access
  - CORS enabled endpoints

## API Endpoints

- Activities:
  - `GET api.php?type={type}` - Get activities by type
  - `GET api.php` - Get all activities
  - `POST api.php` - Save activity

- Timer Sync:
  - `GET api.php?action=active-timer` - Get timer state
  - `POST api.php?action=active-timer` - Update timer state

## Installation

1. Clone repository
2. Configure PHP server with SQLite3
3. Set database permissions
4. Deploy files
5. Access via browser or install as PWA

## Project Structure

- `index.html` - Main application structure
- `style.css` - All styling and animations
- `script.js` - Frontend application logic
- `api.php` - Backend API endpoints
- `manifest.json` - PWA configuration
- `sw.js` - Service Worker
- `.htaccess` - Server configuration
- `icons/` - Application icons

## Changelog

### v3.3.1
- Added milk amount tracking for bottle feeding
- Added input validation for milk amount (30-500ml)
- Improved timeline display with milk amount information
- Added automatic focus on milk amount input
- Database migration system implemented
- Unified translation keys
- Fixed placeholder translations
- Code cleanup and optimizations

### v3.2.0
- Optimized mobile design
- Removed hover effects for better mobile usability
- Cleaned up unused CSS rules
- Removed duplicate styles
- Improved time display formatting
- Added Slovak language with proper grammar cases
- Enhanced relative time display (seconds, minutes, hours, days)
- Optimized translations loading via localStorage
- Added icons for all activity types
- Improved timeline information layout
- Fixed relative time display issues

### v3.0.0
- First stable release
- Core activity tracking functionality
- Offline mode support
- Real-time device synchronization
- Basic user interface

### v2.0.0
- Added Slovak language support
- Enhanced mobile design
- Added new activity icons
- Improved time display
- Added activity timeline
- Added last activity display
- Performance optimizations
- Fixed synchronization issues

### v1.0.0
- Initial release
- Breast, bottle and sleep tracking
- Basic activity timer
- Basic device synchronization
- English-only interface
- SQLite data storage
- PWA functionality