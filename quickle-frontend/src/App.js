import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css'; 
import StatsModal from './StatsModal'; // Assuming StatsModal is in a separate file

const API_BASE_URL = 'http://localhost:8000/api/wordle';

// --- Redirection Handler ---
const redirectToRules = () => {
    window.location.href = '/rules.html';
};


// --- Theme Button Component ---
const ThemeButton = ({ theme, toggleTheme }) => {
    const icon = theme === 'dark' ? '☀️' : '🌙'; 
    return (
        <div className="theme-icon" onClick={toggleTheme}>
            {icon}
        </div>
    );
};


// --- BitTitle Component ---
const BitTitle = ({ text }) => {
    const processedText = text.split('');
    const coloredCharacters = processedText.map((char, index) => {
        if (char === ' ' && index === 5) {
            return <span key={index} className="word-separator">&nbsp;</span>;
        }
        return <span key={index} className="bit-char">{char}</span>;
    });
    return (<h1 className="title-bitcount">{coloredCharacters}</h1>);
};

// --- Tile Component ---
const Tile = ({ letter, status }) => {
    const className = `tile ${status || 'empty'}`; 
    return (<div className={className}>{letter}</div>);
};

// --- Row Component ---
const Row = ({ guess, solutionStatus }) => {
    const tiles = Array.from({ length: 5 }, (_, i) => ({
        letter: guess[i] || '',
        status: solutionStatus ? solutionStatus[i] : (guess[i] ? 'typing' : 'empty')
    }));

    return (
        <div className="row">
            {tiles.map((tile, index) => (
                <Tile key={index} letter={tile.letter} status={tile.status} />
            ))}
        </div>
    );
};


// --- Toast Component for Notifications (FIXED STRUCTURE) ---
const Toast = ({ message, type, onClose }) => {
    
    // 1. HOOKS MUST COME FIRST (to avoid conditional hook error)
    useEffect(() => {
        if (message) { 
            const timer = setTimeout(onClose, 2000); 
            return () => clearTimeout(timer);
        }
        return undefined; 
    }, [message, onClose]);

    // 2. Conditional rendering can follow
    if (!message) return null; 

    return (
        <div className={`toast toast-${type}`}>
            {message}
        </div>
    );
};


// Main App component
function App() {
    const MAX_GUESSES = 6;
    const WORD_LENGTH = 5;

    // --- State Management ---
    // MODIFIED: Initialize theme from localStorage, defaulting to 'dark'
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('quickle_theme') || 'dark';
    });
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [solvedStatuses, setSolvedStatuses] = useState([]); 
    const [gameState, setGameState] = useState('playing'); 
    const [score, setScore] = useState(0); 
    const [systemWord, setSystemWord] = useState(''); 
    const [toastMessage, setToastMessage] = useState(null); 
    const [isLocked, setIsLocked] = useState(false); // Device-level one-play lock
    const [showLockModal, setShowLockModal] = useState(false);
    
    // 6th Guess Timer State
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const timerRef = useRef(null);

    // Modal State
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [statsData, setStatsData] = useState(null);
    const [resetTime, setResetTime] = useState(null);
    
    // --- One-play-per-day lock ---
    const todayKey = new Date().toISOString().slice(0, 10);
    useEffect(() => {
        const lastPlayed = localStorage.getItem('quickle_play_date');
        if (lastPlayed === todayKey) {
            setIsLocked(true);
            setGameState('locked');
            setIsTimerActive(false);
            setToastMessage("Game over. Come back tomorrow to guess new word.");
            setShowLockModal(true);
        }
    }, [todayKey]);

    // Allow closing the lock modal with Escape
    useEffect(() => {
        if (!showLockModal) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') setShowLockModal(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [showLockModal]);
    
    // --- Initial Word Fetch (USING API_BASE_URL) ---
    const fetchSystemWord = useCallback(async () => {
        try {
            const wordResponse = await axios.get(`${API_BASE_URL}/daily-word`);
            setSystemWord(wordResponse.data.word || "QUICK"); 
        } catch (error) {
            console.error("Error fetching daily word:", error);
            setSystemWord("QUICK"); 
        }
    }, []);

    useEffect(() => {
        fetchSystemWord();
    }, [fetchSystemWord]);


    // --- Theme Logic ---
    // MODIFIED: Save new theme to localStorage
    const toggleTheme = () => {
        setTheme(current => {
            const newTheme = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('quickle_theme', newTheme);
            return newTheme;
        });
    };

    // Apply theme class to the body tag
    useEffect(() => {
        document.body.classList.remove('dark-theme', 'light-theme');
        document.body.classList.add(`${theme}-theme`);
    }, [theme]);


    // --- Game Reset Time (USING API_BASE_URL) ---
    const fetchResetTime = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/next-reset`);
            setResetTime(response.data.time_remaining_seconds);
        } catch (error) {
            console.error("Error fetching reset time:", error);
            setResetTime(3600); 
        }
    }, []);

    useEffect(() => {
        fetchResetTime();
        const resetInterval = setInterval(() => {
            setResetTime(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(resetInterval);
    }, [fetchResetTime]);


    // --- Game Scoring Logic (Fixed) ---
    const calculateScore = useCallback((guessNumber, timeSeconds) => {
        if (guessNumber <= 5) {
            const pointsMap = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 6 };
            return pointsMap[guessNumber] || 0;
        } 
        
        if (guessNumber === 6) {
            if (timeSeconds <= 5) return 5;
            if (timeSeconds <= 9) return 3;
            if (timeSeconds < 12) return 1; 
            return 0; 
        }
        return 0;
    }, []);

    // --- Statistics Modal Display ---
    const showStatistics = useCallback(async (finalScore, isWin) => {
        const userId = 0; // Anonymous user simulation
        try {
            // Note: This endpoint is outside the specific API_BASE_URL, keeping the full path
            const response = await axios.get(`http://localhost:8000/api/user/stats?user_id=${userId}`);
            
            setStatsData(response.data);
            setIsStatsModalOpen(true);
        } catch (error) {
            console.error("Error fetching user stats:", error);
            setStatsData({
                times_played: 1, 
                streak: isWin ? 1 : 0, 
                max_streak: isWin ? 1 : 0, 
                win_percentage: isWin ? 100.00 : 0.00, 
                is_logged_in: false
            });
            setIsStatsModalOpen(true);
        }
    }, []);


    // --- 6th Guess Timer Logic ---
    useEffect(() => {
        if (isTimerActive) {
            timerRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    if (prev >= 12) {
                        clearInterval(timerRef.current);
                        setIsTimerActive(false);
                        return 12;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [isTimerActive]);


    // --- Game Submission Logic (USING API_BASE_URL) ---
    const submitGuess = useCallback(async () => {
        if (isLocked) {
            setToastMessage("Game over. Come back tomorrow to guess new word.");
            setShowLockModal(true);
            return;
        }
        const guessNumber = guesses.length + 1;
        const guessWord = currentGuess;
        if (!localStorage.getItem('quickle_play_date')) {
            localStorage.setItem('quickle_play_date', todayKey);
        }
        
        try {
            const response = await axios.post(`${API_BASE_URL}/guess`, { guess: guessWord });
            const { status_array, is_correct } = response.data;
            
            // 1. Update Game State
            setGuesses((prev) => [...prev, guessWord]);
            setSolvedStatuses((prev) => [...prev, status_array]);
            setCurrentGuess('');
            
            if (is_correct) {
                const finalScore = score + calculateScore(guessNumber, timerSeconds);
                setScore(finalScore);
                setGameState('won');
                setIsTimerActive(false);
                setIsLocked(true);
                localStorage.setItem('quickle_play_date', todayKey);
                setShowLockModal(true);
                showStatistics(finalScore, true);
            
            } else if (guessNumber === MAX_GUESSES) {
                const penaltyAmount = 5;
                const finalScore = score - penaltyAmount; 
                setScore(finalScore);
                setGameState('lost');
                setIsTimerActive(false);
                setIsLocked(true);
                localStorage.setItem('quickle_play_date', todayKey);
                setShowLockModal(true);
                showStatistics(finalScore, false);
            
            } else if (guessNumber === MAX_GUESSES - 1) {
                setIsTimerActive(true);
                setTimerSeconds(0);
            }
            
        } catch (error) {
            // Handle 422 (Unprocessable Entity) error from FastAPI for invalid words
            if (error.response && error.response.status === 422) {
                setToastMessage("Enter only meaningful 5-letter words.");
            } else {
                console.error("Error verifying guess:", error);
                setToastMessage("An unexpected error occurred.");
            }
        }
    }, [currentGuess, guesses.length, MAX_GUESSES, timerSeconds, score, calculateScore, showStatistics, isLocked, todayKey]);


    // --- Keyboard Input Handler ---
    const handleKeyDown = useCallback((event) => {
        if (gameState !== 'playing' || isStatsModalOpen || isLocked) return;
        
        const key = event.key;

        // 1. Handle Letter Input
        if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
            setCurrentGuess((prev) => prev + key.toUpperCase());
            return;
        }
        
        // 2. Handle Backspace
        if (key === 'Backspace') {
            setCurrentGuess((prev) => prev.slice(0, -1));
            return;
        }

        // 3. Handle Enter/Submit
        if (key === 'Enter' && currentGuess.length === WORD_LENGTH) {
            submitGuess();
        }
    }, [currentGuess, WORD_LENGTH, submitGuess, gameState, isStatsModalOpen, isLocked]);

    // Attach keyboard listener
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // Create 6 rows for the board
    const boardRows = Array.from({ length: MAX_GUESSES }, (_, index) => {
        const status = solvedStatuses[index];
        if (index < guesses.length) {
            return ( <Row key={index} guess={guesses[index]} solutionStatus={status}/> );
        } else if (index === guesses.length) {
            return ( <Row key={index} guess={currentGuess} isCurrentGuess={true}/> );
        } else {
            return <Row key={index} guess="" />;
        }
    });

    // Formatting countdown timer
    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const redirectToAuth = () => {
        // Since the backend authentication routes are removed, this button only redirects
        window.location.href = '/auth.html'; 
    };

    return (
        <div className="App">
            
            <div className="help-icon" onClick={redirectToRules}>?</div>
            
            <ThemeButton theme={theme} toggleTheme={toggleTheme} />

            {/* Signup/Login Button (Far right) */}
            <button 
                className="login-btn" 
                onClick={redirectToAuth}
            >
                Signup/Login
            </button>
            
            {/* Timer Display for 6th Guess */}
            {isTimerActive && (
                <div className="timer-display">
                    {timerSeconds.toString().padStart(2, '0')}s / 12s
                </div>
            )}
            
            <header className="header">
                <BitTitle text="QUICKLE" />
                <div className="score-display">Score: {score} pts</div>
            </header>
            
            <div className="board">{boardRows}</div>

            {/* Toast Notification */}
            <Toast 
                message={toastMessage} 
                type="error"
                onClose={() => setToastMessage(null)} 
            />

            {/* Lock Modal */}
            {showLockModal && (
                <div className="lock-modal-overlay" onClick={() => setShowLockModal(false)}>
                    <div className="lock-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Game over</h3>
                        <p>Come back tomorrow to guess new word.</p>
                        <button className="primary-btn" onClick={() => setShowLockModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Statistics Modal */}
            {isStatsModalOpen && statsData && (
                <StatsModal 
                    stats={statsData} 
                    onClose={() => setIsStatsModalOpen(false)}
                    resetTime={resetTime}
                    formatTime={formatTime}
                    answerWord={systemWord}
                    isWin={gameState === 'won'}
                />
            )}
        </div>
    );
}

export default App;