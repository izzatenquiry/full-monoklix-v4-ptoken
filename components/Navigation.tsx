
import React from 'react';
import { type View, type User } from '../types';
import { 
    BookOpenIcon, 
    ImageIcon, 
    VideoIcon, 
    FileTextIcon, 
    SettingsIcon, 
    LibraryIcon, 
    GalleryIcon, 
    ShieldCheckIcon,
    LogoutIcon,
    MenuIcon,
    XIcon,
    LogoIcon,
    UserIcon
} from './Icons';
import { getTranslations } from '../services/translations';

interface NavigationProps {
  activeView: View;
  setActiveView: (view: View) => void;
  currentUser: User;
  onLogout: () => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
}

const MAIN_NAV_ITEMS = [
  { id: 'home', icon: BookOpenIcon, label: 'Home' },
  { id: 'ai-text-suite', icon: FileTextIcon, label: 'Text' },
  { id: 'ai-image-suite', icon: ImageIcon, label: 'Image' },
  { id: 'ai-video-suite', icon: VideoIcon, label: 'Video' },
  { id: 'gallery', icon: GalleryIcon, label: 'Gallery' },
];

const SECONDARY_NAV_ITEMS = [
    { id: 'ai-prompt-library-suite', icon: LibraryIcon, label: 'Library' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];

const Navigation: React.FC<NavigationProps> = ({ 
    activeView, 
    setActiveView, 
    currentUser, 
    onLogout,
    isMenuOpen,
    setIsMenuOpen 
}) => {
  const T = getTranslations().sidebar;

  // --- 2100 MOBILE FLOATING DOCK ---
  const MobileDock = () => (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
      <div className="nav-capsule !bg-[#0a0a0a] rounded-full px-2 h-[4.5rem] flex items-center justify-between relative overflow-hidden border border-white/10 shadow-2xl">
        {/* Subtle background glow inside dock */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50 blur-sm"></div>

        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`relative z-10 flex flex-col items-center justify-center w-full h-full transition-all duration-300 group ${
                isActive ? '-translate-y-2' : ''
              }`}
            >
              <div className={`p-2.5 rounded-full transition-all duration-300 ${
                  isActive 
                  ? 'bg-gradient-to-br from-brand-start to-brand-end text-white shadow-[0_0_15px_rgba(74,108,247,0.5)] scale-110' 
                  : 'text-neutral-400 group-hover:text-white'
              }`}>
                 <item.icon className="w-5 h-5" />
              </div>
              {isActive && (
                  <span className="absolute -bottom-3 text-[10px] font-bold text-white tracking-wide animate-zoomIn opacity-90">{item.label}</span>
              )}
            </button>
          );
        })}
        
        {/* Menu Trigger */}
        <button
            onClick={() => setIsMenuOpen(true)}
            className="relative z-10 flex flex-col items-center justify-center w-full h-full text-neutral-400"
        >
            <div className="p-2.5 rounded-full bg-white/5 border border-white/5">
                <MenuIcon className="w-5 h-5" />
            </div>
        </button>
      </div>
    </div>
  );

  // --- 2100 HOLO DRAWER ---
  const HoloDrawer = () => (
    <>
        <div 
            className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] transition-opacity duration-500 ${
                isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`} 
            onClick={() => setIsMenuOpen(false)}
        />
        
        <div className={`fixed inset-y-4 right-4 w-72 nav-capsule rounded-3xl z-[70] transform transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) flex flex-col overflow-hidden border border-white/10 ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-[120%]'
        }`}>
            {/* Drawer Header */}
            <div className="p-6 border-b border-white/5 relative">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>
                <div className="flex justify-between items-center">
                    <LogoIcon className="w-28 text-white filter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="text-[10px] font-bold text-brand-start uppercase tracking-[0.2em] mb-3 px-2">System Modules</div>
                {SECONDARY_NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => { setActiveView(item.id as View); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                            activeView === item.id 
                            ? 'bg-brand-start/20 text-brand-start border border-brand-start/50 shadow-[0_0_10px_rgba(74,108,247,0.2)]' 
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </button>
                ))}

                {currentUser.role === 'admin' && (
                    <button
                        onClick={() => { setActiveView('admin-suite'); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                            activeView === 'admin-suite' 
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' 
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <ShieldCheckIcon className="w-5 h-5" />
                        Admin Protocol
                    </button>
                )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-black/20 backdrop-blur-md border-t border-white/5">
                <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-start to-brand-end p-[1px]">
                        <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                             {currentUser.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-5 h-5 text-neutral-400" />
                            )}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{currentUser.fullName || currentUser.username}</p>
                        <p className="text-[10px] text-brand-start uppercase tracking-wider">{currentUser.status}</p>
                    </div>
                </div>
                <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-semibold text-xs uppercase tracking-wider hover:bg-red-500/20 transition-all"
                >
                    <LogoutIcon className="w-4 h-4" />
                    Disconnect
                </button>
            </div>
        </div>
    </>
  );

  // --- 2100 DESKTOP RAIL ---
  const DesktopRail = () => (
    <div className="hidden md:flex flex-col w-20 lg:w-24 fixed left-4 top-4 bottom-4 nav-capsule rounded-3xl z-40 transition-all duration-300 items-center py-6">
        <div className="mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-start to-brand-end rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(74,108,247,0.5)]">
                <span className="font-black text-white text-lg">M</span>
            </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 w-full px-2">
            {MAIN_NAV_ITEMS.map((item) => {
                 const isActive = activeView === item.id;
                 return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id as View)}
                        className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 ${
                            isActive 
                            ? 'bg-brand-start text-white shadow-[0_0_20px_rgba(74,108,247,0.4)]' 
                            : 'text-neutral-500 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <item.icon className="w-6 h-6" />
                        
                        {/* Hover Tooltip */}
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50 backdrop-blur-md">
                            {item.label}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-neutral-900 border-l border-b border-white/10 transform rotate-45"></div>
                        </div>
                    </button>
                 );
            })}

            <div className="h-px w-1/2 bg-white/10 mx-auto my-2"></div>
            
            {SECONDARY_NAV_ITEMS.map((item) => {
                 const isActive = activeView === item.id;
                 return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id as View)}
                        className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 ${
                            isActive 
                            ? 'bg-white/20 text-white' 
                            : 'text-neutral-500 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <item.icon className="w-5 h-5" />
                         <div className="absolute left-full ml-4 px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-xs font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50 backdrop-blur-md">
                            {item.label}
                        </div>
                    </button>
                 );
            })}
        </div>

        <div className="mt-auto">
            <button 
                onClick={onLogout} 
                className="p-3 rounded-2xl text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="Logout"
            >
                <LogoutIcon className="w-5 h-5" />
            </button>
        </div>
    </div>
  );

  return (
    <>
      <DesktopRail />
      <MobileDock />
      <HoloDrawer />
    </>
  );
};

export default Navigation;
