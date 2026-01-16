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
    const { user, openAuthModal, isAuthModalOpen } = useAuth();
    
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
    const [isResetMode, setIsResetMode] = useState(false);
    const [showRules, setShowRules] = useState(false);
    
    // Timer for the 6th guess points logic
    const [timerStart, setTimerStart] = useState(null);

    // Universal dynamic height calculation
    const [appHeight, setAppHeight] = useState(() => window.innerHeight);
    
    const hasAutoShownStats = useRef(false);

    useEffect(() => {
        const updateHeight = () => setAppHeight(window.innerHeight);
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/user/leaderboard`);
            setLeaderboardData(res.data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchSystemWord = useCallback(async (id) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/wordle/daily-word?gameId=${id}`);
            const word = res.data?.word?.toUpperCase() || "";
            setSystemWord(word);
            return word;
        } catch (e) { return ""; }
    }, []);

    // Get the Monthly Champion
    const monthlyChampion = leaderboardData.length > 0 ? leaderboardData[0].username : null;

    const showStatistics = useCallback(async (win) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/user/stats`);
            setStatsData(res.data);
        } catch (e) {
            setStatsData({ times_played: 1, streak: win ? 1 : 0, max_streak: 1, win_percentage: win ? 100 : 0, total_points: 0, is_logged_in: false });
        }
        setIsStatsModalOpen(true);
    }, []);

    const saveGameState = useCallback((data) => {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('quickle_game_state', JSON.stringify({
            guesses: data.guesses || guesses,
            solvedStatuses: data.solvedStatuses || solvedStatuses,
            gameState: data.gameState || gameState,
            systemWord: data.systemWord || systemWord,
            gameId: data.gameId || Date.now().toString(),
            date: today
        }));
    }, [guesses, solvedStatuses, gameState, systemWord]);

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
        const id = Date.now().toString();
        const word = await fetchSystemWord(id);
        saveGameState({ systemWord: word, gameId: id });
    }, [fetchSystemWord, saveGameState, showStatistics]);

    useEffect(() => {
        loadGameState();
        fetchLeaderboard();
    }, [loadGameState, fetchLeaderboard]);

    // Handle timer for the 6th guess
    useEffect(() => {
        if (guesses.length === 5 && !timerStart && gameState === 'playing') {
            setTimerStart(Date.now());
        }
    }, [guesses, timerStart, gameState]);

    const submitGuess = useCallback(async () => {
        if (isLocked || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/wordle/guess`, { 
                guess: currentGuess, 
                gameId: JSON.parse(localStorage.getItem('quickle_game_state')).gameId 
            });

            if (res.data.error) {
                setToastMessage(res.data.error);
                setShakeRow(guesses.length);
                setTimeout(() => setShakeRow(null), 500);
                return;
            }

            const { status_array, is_correct } = res.data;
            const newG = [...guesses, currentGuess];
            const newS = [...solvedStatuses, status_array];
            
            setGuesses(newG); 
            setSolvedStatuses(newS); 
            setCurrentGuess('');

            if (is_correct || newG.length === 6) {
                const finalState = is_correct ? 'won' : 'lost';
                setGameState(finalState);
                setIsLocked(true);

                // Calculate points based on timing if it was the 6th guess
                let points = is_correct ? 50 : 0;
                if (is_correct && newG.length === 6 && timerStart) {
                    const seconds = (Date.now() - timerStart) / 1000;
                    if (seconds <= 10) points = 150;
                    else if (seconds <= 15) points = 100;
                    else if (seconds <= 30) points = 75;
                } else if (is_correct) {
                    // Standard points for guesses 1-5
                    points = (7 - newG.length) * 20;
                }

                saveGameState({ guesses: newG, solvedStatuses: newS, gameState: finalState, systemWord });
                showStatistics(is_correct);

                if (user) {
                    await axios.post(`${API_BASE_URL}/user/update-stats`, { 
                        won: is_correct, 
                        points: points, 
                        word: systemWord 
                    });
                    fetchLeaderboard();
                }
            }
        } catch (e) {
            setShakeRow(guesses.length);
            setTimeout(() => setShakeRow(null), 500);
        } finally {
            setIsSubmitting(false);
        }
    }, [currentGuess, guesses, solvedStatuses, systemWord, user, isLocked, isSubmitting, timerStart, saveGameState, showStatistics, fetchLeaderboard]);

    const handleKeyPress = useCallback((key) => {
        if (gameState !== 'playing' || isStatsModalOpen || isLocked || isSubmitting) return;
        if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) setCurrentGuess(p => p + key.toUpperCase());
        if (key === 'Backspace') setCurrentGuess(p => p.slice(0, -1));
        if (key === 'Enter' && currentGuess.length === 5) submitGuess();
    }, [currentGuess, gameState, isStatsModalOpen, isLocked, isSubmitting, submitGuess]);

    useEffect(() => {
        if (isAuthModalOpen || isResetMode) return;
        const h = (e) => handleKeyPress(e.key);
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [handleKeyPress, isAuthModalOpen, isResetMode]);

    const getKeyboardLetterStatuses = () => {
        const statuses = {};
        guesses.forEach((guess, i) => {
            guess.split('').forEach((char, j) => {
                const s = solvedStatuses[i][j];
                if (s === 'correct') statuses[char] = 'correct';
                else if (s === 'present' && statuses[char] !== 'correct') statuses[char] = 'present';
                else if (s === 'absent' && !statuses[char]) statuses[char] = 'absent';
            });
        });
        return statuses;
    };

    return (
        <div className="App" style={{ height: `${appHeight}px` }}>
            {isResetMode ? <ResetPassword /> : (
                <>
                    <div className="help-icon" onClick={() => setShowRules(true)}>?</div>
                    
                    <div className="top-right-nav">
                        {monthlyChampion && (
                            <div className="champion-banner">👑 {monthlyChampion} 👑</div>
                        )}
                        {user ? <UserMenu /> : <button className="login-btn" onClick={openAuthModal}>Login</button>}
                    </div>

                    <Leaderboard data={leaderboardData} />

                    <header className="header"><BitTitle text="QUICKLE" /></header>
                    
                    <div className="board">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Row 
                                key={i} 
                                guess={i === guesses.length ? currentGuess : (guesses[i] || "")} 
                                solutionStatus={solvedStatuses[i]} 
                                isShaking={shakeRow === i} 
                            />
                        ))}
                    </div>

                    <VirtualKeyboard onKeyPress={handleKeyPress} letterStatuses={getKeyboardLetterStatuses()} />
                    
                    <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
                    
                    {isStatsModalOpen && statsData && (
                        <StatsModal 
                            stats={statsData} 
                            onClose={() => setIsStatsModalOpen(false)} 
                            answerWord={systemWord} 
                            isWin={gameState === 'won'} 
                            onPlayAgain={() => window.location.reload()} 
                        />
                    )}

                    {showRules && (
                        <div className="modal-overlay" onClick={() => setShowRules(false)}>
                            <div className="stats-card" onClick={e => e.stopPropagation()}>
                                <h2>How To Play</h2>
                                <p>Guess the word in 6 tries.</p>
                                <p>Each guess must be a valid 5-letter word.</p>
                                <p>Speed on the 6th guess grants bonus points!</p>
                                <button className="primary-btn" onClick={() => setShowRules(false)}>Got it</button>
                            </div>
                        </div>
                    )}

                    <AuthModal />
                </>
            )}
        </div>
    );
}

export default App;