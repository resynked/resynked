import { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, Minimize2, Maximize2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ResynkedAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m Resynked AI, your assistant. I can help you create invoices, manage customers, and add products. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Simulate AI response - you'll replace this with actual API call
    setTimeout(() => {
      const response = generateResponse(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setIsLoading(false);
    }, 1000);
  };

  const generateResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('invoice') || lowerInput.includes('factuur')) {
      return 'I can help you create an invoice! You can click the "Factuur maken" button in the Invoices section, or I can guide you through the process. What information do you have for the invoice?';
    }

    if (lowerInput.includes('customer') || lowerInput.includes('klant')) {
      return 'To add a new customer, go to the Customers page and click "Klant toevoegen". You\'ll need their name, email, phone number, and address. Would you like me to explain any specific field?';
    }

    if (lowerInput.includes('product') || lowerInput.includes('producten')) {
      return 'You can add products in the Products section. Each product needs a name, description, price, and stock quantity. Need help with product management?';
    }

    return 'I\'m here to help with invoices, customers, and products. Try asking me things like "How do I create an invoice?" or "How do I add a customer?"';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* AI Chat Button */}
      {!isOpen && (
        <button className="ai-chat-button" onClick={() => setIsOpen(true)}>
          <Bot size={24} />
          <span>Resynked AI</span>
        </button>
      )}

      {/* AI Chat Window */}
      {isOpen && (
        <div className={`ai-chat-window ${isMinimized ? 'minimized' : ''}`}>
          <div className="ai-chat-header">
            <div className="ai-chat-header-left">
              <Bot size={20} />
              <span>Resynked AI</span>
            </div>
            <div className="ai-chat-header-actions">
              <button onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="ai-chat-messages">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`ai-message ${message.role === 'user' ? 'ai-message-user' : 'ai-message-assistant'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="ai-message-avatar">
                        <Bot size={16} />
                      </div>
                    )}
                    <div className="ai-message-content">{message.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="ai-message ai-message-assistant">
                    <div className="ai-message-avatar">
                      <Bot size={16} />
                    </div>
                    <div className="ai-message-content">
                      <div className="ai-loading">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="ai-chat-input">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                />
                <button onClick={handleSend} disabled={!input.trim() || isLoading}>
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
