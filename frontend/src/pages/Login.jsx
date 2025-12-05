import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden font-display">
      <div className="layout-container flex h-full grow flex-col">
        <div className="flex flex-1 w-full">
          <div className="flex flex-col lg:flex-row w-full min-h-screen">
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 order-2 lg:order-1">
              <div className="layout-content-container flex flex-col max-w-md w-full flex-1">
                <div className="flex flex-col gap-2 mb-8">
                  <h1 className="text-[#0d1b14] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">Đăng Nhập Hệ Thống</h1>
                  <p className="text-primary/70 dark:text-primary/80 text-base font-normal leading-normal">Hệ thống Quản lý Phòng Gym</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <label className="flex flex-col w-full flex-1">
                      <p className="text-[#0d1b14] dark:text-gray-300 text-base font-medium leading-normal pb-2">Tên đăng nhập</p>
                      <div className="flex w-full flex-1 items-stretch rounded-lg">
                        <input 
                          className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d1b14] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-700/50 bg-white dark:bg-[#102219] focus:border-primary h-14 placeholder:text-gray-500 p-[15px] rounded-r-none border-r-0 pr-2 text-base font-normal leading-normal" 
                          placeholder="admin" 
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                        <div className="text-gray-400 flex border border-gray-700/50 bg-gray-50 dark:bg-[#102219] items-center justify-center pr-[15px] rounded-r-lg border-l-0">
                          <span className="material-symbols-outlined">person</span>
                        </div>
                      </div>
                    </label>

                    <label className="flex flex-col w-full flex-1">
                      <p className="text-[#0d1b14] dark:text-gray-300 text-base font-medium leading-normal pb-2">Mật khẩu</p>
                      <div className="flex w-full flex-1 items-stretch rounded-lg">
                        <input 
                          className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d1b14] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-700/50 bg-white dark:bg-[#102219] focus:border-primary h-14 placeholder:text-gray-500 p-[15px] rounded-r-none border-r-0 pr-2 text-base font-normal leading-normal" 
                          placeholder="••••••" 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <div className="text-gray-400 flex border border-gray-700/50 bg-gray-50 dark:bg-[#102219] items-center justify-center pr-[15px] rounded-r-lg border-l-0">
                          <span className="material-symbols-outlined">lock</span>
                        </div>
                      </div>
                    </label>
                  </div>

                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center justify-center w-full bg-primary text-background-dark font-bold text-lg h-14 rounded-lg hover:bg-primary/90 transition-colors duration-300 disabled:opacity-70"
                  >
                    {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                  </button>
                </form>
                
                <div className="mt-auto pt-8 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-600">Demo: admin / 123</p>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-1/2 min-h-[300px] lg:min-h-screen order-1 lg:order-2">
              <div 
                className="w-full h-full bg-center bg-no-repeat bg-cover" 
                style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")' }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;