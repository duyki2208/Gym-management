import React from "react";

const PageHeader = ({ title, description, icon: Icon, actions, meta }) => (
  <header className="flex flex-col gap-4 border-b border-border-light pb-5 dark:border-border-dark sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {meta && (
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-text-muted-light dark:text-text-muted-dark">
          {meta}
        </p>
      )}
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={22} className="shrink-0 text-text-muted-light dark:text-text-muted-dark" />}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-text-light dark:text-text-dark">{title}</h1>
      </div>
      {description && (
        <p className="mt-1.5 max-w-3xl text-sm text-text-muted-light dark:text-text-muted-dark">{description}</p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export default PageHeader;
