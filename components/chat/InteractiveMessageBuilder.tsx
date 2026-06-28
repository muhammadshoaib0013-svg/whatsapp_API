'use client';

import { useState } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';

interface ButtonConfig {
  id: string;
  title: string;
}

interface InteractiveMessageBuilderProps {
  chatSessionId: string;
  onSend?: () => void;
}

export function InteractiveMessageBuilder({ chatSessionId, onSend }: InteractiveMessageBuilderProps) {
  const [type, setType] = useState<'button' | 'list'>('button');
  const [bodyText, setBodyText] = useState('');
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addButton = () => {
    if (buttons.length >= 3) {
      setError('Maximum 3 buttons allowed');
      return;
    }
    setButtons([...buttons, { id: `btn-${Date.now()}`, title: '' }]);
    setError(null);
  };

  const removeButton = (id: string) => {
    setButtons(buttons.filter(btn => btn.id !== id));
    setError(null);
  };

  const updateButtonTitle = (id: string, title: string) => {
    if (title.length > 20) {
      setError('Button title must be at most 20 characters');
      return;
    }
    setError(null);
    setButtons(buttons.map(btn => 
      btn.id === id ? { ...btn, title } : btn
    ));
  };

  const handleSend = async () => {
    if (!bodyText.trim()) {
      setError('Body text is required');
      return;
    }

    if (type === 'button' && buttons.length === 0) {
      setError('At least one button is required for button type');
      return;
    }

    if (buttons.some(btn => !btn.title.trim())) {
      setError('All buttons must have a title');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/whatsapp/messages/send-interactive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatSessionId,
          type,
          bodyText,
          buttonsJson: {
            buttons: type === 'button' ? buttons : undefined,
            button: type === 'list' ? 'Select an option' : undefined,
            sections: type === 'list' ? [] : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send interactive message');
      }

      // Reset form
      setBodyText('');
      setButtons([]);
      
      if (onSend) {
        onSend();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <h3 className="font-semibold text-lg">Interactive Message Builder</h3>
      
      {/* Type Selection */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('button')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            type === 'button'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Buttons
        </button>
        <button
          type="button"
          onClick={() => setType('list')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            type === 'list'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          List
        </button>
      </div>

      {/* Body Text */}
      <div className="space-y-2">
        <label htmlFor="bodyText" className="text-sm font-medium text-gray-700">
          Body Text
        </label>
        <textarea
          id="bodyText"
          placeholder="Enter your message text..."
          value={bodyText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBodyText(e.target.value)}
          maxLength={1024}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500">
          {bodyText.length}/1024 characters
        </p>
      </div>

      {/* Buttons Section */}
      {type === 'button' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Quick Reply Buttons</label>
            <button
              type="button"
              onClick={addButton}
              disabled={buttons.length >= 3}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Button
            </button>
          </div>
          
          {buttons.length === 0 && (
            <p className="text-sm text-gray-500">
              Add up to 3 buttons (max 20 characters each)
            </p>
          )}

          {buttons.map((button) => (
            <div key={button.id} className="flex gap-2">
              <input
                type="text"
                placeholder="Button title"
                value={button.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateButtonTitle(button.id, e.target.value)}
                maxLength={20}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => removeButton(button.id)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          <p className="text-xs text-gray-500">
            {buttons.length}/3 buttons
          </p>
        </div>
      )}

      {type === 'list' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            List messages require sections with options. This is a simplified view.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={isSending || !bodyText.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSending ? (
          'Sending...'
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send Interactive Message
          </>
        )}
      </button>
    </div>
  );
}
