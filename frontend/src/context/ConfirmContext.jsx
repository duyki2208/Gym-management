import React, { createContext, useContext, useState } from "react";
import { AlertTriangle, HelpCircle, Info, X } from "lucide-react";

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({
    isOpen: false,
    title: "Xác nhận",
    message: "Bạn có chắc chắn muốn thực hiện hành động này?",
    type: "warning", // 'warning' | 'danger' | 'info'
    resolve: null,
  });

  const confirm = (options = {}) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title || "Xác nhận",
        message: options.message || "Bạn có chắc chắn muốn thực hiện hành động này?",
        type: options.type || "warning",
        resolve,
      });
    });
  };

  const handleClose = (value) => {
    if (state.resolve) {
      state.resolve(value);
    }
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const getIcon = () => {
    switch (state.type) {
      case "danger":
        return <AlertTriangle className="text-red-500 w-8 h-8" />;
      case "info":
        return <Info className="text-blue-500 w-8 h-8" />;
      default:
        return <HelpCircle className="text-amber-500 w-8 h-8" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (state.type) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white";
      case "info":
        return "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white";
      default:
        return "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white";
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100 animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="text-base font-bold text-gray-800 dark:text-white tracking-tight flex items-center gap-2">
                {state.title}
              </h3>
              <button
                onClick={() => handleClose(false)}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 flex gap-4 items-start">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl shrink-0">
                {getIcon()}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium break-words">
                  {state.message}
                </p>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-xl transition-all border border-gray-200 dark:border-gray-700"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${getConfirmButtonClass()}`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};
