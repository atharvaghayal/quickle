# Quickle - A Modern Wordle Game

A fully functional, responsive Wordle-style game with daily word challenges, user authentication, statistics tracking, and leaderboard system.

## Features

✅ **Complete Game Mechanics**
- 6 guesses to find the daily word
- Real-time feedback with color-coded tiles (Green = Correct, Yellow = Wrong Position, Gray = Not in word)
- Bonus points for fast solving on 6th guess
- Daily unique word based on date

✅ **Responsive Design**
- Perfect UI/UX across ALL screen sizes
- Mobile-first design with touch optimization
- Tablet and desktop layouts
- Safe area support for notched devices
- Landscape and portrait orientations

✅ **User Authentication**
- Sign up & Login functionality
- Password reset via email
- Secure password hashing with bcrypt
- Session management

✅ **Statistics & Leaderboard**
- Track games played, wins, streaks
- Points system with multipliers
- Monthly leaderboard resets
- Personal statistics dashboard

✅ **Performance**
- Optimized CSS with responsive units
- Lightweight React components
- Efficient game state management
- Fast API backend with SQLAlchemy ORM

## Tech Stack

### Frontend
- React 19
- CSS3 with responsive design (clamp units for universal scaling)
- Axios for API calls
- Custom game UI components

### Backend
- FastAPI (Python)
- SQLAlchemy ORM
- SQLite database (upgradable to PostgreSQL)
- bcrypt for password hashing

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- Git

### Backend Setup

```bash
# Navigate to backend directory
cd quickle-backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (already provided)
# Edit .env with your configuration
# SESSION_SECRET_KEY=your_secret_key

# Run the backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd quickle-frontend

# Install dependencies
npm install

# Start development server (runs on port 3000)
npm start

# Build for production
npm run build
```

## How to Play

1. **Daily Challenge**: A new word is selected daily based on the current date
2. **Make Guesses**: Type a 5-letter word and press Enter (or click Submit)
3. **Read Feedback**:
   - 🟩 Green: Correct letter in correct position
   - 🟨 Yellow: Correct letter in wrong position
   - ⬜ Gray: Letter not in the word
4. **Solve**: Find the word in 6 guesses or less to win
5. **Bonus Points**: 
   - Win on guess 1: 150 points
   - Win on guess 2-5: 7 - guess_number × 25 points
   - Win on guess 6 (within 10s): 150 points
   - Win on guess 6 (within 15s): 100 points
   - Win on guess 6 (within 30s): 75 points

## API Endpoints

### Game Endpoints
- `GET /api/wordle/daily-word?gameId={id}` - Get today's word
- `POST /api/wordle/guess` - Submit a guess
- `GET /api/wordle/next-reset` - Time until next word

### User Endpoints
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login to account
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/user/stats` - Get user statistics
- `POST /api/user/update-stats` - Update stats after game
- `GET /api/user/leaderboard` - Get top players

## Configuration

### Environment Variables (.env)

```
SESSION_SECRET_KEY=your_secret_key_here
GOOGLE_CLIENT_ID=optional_for_oauth
GOOGLE_CLIENT_SECRET=optional_for_oauth
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## File Structure

```
quickle/
├── quickle-backend/
│   ├── main.py              # FastAPI app with game logic
│   ├── auth.py              # Authentication endpoints
│   ├── models.py            # Database models
│   ├── database.py          # Database configuration
│   ├── requirements.txt      # Python dependencies
│   └── .env                 # Environment variables
│
└── quickle-frontend/
    ├── public/              # Static files
    ├── src/
    │   ├── App.js           # Main game component
    │   ├── App.css          # Responsive styles
    │   ├── StatsModal.js    # Statistics display
    │   ├── index.js         # React entry point
    │   └── auth/            # Auth components
    ├── package.json         # Dependencies
    └── .gitignore
```

## Responsive Design Breakpoints

The CSS uses a universal responsive system with `clamp()` functions that scale smoothly across all devices:

- **320px - 375px**: Small phones (iPhone SE)
- **376px - 480px**: Standard phones
- **481px - 767px**: Large phones / Landscape
- **768px - 1023px**: Tablets
- **1024px+**: Laptops and desktops

## Key Features Explained

### Responsive Tiles
Tiles automatically scale using: `clamp(36px, min(10vw, 11vh), 60px)`
This ensures:
- Minimum size for playability
- Scales with viewport
- Maintains aspect ratio
- Fits all 6 rows on screen

### Touch Optimization
- Minimum 44px touch targets on mobile
- 48px+ on tablets
- Proper spacing for finger interaction

### Performance
- CSS-only animations (no JS overhead)
- Lazy loading components
- Optimized re-renders in React
- Efficient state management

## Development

### Add New Features
1. Frontend: Add component to `src/`
2. Backend: Add endpoint to `main.py`
3. Database: Update models if needed
4. Test in development

### Debugging
- Frontend: Browser DevTools
- Backend: Check terminal output
- Database: SQLite Browser tool

## Known Limitations & Future Improvements

- [ ] Google OAuth integration
- [ ] Email notifications
- [ ] Multiplayer mode
- [ ] Custom word lists
- [ ] Dark/Light theme toggle
- [ ] Accessibility improvements (ARIA labels)
- [ ] PWA support
- [ ] Offline mode

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy the build/ folder
```

### Backend (Heroku/Railway)
```bash
# Add Procfile with: "web: uvicorn main:app --host 0.0.0.0 --port $PORT"
# Set environment variables in platform
# Deploy
```

## License

MIT License - Feel free to use and modify!

## Support

For issues or questions:
1. Check the problems.txt file for known issues
2. Review error messages in browser console
3. Check backend logs in terminal
4. Open an issue on GitHub

## Credits

Built with ❤️ by **Atharva Ghayal**

Inspired by the original Wordle game by Josh Wardle
