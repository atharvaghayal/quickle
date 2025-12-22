import React, { useState } from 'react';
import { useAuth } from './AuthContext'; 

const AuthModal = () => {
    const { isAuthModalOpen, closeAuthModal, login, signup } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [email, setEmail] = useState(''); // This state holds the string the user types
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isAuthModalOpen) return null;

    const toggleMode = () => {
        setMode(prev => prev === 'login' ? 'signup' : 'login');
        setError('');
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        // FIX: Create a payload with 'username' to match your FastAPI UserAuth schema
        // We use the value from the 'email' state variable as the username
        const payload = { username: email, password: password };

        try {
            if (mode === 'login') {
                await login(payload);
            } else {
                await signup(payload);
            }
            // Clear fields on success
            setEmail('');
            setPassword('');
        } catch (err) {
            let message = 'Unable to authenticate. Please try again.';

            if (err.response) {
                const data = err.response.data;
                
                // 1. Handle string-based detail errors (e.g., "Username already registered")
                if (data.detail && typeof data.detail === 'string') {
                    message = data.detail;
                } 
                // 2. Handle FastAPI Pydantic validation errors (array of objects)
                else if (data.detail && Array.isArray(data.detail)) {
                    message = data.detail[0].msg || message;
                }
                else {
                    message = err.message || message;
                }
            }
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-modal-overlay" onClick={closeAuthModal}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={closeAuthModal}>&times;</button>
                
                <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                <p className="auth-subtitle">
                    {mode === 'login' ? 'Enter your details to continue' : 'Join the Quickle community'}
                </p>

                <form className="auth-form" onSubmit={submit}>
                    <label>
                        <span>Username</span> {/* Wrap in span */}
                        <input
                            type="text" 
                            value={email}
                            required
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="my_username"
                        />
                    </label>
                    <label>
                        <span>Password</span> {/* Wrap in span */}
                        <input
                            type="password"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </label>
    
    {error && <div className="auth-error">{error}</div>} 
    
    <button type="submit" className="primary-btn" disabled={isSubmitting}>
        {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
    </button>
</form>

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