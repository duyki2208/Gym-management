import React, { createContext, useState, useContext, useEffect } from "react";
import { authService } from "../services/authService";
import { hasAnyPermission, hasPermission } from "../utils/permissions";
import { LOCAL_STORAGE_KEYS } from "../utils/constants";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kiểm tra xem đã đăng nhập chưa khi mở app
  useEffect(() => {
    let active = true;
    const hydrateSession = async () => {
      const savedUser = authService.getCurrentUser();
      const savedToken = authService.getToken();
      if (!savedToken) {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
        if (active) setLoading(false);
        return;
      }
      if (active && savedUser) setUser(savedUser);

      try {
        const sessionUser = await authService.getSession();
        if (active) setUser(sessionUser || savedUser);
      } catch (error) {
        // 401 được interceptor xó token và chuyển về login. Với lỗi
        // mạng/5xx, giữ phiên local thay vì ép người dùng đăng nhập lại.
        if (active) setUser(error?.response?.status === 401 ? null : savedUser);
      } finally {
        if (active) setLoading(false);
      }
    };

    hydrateSession();
    return () => {
      active = false;
    };
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
        permissions: result.permissions || [],
      };
      setUser(updatedUser);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        switchBranch,
        loading,
        hasPermission: (permission) => hasPermission(user, permission),
        hasAnyPermission: (permissions) => hasAnyPermission(user, permissions),
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
