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

    // Function to check if a session exists on the backend
    const refreshUser = useCallback(async () => {
        try {
            // This calls the @auth_router.get("/me") route we added
            const { data } = await api.get('/auth/me');
            setUser(data.user);
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Check for existing session when the app first loads
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    // Sign up a new user (changed 'email' to 'username' to match backend)
    const signup = useCallback(
        async ({ username, password }) => {
            await api.post('/auth/signup', { username, password });
            await refreshUser(); // Fetch the newly created user session
            setIsAuthModalOpen(false);
        },
        [refreshUser]
    );

    // Log in (changed 'email' to 'username' to match backend)
    const login = useCallback(
        async ({ username, password }) => {
            await api.post('/auth/login', { username, password });
            await refreshUser(); // Fetch the logged-in user session
            setIsAuthModalOpen(false);
        },
        [refreshUser]
    );

    // Log out (clears the session cookie)
    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
            setUser(null);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }, []);

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
        }),
        [user, loading, isAuthModalOpen, signup, login, logout]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};