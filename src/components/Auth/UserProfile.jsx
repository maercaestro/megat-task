import React, { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { UserCircleIcon } from '@heroicons/react/24/solid';

const UserProfile = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [imageError, setImageError] = useState(false);
  
  // Reset image error state if user changes
  useEffect(() => {
    setImageError(false);
  }, [user?.picture]);
  
  console.log("Auth user object:", user);

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

  // Define a default avatar URL
  const defaultAvatar = "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.name || 'User') + "&background=0D8ABC&color=fff";

  // Determine which image source to use
  const imageSrc = (user.picture && !imageError) ? user.picture : defaultAvatar;

  return (
    <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-r from-blue-500 to-emerald-400">
      {/* Profile Button */}
      <button className="w-full h-full rounded-full overflow-hidden shadow-md hover:shadow-lg transition-shadow bg-white">
        {/* Always show image if available, otherwise show initials */}
        {user.picture && !imageError ? (
          <img 
            src={user.picture} 
            alt={user.name || 'User'} 
            className="w-full h-full"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-lg font-semibold">
            {getInitials()}
          </div>
        )}
      </button>
      
      {/* Dropdown Menu */}
      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg opacity-0 invisible 
        group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 flex items-center justify-center overflow-hidden">
              {/* Use the same logic for the dropdown image */}
              {user.picture && !imageError ? (
                <img 
                  src={user.picture} 
                  alt={user.name || 'User'}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xl font-semibold">
                  {getInitials()}
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-800">{user.name || 'User'}</p>
              <p className="text-sm text-gray-500">{user.email || 'No email available'}</p>
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