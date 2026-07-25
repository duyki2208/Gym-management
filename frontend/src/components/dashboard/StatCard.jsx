import React from "react";

const StatCard = ({ label, value, change, type, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex flex-col rounded-2xl p-6 border bg-surface-light dark:bg-surface-dark relative overflow-hidden group shadow-sm hover:shadow-md transition-all cursor-pointer min-w-0 w-full ${colorClass || 'border-border-light dark:border-border-dark'}`}
  >
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark line-clamp-1">{label}</span>
      {Icon && (
        <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-primary-light dark:text-primary-dark group-hover:scale-110 transition-transform flex-shrink-0">
          <Icon size={20} />
        </div>
      )}
    </div>
    
    <div className="flex items-baseline justify-between gap-2 mt-auto">
      <h3 className="text-2xl sm:text-3xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight truncate">
        {value}
      </h3>
      
      {change && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
          type === 'increase' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
          type === 'decrease' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
          'bg-gray-500/10 text-gray-600 dark:text-gray-400'
        }`}>
          {change}
        </span>
      )}
    </div>
  </div>
);

export default StatCard;
