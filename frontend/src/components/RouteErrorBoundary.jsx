import React from 'react';
import { useLocation } from 'react-router-dom';

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Route render failed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/50 dark:bg-gray-900">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-500">Không thể hiển thị trang</p>
          <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            Giao diện gặp lỗi khi tải dữ liệu
          </h1>
          <p className="mt-2 break-words text-sm text-gray-500 dark:text-gray-400">
            {this.state.error?.message || 'Đã xảy ra lỗi không xác định.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}

const RouteErrorBoundary = ({ children }) => {
  const location = useLocation();
  return <Boundary key={location.pathname}>{children}</Boundary>;
};

export default RouteErrorBoundary;
