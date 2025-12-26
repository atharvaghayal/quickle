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

// --- Updated Leaderboard Component in App.js ---
const Leaderboard = ({ data }) => {
    return (
        <div className="leaderboard-container">
            <div className="leaderboard-title">LEADERBOARD</div>
            {/* NEW: Scrollable area for rankings */}
            <div className="leaderboard-scroll-area">
                {data.map((player) => {
                    let rankClass = "rank-normal";
                    if (player.rank === 1) rankClass = "rank-1";
                    else if (player.rank === 2) rankClass = "rank-2";
                    else if (player.rank === 3) rankClass = "rank-3";

                    return (
                        <div key={player.username} className={`leaderboard-row ${rankClass}`}>
                            <span>{player.rank}. {player.username}</span>
                            <span>{player.points}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
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
const Row = ({ guess, solutionStatus, isShaking }) => {
    const tiles = Array.from({ length: 5 }, (_, i) => ({
        letter: guess[i] || '',
        status: solutionStatus ? solutionStatus[i] : (guess[i] ? 'typing' : 'empty')
    }));

    return (
        <div className={`row ${isShaking ? 'row-shake' : ''}`}>
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
    const [shakeRow, setShakeRow] = useState(null);
    const [leaderboardData, setLeaderboardData] = useState([]);

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

    // --- Leaderboard Fetching ---
    const fetchLeaderboard = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/user/leaderboard`);
            setLeaderboardData(response.data);
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        }
    }, []);

    // Midnight Update Logic
    useEffect(() => {
        fetchLeaderboard();
        
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const timeToMidnight = midnight.getTime() - now.getTime();

        const timer = setTimeout(() => {
            fetchLeaderboard();
            // After the first midnight reset, fetch every 24 hours
            const interval = setInterval(fetchLeaderboard, 24 * 60 * 60 * 1000);
            return () => clearInterval(interval);
        }, timeToMidnight);

        return () => clearTimeout(timer);
    }, [fetchLeaderboard]);

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
                
                if (gameStateData.gameState === 'won' || gameStateData.gameState === 'lost') {
                    setTimeout(() => {
                        showStatistics(gameStateData.score || 0, gameStateData.gameState === 'won');
                    }, 1000);
                }
                
                return true;
            } else {
                localStorage.removeItem('quickle_game_state');
            }
        }
        return false;
    }, [showStatistics]);
    
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
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

    const todayKey = new Date().toISOString().slice(0, 10);
    useEffect(() => {
        const hasSavedState = loadGameState();
        
        if (!hasSavedState) {
            const lastPlayed = localStorage.getItem('quickle_play_date');
            if (lastPlayed === todayKey) {
                setIsLocked(true);
                setGameState('locked');
                setIsTimerActive(false);
                setToastMessage("Game over. Come back tomorrow for a new word.");
                setShowLockModal(true);
            } else if (lastPlayed && lastPlayed !== todayKey) {
                localStorage.removeItem('quickle_game_state');
                localStorage.removeItem('quickle_play_date');
                fetchSystemWord();
            }
        }
    }, [todayKey, loadGameState, fetchSystemWord, showStatistics]);

    useEffect(() => {
        fetchSystemWord();
    }, [fetchSystemWord]);


    const toggleTheme = () => {
        setTheme(current => {
            const newTheme = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('quickle_theme', newTheme);
            return newTheme;
        });
    };

    useEffect(() => {
        document.body.classList.remove('dark-theme', 'light-theme');
        document.body.classList.add(`${theme}-theme`);
    }, [theme]);


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
        setIsSubmitting(false);
        setShakeRow(null);
        fetchSystemWord();
        localStorage.removeItem('quickle_game_state');
        fetchLeaderboard(); // Refresh leaderboard on reset
    }, [fetchSystemWord, fetchLeaderboard]);


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


    const submitGuess = useCallback(async () => {
        if (isLocked || isSubmitting) {
            setToastMessage("Game over. Come back tomorrow for a new word.");
            setShowLockModal(true);
            return;
        }

        setIsSubmitting(true);
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

            if (response.data.error) {
                setToastMessage("Enter only meaningful words!");
                setShakeRow(guesses.length);
                setTimeout(() => setShakeRow(null), 500);
                setIsSubmitting(false);
                return;
            }

            const { status_array, is_correct } = response.data;
            
            setGuesses((prev) => [...prev, guessWord]);
            setSolvedStatuses((prev) => [...prev, status_array]);
            setCurrentGuess('');
            
            if (is_correct) {
                const finalScore = score + calculateScore(guessNumber, timerSeconds);
                setScore(finalScore);
                setGameState('won');
                setIsTimerActive(false);
                
                saveGameState({
                    guesses: [...guesses, guessWord],
                    solvedStatuses: [...solvedStatuses, status_array],
                    gameState: 'won',
                    score: finalScore,
                    systemWord
                });
                
                showStatistics(finalScore, true);
                
                if (user) {
                    const won = true;
                    const points = calculateScore(guessNumber, timerSeconds);
                    try {
                        await axios.post(`${API_BASE_URL}/user/update-stats`, { won, points, word: systemWord });
                        fetchLeaderboard(); // Refresh after stats update
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
                
                saveGameState({
                    guesses: [...guesses, guessWord],
                    solvedStatuses: [...solvedStatuses, status_array],
                    gameState: 'lost',
                    score: finalScore,
                    systemWord
                });
                
                showStatistics(finalScore, false);
                
                if (user) {
                    const won = false;
                    const points = -5;
                    try {
                        await axios.post(`${API_BASE_URL}/user/update-stats`, { won, points, word: systemWord });
                        fetchLeaderboard(); // Refresh after stats update
                    } catch (error) {
                        console.error("Error updating stats:", error);
                    }
                }
            
            } else if (guessNumber === MAX_GUESSES - 1) {
                setIsTimerActive(true);
                setTimerSeconds(0);
            }
            
        } catch (error) {
            if (error.response && error.response.data && error.response.data.error) {
                setToastMessage(error.response.data.error);
            } else if (error.response && error.response.status === 422) {
                setToastMessage("Enter only meaningful 5-letter words.");
            } else {
                console.error("Error verifying guess:", error);
                setToastMessage("An unexpected error occurred.");
            }
            setShakeRow(guesses.length);
            setTimeout(() => setShakeRow(null), 500);
        } finally {
            setIsSubmitting(false);
        }
    }, [currentGuess, guesses, solvedStatuses, MAX_GUESSES, timerSeconds, score, calculateScore, showStatistics, isLocked, isSubmitting, todayKey, user, systemWord, saveGameState, gameId, fetchLeaderboard]);

    const handleKeyPress = useCallback((key) => {
        if (gameState !== 'playing' || isStatsModalOpen || isLocked || showGameOverModal || isAuthModalOpen || isSubmitting) return;
        
        if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
            setCurrentGuess((prev) => prev + key.toUpperCase());
            return;
        }
        
        if (key === 'Backspace') {
            setCurrentGuess((prev) => prev.slice(0, -1));
            return;
        }

        if (key === 'Enter' && currentGuess.length === WORD_LENGTH) {
            submitGuess();
        }
    }, [currentGuess, WORD_LENGTH, submitGuess, gameState, isStatsModalOpen, isLocked, showGameOverModal, isAuthModalOpen, isSubmitting]);

    const handleKeyDown = useCallback((event) => {
        handleKeyPress(event.key);
    }, [handleKeyPress]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const boardRows = Array.from({ length: MAX_GUESSES }, (_, index) => {
        const status = solvedStatuses[index];
        const isShaking = shakeRow === index;
        
        if (index < guesses.length) {
            return ( <Row key={index} guess={guesses[index]} solutionStatus={status} isShaking={isShaking}/> );
        } else if (index === guesses.length) {
            return ( <Row key={index} guess={currentGuess} isCurrentGuess={true} isShaking={isShaking}/> );
        } else {
            return <Row key={index} guess="" isShaking={isShaking}/>;
        }
    });

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

            {loading ? (
                <div className="login-btn" style={{ visibility: 'hidden' }}>Loading...</div>
            ) : user ? (
                <UserMenu /> 
            ) : (
                <button 
                    className="login-btn" 
                    onClick={openAuthModal} 
                >
                    Signup/Login
                </button>
            )}
            
            {/* Leaderboard positioned below the Profile Icon/UserMenu */}
            {leaderboardData.length > 0 && <Leaderboard data={leaderboardData} />}

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

            {isMobile && <VirtualKeyboard onKeyPress={handleKeyPress} />}

            <Toast 
                message={toastMessage} 
                type="error"
                onClose={() => setToastMessage(null)} 
            />

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

            {showGameOverModal && (
                <div className="lock-modal-overlay" onClick={() => {
                    setShowGameOverModal(false);
                    showStatistics(score, gameState === 'won');
                }}>
                    <div className="lock-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Game over</h3>
                        <p>Come back tomorrow for a new word.</p>
                        <button className="primary-btn" onClick={() => {
                            setShowGameOverModal(false);
                            showStatistics(score, gameState === 'won');
                        }}>
                            View Stats
                        </button>
                    </div>
                </div>
            )}

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
            
            <AuthModal />
        </div>
    );
}

export default App;