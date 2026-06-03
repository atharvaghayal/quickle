import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ResetPassword = () => {
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const t = urlParams.get('token');
        if (t) setToken(t);
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsSubmitting(true);
        try {
            await axios.post('http://localhost:8000/api/auth/reset-password', { token, new_password: newPassword });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to reset password');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="reset-password">
                <h2>Password Reset Successful</h2>
                <p>You can now log in with your new password.</p>
                <button onClick={() => window.location.href = '/'}>Go to Game</button>
            </div>
        );
    }

    return (
        <div className="reset-password">
            <h2>Reset Password</h2>
            <form onSubmit={submit}>
                <label>
                    New Password
                    <input
                        type="password"
                        value={newPassword}
                        required
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                </label>
                <label>
                    Confirm Password
                    <input
                        type="password"
                        value={confirmPassword}
                        required
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                </label>
                {error && <div className="error">{error}</div>}
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
        </div>
    );
};

export default ResetPassword;