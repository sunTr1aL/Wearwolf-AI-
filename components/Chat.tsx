
import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage?: (text: string) => void;
  inputEnabled?: boolean;
  placeholder?: string;
  sendButtonText?: string;
}

const Chat: React.FC<ChatProps> = ({ 
  messages, 
  onSendMessage, 
  inputEnabled = false,
  placeholder = "Type a message...",
  sendButtonText = "Send"
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-700 font-serif text-slate-300">
        <span>Game Log</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isSystem ? 'items-center' : 'items-start'}`}>
            {msg.isSystem ? (
              <span className="text-xs text-yellow-500/80 bg-yellow-900/10 px-2 py-1 rounded border border-yellow-900/20 text-center my-1">
                {msg.content}
              </span>
            ) : (
              <div className="max-w-[90%]">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${
                        msg.isHostChat ? 'text-yellow-400' :
                        msg.senderName === 'You' || msg.senderId === 'player-user' ? 'text-blue-400' : 'text-slate-400'
                    }`}>
                      {msg.senderName}
                    </span>
                    {msg.isDeadChat && <span className="text-[10px] text-slate-500 bg-slate-800 px-1 rounded border border-slate-700">DEAD</span>}
                    {msg.isHostChat && <span className="text-[10px] text-yellow-600 bg-yellow-900/30 px-1 rounded border border-yellow-800">HOST</span>}
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                   msg.isHostChat ? 'bg-yellow-900/20 text-yellow-100 border border-yellow-800/30' :
                   msg.isDeadChat ? 'bg-slate-800 text-slate-400 italic border border-slate-700' :
                   msg.senderName === 'You' || msg.senderId === 'player-user'
                   ? 'bg-blue-600/20 text-blue-100 rounded-tl-none' 
                   : 'bg-slate-700/50 text-slate-200 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      
      {inputEnabled ? (
        <form onSubmit={handleSubmit} className="p-2 bg-slate-900/50 flex gap-2 border-t border-slate-700">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 outline-none"
          />
          <button 
            type="submit" 
            disabled={!inputText.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            {sendButtonText}
          </button>
        </form>
      ) : (
        <div className="p-2 text-center text-xs text-slate-500 bg-slate-900/50 border-t border-slate-700">
          Voice communication active. No text chat allowed.
        </div>
      )}
    </div>
  );
};

export default Chat;