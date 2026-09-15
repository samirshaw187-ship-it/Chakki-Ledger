import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import {
  AuthService,
  AuthProvider,
  useAuth,
  canAccessRoute,
  ROLE_METADATA,
} from './modules/auth';
import { MobileShell } from './components/layout/MobileShell';
import { AdminShell } from './components/layout/AdminShell';
import { MobileHomeView } from './views/MobileHomeView';
import { MobileCustomersView } from './views/MobileCustomersView';
import { MobileAddCustomerView } from './views/MobileAddCustomerView';
import { CustomerProfileView } from './views/CustomerProfileView';
import { CustomerStatementView } from './views/CustomerStatementView';
import { MobileNewTransactionView } from './views/MobileNewTransactionView';
import { MobileTransactionsListView } from './views/MobileTransactionsListView';
import { AdminTransactionsView } from './views/AdminTransactionsView';
import { TransactionDetailView } from './views/TransactionDetailView';
import { PaymentView } from './views/PaymentView';
import { AdminPaymentsView } from './views/AdminPaymentsView';
import { MobileLedgerView } from './views/MobileLedgerView';
import { MobileMoreView } from './views/MobileMoreView';
import { MobileSubmoduleView } from './views/MobileSubmoduleView';
import { ReceiptView } from './views/ReceiptView';
import { InventoryView } from './views/InventoryView';
import { RiceTradingView } from './views/RiceTradingView';
import { WholesalersView } from './views/WholesalersView';
import { RiceProfitView } from './views/RiceProfitView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { AdminReportsView } from './views/AdminReportsView';
import { AdminModuleView } from './views/AdminModuleView';
import { BackupExportView } from './views/BackupExportView';
import { LoginView } from './views/LoginView';
import { TransactionCard } from './components/domain/TransactionCard';
import { AccessDenied } from './components/domain/AccessDenied';
import { dbRepository } from './db/in-memory-db';
import { ArrowLeft } from 'lucide-react';

function MainApp() {
  const {
    user,
    role: activeRole,
    isAuthenticated,
    loginAsRole,
    logout,
    canAccessPath,
  } = useAuth();

  const [currentPath, setCurrentPath] = useState<string>('/app/home');
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(true);

  // Synchronize layout mode if role defaults to desktop (e.g. Admin)
  useEffect(() => {
    if (activeRole === UserRole.ADMIN && currentPath === '/app/home') {
      setIsMobileLayout(false);
      setCurrentPath('/admin/dashboard');
    }
  }, [activeRole]);

  // Synchronize role switch with AuthService and auto-navigate if route is forbidden
  const handleRoleChange = (newRole: UserRole) => {
    loginAsRole(newRole);
    if (!canAccessRoute(currentPath, newRole)) {
      const defaultPath = ROLE_METADATA[newRole]?.defaultPath || '/app/home';
      setCurrentPath(defaultPath);
      if (defaultPath.startsWith('/admin')) {
        setIsMobileLayout(false);
      } else {
        setIsMobileLayout(true);
      }
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    // If navigating to admin route, switch to admin layout automatically
    if (path.startsWith('/admin')) {
      setIsMobileLayout(false);
    } else if (path.startsWith('/app')) {
      setIsMobileLayout(true);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentPath('/login');
  };

  const toggleLayoutMode = () => {
    if (isMobileLayout) {
      setIsMobileLayout(false);
      setCurrentPath('/admin/dashboard');
    } else {
      setIsMobileLayout(true);
      setCurrentPath('/app/home');
    }
  };

  // 1. Unauthenticated or Explicit Login View
  if (!isAuthenticated || currentPath === '/login') {
    return (
      <LoginView
        onLoginSuccess={(loggedRole) => {
          if (loggedRole === UserRole.ADMIN) {
            setIsMobileLayout(false);
            setCurrentPath('/admin/dashboard');
          } else {
            setIsMobileLayout(true);
            setCurrentPath('/app/home');
          }
        }}
      />
    );
  }

  // 2. Authorization Guard: Check if active user role can access the route
  const isRoutePermitted = canAccessPath(currentPath);

  // 3. Mobile Layout Shell (Touch-first for shop counter owner & staff)
  if (isMobileLayout) {
    let mobileContent: React.ReactNode = null;

    if (!isRoutePermitted) {
      mobileContent = (
        <AccessDenied
          activeRole={activeRole}
          onNavigate={handleNavigate}
        />
      );
    } else if (currentPath === '/app/home' || currentPath === '/app') {
      mobileContent = (
        <MobileHomeView
          onNavigate={handleNavigate}
          userName={user?.name}
        />
      );
    } else if (currentPath === '/app/customers') {
      mobileContent = <MobileCustomersView onNavigate={handleNavigate} />;
    } else if (currentPath === '/app/customers/new') {
      mobileContent = <MobileAddCustomerView onNavigate={handleNavigate} />;
    } else if (currentPath.startsWith('/app/customers/') && currentPath.endsWith('/statement')) {
      const parts = currentPath.split('/');
      const customerId = parts[3];
      mobileContent = (
        <CustomerStatementView
          customerId={customerId}
          onNavigate={handleNavigate}
        />
      );
    } else if (currentPath.startsWith('/app/transactions/') && currentPath.endsWith('/receipt')) {
      const transactionId = currentPath.split('/')[3];
      mobileContent = <ReceiptView receiptId={transactionId} onNavigate={handleNavigate} />;
    } else if (currentPath.startsWith('/app/payments/') && currentPath.endsWith('/receipt')) {
      const paymentId = currentPath.split('/')[3];
      mobileContent = <ReceiptView receiptId={paymentId} kind="payment" onNavigate={handleNavigate} />;
    } else if (currentPath.startsWith('/app/customers/')) {
      const customerId = currentPath.replace('/app/customers/', '');
      mobileContent = (
        <CustomerProfileView
          customerId={customerId}
          onNavigate={handleNavigate}
        />
      );
    } else if (currentPath.startsWith('/app/transactions/new')) {
      const urlParams = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : '');
      const custId = urlParams.get('customerId') || undefined;
      mobileContent = (
        <MobileNewTransactionView
          initialCustomerId={custId}
          onNavigate={handleNavigate}
        />
      );
    } else if (currentPath === '/app/transactions') {
      mobileContent = <MobileTransactionsListView onNavigate={handleNavigate} />;
    } else if (currentPath.startsWith('/app/transactions/')) {
      const txId = currentPath.replace('/app/transactions/', '');
      mobileContent = (
        <TransactionDetailView
          transactionId={txId}
          onNavigate={handleNavigate}
        />
      );
    } else if (currentPath === '/app/payments' || currentPath.startsWith('/app/payments/new')) {
      const urlParams = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : '');
      const custId = urlParams.get('customerId') || undefined;
      mobileContent = <PaymentView initialCustomerId={custId} onNavigate={handleNavigate} />;
    } else if (currentPath === '/app/ledger') {
      mobileContent = <MobileLedgerView onNavigate={handleNavigate} />;
    } else if (currentPath === '/app/more') {
      mobileContent = (
        <MobileMoreView
          onNavigate={handleNavigate}
          activeRole={activeRole}
          userName={user?.name}
          userPhone={user?.phone}
          onRoleChange={handleRoleChange}
          onLogout={handleLogout}
        />
      );
    } else if (currentPath.startsWith('/app/rice-trading/profit/')) {
      mobileContent = <RiceProfitView saleId={currentPath.split('/')[4]} onNavigate={handleNavigate} />;
    } else if (currentPath === '/app/rice-trading') {
      mobileContent = <RiceTradingView onNavigate={handleNavigate} />;
    } else if (currentPath === '/app/wholesalers' || currentPath.startsWith('/app/wholesalers/')) {
      mobileContent = <WholesalersView wholesalerId={currentPath.split('/')[3]} onNavigate={handleNavigate} />;
    } else if (currentPath === '/app/reports') {
      mobileContent = <AdminReportsView onNavigate={handleNavigate} compactMode />;
    } else if (
      currentPath === '/app/daily-closing' ||
      currentPath === '/app/settings' ||
      currentPath === '/app/audit-logs'
    ) {
      mobileContent = (
        <MobileSubmoduleView
          path={currentPath}
          onNavigate={handleNavigate}
        />
      );
    } else if (currentPath === '/app/backup') {
      mobileContent = <BackupExportView onNavigate={handleNavigate} compactMode />;
    } else if (currentPath === '/app/inventory') {
      mobileContent = <InventoryView onNavigate={handleNavigate} />;
    } else {
      // Fallback for any other /app path
      mobileContent = (
        <MobileSubmoduleView
          path={currentPath}
          onNavigate={handleNavigate}
        />
      );
    }

    return (
      <MobileShell
        activeRole={activeRole}
        userName={user?.name}
        userPhone={user?.phone}
        onRoleChange={handleRoleChange}
        activePath={currentPath}
        onNavigate={handleNavigate}
        onToggleLayout={toggleLayoutMode}
        onLogout={handleLogout}
      >
        {mobileContent}
      </MobileShell>
    );
  }

  // 4. Desktop Admin Layout Shell (Table & reports first for laptop/desktop)
  let adminContent: React.ReactNode = null;

  if (!isRoutePermitted) {
    adminContent = (
      <AccessDenied
        activeRole={activeRole}
        onNavigate={handleNavigate}
      />
    );
  } else if (currentPath === '/admin/dashboard' || currentPath === '/admin') {
    adminContent = <AdminDashboardView onNavigate={handleNavigate} />;
  } else if (currentPath.startsWith('/app/customers/') && currentPath.endsWith('/statement')) {
    const parts = currentPath.split('/');
    const customerId = parts[3];
    adminContent = (
      <CustomerStatementView
        customerId={customerId}
        onNavigate={handleNavigate}
      />
    );
  } else if (currentPath.startsWith('/app/transactions/') && currentPath.endsWith('/receipt')) {
    const transactionId = currentPath.split('/')[3];
    adminContent = <ReceiptView receiptId={transactionId} onNavigate={handleNavigate} />;
  } else if (currentPath.startsWith('/app/payments/') && currentPath.endsWith('/receipt')) {
    const paymentId = currentPath.split('/')[3];
    adminContent = <ReceiptView receiptId={paymentId} kind="payment" onNavigate={handleNavigate} />;
  } else if (currentPath.startsWith('/app/customers/')) {
    const customerId = currentPath.replace('/app/customers/', '');
    adminContent = (
      <CustomerProfileView
        customerId={customerId}
        onNavigate={handleNavigate}
      />
    );
  } else if (currentPath === '/app/ledger' || currentPath === '/admin/ledger') {
    adminContent = <MobileLedgerView onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/inventory' || currentPath === '/app/inventory') {
    adminContent = <InventoryView onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/reports' || currentPath === '/admin/analytics') {
    adminContent = <AdminReportsView onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/backup' || currentPath === '/admin/export') {
    adminContent = <BackupExportView onNavigate={handleNavigate} />;
  } else if (currentPath.startsWith('/admin/rice-trading/profit/') || currentPath.startsWith('/app/rice-trading/profit/')) {
    adminContent = <RiceProfitView saleId={currentPath.split('/')[4]} onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/rice-trading' || currentPath === '/app/rice-trading') {
    adminContent = <RiceTradingView onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/wholesalers' || currentPath.startsWith('/admin/wholesalers/') || currentPath.startsWith('/app/wholesalers/')) {
    adminContent = <WholesalersView wholesalerId={currentPath.split('/')[3]} onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/transactions' || currentPath === '/app/transactions') {
    adminContent = <AdminTransactionsView onNavigate={handleNavigate} />;
  } else if (currentPath === '/admin/payments' || currentPath === '/app/payments') {
    adminContent = <AdminPaymentsView onNavigate={handleNavigate} />;
  } else if (currentPath.startsWith('/admin/transactions/') || currentPath.startsWith('/app/transactions/')) {
    if (currentPath.includes('/new')) {
      adminContent = <MobileNewTransactionView onNavigate={handleNavigate} />;
    } else {
      const txId = currentPath.split('/')[3] || currentPath.split('/')[2];
      adminContent = <TransactionDetailView transactionId={txId} onNavigate={handleNavigate} />;
    }
  } else {
    adminContent = <AdminModuleView modulePath={currentPath} onNavigate={handleNavigate} />;
  }

  return (
    <AdminShell
      activeRole={activeRole}
      userName={user?.name}
      onRoleChange={handleRoleChange}
      activePath={currentPath}
      onNavigate={handleNavigate}
      onToggleLayout={toggleLayoutMode}
      onLogout={handleLogout}
    >
      {adminContent}
    </AdminShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
