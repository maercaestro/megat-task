import React from 'react';
import { useAuth } from './useAuth';

const LoginButton = () => {
  const { login } = useAuth();

  return (
    <button
      onClick={() => login()}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Sign In
    </button>
  );
};

export default LoginButton;