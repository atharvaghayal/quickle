import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext'; // Using the updated AuthContext

const UserMenu = () => {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // If the user object is not available (e.g., they logged out or session expired), render nothing.
    if (!user) return null;

    // Use user.username as the displayed identifier
    const initial = user.username ? user.username.charAt(0).toUpperCase() : 'U';

    return (
        <div className="user-menu-wrapper" ref={menuRef}>
            <div className="user-avatar" onClick={() => setOpen((prev) => !prev)}>
                {initial}
            </div>
            {open && (
                <div className="user-menu">
                    <div className="user-menu__header">
                        <div className="user-menu__name">{user.username}</div>
                    </div>
                    {/* Placeholder for Profile button */}
                    <button className="user-menu__item" onClick={() => window.location.href = '/profile.html'}>Profile</button> 
                    <button className="user-menu__item" onClick={logout}>
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserMenu;