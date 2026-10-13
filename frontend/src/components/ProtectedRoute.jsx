import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, permission, anyPermission = [] }) => {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();

  // Hiển thị loading khi đang kiểm tra authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Chuyển hướng đến login nếu chưa đăng nhập
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const deniedByPermission = permission && !hasPermission(permission);
  const deniedByPermissionGroup = anyPermission.length > 0 && !hasAnyPermission(anyPermission);
  if (deniedByPermission || deniedByPermissionGroup) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-500">403</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Bạn không có quyền truy cập
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Chức năng này chưa được cấp cho tài khoản của bạn tại cơ sở hiện tại.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
