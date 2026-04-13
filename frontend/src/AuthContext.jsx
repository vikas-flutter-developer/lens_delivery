import { createContext, useState, useEffect } from "react";
import axios from "axios";
import ApiClient from "./ApiClient.js";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; // Set default header for axios
    }
    setLoading(false);
  };

  // This Run once on component mount
  useEffect(() => {
    checkAuth();
  }, []);


  const login = async (role, email, password) => {
    const response = await ApiClient.post(`/auth/login`, {
      role,
      email,
      password
    });

    let { token, user: loggedInUser } = response.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(loggedInUser);
    return response;
  };

  const impersonate = (token, impersonatedUser) => {
    // Store original admin session if not already impersonating
    if (!user.isImpersonated) {
      localStorage.setItem("original_token", localStorage.getItem("token"));
      localStorage.setItem("original_user", localStorage.getItem("user"));
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ ...impersonatedUser, isImpersonated: true }));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser({ ...impersonatedUser, isImpersonated: true });
  };

  const stopImpersonating = () => {
    const originalToken = localStorage.getItem("original_token");
    const originalUser = localStorage.getItem("original_user");

    if (originalToken && originalUser) {
      localStorage.setItem("token", originalToken);
      localStorage.setItem("user", originalUser);
      localStorage.removeItem("original_token");
      localStorage.removeItem("original_user");
      axios.defaults.headers.common['Authorization'] = `Bearer ${originalToken}`;
      setUser(JSON.parse(originalUser));
    } else {
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("original_token");
    localStorage.removeItem("original_user");
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      login,
      logout,
      impersonate,
      stopImpersonating,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};
