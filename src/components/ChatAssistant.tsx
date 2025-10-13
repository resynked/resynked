import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.message || errorData.error || `Failed to get response (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        const assistantId = (Date.now() + 1).toString();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '' },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantMessage += chunk;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantMessage } : m
            )
          );
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Sorry, er is een fout opgetreden: ${error.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="welcome-title">Hoe kan ik je helpen?</div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <div className="message-wrapper">
              <div className="message-avatar">
                {message.role === 'user' ? (
                  <div className="avatar-user">U</div>
                ) : (
                  <div className="avatar-assistant">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                        fill="currentColor"
                      />
                      <circle cx="12" cy="12" r="4" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="message-content">
                {message.content.split('\n').map((line, i) => (
                  <div key={i} className="message-line">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-wrapper">
              <div className="message-avatar">
                <div className="avatar-assistant">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                      fill="currentColor"
                    />
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div className="message-content">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stel een vraag..."
            disabled={isLoading}
            className="chat-textarea"
            rows={1}
          />
          <button type="submit" disabled={!input.trim() || isLoading} className="chat-send-btn">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
