import React from 'react';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';

// Inner wrapper cần dùng useSidebar hook
const LayoutInner = ({ children }) => {
  const { isCompact } = useSidebar();

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark overflow-hidden">
      {/* Sidebar cố định bên trái */}
      <Sidebar />

      {/* Vùng nội dung — dịch chuyển theo sidebar */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ marginLeft: isCompact ? '64px' : '256px' }}
      >
        {/* Sticky Header */}
        <Header />

        {/* Main content scroll độc lập */}
        <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark px-3 pt-4 pb-5 sm:px-5 lg:px-7 lg:pt-6 lg:pb-8 custom-scrollbar">
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
