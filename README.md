# Baby Care Tracker

A Progressive Web App for tracking baby's daily activities with SQLite database storage.

## Features

- Track multiple activities:
  - Breast Feeding (Purple)
  - Bottle Feeding (Light Blue)
  - Soothing (Blue)
  - Nappy Changes (Yellow/Brown)
- Real-time timer with pause functionality
- Recent activities display (last 6 entries per activity)
- Daily log with relative dates (Today/Yesterday)
- SQLite database storage via PHP API
- Network-only service worker strategy
- Installable as PWA
- Color-coded activities and navigation

## Technical Details

- Frontend:
  - Pure JavaScript, HTML, and CSS
  - Font Awesome icons
  - Responsive design for mobile devices
  - iOS safe area support

- Backend:
  - PHP 8.4 API
  - SQLite3 database
  - JSON communication
  - Error handling and validation

- PWA Features:
  - Service Worker for network-only strategy
  - Manifest for installation
  - Version-based cache management

## Installation

1. Clone the repository
2. Set up a PHP 8.4+ web server
3. Ensure SQLite3 PHP extension is enabled
4. Deploy files to web server
5. Set proper permissions for SQLite database directory
6. Access through a browser
7. Can be installed as PWA through browser's install option

## File Structure

- `index.html` - Main application structure
- `style.css` - All styling and animations
- `script.js` - Frontend application logic
- `api.php` - Backend API for data handling
- `manifest.json` - PWA configuration
- `sw.js` - Service Worker with version control
- `.htaccess` - Server security configuration
- `icons/` - Application icons for PWA

## API Endpoints

- `GET api.php?type={activity_type}` - Get last 6 entries for specific activity
- `GET api.php` - Get all activities from last 30 days
- `POST api.php` - Save new activity

## Security

- Database file has random hash name
- Direct database access blocked via .htaccess
- API error handling and validation
- CORS headers for API access

## Data Storage

All data is stored in SQLite database with:
- Activity type tracking
- Timestamps for all events
- Duration tracking for timed activities
- Automatic database initialization