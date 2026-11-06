import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { isSafeLink } from '@/features/editor/sanitize-editor-html';

export function LinkForm({ editor, onChoose }: { editor: Editor; onChoose: () => void }) {
  const [url, setUrl] = useState<string>(String(editor.getAttributes('link').href ?? ''));
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="editor-link-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = url.trim();
        const normalized = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
        if (!value || !isSafeLink(normalized)) {
          setError('Enter an http, https, mailto, or tel link.');
          return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
        onChoose();
      }}
    >
      <label htmlFor="editor-link-url">Link URL</label>
      <input
        autoFocus
        id="editor-link-url"
        value={url}
        placeholder="https://example.com"
        onChange={(event) => {
          setUrl(event.target.value);
          setError(null);
        }}
        aria-invalid={error !== null}
      />
      {error && <p role="alert">{error}</p>}
      <div className="editor-link-actions">
        <button
          type="button"
          disabled={!editor.isActive('link')}
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            onChoose();
          }}
        >
          Remove link
        </button>
        <button type="submit">Apply link</button>
      </div>
    </form>
  );
}
