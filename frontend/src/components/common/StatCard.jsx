import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getIconTone } from "../../utils/iconTone";

/**
 * StatCard - Thẻ thống kê chuẩn hóa toàn hệ thống
 * @param {string} label - Tiêu đề của chỉ số
 * @param {string|number} value - Giá trị hiển thị
 * @param {string} subText | subtitle | change - Dòng ghi chú/mô tả phụ
 * @param {React.ReactNode} icon - Icon Lucide
 * @param {string} color - Tên màu tắt ('primary' | 'blue' | 'emerald' | 'purple' | 'amber')
 * @param {string} iconBg - Tùy biến class nền và màu icon
 * @param {boolean} loading - Trạng thái loading skeleton
 * @param {object} trend - { value: number|string, direction: "up"|"down"|"neutral", label: string }
 * @param {string} type - 'positive' | 'negative' | 'warning' cho change badge
 * @param {function} onClick - Sự kiện click mở modal chi tiết (nếu có)
 */
const COLOR_MAP = {
  primary: "bg-primary/15 text-text-light dark:text-primary",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
};

const StatCard = ({
  label,
  value,
  subText,
  subtitle,
  change,
  type,
  icon: Icon,
  color = "primary",
  iconBg,
  loading = false,
  trend,
  onClick,
  className = "",
}) => {
  const finalSubText = subText || subtitle || change;
  const resolvedIconBg = iconBg || (Icon ? getIconTone(Icon) : COLOR_MAP[color] || COLOR_MAP.primary);

  if (loading) {
    return (
      <div
        className={`bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm animate-pulse flex flex-col justify-between ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-28" />
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-36 mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-20" />
      </div>
    );
  }

  const displayValue =
    value === null || value === undefined || value === "" ? "-" : value;

  return (
    <div
      onClick={onClick}
      className={`bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm transition-all duration-200 flex flex-col justify-between ${
        onClick
          ? "cursor-pointer hover:shadow-md hover:border-primary/50"
          : "hover:shadow-md"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark truncate">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark tracking-tight mt-1.5 break-words leading-tight">
            {displayValue}
          </p>
        </div>
        {Icon && (
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${resolvedIconBg}`}
          >
            <Icon size={22} />
          </div>
        )}
      </div>

      {(trend || finalSubText) && (
        <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-border-light dark:border-border-dark mt-2">
          {trend && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                trend.direction === "up"
                  ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400"
                  : trend.direction === "down"
                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {trend.direction === "up" && <TrendingUp size={12} />}
              {trend.direction === "down" && <TrendingDown size={12} />}
              {trend.direction === "neutral" && <Minus size={12} />}
              {trend.value}
            </span>
          )}
          {type && finalSubText && !trend && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                type === "positive"
                  ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400"
                  : type === "negative"
                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                  : type === "warning"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {finalSubText}
            </span>
          )}
          {!type && finalSubText && (
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              {finalSubText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
