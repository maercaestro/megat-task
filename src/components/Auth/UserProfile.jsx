import React, { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { UserCircleIcon } from '@heroicons/react/24/solid';

const UserProfile = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [imageError, setImageError] = useState(false);
  
  // Debug the user object and image loading
  useEffect(() => {
    if (user) console.log('User profile data:', user);
  }, [user]);
  
  if (!isAuthenticated || !user) {
    return null;
  }

  // Function to get initials from name
  const getInitials = () => {
    if (!user.name) return 'U';
    const names = user.name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  // Render avatar display (used in both button and dropdown)
  const renderAvatar = (size = 'small') => {
    const sizeClasses = size === 'small' ? 'w-9 h-9' : 'w-12 h-12';
    
    if (user.picture && !imageError) {
      return (
        <div className={`${sizeClasses} rounded-full overflow-hidden border-2 border-white`}>
          <img 
            src={user.picture}
            alt={user.name || 'User profile'} 
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      );
    } else {
      // Fallback to initials
      return (
        <div className={`${sizeClasses} rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 
                        flex items-center justify-center text-white font-semibold`}>
          {getInitials()}
        </div>
      );
    }
  };

  return (
    <div className="relative group">
      {/* Avatar Button - Simpler implementation */}
      <button className="focus:outline-none">
        {renderAvatar('small')}
      </button>
      
      {/* Dropdown Menu */}
      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl opacity-0 invisible 
        group-hover:opacity-100 group-hover:visible transition-all duration-200 z-40">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {renderAvatar('large')}
            <div>
              <p className="font-medium text-gray-800">{user.name || 'User'}</p>
              <p className="text-sm text-gray-500 truncate">{user.email || 'No email available'}</p>
            </div>
          </div>
        </div>
        
        <div className="p-2">
          <button 
            onClick={() => logout()}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;