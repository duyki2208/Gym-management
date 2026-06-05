import React, { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

const Settings = () => {
  const [gymName, setGymName] = useState("Gym Admin Fitness");
  const [address, setAddress] = useState("123 Đường ABC, Quận 1");
  const [targetRevenue, setTargetRevenue] = useState(100000000);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Kiểm tra quyền Admin
    try {
      const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
      setIsAdmin(user.role === "admin");
    } catch (e) {
      console.error(e);
    }

    // Tải cấu hình hiện tại
    const loadSettings = async () => {
      try {
        const res = await settingsService.get();
        if (res && res.success && res.data) {
          setGymName(res.data.gymName || "Gym Admin Fitness");
          setAddress(res.data.address || "123 Đường ABC, Quận 1");
          setTargetRevenue(res.data.targetRevenue || 100000000);
        }
      } catch (error) {
        console.error("Lỗi tải cấu hình:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền thay đổi cài đặt hệ thống!");
      return;
    }

    if (!gymName.trim()) {
      toast.error("Tên phòng tập không được để trống!");
      return;
    }

    try {
      const res = await settingsService.update({
        gymName,
        address,
        targetRevenue: Number(targetRevenue)
      });
      if (res && res.success) {
        toast.success("Đã lưu thay đổi cài đặt thành công!");
      }
    } catch (error) {
      toast.error(error.message || "Lỗi khi lưu cài đặt");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-light dark:text-text-dark">Đang tải cấu hình hệ thống...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-text-light dark:text-text-dark text-3xl font-bold">Cài đặt Hệ thống</h1>
      
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark">Thông tin chung & Chỉ tiêu doanh thu</h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Tên phòng tập</label>
            <input 
              className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark" 
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Địa chỉ</label>
            <input 
              className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">Chỉ tiêu doanh thu tháng (VNĐ)</label>
            <input 
              type="number"
              className="w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark" 
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(e.target.value)}
              disabled={!isAdmin}
            />
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">Mục tiêu doanh thu hàng tháng được sử dụng để hiển thị tỷ lệ % hoàn thành trên trang Tổng quan.</p>
          </div>
        </div>
        {isAdmin && (
          <div className="p-6 bg-background-light dark:bg-background-dark/50 flex justify-end">
            <button 
              onClick={handleSave}
              className="h-10 px-6 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Lưu thay đổi
            </button>
          </div>
        )}
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
                <input type="checkbox" className="sr-only peer" defaultChecked disabled={!isAdmin} />
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