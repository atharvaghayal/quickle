import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css'; 
import StatsModal from './StatsModal'; 
// CORRECTED IMPORTS
import { useAuth } from './auth/AuthContext'; 
import AuthModal from './auth/AuthModal'; 
import UserMenu from './auth/UserMenu'; 

const API_BASE_URL = 'http://localhost:8000/api';

// Enable credentials for all axios requests
axios.defaults.withCredentials = true;

// --- Redirection Handler ---
const redirectToRules = () => {
    window.location.href = '/rules.html';
};

// --- Virtual Keyboard Component ---
const VirtualKeyboard = ({ onKeyPress }) => {
    const rows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
    ];

    return (
        <div className="virtual-keyboard">
            {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="keyboard-row">
                    {row.map((key) => (
                        <button
                            key={key}
                            className={`key-btn ${key === 'Enter' || key === 'Backspace' ? 'key-wide' : ''}`}
                            onClick={() => onKeyPress(key)}
                        >
                            {key === 'Backspace' ? '⌫' : key === 'Enter' ? 'ENTER' : key}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
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


// --- BitTitle Component (FIXED JSX ERROR) ---
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
    useEffect(() => {
        if (message) { 
            const timer = setTimeout(onClose, 2000); 
            return () => clearTimeout(timer);
        }
        return undefined; 
    }, [message, onClose]);

    if (!message) return null; 

    return (
        <div className={`toast toast-${type}`}>
            {message}
        </div>
    );
};


// Main App component
function App() {
    // USE AUTH CONTEXT
    const { user, loading, openAuthModal, isAuthModalOpen } = useAuth(); 
    
    const MAX_GUESSES = 6;
    const WORD_LENGTH = 5;

    // --- State Management ---
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('quickle_theme') || 'dark';
    });
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [solvedStatuses, setSolvedStatuses] = useState([]); 
    const [gameState, setGameState] = useState('playing'); 
    const [score, setScore] = useState(0); 
    const [systemWord, setSystemWord] = useState(''); 
    const [gameId, setGameId] = useState(null); 
    const [toastMessage, setToastMessage] = useState(null); 
    const [isLocked, setIsLocked] = useState(false); // Device-level one-play lock
    const [showLockModal, setShowLockModal] = useState(false);
    const [showGameOverModal, setShowGameOverModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // Prevent input during guess submission
    
    // 6th Guess Timer State
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const timerRef = useRef(null);

    // Modal State
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [statsData, setStatsData] = useState(null);
    const [resetTime, setResetTime] = useState(null);
    
    // Mobile detection
    const [isMobile, setIsMobile] = useState(false);

    // --- Game State Persistence ---
    const saveGameState = useCallback((gameData) => {
        const todayKey = new Date().toISOString().slice(0, 10);
        const gameStateData = {
            guesses: gameData.guesses || guesses,
            solvedStatuses: gameData.solvedStatuses || solvedStatuses,
            gameState: gameData.gameState || gameState,
            score: gameData.score || score,
            systemWord: gameData.systemWord || systemWord,
            date: todayKey
        };
        localStorage.setItem('quickle_game_state', JSON.stringify(gameStateData));
    }, [guesses, solvedStatuses, gameState, score, systemWord]);

    // --- Statistics Modal Display ---
    const showStatistics = useCallback(async (finalScore, isWin) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/user/stats`);
            setStatsData(response.data);
            setIsStatsModalOpen(true);
        } catch (error) {
            console.error("Error fetching user stats:", error);
            setStatsData({
                times_played: 1, 
                streak: isWin ? 1 : 0, 
                max_streak: isWin ? 1 : 0, 
                win_percentage: isWin ? 100.00 : 0.00, 
                total_points: isWin ? finalScore : 0,
                is_logged_in: false
            });
            setIsStatsModalOpen(true);
        }
    }, []);

    const loadGameState = useCallback(() => {
        const todayKey = new Date().toISOString().slice(0, 10);
        const savedState = localStorage.getItem('quickle_game_state');
        
        if (savedState) {
            const gameStateData = JSON.parse(savedState);
            if (gameStateData.date === todayKey) {
                setGuesses(gameStateData.guesses || []);
                setSolvedStatuses(gameStateData.solvedStatuses || []);
                setGameState(gameStateData.gameState || 'playing');
                setScore(gameStateData.score || 0);
                setSystemWord(gameStateData.systemWord || '');
                setIsLocked(gameStateData.gameState !== 'playing');
                
                // Show stats modal for completed games on page load (unlimited plays)
                if (gameStateData.gameState === 'won' || gameStateData.gameState === 'lost') {
                    setTimeout(() => {
                        showStatistics(gameStateData.score || 0, gameStateData.gameState === 'won');
                    }, 1000); // 1 second delay
                }
                
                return true; // Game state was loaded
            } else {
                // Different day, clear old state
                localStorage.removeItem('quickle_game_state');
            }
        }
        return false; // No valid saved state
    }, [showStatistics]);
    
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // --- Initial Word Fetch (USING API_BASE_URL) ---
    const fetchSystemWord = useCallback(async (gameId = null) => {
        try {
            const currentGameId = gameId || Date.now().toString();
            setGameId(currentGameId);
            const url = `${API_BASE_URL}/wordle/daily-word?gameId=${currentGameId}`;
            const wordResponse = await axios.get(url);
            setSystemWord(wordResponse.data.word || "QUICK"); 
        } catch (error) {
            console.error("Error fetching daily word:", error);
            setSystemWord("QUICK"); 
        }
    }, []);

    // --- One-play-per-day lock and Game State Loading ---
    const todayKey = new Date().toISOString().slice(0, 10);
    useEffect(() => {
        // First try to load saved game state
        const hasSavedState = loadGameState();
        
        // If no saved state, check if already played today
        if (!hasSavedState) {
            const lastPlayed = localStorage.getItem('quickle_play_date');
            if (lastPlayed === todayKey) {
                setIsLocked(true);
                setGameState('locked');
                setIsTimerActive(false);
                setToastMessage("Game over. Come back tomorrow for a new word.");
                setShowLockModal(true);
            } else if (lastPlayed && lastPlayed !== todayKey) {
                // New day has started, clear old game state and fetch new word
                localStorage.removeItem('quickle_game_state');
                localStorage.removeItem('quickle_play_date');
                fetchSystemWord(); // Fetch the new daily word
            }
        }
    }, [todayKey, loadGameState, fetchSystemWord, showStatistics]);

    useEffect(() => {
        fetchSystemWord();
    }, [fetchSystemWord]);


    // --- Theme Logic ---
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
            const response = await axios.get(`${API_BASE_URL}/wordle/next-reset`);
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

    // --- Game Reset Function ---
    const resetGame = useCallback(() => {
        setGuesses([]);
        setCurrentGuess('');
        setSolvedStatuses([]);
        setGameState('playing');
        setScore(0);
        setIsTimerActive(false);
        setTimerSeconds(0);
        setShowGameOverModal(false);
        setIsStatsModalOpen(false);
        setToastMessage(null);
        setIsSubmitting(false); // Reset submission flag
        // Generate a new word for this game session
        fetchSystemWord();
        // Clear saved game state
        localStorage.removeItem('quickle_game_state');
    }, [fetchSystemWord]);


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
        if (isLocked || isSubmitting) {
            setToastMessage("Game over. Come back tomorrow for a new word.");
            setShowLockModal(true);
            return;
        }
        setIsSubmitting(true); // Prevent input during submission
        const guessNumber = guesses.length + 1;
        const guessWord = currentGuess;
        if (!localStorage.getItem('quickle_play_date')) {
            localStorage.setItem('quickle_play_date', todayKey);
        }
        
        try {
            const response = await axios.post(`${API_BASE_URL}/wordle/guess`, { 
                guess: guessWord,
                gameId: gameId 
            });
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
                // Remove the lock - allow unlimited plays
                // setIsLocked(true);
                // localStorage.setItem('quickle_play_date', todayKey);
                
                // Save game state
                saveGameState({
                    guesses: [...guesses, guessWord],
                    solvedStatuses: [...solvedStatuses, status_array],
                    gameState: 'won',
                    score: finalScore,
                    systemWord
                });
                
                // For unlimited plays, show stats directly instead of game over modal
                // setShowGameOverModal(true);
                showStatistics(finalScore, true);
                
                // Update stats if user is logged in BEFORE showing stats
                if (user) {
                    const won = true;
                    const points = calculateScore(guessNumber, timerSeconds);
                    try {
                        await axios.post(`${API_BASE_URL}/user/update-stats`, { won, points, word: systemWord });
                    } catch (error) {
                        console.error("Error updating stats:", error);
                    }
                }
            
            } else if (guessNumber === MAX_GUESSES) {
                const penaltyAmount = 5;
                const finalScore = score - penaltyAmount; 
                setScore(finalScore);
                setGameState('lost');
                setIsTimerActive(false);
                // Remove the lock - allow unlimited plays
                // setIsLocked(true);
                // localStorage.setItem('quickle_play_date', todayKey);
                
                // Save game state
                saveGameState({
                    guesses: [...guesses, guessWord],
                    solvedStatuses: [...solvedStatuses, status_array],
                    gameState: 'lost',
                    score: finalScore,
                    systemWord
                });
                
                // For unlimited plays, show stats directly instead of game over modal
                // setShowGameOverModal(true);
                showStatistics(finalScore, false);
                
                // Update stats if user is logged in BEFORE showing stats
                if (user) {
                    const won = false;
                    const points = -5;
                    try {
                        await axios.post(`${API_BASE_URL}/user/update-stats`, { won, points, word: systemWord });
                    } catch (error) {
                        console.error("Error updating stats:", error);
                    }
                }
                
                // showStatistics(finalScore, false); // Already called above
            
            } else if (guessNumber === MAX_GUESSES - 1) {
                setIsTimerActive(true);
                setTimerSeconds(0);
            }
            
            // Remove the duplicate update stats call here
            
        } catch (error) {
            if (error.response && error.response.data && error.response.data.error) {
                setToastMessage(error.response.data.error);
                setCurrentGuess(''); // Clear the invalid guess so user can try again
            } else if (error.response && error.response.status === 422) {
                setToastMessage("Enter only meaningful 5-letter words.");
                setCurrentGuess(''); // Clear the invalid guess so user can try again
            } else {
                console.error("Error verifying guess:", error);
                setToastMessage("An unexpected error occurred.");
                setCurrentGuess(''); // Clear the guess on unexpected error
            }
        } finally {
            setIsSubmitting(false); // Re-enable input
        }
    }, [currentGuess, guesses, solvedStatuses, MAX_GUESSES, timerSeconds, score, calculateScore, showStatistics, isLocked, isSubmitting, todayKey, user, systemWord, saveGameState, gameId]);


    // --- Keyboard Input Handler ---
    const handleKeyPress = useCallback((key) => {
        if (gameState !== 'playing' || isStatsModalOpen || isLocked || showGameOverModal || isAuthModalOpen || isSubmitting) return;
        
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
    }, [currentGuess, WORD_LENGTH, submitGuess, gameState, isStatsModalOpen, isLocked, showGameOverModal, isAuthModalOpen, isSubmitting]);

    const handleKeyDown = useCallback((event) => {
        handleKeyPress(event.key);
    }, [handleKeyPress]);

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

    return (
        <div className={`App ${isMobile ? 'mobile' : ''}`}>
            
            <div className="help-icon" onClick={redirectToRules}>?</div>
            
            <ThemeButton theme={theme} toggleTheme={toggleTheme} />

            {/* NEW PROFILE ICON LOGIC */}
            {loading ? (
                <div className="login-btn" style={{ visibility: 'hidden' }}>Loading...</div>
            ) : user ? (
                /* USER IS LOGGED IN: Show Profile Initial Icon with UserMenu */
                <UserMenu /> 
            ) : (
                /* USER NOT LOGGED IN: Show Signup/Login Button */
                <button 
                    className="login-btn" 
                    onClick={openAuthModal} 
                >
                    Signup/Login
                </button>
            )}
            
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

            {/* Virtual Keyboard for Mobile */}
            {isMobile && <VirtualKeyboard onKeyPress={handleKeyPress} />}

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
                        <p>Come back tomorrow for a new word.</p>
                        <button className="primary-btn" onClick={() => setShowLockModal(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Game Over Modal */}
            {showGameOverModal && (
                <div className="lock-modal-overlay" onClick={() => {
                    setShowGameOverModal(false);
                    // Show stats modal after game over modal closes
                    showStatistics(score, gameState === 'won');
                }}>
                    <div className="lock-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Game over</h3>
                        <p>Come back tomorrow for a new word.</p>
                        <button className="primary-btn" onClick={() => {
                            setShowGameOverModal(false);
                            // Show stats modal after game over modal closes
                            showStatistics(score, gameState === 'won');
                        }}>
                            View Stats
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
                    onPlayAgain={resetGame}
                />
            )}
            
            {/* Authentication Modal */}
            <AuthModal />
        </div>
    );
}

export default App;