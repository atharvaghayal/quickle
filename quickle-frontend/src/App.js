import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css'; 
import StatsModal from './StatsModal'; 
import { useAuth } from './auth/AuthContext'; 
import AuthModal from './auth/AuthModal'; 
import UserMenu from './auth/UserMenu'; 
import ResetPassword from './ResetPassword'; 

const API_BASE_URL = 'http://localhost:8000/api';
axios.defaults.withCredentials = true;

// --- Helper Functions ---
const redirectToRules = () => {
    window.location.href = '/rules.html';
};

// --- Sub-Components ---
const Leaderboard = ({ data }) => (
    <div className="leaderboard-container">
        <div className="leaderboard-title">LEADERBOARD</div>
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

const VirtualKeyboard = ({ onKeyPress, letterStatuses = {} }) => {
    const rows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
    ];
    return (
        <div className="virtual-keyboard">
            {rows.map((row, i) => (
                <div key={i} className="keyboard-row">
                    {row.map((key) => {
                        const status = letterStatuses[key] || '';
                        return (
                            <button 
                                key={key} 
                                className={`key-btn ${key === 'Enter' || key === 'Backspace' ? 'key-wide' : ''} ${status}`}
                                onClick={() => onKeyPress(key)}
                            >
                                {key === 'Backspace' ? '⌫' : key === 'Enter' ? 'ENTER' : key}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

const ThemeButton = ({ theme, toggleTheme }) => (
    <div className="theme-icon" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</div>
);

const BitTitle = ({ text }) => (
    <h1 className="title-bitcount">
        {text.split('').map((char, i) => (
            char === ' ' ? <span key={i} className="word-separator">&nbsp;</span> : <span key={i} className="bit-char">{char}</span>
        ))}
    </h1>
);

const Tile = ({ letter, status }) => <div className={`tile ${status || 'empty'}`}>{letter}</div>;

const Row = ({ guess, solutionStatus, isShaking }) => {
    const tiles = Array.from({ length: 5 }, (_, i) => ({
        letter: guess[i] || '',
        status: solutionStatus ? solutionStatus[i] : (guess[i] ? 'typing' : 'empty')
    }));
    return (
        <div className={`row ${isShaking ? 'row-shake' : ''}`}>
            {tiles.map((tile, i) => <Tile key={i} letter={tile.letter} status={tile.status} />)}
        </div>
    );
};

const Toast = ({ message, onClose }) => {
    useEffect(() => {
        if (message) {
            const t = setTimeout(onClose, 2000);
            return () => clearTimeout(t);
        }
    }, [message, onClose]);
    return message ? <div className="toast toast-error">{message}</div> : null;
};

// --- Main App ---
function App() {
    // FIXED: Removed unused 'loading' and 'isAuthModalOpen' to resolve ESLint warnings
    const { user, openAuthModal, isAuthModalOpen } = useAuth();
    
    const [theme, setTheme] = useState(() => localStorage.getItem('quickle_theme') || 'dark');
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [solvedStatuses, setSolvedStatuses] = useState([]);
    const [gameState, setGameState] = useState('playing');
    const [systemWord, setSystemWord] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [shakeRow, setShakeRow] = useState(null);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [statsData, setStatsData] = useState(null);
    // Wordle doesn't use a scoring/timer system; keep state minimal
    const [isResetMode, setIsResetMode] = useState(false);
    
    // Logic Ref to prevent flickering re-opens
    const hasAutoShownStats = useRef(false);

    // Calculate keyboard letter statuses (Wordle style)
    const getKeyboardLetterStatuses = useCallback(() => {
        const letterStatuses = {};
        
        // Process all completed guesses
        guesses.forEach((guess, guessIndex) => {
            const statusArray = solvedStatuses[guessIndex];
            if (!statusArray) return;
            
            guess.split('').forEach((letter, letterIndex) => {
                const status = statusArray[letterIndex];
                const upperLetter = letter.toUpperCase();
                
                // Priority: correct > present > absent
                if (!letterStatuses[upperLetter] || 
                    (letterStatuses[upperLetter] === 'absent' && status === 'present') ||
                    (letterStatuses[upperLetter] !== 'correct' && status === 'correct')) {
                    letterStatuses[upperLetter] = status;
                }
            });
        });
        
        return letterStatuses;
    }, [guesses, solvedStatuses]);

    // Apply theme to body and save to localStorage
    useEffect(() => {
        document.body.className = theme === 'light' ? 'light-theme' : '';
        localStorage.setItem('quickle_theme', theme);
    }, [theme]);

    // FIXED: Lock gameId for the session to prevent synchronization bugs
    const [gameId] = useState(() => {
        const saved = localStorage.getItem('quickle_game_state');
        const today = new Date().toISOString().slice(0, 10);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.date === today) return data.gameId || Date.now().toString();
        }
        return Date.now().toString();
    });

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/user/leaderboard`);
            setLeaderboardData(res.data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchSystemWord = useCallback(async (id) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/wordle/daily-word?gameId=${id}`);
            const word = (res.data && res.data.word) ? String(res.data.word).toUpperCase() : "";
            setSystemWord(word);
            return word;
        } catch (e) { return ""; }
    }, []);

    const saveGameState = useCallback((data) => {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('quickle_game_state', JSON.stringify({
            guesses: data.guesses || guesses,
            solvedStatuses: data.solvedStatuses || solvedStatuses,
            gameState: data.gameState || gameState,
            // score removed to follow Wordle rules; keep for backward-compat
            score: data.score || 0,
            systemWord: data.systemWord || systemWord,
            gameId, date: today
        }));
    }, [guesses, solvedStatuses, gameState, systemWord, gameId]);

    const showStatistics = useCallback(async (win) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/user/stats`);
            setStatsData(res.data);
        } catch (e) {
            setStatsData({ times_played: 1, streak: win ? 1 : 0, max_streak: 1, win_percentage: win ? 100 : 0, total_points: 0, is_logged_in: false });
        }
        setIsStatsModalOpen(true);
    }, []);

    const loadGameState = useCallback(async () => {
        const today = new Date().toISOString().slice(0, 10);
        const saved = localStorage.getItem('quickle_game_state');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.date === today) {
                setGuesses(data.guesses || []);
                setSolvedStatuses(data.solvedStatuses || []);
                setGameState(data.gameState || 'playing');
                setSystemWord(data.systemWord || '');
                setIsLocked(data.gameState !== 'playing');
                if (data.gameState !== 'playing' && !hasAutoShownStats.current) {
                    hasAutoShownStats.current = true;
                    setTimeout(() => showStatistics(data.gameState === 'won'), 1000);
                }
                return;
            }
        }
        const word = await fetchSystemWord(gameId);
        saveGameState({ systemWord: word });
    }, [gameId, fetchSystemWord, saveGameState, showStatistics]);

    useEffect(() => {
        loadGameState();
        fetchLeaderboard();
    }, []); // Empty deps to stop loops

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('token')) {
            setIsResetMode(true);
        }
    }, []);

    const resetGame = useCallback(() => {
        window.location.reload(); 
    }, []);

    const submitGuess = useCallback(async () => {
        if (isLocked || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/wordle/guess`, { guess: currentGuess, gameId });
            if (res.data.error) {
                // Use backend error message when available
                setToastMessage(res.data.error || "Not in word list.");
                setShakeRow(guesses.length);
                setTimeout(() => setShakeRow(null), 500);
                return;
            }
            const { status_array, is_correct } = res.data;
            const newG = [...guesses, currentGuess];
            const newS = [...solvedStatuses, status_array];
            setGuesses(newG); setSolvedStatuses(newS); setCurrentGuess('');
            if (is_correct) {
                setGameState('won');
                saveGameState({ guesses: newG, solvedStatuses: newS, gameState: 'won', score: 0, systemWord });
                showStatistics(true);
                if (user) await axios.post(`${API_BASE_URL}/user/update-stats`, { won: true, points: 0, word: systemWord });
            } else if (newG.length === 6) {
                setGameState('lost');
                saveGameState({ guesses: newG, solvedStatuses: newS, gameState: 'lost', score: 0, systemWord });
                showStatistics(false);
                if (user) await axios.post(`${API_BASE_URL}/user/update-stats`, { won: false, points: 0, word: systemWord });
            }
            fetchLeaderboard();
        } catch (e) { setShakeRow(guesses.length); setTimeout(() => setShakeRow(null), 500); }
        finally { setIsSubmitting(false); }
    }, [currentGuess, guesses, solvedStatuses, gameId, systemWord, user, isLocked, isSubmitting, saveGameState, showStatistics, fetchLeaderboard]);

    const handleKeyPress = useCallback((key) => {
        if (gameState !== 'playing' || isStatsModalOpen || isLocked || isSubmitting) return;
        if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) setCurrentGuess(p => p + key.toUpperCase());
        if (key === 'Backspace') setCurrentGuess(p => p.slice(0, -1));
        if (key === 'Enter' && currentGuess.length === 5) submitGuess();
    }, [currentGuess, gameState, isStatsModalOpen, isLocked, isSubmitting, submitGuess]);

    useEffect(() => {
        if (isAuthModalOpen || isResetMode) return; // Don't listen to keys when auth modal or reset is open

        const h = (e) => handleKeyPress(e.key);
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [handleKeyPress, isAuthModalOpen, isResetMode]);

    return (
        <div className={`App ${window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'}`}>
            {isResetMode ? (
                <ResetPassword />
            ) : (
                <>
                    <div className="help-icon" onClick={redirectToRules}>?</div>
                    <ThemeButton theme={theme} toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
                    {user ? <UserMenu /> : <button className="login-btn" onClick={openAuthModal}>Signup/Login</button>}
                    {leaderboardData.length > 0 && window.innerWidth >= 481 && <Leaderboard data={leaderboardData} />}
                    <header className="header"><BitTitle text="QUICKLE" /></header>
                    <div className="board">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Row key={i} guess={i === guesses.length ? currentGuess : (guesses[i] || "")} solutionStatus={solvedStatuses[i]} isShaking={shakeRow === i} />
                        ))}
                    </div>
                    <VirtualKeyboard onKeyPress={handleKeyPress} letterStatuses={getKeyboardLetterStatuses()} />
                    <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
                    {isStatsModalOpen && statsData && (
                        <StatsModal stats={statsData} onClose={() => setIsStatsModalOpen(false)} answerWord={systemWord} isWin={gameState === 'won'} onPlayAgain={resetGame} />
                    )}
                    <AuthModal />
                </>
            )}
        </div>
    );
}

export default App;