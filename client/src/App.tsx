import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import JoinPage from './pages/JoinPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
