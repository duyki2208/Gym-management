import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dumbbell,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  User,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [facilityKey, setFacilityKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Đảm bảo trang hiển thị ở chế độ Light Mode theo yêu cầu giao diện
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');

    return () => {
      if (wasDark) {
        root.classList.add('dark');
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(facilityKey.trim(), username.trim(), password);

    if (result.success) {
      navigate('/');
      return;
    }

    setError(result.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    setIsLoading(false);
  };

  return (
    <main
      lang="vi"
      className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 font-display overflow-hidden text-gray-900"
    >
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 40px #f9fafb inset !important;
          -webkit-text-fill-color: #111827 !important;
        }
      `}</style>

      {/* Hình nền phòng tập gym hiện đại, sắc nét */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700"
        style={{ backgroundImage: "url('/gym_login_bg.jpg')" }}
        aria-hidden="true"
      />

      {/* Lớp phủ chuyển sắc xanh đậm & hiệu ứng mờ ambient tăng độ sâu và làm nổi bật card đăng nhập */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0b1b13]/85 via-[#0e271a]/75 to-[#08150f]/90 backdrop-blur-[4px]"
        aria-hidden="true"
      />

      {/* Đốm sáng phản chiếu thương hiệu */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] rounded-full bg-primary/20 blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Card đăng nhập chia 2 cột đồng nhất với mẫu thiết kế (nổi bật trên nền hình) */}
      <div className="relative z-10 w-full max-w-[900px] bg-white/95 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Cột trái: Nhận diện thương hiệu Gym Fitness với nền đậm màu hơn, tách biệt rõ rệt với form trắng bên phải */}
        <section className="bg-gradient-to-b from-[#d8f2e4] via-[#e2f5ec] to-[#c8eed8] p-8 sm:p-12 lg:p-14 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-emerald-200/70">
          <div
            className="flex size-20 items-center justify-center rounded-2xl bg-primary text-[#0d1b14] shadow-lg shadow-emerald-800/20 transition-transform duration-300 hover:scale-105"
            aria-hidden="true"
          >
            <Dumbbell size={40} strokeWidth={2.2} />
          </div>

          <h1 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-[#0d1b14]">
            Gym Fitness
          </h1>
        </section>

        {/* Cột phải: Form đăng nhập hệ thống */}
        <section className="bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Đăng nhập hệ thống
            </h2>

          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 animate-slideDown"
            >
              <AlertCircle size={18} className="shrink-0 text-red-500 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Mã cơ sở do quản trị viên cung cấp; không tải danh sách cơ sở công khai. */}
            <div>
              <label
                htmlFor="facilityKey"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Cơ sở
              </label>
              <div className="group flex h-12 items-center rounded-xl border border-gray-200 bg-gray-50/80 transition-all duration-200 focus-within:border-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                <Building2
                  size={18}
                  className="ml-4 shrink-0 text-gray-400 transition-colors group-focus-within:text-emerald-600"
                  aria-hidden="true"
                />
                <input
                  id="facilityKey"
                  name="facilityKey"
                  type="text"
                  autoComplete="organization"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  minLength={3}
                  maxLength={64}
                  pattern="[A-Za-z0-9][A-Za-z0-9-]*"
                  placeholder="Nhập mã cơ sở"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
                  value={facilityKey}
                  onChange={(event) => setFacilityKey(event.target.value)}
                />
              </div>
            </div>

            {/* Tên đăng nhập */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Tên đăng nhập
              </label>
              <div className="group flex h-12 items-center rounded-xl border border-gray-200 bg-gray-50/80 transition-all duration-200 focus-within:border-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                <User
                  size={18}
                  className="ml-4 shrink-0 text-gray-400 transition-colors group-focus-within:text-emerald-600"
                  aria-hidden="true"
                />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  placeholder="Nhập tên đăng nhập"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
            </div>

            {/* Mật khẩu */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Mật khẩu
              </label>
              <div className="group flex h-12 items-center rounded-xl border border-gray-200 bg-gray-50/80 transition-all duration-200 focus-within:border-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                <LockKeyhole
                  size={18}
                  className="ml-4 shrink-0 text-gray-400 transition-colors group-focus-within:text-emerald-600"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="mr-2.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200/60 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-bold text-[#0d1b14] shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={19} className="animate-spin" aria-hidden="true" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>

          {/* Dòng chú thích bảo mật đồng nhất mẫu */}
          <p className="mt-8 text-center text-xs text-gray-400">
            Đồ án tốt nghiệp của duyki
          </p>
        </section>
      </div>
    </main>
  );
};

export default Login;
