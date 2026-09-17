import React, { createContext, useState, useContext, useEffect } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kiểm tra xem đã đăng nhập chưa khi mở app
  useEffect(() => {
    const savedUser = authService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const login = async (facilityKey, username, password) => {
    try {
      const userData = await authService.login(facilityKey, username, password);
      setUser(userData);
      return { success: true };
    } catch (error) {
      const errorMessage =
        typeof error === "string"
          ? error
          : error?.message || "Đăng nhập thất bại";
      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const switchBranch = async (branchCode) => {
    try {
      const result = await authService.switchBranch(branchCode);
      const updatedUser = {
        ...user,
        activeBranch: result.activeBranch,
        branchName: result.branchName || user?.branchName,
      };
      setUser(updatedUser);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchBranch, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
