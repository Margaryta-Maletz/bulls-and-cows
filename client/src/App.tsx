import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HostPage from './pages/HostPage.tsx';
import JoinPage from './pages/JoinPage.tsx';
import PresentPage from './pages/PresentPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/host" element={<HostPage />} />
        <Route path="/present" element={<PresentPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
