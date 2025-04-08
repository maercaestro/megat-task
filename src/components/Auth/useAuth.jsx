import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';

export const useAuth = () => {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently
  } = useAuth0();

  // Add this debugging log
  useEffect(() => {
    console.log("Auth0 state:", {
      isLoading,
      isAuthenticated,
      user
    });
  }, [isLoading, isAuthenticated, user]);

  // Handle token acquisition and storage
  useEffect(() => {
    const getToken = async () => {
      try {
        if (isAuthenticated) {
          const token = await getAccessTokenSilently();
          localStorage.setItem('auth_token', token);
        }
      } catch (e) {
        console.error('Error getting token', e);
      }
    };

    getToken();
  }, [isAuthenticated, getAccessTokenSilently]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    logout({ returnTo: window.location.origin });
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    login: loginWithRedirect,
    logout: handleLogout,
    getToken: getAccessTokenSilently
  };
};