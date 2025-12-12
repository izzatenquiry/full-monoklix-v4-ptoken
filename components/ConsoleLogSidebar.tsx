
import React, { useState, useEffect, useRef } from 'react';
import eventBus from '../services/eventBus';
import { XIcon, TrashIcon, TerminalIcon } from './Icons';
import { getTranslations } from '../services/translations';

interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
}

interface ConsoleLogSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConsoleLogSidebar: React.FC<ConsoleLogSidebarProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const T = getTranslations().consoleLogSidebar;

  useEffect(() => {
    const handleLog = (data: LogEntry) => {
      // Append new logs to the end, and keep max 200 logs by slicing from the end
      setLogs(prevLogs => [...prevLogs, data].slice(-200));
    };

    eventBus.on('consoleLog', handleLog);

    return () => {
      eventBus.remove('consoleLog', handleLog);
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when new logs are added
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLevelClasses = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warn':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'debug':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default: // 'log'
        return 'bg-white/5 border-white/5 text-neutral-300';
    }
  };

  return (
    <>
      {/* Overlay for mobile - z-index increased to be above nav */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>
      
      {/* Sidebar - z-index increased to 60 to overlap MobileDock (z-50) */}
      <aside
        className={`fixed inset-y-4 right-4 z-[60] w-80 lg:w-96
                   bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl
                   flex flex-col overflow-hidden transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
                   ${isOpen ? 'translate-x-0' : 'translate-x-[120%]'}
                   `}
      >
        <div className="w-full h-full flex flex-col p-4 relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0 p-4 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>
                
                <h2 className="text-sm font-bold flex items-center gap-2 text-white uppercase tracking-wider relative z-10">
                    <TerminalIcon className="w-4 h-4 text-brand-start" />
                    {T.title}
                </h2>
                
                <div className="flex items-center gap-2 relative z-10">
                    <button 
                        onClick={clearLogs} 
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                        aria-label={T.clearLogs} 
                        title={T.clearLogs}
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                        aria-label={T.closeConsole}
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            <div ref={logContainerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-neutral-500 italic">
                        <p>{T.placeholder}</p>
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`p-3 rounded-xl border text-[10px] sm:text-xs font-mono break-words ${getLevelClasses(log.level)}`}>
                            <div className="flex justify-between items-center text-white/40 mb-1">
                                <span className="font-bold uppercase tracking-wider">{log.level}</span>
                                <span>{log.timestamp.toLocaleTimeString()}</span>
                            </div>
                            <pre className="whitespace-pre-wrap font-medium">{log.message}</pre>
                        </div>
                    ))
                )}
            </div>
        </div>
      </aside>
    </>
  );
};

export default ConsoleLogSidebar;
