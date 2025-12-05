import React from 'react';

const Settings = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-4xl font-black text-text-light dark:text-text-dark">Cài đặt Hệ thống</h1>
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark"><h2 className="text-xl font-bold text-text-light dark:text-text-dark">Thông tin chung</h2></div>
        <div className="p-6 space-y-6">
          <div><label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Tên phòng tập</label><input className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark" defaultValue="Gym Admin Fitness" /></div>
          <div><label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Địa chỉ</label><input className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark" defaultValue="123 Đường ABC, Quận 1" /></div>
        </div>
        <div className="p-6 bg-background-light dark:bg-background-dark/50 flex justify-end"><button className="h-10 px-4 bg-primary text-text-light font-bold rounded">Lưu thay đổi</button></div>
      </div>
    </div>
  );
};
export default Settings;