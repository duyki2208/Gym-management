import React from 'react';

const metricStripColumns = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 xl:grid-cols-4',
};

export const ReportMetricStrip = ({ columns = 4, children }) => (
  <div
    className={`grid gap-px overflow-hidden rounded-lg border border-border-light bg-border-light dark:border-border-dark dark:bg-border-dark ${metricStripColumns[columns]}`}
  >
    {children}
  </div>
);

export const ReportMetricCell = ({ children, spacious = false }) => (
  <div className={`min-w-0 bg-surface-light dark:bg-surface-dark ${spacious ? 'min-h-28 p-5 sm:min-h-32 sm:p-6' : 'p-4 sm:p-5'}`}>
    {children}
  </div>
);

export const ReportPageHeader = ({ title, description, children }) => (
  <header className="flex flex-col items-start justify-between gap-4 border-b border-border-light pb-5 dark:border-border-dark sm:flex-row sm:items-end">
    <div className="min-w-0">
      <h1 className="text-xl font-semibold text-text-light dark:text-text-dark">{title}</h1>
      {description && (
        <p className="mt-0.5 text-xs text-subtle-light dark:text-subtle-dark md:text-sm">
          {description}
        </p>
      )}
    </div>
    {children && (
      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
        {children}
      </div>
    )}
  </header>
);

