// src/StatsModal.js

import React, { useEffect, useState } from 'react';

const StatsModal = ({ stats, onClose, answerWord, isWin, onPlayAgain }) => {
    const [countdown, setCountdown] = useState(30);
    
    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (onPlayAgain) onPlayAgain();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        return () => clearInterval(timer);
    }, [onPlayAgain]);
    
    // Close on Escape key
    useEffect(() => { 
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const isLoggedIn = stats?.is_logged_in || false;
    
    // Safely handle stats display
    const times_played = stats?.times_played || 1;
    const streak = stats?.streak || 0;
    const max_streak = stats?.max_streak || 0;
    const win_percentage = stats?.win_percentage || (isWin ? 100 : 0);
    const total_points = stats?.total_points || 0;
    const current_points = stats?.current_points || 0;

    const headerText = isWin ? '🥳 CONGRATULATIONS! 🥳' : 'GAME OVER';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="stats-card" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>✕</button>
                
                <h2>{headerText}</h2>
                
                {!isWin && (
                    <div className="answer-reveal">
                        The word was: <span className="actual-answer">{answerWord}</span>
                    </div>
                )}

                {isWin && current_points > 0 && (
                    <div className="answer-reveal" style={{ background: 'rgba(0, 255, 0, 0.15)', borderColor: '#00ff00' }}>
                        Points Earned: <span className="actual-answer" style={{ color: '#00ff00' }}>+{current_points}</span>
                    </div>
                )}

                <div className="stats-row">
                    <div className="stat-item">
                        <div className="stat-label">Played</div>
                        <div className="stat-value">{times_played}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Streak</div>
                        <div className="stat-value">{streak}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Max</div>
                        <div className="stat-value">{max_streak}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Win %</div>
                        <div className="stat-value">{win_percentage.toFixed(1)}%</div>
                    </div>
                </div>

                {!isLoggedIn && (
                    <p className="login-prompt">
                        📝 Login to save your stats and compete on the leaderboard!
                    </p>
                )}

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button className="primary-btn" onClick={onPlayAgain}>Play Again</button>
                    <button className="secondary-btn" onClick={onClose}>Close</button>
                </div>

                <div className="countdown-section">
                    <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Auto-restart in:</div>
                    <div className="countdown-timer">{countdown}s</div>
                </div>

                <div className="footer-credit" style={{ marginTop: '15px', fontSize: '0.75rem', color: '#666', textAlign: 'center' }}>
                    Quickle • Built with ❤️ by Atharva Ghayal
                </div>
            </div>
        </div>
    );
};

export default StatsModal;
