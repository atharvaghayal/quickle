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

    // Use user.email as the displayed identifier, which maps to the username in the current backend
    const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U';

    return (
        <div className="user-menu-wrapper" ref={menuRef}>
            <div className="user-avatar" onClick={() => setOpen((prev) => !prev)}>
                {initial}
            </div>
            {open && (
                <div className="user-menu">
                    <div className="user-menu__header">
                        <div className="user-menu__name">{user.email}</div>
                        {/* Provider is 'local' for username/password sign-up in the new backend */}
                        <div className="user-menu__provider">Signed in via {user.provider}</div>
                    </div>
                    {/* Placeholder for Profile button */}
                    <button className="user-menu__item">Profile</button> 
                    <button className="user-menu__item" onClick={logout}>
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserMenu;