import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './pages/Layout';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Customers from './pages/Customers';
import EmailTemplates from './pages/EmailTemplates';
import Enquiries from './pages/Enquiries';
import ReportingSettings from './pages/ReportingSettings';
import TemplateEditor from './pages/TemplateEditor';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/templates" element={<EmailTemplates />} />
            <Route path="/templates/:id" element={<TemplateEditor />} />
            <Route path="/enquiries" element={<Enquiries />} />
            <Route path="/reporting" element={<ReportingSettings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
