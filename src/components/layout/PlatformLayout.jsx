import React from 'react';
import { Outlet } from 'react-router-dom';
import SubPageNav from './SubPageNav';

export default function PlatformLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <SubPageNav />
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}