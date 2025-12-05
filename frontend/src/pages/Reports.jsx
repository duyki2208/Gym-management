import React from 'react';

const Reports = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black text-text-light dark:text-text-dark">Báo cáo & Tài chính</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[{l: 'Tổng doanh thu', v: '1,250M', c: '+15.2%'}, {l: 'Khách hàng mới', v: '125', c: '+8.5%'}, {l: 'Lượt gia hạn', v: '82', c: '+5.0%'}].map((s,i)=>(
          <div key={i} className="p-6 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg">
            <p className="text-text-light dark:text-text-dark font-medium">{s.l}</p>
            <p className="text-3xl font-bold text-text-light dark:text-text-dark my-2">{s.v}</p>
            <p className="text-positive-light dark:text-positive-dark font-medium">{s.c}</p>
          </div>
        ))}
      </div>
      <div className="p-6 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg h-96 flex items-center justify-center text-text-muted-light dark:text-text-muted-dark">
        Biểu đồ doanh thu (Placeholder)
      </div>
    </div>
  );
};
export default Reports;