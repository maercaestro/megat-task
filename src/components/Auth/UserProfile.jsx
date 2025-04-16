import React, { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { UserCircleIcon } from '@heroicons/react/24/solid';

const UserProfile = ({ compact = false, fullWidth = false, rightAlignedDropdown = false }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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
        <img
          src={user.picture}
          alt={user.name || 'User'}
          onError={() => setImageError(true)}
          className={`${sizeClasses} rounded-full border-2 border-white shadow-sm`}
        />
      );
    }
    
    // Fallback to initials
    return (
      <div className={`${sizeClasses} rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 flex items-center justify-center border-2 border-white shadow-sm`}>
        <span className="text-white font-medium">
          {getInitials()}
        </span>
      </div>
    );
  };

  return (
    <div 
      className={`relative ${fullWidth ? 'w-full' : ''}`}
      onMouseEnter={() => setShowDropdown(true)}
      onMouseLeave={() => setShowDropdown(false)}
    >
      <button
        className={`flex items-center gap-2 rounded-full ${compact ? 'p-1' : 'px-3 py-2'} hover:bg-gray-100 transition-colors ${fullWidth ? 'w-full justify-between' : ''}`}
      >
        {renderAvatar()}
        {!compact && (
          <span className="text-sm font-medium text-gray-700 truncate">
            {user?.name || 'User'}
          </span>
        )}
        {fullWidth && !compact && (
          <div className="bg-gray-100 h-5 w-5 rounded-full flex items-center justify-center">
            <span className="text-xs text-gray-500">↓</span>
          </div>
        )}
      </button>

      {showDropdown && (
        <div 
          className="absolute top-0 right-0 transform -translate-y-full w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 mt-2"
        >
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;