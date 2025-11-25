import { Routes, Route, Navigate } from 'react-router-dom';
import { ClaimUploadPage } from './pages/ClaimUploadPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/claim-upload" element={<ClaimUploadPage />} />
      <Route path="/" element={<Navigate to="/claim-upload" replace />} />
    </Routes>
  );
}

export default App;

