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
      text: `Welcome, Delegate Sarah Jones. I have initiated the ${mode === AttendanceMode.VIRTUAL ? 'Virtual' : 'On-site'} protocol. How may I assist you with your schedule today?`,
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
  const accentColor = isVirtual ? 'cyan' : 'purple';
  const glowColor = isVirtual ? 'rgba(34,211,238,0.2)' : 'rgba(168,85,247,0.2)';

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Chat Header */}
      <div className={`p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-t-3xl`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isVirtual ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-sm tracking-wide">AI Assistant</h3>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isVirtual ? 'bg-cyan-400' : 'bg-purple-400'} animate-pulse`}></span>
              Online
            </span>
          </div>
        </div>
        <button 
          onClick={onReset}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="Change Mode"
        >
          <Minimize2 size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl backdrop-blur-sm border border-white/5 shadow-sm ${
              msg.role === 'user' 
                ? `bg-white/10 text-white rounded-br-sm`
                : `bg-black/40 text-slate-200 rounded-bl-sm border-l-4 ${isVirtual ? 'border-l-cyan-500' : 'border-l-purple-500'}`
            }`}>
               <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase tracking-wider font-bold">
                  {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                  {msg.role === 'user' ? 'Delegate Sarah' : 'System'}
               </div>
               <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-black/40 p-4 rounded-2xl rounded-bl-sm border border-white/5 flex items-center gap-3">
                <Loader2 className={`animate-spin ${isVirtual ? 'text-cyan-400' : 'text-purple-400'}`} size={16} />
                <span className="text-xs text-slate-400 font-display animate-pulse">Processing...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/5 backdrop-blur-xl border-t border-white/10 rounded-b-3xl">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Query the system..."
            className={`w-full bg-black/30 text-white text-sm placeholder-slate-500 rounded-xl py-3 pl-4 pr-12 border border-white/10 focus:outline-none focus:border-opacity-50 transition-all ${
               isVirtual ? 'focus:border-cyan-400' : 'focus:border-purple-500'
            }`}
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`absolute right-2 p-2 rounded-lg transition-all ${
              !inputValue.trim() 
                ? 'text-slate-600' 
                : isVirtual 
                  ? 'bg-cyan-500 text-black hover:bg-cyan-400' 
                  : 'bg-purple-500 text-white hover:bg-purple-400'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
