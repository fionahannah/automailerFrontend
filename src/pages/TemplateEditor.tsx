import { useEffect, useState, useRef, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmailEditorModule, { type EditorRef } from 'react-email-editor';

// CJS interop — the default export is wrapped in an object
const EmailEditor = (EmailEditorModule as any).default || EmailEditorModule;
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { renderTemplate, customerToVars, availableVars, sampleCustomer, type EmailTemplate } from '../templateUtils';
import './TemplateEditor.css';

type EditorMode = 'visual' | 'code';

const sampleVars = customerToVars(sampleCustomer);

const mergeTags = availableVars.reduce((acc, v) => {
  acc[v] = {
    name: v,
    value: `{{${v}}}`,
    sample: sampleVars[v] || v,
  };
  return acc;
}, {} as Record<string, { name: string; value: string; sample: string }>);

function PreviewIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="te-preview-iframe"
      title="Email preview"
      sandbox="allow-same-origin"
    />
  );
}

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'new';

  const [templateName, setTemplateName] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [designJson, setDesignJson] = useState<any>(null);
  const [mode, setMode] = useState<EditorMode>('visual');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const editorRef = useRef<EditorRef>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewHtml = renderTemplate(bodyHtml, sampleVars);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isNew || !user) return;
    (async () => {
      const res = await fetch(`${API_URL}/api/emailtemplates/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const t: EmailTemplate = await res.json();
        setTemplateName(t.templateName);
        setBodyText(t.bodyText || '');
        setBodyHtml(t.bodyHtml || '');
        if (t.designJson) {
          setDesignJson(JSON.parse(t.designJson));
        }
      } else {
        showToast('Failed to load template', 'error');
      }
      setLoading(false);
    })();
  }, [id, isNew, user]);

  const exportHtmlFromEditor = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const unlayer = editorRef.current?.editor;
      if (!unlayer) {
        resolve(bodyHtml);
        return;
      }
      unlayer.exportHtml((data) => {
        resolve(data.html);
      });
    });
  }, [bodyHtml]);

  const saveDesignFromEditor = useCallback((): Promise<any> => {
    return new Promise((resolve) => {
      const unlayer = editorRef.current?.editor;
      if (!unlayer) {
        resolve(null);
        return;
      }
      unlayer.saveDesign((design) => {
        resolve(design);
      });
    });
  }, []);

  const switchMode = async (newMode: EditorMode) => {
    if (mode === 'visual') {
      const html = await exportHtmlFromEditor();
      setBodyHtml(html);
    }
    setMode(newMode);
  };

  const handleEditorReady = useCallback(() => {
    const unlayer = editorRef.current?.editor;
    if (!unlayer) return;

    if (designJson) {
      unlayer.loadDesign(designJson);
    }

    // Update preview on changes
    unlayer.addEventListener('design:updated', () => {
      unlayer.exportHtml((data) => {
        setBodyHtml(data.html);
      });
    });
  }, [designJson]);

  const insertVariable = (v: string) => {
    const tag = `{{${v}}}`;
    if (mode === 'code' && htmlTextareaRef.current) {
      const textarea = htmlTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newHtml = bodyHtml.substring(0, start) + tag + bodyHtml.substring(end);
      setBodyHtml(newHtml);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        textarea.focus();
      });
    }
    // In visual mode, Unlayer has its own merge tag UI — no external button needed
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!user) return;

    let currentHtml = bodyHtml;
    let currentDesign = null;

    if (mode === 'visual') {
      currentHtml = await exportHtmlFromEditor();
      currentDesign = await saveDesignFromEditor();
    }

    setSaving(true);
    const payload = {
      templateName,
      bodyText: bodyText || '',
      bodyHtml: currentHtml || '',
      designJson: currentDesign ? JSON.stringify(currentDesign) : null,
    };

    const url = isNew
      ? `${API_URL}/api/emailtemplates`
      : `${API_URL}/api/emailtemplates/${id}`;

    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      showToast('Template saved', 'success');
      if (isNew) {
        const created = await res.json();
        navigate(`/templates/${created.emailTemplateGuid}`, { replace: true });
      }
    } else {
      const errorText = await res.text();
      console.error('Save failed:', res.status, errorText);
      showToast(`Failed to save template: ${res.status}`, 'error');
    }
  };

  if (!user || user.role !== 'Admin') {
    return <div className="template-editor"><h1>Access Denied</h1></div>;
  }

  if (loading) return <div className="template-editor"><p>Loading...</p></div>;

  return (
    <div className="template-editor">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="te-topbar">
        <button className="btn-back" onClick={() => navigate('/templates')}>&larr; Templates</button>
        <input
          className="te-name-input"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="Template name..."
          required
        />
        <div className="te-mode-toggle">
          <button
            className={mode === 'visual' ? 'active' : ''}
            onClick={() => switchMode('visual')}
          >
            Visual
          </button>
          <button
            className={mode === 'code' ? 'active' : ''}
            onClick={() => switchMode('code')}
          >
            Code
          </button>
        </div>
        <button
          className={`btn-preview-toggle ${showPreview ? 'active' : ''}`}
          onClick={() => setShowPreview(p => !p)}
        >
          Preview
        </button>
        <button className="btn-save" onClick={handleSave} disabled={saving || !templateName}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {mode === 'code' && (
        <div className="te-variable-bar">
          <span className="hint-label">Insert variables:</span>
          {availableVars.map(v => (
            <code
              key={v}
              className="var-chip"
              onClick={() => insertVariable(v)}
            >
              {`{{${v}}}`}
            </code>
          ))}
        </div>
      )}

      <div className="te-main">
        <div className="te-editor-pane">
          {mode === 'visual' ? (
            <div className="te-unlayer-wrapper">
              <EmailEditor
                ref={editorRef}
                onReady={handleEditorReady}
                minHeight="100%"
                options={{
                  mergeTags,
                  features: {
                    textEditor: {
                      spellChecker: true,
                    },
                  },
                  appearance: {
                    theme: 'modern_dark',
                  },
                }}
              />
            </div>
          ) : (
            <div className="te-code-body">
              <div className="te-code-field te-code-html">
                <textarea
                  ref={htmlTextareaRef}
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  placeholder="HTML content..."
                />
              </div>
              <div className="te-code-field te-code-text">
                <label>Plain Text Fallback</label>
                <textarea
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  placeholder="Plain text fallback..."
                />
              </div>
            </div>
          )}
        </div>

        {showPreview && (
          <div className="te-preview-pane">
            <div className="te-pane-header">
              <span>Preview</span>
              <span className="te-preview-badge">{sampleCustomer.firstName} {sampleCustomer.lastName}</span>
            </div>
            <div className="te-preview-body">
              {previewHtml ? (
                <PreviewIframe html={previewHtml} />
              ) : (
                <p className="te-preview-empty">No content to preview yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
