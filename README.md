# Baby Care Tracker

A Progressive Web App for tracking baby's daily activities including feeding, sleeping, and nappy changes.

## Features

- Track multiple activities:
  - Breast Feeding
  - Bottle Feeding
  - Soothing
  - Nappy Changes (Pee/Poop)
- Real-time timer with pause functionality
- Recent activities display (last 6 entries)
- Daily log with relative dates (Today/Yesterday)
- Offline support with network-only strategy
- Installable as PWA
- Local storage for data persistence

## Technical Details

- Pure JavaScript, HTML, and CSS
- Font Awesome icons
- Service Worker for offline handling
- PWA manifest for installation
- Responsive design for mobile devices

## Installation

1. Clone the repository
2. Serve the files using a web server
3. Access through a browser
4. Can be installed as PWA through browser's install option

## File Structure

- `index.html` - Main application structure
- `style.css` - All styling and animations
- `script.js` - Application logic and data handling
- `manifest.json` - PWA configuration
- `sw.js` - Service Worker for network-only strategy
- `icons/` - Application icons for PWA

## Usage

- Select activity type from bottom navigation
- Use Start/Stop/Pause buttons to control timer
- View recent activities in mini-timeline
- Check full history in Log section
- Nappy changes can be logged with single tap

## Data Storage

All data is stored locally using browser's localStorage.