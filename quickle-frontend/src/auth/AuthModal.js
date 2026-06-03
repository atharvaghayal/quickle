import React, { useState } from 'react';
import { useAuth } from './AuthContext'; 

const AuthModal = () => {
    const { isAuthModalOpen, closeAuthModal, login, signup, forgotPassword } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);

    if (!isAuthModalOpen) return null;

    const toggleMode = () => {
        setMode(prev => prev === 'login' ? 'signup' : 'login');
        setError('');
        setForgotMode(false);
        setEmail('');
        setUsername('');
        setPassword('');
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (forgotMode) {
                await forgotPassword({ email });
                setError('If the email is registered, a reset link has been sent.');
            } else if (mode === 'login') {
                await login({ username, password });
                setUsername('');
                setPassword('');
            } else {
                await signup({ email, username, password });
                setEmail('');
                setUsername('');
                setPassword('');
                setMode('login'); // Switch to login mode after successful signup
            }
        } catch (err) {
            let message = 'Unable to authenticate. Please try again.';

            if (err.response) {
                const data = err.response.data;
                
                if (data.detail && typeof data.detail === 'string') {
                    message = data.detail;
                } 
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
                
                <h2>{forgotMode ? 'Forgot Password' : mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                <p className="auth-subtitle">
                    {forgotMode ? 'Enter your email to reset password' : mode === 'login' ? 'Enter your details to continue' : 'Join the Quickle community'}
                </p>

                <form className="auth-form" onSubmit={submit}>
                    {forgotMode ? (
                        <label>
                            <span>Email</span>
                            <input
                                type="email"
                                value={email}
                                required
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                            />
                        </label>
                    ) : (
                        <>
                            {mode === 'signup' && (
                                <label>
                                    <span>Email</span>
                                    <input
                                        type="email"
                                        value={email}
                                        required
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                    />
                                </label>
                            )}
                            <label>
                                <span>Username</span>
                                <input
                                    type="text"
                                    value={username}
                                    required
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="my_username"
                                />
                            </label>
                            <label>
                                <span>Password</span>
                                <input
                                    type="password"
                                    value={password}
                                    required
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </label>
                        </>
                    )}
    
    {error && <div className="auth-error">{error}</div>} 
    
    <button type="submit" className="primary-btn" disabled={isSubmitting}>
        {isSubmitting ? 'Please wait...' : forgotMode ? 'Send Reset Email' : mode === 'login' ? 'Login' : 'Sign Up'}
    </button>
</form>

                <div className="switch-mode">
                    {forgotMode ? (
                        <button onClick={() => { setForgotMode(false); setError(''); setEmail(''); }}>Back to Login</button>
                    ) : mode === 'login' ? (
                        <>
                            <button onClick={() => setForgotMode(true)}>Forgot Password?</button>
                            <br />
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