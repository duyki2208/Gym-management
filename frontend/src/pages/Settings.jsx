import React from 'react';

const Settings = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-text-light dark:text-text-dark text-3xl font-bold">Cài đặt Hệ thống</h1>
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark"><h2 className="text-xl font-bold text-text-light dark:text-text-dark">Thông tin chung</h2></div>
        <div className="p-6 space-y-6">
          <div><label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Tên phòng tập</label><input className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark" defaultValue="Gym Admin Fitness" /></div>
          <div><label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Địa chỉ</label><input className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark" defaultValue="123 Đường ABC, Quận 1" /></div>
        </div>
        <div className="p-6 bg-background-light dark:bg-background-dark/50 flex justify-end"><button className="h-10 px-4 bg-primary text-text-light font-bold rounded">Lưu thay đổi</button></div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark">Thông báo & Nhắc nhở</h2>
        </div>
        <div className="p-6 grid gap-4">
          {['Nhắc nhở Hết hạn Gói tập', 'Nhắc nhở Không Hoạt động', 'Thông báo Gia hạn Thành công'].map((item, i) => (
            <div key={i} className="flex justify-between items-center p-5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl">
              <div>
                <p className="font-bold text-text-light dark:text-text-dark">{item}</p>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Tự động gửi thông báo đến khách hàng.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Settings;