// --- File: AuthModal.js (CORRECTED IMPORT PATH) ---
import React, { useState } from 'react';
// FIX: Changed './auth/AuthContext' to './AuthContext' because AuthContext.js 
// is in the same directory (src/auth/) as AuthModal.js
import { useAuth } from './AuthContext'; 

const AuthModal = () => {
    const { isAuthModalOpen, closeAuthModal, login, signup, startOauth } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isAuthModalOpen) return null;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            if (mode === 'login') {
                await login({ email, password });
            } else {
                await signup({ email, password });
            }
            setEmail('');
            setPassword('');
        } catch (err) {
            let message = 'Unable to authenticate. Please try again.';

            if (err.response) {
                const data = err.response.data;
                
                // 1. Handle single message errors (e.g., status 409 "Username already registered")
                if (data.detail && typeof data.detail === 'string') {
                    message = data.detail;
                } 
                // 2. Handle FastAPI validation errors (e.g., status 400/422 with a list of dicts)
                else if (data.detail && Array.isArray(data.detail)) {
                    // Extract the message from the first validation error object
                    message = data.detail[0].msg || message;
                }
                // 3. Handle general Axios/JS error message
                else {
                    message = err.message || message;
                }
            }
            
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleMode = () => {
        setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
        setError('');
    };

    return (
        <div className="auth-modal-overlay" onClick={closeAuthModal}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={closeAuthModal} aria-label="Close auth modal">
                    ×
                </button>
                <h2>{mode === 'login' ? 'Login' : 'Create Account'}</h2>

                <form className="auth-form" onSubmit={submit}>
                    <label>
                        Username (4-20 Alphanumeric chars)
                        <input
                            type="text" 
                            value={email}
                            required
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="my_unique_username"
                            minLength={4}
                            maxLength={20}
                            pattern="[A-Za-z0-9]+" // Client-side check for alphanumeric
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            required
                            minLength={8}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 8 chars, incl. upper, lower, digit, special"
                        />
                    </label>
                    {error && <div className="auth-error">{error}</div>} 
                    <button type="submit" className="primary-btn" disabled={isSubmitting}>
                        {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>OR</span>
                </div>

                <div className="oauth-actions">
                    <button className="secondary-btn" onClick={() => startOauth('google')}>
                        Continue with Google
                    </button>
                    <button className="secondary-btn" onClick={() => startOauth('github')}>
                        Continue with GitHub
                    </button>
                </div>

                <div className="switch-mode">
                    {mode === 'login' ? (
                        <>
                            New here? <button onClick={toggleMode}>Create an account</button>
                        </>
                    ) : (
                        <>
                            Already have an account? <button onClick={toggleMode}>Log in</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;