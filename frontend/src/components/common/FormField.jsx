import React from "react";

/**
 * ClassName chuẩn cho các ô nhập liệu (input, select, textarea)
 */
export const inputClassName =
  "w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition-all";

/**
 * FormField - Bọc nhãn (label), dấu sao đỏ required, input và thông báo lỗi chuẩn
 */
const FormField = ({
  id,
  label,
  required = false,
  error,
  helpText,
  className = "",
  children,
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 font-semibold ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <span className="text-xs text-red-500 font-medium mt-1">
          {error}
        </span>
      )}
      {helpText && !error && (
        <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          {helpText}
        </span>
      )}
    </div>
  );
};

export default FormField;
