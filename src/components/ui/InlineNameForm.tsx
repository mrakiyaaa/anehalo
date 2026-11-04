import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import type { RepositoryResult } from '@/features/storage/repository-result';

interface InlineNameFormProps {
  label: string;
  initialValue?: string;
  onSubmit: (name: string) => Promise<RepositoryResult<unknown>>;
  onCancel: () => void;
}

export function InlineNameForm({
  label,
  initialValue = '',
  onSubmit,
  onCancel,
}: InlineNameFormProps) {
  const [name, setName] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submitName() {
    if (isSubmitting || !name.trim()) return;
    setIsSubmitting(true);
    const result = await onSubmit(name);
    setIsSubmitting(false);
    if (!result.ok) setError(result.error.message);
  }
  return (
    <form
      className="inline-name-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submitName();
      }}
    >
      <div className="inline-name-fields">
        <input
          autoFocus
          aria-label={label}
          placeholder={label}
          value={name}
          disabled={isSubmitting}
          maxLength={120}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !isSubmitting) {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          className="small-icon-button"
          aria-label="Save name"
          disabled={isSubmitting || !name.trim()}
        >
          <Icon name="check" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="small-icon-button"
          aria-label="Cancel rename"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          <Icon name="close" />
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
