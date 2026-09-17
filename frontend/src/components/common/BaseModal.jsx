import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * BaseModal - Chuẩn Modal dùng chung toàn hệ thống Gym Management
 * @param {boolean} isOpen - Trạng thái hiển thị modal
 * @param {function} onClose - Hàm đóng modal
 * @param {string} title - Tiêu đề modal
 * @param {string} subtitle - Dòng mô tả phụ bên dưới tiêu đề
 * @param {React.ReactNode} icon - Icon biểu tượng bên cạnh tiêu đề
 * @param {string} maxWidth - Kích thước tối đa (vd: max-w-md, max-w-lg, max-w-2xl, max-w-3xl, max-w-4xl)
 * @param {React.ReactNode} children - Nội dung form hoặc nội dung modal
 * @param {React.ReactNode} footer - Các nút hành động ở footer
 * @param {string} headerGradient - Tùy chỉnh màu gradient header nếu cần
 */
const BaseModal = ({
  isOpen = true,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = "max-w-2xl",
  children,
  footer,
  headerGradient = "from-emerald-600 to-emerald-700",
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-xl overflow-hidden w-full ${maxWidth} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Gradient */}
        <div
          className={`bg-gradient-to-r ${headerGradient} px-6 py-4 text-white flex items-center justify-between shrink-0`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="p-2 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-lg sm:text-xl truncate text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-emerald-50/90 font-normal truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white shrink-0 cursor-pointer ml-3"
              title="Đóng (Esc)"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-4 bg-background-light/70 dark:bg-background-dark/70 border-t border-border-light dark:border-border-dark flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
