// src/StatsModal.js

import React, { useEffect } from 'react';

const StatsModal = ({ stats, onClose, resetTime, formatTime, answerWord, isWin, onPlayAgain }) => {
    
    // This Hook is now structurally guaranteed to be the first hook call, 
    // eliminating the conditional error when imported into App.js.
    useEffect(() => { 
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const isLoggedIn = stats.is_logged_in;

    // --- ANONYMOUS FIRST-TIME STATS LOGIC ---
    if (!isLoggedIn) {
        stats.times_played = 1;
        stats.streak = isWin ? 1 : 0;
        stats.max_streak = isWin ? 1 : 0;
        stats.win_percentage = isWin ? 100.00 : 0.00;
    }

    const streakDisplay = stats.currentStreakOngoing ? `${stats.streak}*` : stats.streak.toString();
    const maxStreakDisplay = stats.max_streak.toString();

    const headerText = isWin ? '🥳 CONGRATULATIONS! 🥳' : 'GAME OVER';
    const headerClass = isWin ? 'win-header' : 'loss-header';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="stats-card" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>X</button>
                
                <h2 className={headerClass}>{headerText}</h2>
                
                {!isWin && (
                    <div className="answer-reveal">
                        The word was: <span className="actual-answer">{answerWord}</span>
                    </div>
                )}

                <div className="stats-row">
                    <div className="stat-item">
                        <div className="stat-label">Played</div>
                        <div className="stat-value">{stats.times_played}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Streak</div>
                        <div className="stat-value">{streakDisplay}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Max Streak</div>
                        <div className="stat-value">{maxStreakDisplay}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Win %</div>
                        <div className="stat-value">{stats.win_percentage.toFixed(2)}%</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Total Points</div>
                        <div className="stat-value">{stats.total_points}</div>
                    </div>
                </div>

                {!isLoggedIn && (
                    <p className="login-prompt">
                        “Sign-up OR Login if you want to save your scores and appear at the top of the leaderboard.”
                    </p>
                )}
                <div className="footer-credit">
                    Quickle-Word Game | Built with ❤️ by Atharva Ghayal
                </div>

            </div>
        </div>
    );
};

export default StatsModal;