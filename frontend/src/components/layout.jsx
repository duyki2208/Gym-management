import React from 'react';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';

// Inner wrapper cần dùng useSidebar hook
const LayoutInner = ({ children }) => {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-display text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Sidebar cố định bên trái */}
      <Sidebar />

      {/* Vùng nội dung — dịch chuyển theo sidebar */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ marginLeft: isCollapsed ? '64px' : '256px' }}
      >
        {/* Sticky Header */}
        <Header />

        {/* Main content scroll độc lập */}
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900 px-6 pt-3 pb-6 lg:px-8 lg:pt-4 lg:pb-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Layout wrapper bọc SidebarProvider
const Layout = ({ children }) => {
  return (
    <SidebarProvider>
      <LayoutInner>{children}</LayoutInner>
    </SidebarProvider>
  );
};

export default Layout;