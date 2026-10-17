import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginView from './views/LoginView';
import Navbar from './components/Navbar';
import ManagerDashboard from './views/manager/ManagerDashboard';
import SellerArea from './views/seller/SellerArea';
import CreatorArea from './views/creator/CreatorArea';

export default function App() {
  const { firebaseUser, profile, loading } = useAuth();
  // Ao mudar este número, a área principal é recriada e volta para a aba inicial (Painel).
  const [viewKey, setViewKey] = useState(0);

  if (!firebaseUser) {
    return <LoginView />;
  }

  if (loading || !profile) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar onGoHome={() => setViewKey((k) => k + 1)} />
      <main className="page" key={viewKey}>
        {profile.level === 'manager' && <ManagerDashboard />}
        {profile.level === 'seller' && <SellerArea />}
        {profile.level === 'creator' && <CreatorArea />}
      </main>
    </div>
  );
}