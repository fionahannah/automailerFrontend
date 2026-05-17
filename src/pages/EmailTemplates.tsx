import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { renderTemplate, customerToVars, sampleCustomer, type EmailTemplate } from '../templateUtils';
import './EmailTemplates.css';

const sampleVars = customerToVars(sampleCustomer);

export default function EmailTemplates() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTemplates = async () => {
    const res = await fetch(`${API_URL}/api/emailtemplates`, {
      headers: { Authorization: `Bearer ${user!.token}` },
    });
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const deleteTemplate = async (guid: string) => {
    if (!confirm('Delete this template?')) return;
    const res = await fetch(`${API_URL}/api/emailtemplates/${guid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user!.token}` },
    });
    if (res.ok) {
      showToast('Template deleted', 'success');
    } else {
      showToast('Failed to delete template', 'error');
    }
    fetchTemplates();
  };

  const togglePreview = (guid: string) => {
    if (preview?.emailTemplateGuid === guid) {
      setPreview(null);
    } else {
      const t = templates.find(t => t.emailTemplateGuid === guid);
      if (t) setPreview(t);
    }
  };

  if (!user || user.role !== 'Admin') {
    return <div className="templates"><h1>Access Denied</h1><p>Admin role required.</p></div>;
  }

  if (loading) return <div className="templates"><p>Loading...</p></div>;

  return (
    <div className="templates">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      <div className="templates-header">
        <h1>Email Templates</h1>
        <button className="btn-add" onClick={() => navigate('/templates/new')}>
          + Add Template
        </button>
      </div>

      <div className="templates-body">
        <div className="templates-list">
          <table>
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Has Text</th>
                <th>Has HTML</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.emailTemplateGuid}>
                  <td>{t.templateName}</td>
                  <td>{t.bodyText ? 'Yes' : 'No'}</td>
                  <td>{t.bodyHtml ? 'Yes' : 'No'}</td>
                  <td className="actions">
                    <button className="btn-edit" onClick={() => navigate(`/templates/${t.emailTemplateGuid}`)}>Edit</button>
                    <button className="btn-preview" onClick={() => togglePreview(t.emailTemplateGuid)}>Preview</button>
                    <button className="btn-delete" onClick={() => deleteTemplate(t.emailTemplateGuid)}>Delete</button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={4} className="empty">No templates yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="preview-overlay" onClick={() => setPreview(null)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <h3>Preview: {preview.templateName}</h3>
              <button className="btn-cancel" onClick={() => setPreview(null)}>Close</button>
            </div>
            <div className="preview-body">
              {preview.bodyHtml ? (
                <div className="preview-content" dangerouslySetInnerHTML={{ __html: renderTemplate(preview.bodyHtml, sampleVars) }} />
              ) : preview.bodyText ? (
                <pre className="preview-text">{renderTemplate(preview.bodyText, sampleVars)}</pre>
              ) : (
                <p className="empty">No content to preview.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
