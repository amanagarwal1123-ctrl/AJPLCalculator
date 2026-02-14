import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import ManagerDashboard from "@/pages/ManagerDashboard";
import SalesExecDashboard from "@/pages/SalesExecDashboard";
import BillPage from "@/pages/BillPage";
import ItemCalculator from "@/pages/ItemCalculator";
import BillPrintView from "@/pages/BillPrintView";
import RateManagement from "@/pages/RateManagement";
import BranchManagement from "@/pages/BranchManagement";
import UserManagement from "@/pages/UserManagement";
import ItemNameManagement from "@/pages/ItemNameManagement";
import Reports from "@/pages/Reports";
import CustomerListPage from "@/pages/CustomerListPage";
import CustomerHistoryPage from "@/pages/CustomerHistoryPage";
import AllBillsPage from "@/pages/AllBillsPage";
import ItemHistoryPage from "@/pages/ItemHistoryPage";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const apiClient = axios.create({ baseURL: API });

export { apiClient };

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      apiClient.get('/auth/me').then(res => {
        setUser(res.data);
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const loginWithToken = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-2xl text-primary">Loading...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  switch (user.role) {
    case 'admin': return <Navigate to="/admin" />;
    case 'manager': return <Navigate to="/manager" />;
    case 'executive': return <Navigate to="/sales" />;
    default: return <Navigate to="/login" />;
  }
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin/rates" element={<PrivateRoute roles={['admin']}><RateManagement /></PrivateRoute>} />
            <Route path="/admin/branches" element={<PrivateRoute roles={['admin']}><BranchManagement /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><UserManagement /></PrivateRoute>} />
            <Route path="/admin/items" element={<PrivateRoute roles={['admin']}><ItemNameManagement /></PrivateRoute>} />
            <Route path="/admin/items/:itemName" element={<PrivateRoute roles={['admin']}><ItemHistoryPage /></PrivateRoute>} />
            <Route path="/admin/customers" element={<PrivateRoute roles={['admin']}><CustomerListPage /></PrivateRoute>} />
            <Route path="/admin/customers/:customerId" element={<PrivateRoute roles={['admin']}><CustomerHistoryPage /></PrivateRoute>} />
            <Route path="/admin/bills" element={<PrivateRoute roles={['admin']}><AllBillsPage /></PrivateRoute>} />
            <Route path="/admin/reports" element={<PrivateRoute roles={['admin', 'manager']}><Reports /></PrivateRoute>} />
            <Route path="/manager" element={<PrivateRoute roles={['manager']}><ManagerDashboard /></PrivateRoute>} />
            <Route path="/sales" element={<PrivateRoute roles={['executive']}><SalesExecDashboard /></PrivateRoute>} />
            <Route path="/bill/:billId" element={<PrivateRoute><BillPage /></PrivateRoute>} />
            <Route path="/bill/:billId/add-item" element={<PrivateRoute><ItemCalculator /></PrivateRoute>} />
            <Route path="/bill/:billId/edit-item/:itemIndex" element={<PrivateRoute><ItemCalculator /></PrivateRoute>} />
            <Route path="/bill/:billId/print" element={<PrivateRoute><BillPrintView /></PrivateRoute>} />
          </Routes>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
