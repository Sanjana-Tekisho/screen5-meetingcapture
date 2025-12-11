import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Minimize2 } from 'lucide-react';
import { AttendanceMode, ChatMessage } from '../types';
import { generateAssistantResponse } from '../services/geminiService';

interface ChatInterfaceProps {
  mode: AttendanceMode;
  onReset: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ mode, onReset }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: `Welcome, Sarah Jones. I have initiated the ${mode === AttendanceMode.VIRTUAL ? 'Virtual' : 'On-site'} protocol. How may I assist you with your schedule today?`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    // Prepare history for API
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    
    const responseText = await generateAssistantResponse(history, userMsg.text, mode);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  const isVirtual = mode === AttendanceMode.VIRTUAL;

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700 bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl">
      {/* Chat Header */}
      <div className={`p-4 border-b border-slate-200 flex items-center justify-between bg-white`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-blue-100 text-blue-600`}>
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm tracking-wide">AI Assistant</h3>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse`}></span>
              Online
            </span>
          </div>
        </div>
        <button 
          onClick={onReset}
          className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
          title="Change Mode"
        >
          <Minimize2 size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? `bg-blue-600 text-white rounded-br-sm`
                : `bg-white text-slate-700 rounded-bl-sm border border-slate-200`
            }`}>
               <div className={`flex items-center gap-2 mb-1 opacity-70 text-[10px] uppercase tracking-wider font-bold ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                  {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                  {msg.role === 'user' ? 'Sarah' : 'System'}
               </div>
               <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white p-4 rounded-2xl rounded-bl-sm border border-slate-200 flex items-center gap-3 shadow-sm">
                <Loader2 className={`animate-spin text-blue-500`} size={16} />
                <span className="text-xs text-slate-500 font-bold animate-pulse">Processing...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Query the system..."
            className={`w-full bg-slate-100 text-slate-900 text-sm placeholder-slate-400 rounded-xl py-3 pl-4 pr-12 border border-slate-200 focus:outline-none focus:ring-2 focus:bg-white transition-all focus:ring-blue-200 focus:border-blue-400`}
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`absolute right-2 p-2 rounded-lg transition-all ${
              !inputValue.trim() 
                ? 'text-slate-400' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};