import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <ChatPage />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/chat" replace />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
