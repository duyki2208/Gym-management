import React from "react";
import { Target, TrendingUp, Award } from "lucide-react";

const KPIProgressWidget = ({ title, current, target, unit = "đ", icon: Icon = Target }) => {
  const percent = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  
  return (
    <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Icon size={18} />
          </div>
          <span className="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark">{title}</span>
        </div>
        <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
          {percent}%
        </span>
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 mb-3 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-primary to-emerald-500 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
        <span>Đạt: <strong className="text-text-primary-light dark:text-text-primary-dark">{current?.toLocaleString("vi-VN")}{unit}</strong></span>
        <span>Mục tiêu: <strong className="text-text-primary-light dark:text-text-primary-dark">{target?.toLocaleString("vi-VN")}{unit}</strong></span>
      </div>
    </div>
  );
};

export default KPIProgressWidget;
