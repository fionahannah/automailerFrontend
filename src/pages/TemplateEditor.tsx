import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GjsEditor from '@grapesjs/react';
import grapesjs, { type Editor as GjsEditorType } from 'grapesjs';
import newsletterPresetModule from 'grapesjs-preset-newsletter';

const newsletterPreset = (newsletterPresetModule as any).default || newsletterPresetModule;

// Plugin: override the newsletter preset's 'cell' type to extend 'text',
// which enables the Rich Text Editor on double-click.
function editablePlugin(editor: GjsEditorType) {
  const { Components } = editor;

  Components.addType('cell', {
    extend: 'text',
    isComponent: (el: HTMLElement) => el.tagName === 'TD' || el.tagName === 'TH',
    model: {
      defaults: {
        tagName: 'td',
        draggable: false,
        droppable: true,
        editable: true,
      },
    },
  });
}
import 'grapesjs/dist/css/grapes.min.css';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { renderTemplate, customerToVars, availableVars, sampleCustomer, type EmailTemplate } from '../templateUtils';
import './TemplateEditor.css';

type EditorMode = 'visual' | 'code';

const sampleVars = customerToVars(sampleCustomer);

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
  const [mode, setMode] = useState<EditorMode>('visual');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const gjsRef = useRef<GjsEditorType | null>(null);
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
      } else {
        showToast('Failed to load template', 'error');
      }
      setLoading(false);
    })();
  }, [id, isNew, user]);

  const getHtmlFromGjs = (): string => {
    if (!gjsRef.current) return bodyHtml;
    const editor = gjsRef.current;
    const html = editor.getHtml();
    const css = editor.getCss();
    if (css) {
      return `<style>${css}</style>${html}`;
    }
    return html;
  };

  const switchMode = (newMode: EditorMode) => {
    if (mode === 'visual' && gjsRef.current) {
      setBodyHtml(getHtmlFromGjs());
    }
    setMode(newMode);
  };

  const insertVariable = (v: string) => {
    const tag = `{{${v}}}`;
    if (mode === 'visual' && gjsRef.current) {
      const editor = gjsRef.current;
      const rte = editor.RichTextEditor;
      // If actively editing text inside a component, insert at cursor
      if (rte.globalRte && rte.globalRte.el) {
        rte.globalRte.insertHTML(tag);
      } else {
        // Not in text editing mode — select a text component first
        const selected = editor.getSelected();
        if (selected) {
          const currentContent = selected.get('content') || '';
          selected.set('content', currentContent + tag);
        }
      }
    } else if (mode === 'code' && htmlTextareaRef.current) {
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
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!user) return;

    const currentHtml = mode === 'visual' ? getHtmlFromGjs() : bodyHtml;

    setSaving(true);
    const payload = {
      templateName,
      bodyText: bodyText || '',
      bodyHtml: currentHtml || '',
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

  const handleEditorReady = (editor: GjsEditorType) => {
    gjsRef.current = editor;

    editor.on('update', () => {
      const html = getHtmlFromGjs();
      setBodyHtml(html);
    });
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

      <div className="te-variable-bar">
        <span className="hint-label">Insert variables:</span>
        {availableVars.map(v => (
          <code
            key={v}
            className="var-chip"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertVariable(v)}
          >
            {`{{${v}}}`}
          </code>
        ))}
      </div>

      <div className="te-main">
        <div className="te-editor-pane">
          {mode === 'visual' ? (
            <GjsEditor
              className="te-gjs-editor"
              grapesjs={grapesjs}
              plugins={[newsletterPreset, editablePlugin]}
              onReady={handleEditorReady}
              options={{
                height: '100%',
                storageManager: false,
                undoManager: { trackSelection: false },
                components: bodyHtml || '<p>Start editing your email template...</p>',
                style: '',
              }}
            />
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
