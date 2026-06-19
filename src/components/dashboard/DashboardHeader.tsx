"use client";

import Link from "next/link";

type DashboardHeaderProps = {
  activeTab: "performers" | "career-tracker";
  userEmail: string | undefined;
  onSignOut: () => void | Promise<void>;
};

export function DashboardHeader({ activeTab, userEmail, onSignOut }: DashboardHeaderProps) {
  return (
    <header className="dashboard-nav-header">
      <div className="nav-header-container nav-header-container--stacked">
        <div className="nav-header-top">
          <div className="nav-brand">
            Pages<span>101</span>
          </div>
          <div className="nav-user-controls">
            <span className="user-email">{userEmail}</span>
            <button onClick={onSignOut} className="btn-signout">
              Sign Out
            </button>
          </div>
        </div>

        <nav className="dashboard-tab-nav" aria-label="Dashboard sections">
          <Link
            href="/dashboard"
            className={`dashboard-tab-link ${activeTab === "performers" ? "is-active" : ""}`}
          >
            Performers
          </Link>
          <Link
            href="/dashboard/career-tracker"
            className={`dashboard-tab-link ${activeTab === "career-tracker" ? "is-active" : ""}`}
          >
            Career Tracker
          </Link>
        </nav>
      </div>
    </header>
  );
}
