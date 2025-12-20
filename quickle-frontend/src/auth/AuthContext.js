// --- File: AuthContext.js (MODIFIED) ---
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

// Base URL for API
const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true, // IMPORTANT: Allows sending/receiving secure session cookies
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    // Removed: [csrfToken, setCsrfToken] and fetchCsrf/csrfHeaders as secure HTTP-only cookies handle session and CSRF protection (via samesite=Lax)
    
    // Function to check if a session exists
    const refreshUser = useCallback(async () => {
        console.log("Auth: Starting refresh check..."); // NEW LINE
        try {
            const { data } = await api.get('/auth/me');
            setUser(data.user);
            console.log("Auth: User found. User:", data.user); // NEW LINE
        } catch {
            setUser(null);
            console.log("Auth: No user found."); // NEW LINE
        } finally {
            setLoading(false);
            console.log("Auth: Loading set to false."); // NEW LINE
        }
    }, []);

    // Fetch user on initial load to check for existing session persistence
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    // Sign up (creates user and logs them in)
    const signup = useCallback(
        async ({ email, password }) => {
            // Note: The FastAPI backend maps 'email' field to 'username' for signup/login
            await api.post('/auth/signup', { email, password });
            await refreshUser(); // Fetch the newly logged-in user
            setIsAuthModalOpen(false);
        },
        [refreshUser]
    );

    // Log in (sets the secure session cookie)
    const login = useCallback(
        async ({ email, password }) => {
            await api.post('/auth/login', { email, password });
            await refreshUser(); // Fetch the newly logged-in user
            setIsAuthModalOpen(false);
        },
        [refreshUser]
    );

    // Log out (clears the session cookie)
    const logout = useCallback(async () => {
        await api.post('/auth/logout');
        setUser(null);
    }, []);

    // Oauth methods are now placeholders as the backend routes are not fully implemented
    const startOauth = (provider) => {
        window.location.href = `http://localhost:8000/api/auth/oauth/${provider}/login`;
    };

    const value = useMemo(
        () => ({
            user,
            loading,
            isAuthModalOpen,
            openAuthModal: () => setIsAuthModalOpen(true),
            closeAuthModal: () => setIsAuthModalOpen(false),
            signup,
            login,
            logout,
            startOauth,
        }),
        [user, loading, isAuthModalOpen, signup, login, logout, startOauth]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);