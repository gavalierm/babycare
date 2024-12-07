# Baby Care Tracker v3.2.0

A Progressive Web App for tracking baby's daily activities with real-time synchronization across devices.

## Changelog

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

## Core Features

- Activity Tracking:
  - Breast Feeding (Purple)
  - Bottle Feeding (Light Blue)
  - Soothing (Blue)
  - Nappy Changes (Yellow/Brown)
- Timer Functions:
  - Real-time countdown with pause
  - Multi-device synchronization (5s interval)
  - Automatic state recovery
  - Accurate time calculations
- History & Logs:
  - Last 6 entries per activity
  - Daily timeline with relative dates
  - Duration and pause time tracking
  - Color-coded interface

## Technical Stack

- Frontend:
  - HTML5, CSS3, Pure JavaScript
  - Font Awesome icons
  - iOS safe area support
  - PWA with offline capabilities
  - Service Worker with version control

- Backend:
  - PHP 8.4 with SQLite3
  - RESTful JSON API
  - Secure database access
  - CORS enabled endpoints

## API Endpoints

- Activities:
  - `GET api.php?type={type}` - Recent entries
  - `GET api.php` - 30-day history
  - `POST api.php` - Save activity

- Timer Sync:
  - `GET api.php?action=active-timer` - Get state
  - `POST api.php?action=active-timer` - Update state

## Installation

1. Clone repository
2. Configure PHP 8.4+ server with SQLite3
3. Set database permissions
4. Deploy files
5. Access via browser or install as PWA

## Project Structure

- `index.html` - Main application structure
- `style.css` - All styling and animations
- `script.js` - Frontend application logic and synchronization
- `api.php` - Backend API for data handling and timer state
- `manifest.json` - PWA configuration
- `sw.js` - Service Worker with version control
- `.htaccess` - Server security configuration
- `icons/` - Application icons for PWA