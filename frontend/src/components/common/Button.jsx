import React from "react";

/**
 * Button - Chuẩn Button System dùng chung toàn hệ thống
 */
const Button = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  icon: Icon,
  type = "button",
  onClick,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-sm rounded-xl gap-2",
    lg: "px-5 py-3 text-base rounded-xl gap-2.5",
  };

  const variantClasses = {
    primary:
      "bg-primary text-text-light hover:bg-primary-hover shadow-sm",
    secondary:
      "bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold",
    danger:
      "bg-red-600 hover:bg-red-700 text-white shadow-sm",
    success:
      "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
    ghost:
      "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={size === "sm" ? 14 : 18} />
      ) : null}
      {children}
    </button>
  );
};

export default Button;
