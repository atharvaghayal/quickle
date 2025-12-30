import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css'; 
import StatsModal from './StatsModal'; 
import { useAuth } from './auth/AuthContext'; 
import AuthModal from './auth/AuthModal'; 
import UserMenu from './auth/UserMenu'; 

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

const VirtualKeyboard = ({ onKeyPress }) => {
    const rows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
    ];
    return (
        <div className="virtual-keyboard">
            {rows.map((row, i) => (
                <div key={i} className="keyboard-row">
                    {row.map((key) => (
                        <button key={key} className={`key-btn ${key === 'Enter' || key === 'Backspace' ? 'key-wide' : ''}`} onClick={() => onKeyPress(key)}>
                            {key === 'Backspace' ? '⌫' : key === 'Enter' ? 'ENTER' : key}
                        </button>
                    ))}
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
    const { user, openAuthModal } = useAuth();
    
    const [theme, setTheme] = useState(() => localStorage.getItem('quickle_theme') || 'dark');
    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [solvedStatuses, setSolvedStatuses] = useState([]);
    const [gameState, setGameState] = useState('playing');
    const [score, setScore] = useState(0);
    const [systemWord, setSystemWord] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [shakeRow, setShakeRow] = useState(null);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [statsData, setStatsData] = useState(null);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    // Logic Ref to prevent flickering re-opens
    const hasAutoShownStats = useRef(false);

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
            const word = res.data.word.upperCase ? res.data.word.toUpperCase() : res.data.word;
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
            score: data.score || score,
            systemWord: data.systemWord || systemWord,
            gameId, date: today
        }));
    }, [guesses, solvedStatuses, gameState, score, systemWord, gameId]);

    const showStatistics = useCallback(async (pts, win) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/user/stats`);
            setStatsData(res.data);
        } catch (e) {
            setStatsData({ times_played: 1, streak: win ? 1 : 0, max_streak: 1, win_percentage: win ? 100 : 0, total_points: pts, is_logged_in: false });
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
                setScore(data.score || 0);
                setSystemWord(data.systemWord || '');
                setIsLocked(data.gameState !== 'playing');
                if (data.gameState !== 'playing' && !hasAutoShownStats.current) {
                    hasAutoShownStats.current = true;
                    setTimeout(() => showStatistics(data.score, data.gameState === 'won'), 1000);
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
        const check = () => setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []); // Empty deps to stop loops

    const resetGame = useCallback(() => {
        window.location.reload(); 
    }, []);

    const submitGuess = useCallback(async () => {
        if (isLocked || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/wordle/guess`, { guess: currentGuess, gameId });
            if (res.data.error) {
                setToastMessage("Enter only meaningful words!");
                setShakeRow(guesses.length);
                setTimeout(() => setShakeRow(null), 500);
                return;
            }
            const { status_array, is_correct } = res.data;
            const newG = [...guesses, currentGuess];
            const newS = [...solvedStatuses, status_array];
            setGuesses(newG); setSolvedStatuses(newS); setCurrentGuess('');
            if (is_correct) {
                const pts = score + (newG.length <= 5 ? {1:25, 2:18, 3:15, 4:12, 5:6}[newG.length] : (timerSeconds <= 5 ? 5 : timerSeconds <= 9 ? 3 : 1));
                setScore(pts); setGameState('won'); setIsTimerActive(false);
                saveGameState({ guesses: newG, solvedStatuses: newS, gameState: 'won', score: pts });
                showStatistics(pts, true);
                if (user) await axios.post(`${API_BASE_URL}/user/update-stats`, { won: true, points: pts, word: systemWord });
            } else if (newG.length === 6) {
                const pts = score - 5; setScore(pts); setGameState('lost'); setIsTimerActive(false);
                saveGameState({ guesses: newG, solvedStatuses: newS, gameState: 'lost', score: pts });
                showStatistics(pts, false);
                if (user) await axios.post(`${API_BASE_URL}/user/update-stats`, { won: false, points: -5, word: systemWord });
            } else if (newG.length === 5) { setIsTimerActive(true); setTimerSeconds(0); }
            fetchLeaderboard();
        } catch (e) { setShakeRow(guesses.length); setTimeout(() => setShakeRow(null), 500); }
        finally { setIsSubmitting(false); }
    }, [currentGuess, guesses, solvedStatuses, gameId, score, systemWord, user, isLocked, isSubmitting, timerSeconds, saveGameState, showStatistics, fetchLeaderboard]);

    const handleKeyPress = useCallback((key) => {
        if (gameState !== 'playing' || isStatsModalOpen || isLocked || isSubmitting) return;
        if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) setCurrentGuess(p => p + key.toUpperCase());
        if (key === 'Backspace') setCurrentGuess(p => p.slice(0, -1));
        if (key === 'Enter' && currentGuess.length === 5) submitGuess();
    }, [currentGuess, gameState, isStatsModalOpen, isLocked, isSubmitting, submitGuess]);

    useEffect(() => {
        const h = (e) => handleKeyPress(e.key);
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [handleKeyPress]);

    return (
        <div className={`App ${isMobile ? 'mobile' : ''}`}>
            <div className="help-icon" onClick={redirectToRules}>?</div>
            <ThemeButton theme={theme} toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
            {user ? <UserMenu /> : <button className="login-btn" onClick={openAuthModal}>Signup/Login</button>}
            {leaderboardData.length > 0 && <Leaderboard data={leaderboardData} />}
            {isTimerActive && <div className="timer-display">{timerSeconds.toString().padStart(2, '0')}s / 12s</div>}
            <header className="header"><BitTitle text="QUICKLE" /><div className="score-display">Score: {score} pts</div></header>
            <div className="board">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Row key={i} guess={i === guesses.length ? currentGuess : (guesses[i] || "")} solutionStatus={solvedStatuses[i]} isShaking={shakeRow === i} />
                ))}
            </div>
            {isMobile && <VirtualKeyboard onKeyPress={handleKeyPress} />}
            <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            {isStatsModalOpen && statsData && (
                <StatsModal stats={statsData} onClose={() => setIsStatsModalOpen(false)} answerWord={systemWord} isWin={gameState === 'won'} onPlayAgain={resetGame} />
            )}
            <AuthModal />
        </div>
    );
}

export default App;