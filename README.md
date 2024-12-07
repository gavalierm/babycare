# Baby Care Tracker

Version: 3.4.0

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

### v3.4.0
- Added manual record entry for all activity types
- Added new modal window for record entry
- Added separated date and time inputs for better usability
- Added plus button for each activity type
- Improved bottle feeding controls layout
- Optimized form elements layout in modal window
- Enhanced iOS safe area support
- Improved visual distinction of activity types in modal
- Added zoom prevention for better mobile experience
- Optimized date and time handling
- Enhanced input validation

### v3.3.4
- Fixed inconsistent pause/play icon display when starting timer
- Fixed pause/play icon state synchronization between devices
- Fixed incorrect icon flashing when loading active timer
- Unified pause/play icon display logic across the application
- Improved pause_time handling in API response

### v3.3.3
- Enhanced active-timer component display
- Optimized CSS for navigation buttons

### v3.3.2
- Fixed timer behavior during pause state
- Timer now properly stops counting during pause
- Fixed time display in paused state
- Fixed timer synchronization between devices during pause
- Fixed total duration calculation with pauses
- Improved timer state management

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