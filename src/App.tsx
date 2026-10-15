import { useAuth } from './contexts/AuthContext';
import LoginView from './views/LoginView';
import Navbar from './components/Navbar';
import ManagerDashboard from './views/manager/ManagerDashboard';
import SellerArea from './views/seller/SellerArea';
import CreatorArea from './views/creator/CreatorArea';

export default function App() {
  const { firebaseUser, profile, loading } = useAuth();

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
      <Navbar />
      <main className="page">
        {profile.level === 'manager' && <ManagerDashboard />}
        {profile.level === 'seller' && <SellerArea />}
        {profile.level === 'creator' && <CreatorArea />}
      </main>
    </div>
  );
}
