import React from 'react';

const Notifications = () => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black text-text-light dark:text-text-dark">Thông báo & Nhắc nhở</h1>
      <div className="grid gap-4">
        {['Nhắc nhở Hết hạn Gói tập', 'Nhắc nhở Không Hoạt động', 'Thông báo Gia hạn Thành công'].map((item, i) => (
          <div key={i} className="flex justify-between items-center p-5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl">
            <div><p className="font-bold text-text-light dark:text-text-dark">{item}</p><p className="text-sm text-text-muted-light dark:text-text-muted-dark">Tự động gửi thông báo đến khách hàng.</p></div>
            <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" defaultChecked /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></label>
          </div>
        ))}
      </div>
    </div>
  );
};
export default Notifications;