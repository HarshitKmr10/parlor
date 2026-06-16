import React from 'react';

// Standalone shell for the meeting-joiner dashboard. Deliberately does NOT
// reuse the (admin) layout — the dashboard runs under its own auth domain
// and shouldn't load the admin sidebar / org-config bootstrap that the rest
// of the app depends on.
export default function MeetingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased transition-colors dark:bg-slate-950 dark:text-slate-100">
      {children}
    </div>
  );
}
