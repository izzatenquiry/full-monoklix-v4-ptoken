
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type User, type AiLogItem, type Language } from '../../types';
import { updateUserProfile, saveUserPersonalAuthToken, assignPersonalTokenAndIncrementUsage } from '../../services/userService';
import {
    CreditCardIcon, CheckCircleIcon, XIcon, EyeIcon, EyeOffIcon, ChatIcon,
    AlertTriangleIcon, DatabaseIcon, TrashIcon, RefreshCwIcon, WhatsAppIcon, InformationCircleIcon, SparklesIcon, VideoIcon, ImageIcon, KeyIcon, ActivityIcon
} from '../Icons';
import Spinner from '../common/Spinner';
import Tabs, { type Tab } from '../common/Tabs';
import { getTranslations } from '../../services/translations';
import { getFormattedCacheStats, clearVideoCache } from '../../services/videoCacheService';
import { runComprehensiveTokenTest, type TokenTestResult } from '../../services/imagenV3Service';
import eventBus from '../../services/eventBus';

// Define the types for the settings view tabs
type SettingsTabId = 'profile' | 'api';

const getTabs = (): Tab<SettingsTabId>[] => {
    const T = getTranslations().settingsView;
    return [
        { id: 'profile', label: T.tabs.profile },
        { id: 'api', label: T.tabs.api },
    ];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface SettingsViewProps {
  currentUser: User;
  tempApiKey: string | null;
  onUserUpdate: (user: User) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  veoTokenRefreshedAt: string | null;
  assignTokenProcess: () => Promise<{ success: boolean; error: string | null; }>;
}

// --- PANELS ---

interface ProfilePanelProps extends Pick<SettingsViewProps, 'currentUser' | 'onUserUpdate'> {
    language: Language;
    setLanguage: (lang: Language) => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ currentUser, onUserUpdate, language, setLanguage }) => {
    const T = getTranslations().settingsView.profile;
    const [fullName, setFullName] = useState(currentUser.fullName || currentUser.username);
    const [email, setEmail] = useState(currentUser.email);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'loading'; message: string }>({ type: 'idle', message: '' });
    const statusTimeoutRef = useRef<number | null>(null);

     useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        };
    }, []);

    const getAccountStatus = (user: User): { text: string; colorClass: string } => {
        switch (user.status) {
            case 'admin': return { text: T.status.admin, colorClass: 'text-green-500' };
            case 'lifetime': return { text: T.status.lifetime, colorClass: 'text-green-500' };
            case 'subscription': return { text: T.status.subscription, colorClass: 'text-green-500' };
            case 'trial': return { text: T.status.trial, colorClass: 'text-yellow-500' };
            case 'inactive': return { text: T.status.inactive, colorClass: 'text-red-500' };
            case 'pending_payment': return { text: T.status.pending, colorClass: 'text-yellow-500' };
            default: return { text: T.status.unknown, colorClass: 'text-neutral-500' };
        }
    };

    const handleSave = async () => {
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        setStatus({ type: 'loading', message: T.saving });
        const result = await updateUserProfile(currentUser.id, { fullName, email });
        if (result.success === false) {
            setStatus({ type: 'error', message: T.fail.replace('{message}', result.message) });
        } else {
            onUserUpdate(result.user);
            setStatus({ type: 'success', message: T.success });
        }
        statusTimeoutRef.current = window.setTimeout(() => setStatus({ type: 'idle', message: '' }), 4000);
    };

    const accountStatus = getAccountStatus(currentUser);
    let expiryInfo = null;
    if (currentUser.status === 'subscription' && currentUser.subscriptionExpiry) {
        const expiryDate = new Date(currentUser.subscriptionExpiry);
        const isExpired = Date.now() > expiryDate.getTime();
        expiryInfo = (
            <span className={isExpired ? 'text-red-500 font-bold' : ''}>
                {T.expiresOn} {expiryDate.toLocaleDateString()} {isExpired && `(${T.expired})`}
            </span>
        );
    }


    return (
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm h-full">
            <h2 className="text-xl font-semibold mb-6">{T.title}</h2>
            <div className="mb-6 p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{T.accountStatus} <span className={`font-bold ${accountStatus.colorClass}`}>{accountStatus.text}</span></p>
                {expiryInfo && <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">{expiryInfo}</p>}
            </div>

            {/* Usage Statistics / Credits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between transition-all hover:border-blue-200 dark:hover:border-blue-900/50">
                    <div>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Images Generated</p>
                        <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{currentUser.totalImage || 0}</p>
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <ImageIcon className="w-5 h-5" />
                    </div>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between transition-all hover:border-purple-200 dark:hover:border-purple-900/50">
                    <div>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Videos Generated</p>
                        <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{currentUser.totalVideo || 0}</p>
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                        <VideoIcon className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">{T.fullName}</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={status.type === 'loading'} className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none transition disabled:opacity-50" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">{T.email}</label>
                    <input type="email" value={email} readOnly disabled className="w-full bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 cursor-not-allowed" />
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleSave} disabled={status.type === 'loading'} className="bg-primary-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-primary-700 transition-colors w-48 flex justify-center disabled:opacity-50">
                        {status.type === 'loading' ? <Spinner /> : T.save}
                    </button>
                    {status.type !== 'idle' && (
                        <div className={`flex items-center gap-3 text-sm ${status.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                            {status.type === 'success' && <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />}
                            {status.type === 'error' && <XIcon className="w-5 h-5 flex-shrink-0" />}
                            <span>{status.message}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CacheManagerPanel: React.FC = () => {
    const T = getTranslations().settingsView.cache;
  const [stats, setStats] = useState<{
    size: string;
    count: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const formattedStats = await getFormattedCacheStats();
      setStats(formattedStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClearCache = async () => {
    if (!confirm(T.confirmClear)) {
      return;
    }

    setIsClearing(true);
    try {
      await clearVideoCache();
      await loadStats();
      alert(T.clearSuccess);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert(T.clearFail);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm h-full">
        <div className="flex items-center gap-3 mb-6">
          <DatabaseIcon className="w-8 h-8 text-primary-500" />
          <div>
            <h2 className="text-xl font-semibold">{T.title}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {T.subtitle}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">{T.storageUsed}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.size}</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">{T.videosCached}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.count}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {T.howItWorks}
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>{T.l1}</li>
                <li>{T.l2}</li>
                <li>{T.l3}</li>
                <li>{T.l4}</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={loadStats} disabled={isLoading} className="flex items-center justify-center gap-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50">
                <RefreshCwIcon className="w-4 h-4" /> {T.refresh}
              </button>
              <button onClick={handleClearCache} disabled={isClearing || stats.count === 0} className="flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isClearing ? (<><Spinner /> {T.clearing}</>) : (<><TrashIcon className="w-4 h-4" /> {T.clear}</>)}
              </button>
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
              <h3 className="font-semibold mb-2">💡 {T.tips}</h3>
              <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                <li>{T.tip1}</li>
                <li>{T.tip2}</li>
                <li>{T.tip3}</li>
                <li>{T.tip4}</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">{T.failLoad}</div>
        )}
      </div>
  );
};

const ClaimTokenModal: React.FC<{
  status: 'searching' | 'success' | 'error';
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}> = ({ status, error, onRetry, onClose }) => {
    const T = getTranslations().claimTokenModal;
    return (
    <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50 p-4 animate-zoomIn" aria-modal="true" role="dialog">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-8 text-center max-w-sm w-full">
        {status === 'searching' && (
            <>
            <Spinner />
            <h2 className="text-xl font-bold mt-4">{T.searchingTitle}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm">
                {T.searchingMessage}
            </p>
            </>
        )}
        {status === 'success' && (
            <>
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold mt-4">{T.successTitle}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm">
                {T.successMessage}
            </p>
            </>
        )}
        {status === 'error' && (
            <>
            <AlertTriangleIcon className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold mt-4">{T.errorTitle}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm">
                {error || T.errorMessageDefault}
            </p>
            <div className="mt-6 flex gap-4">
                <button onClick={onClose} className="w-full bg-neutral-200 dark:bg-neutral-700 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                {T.closeButton}
                </button>
                <button onClick={onRetry} className="w-full bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors">
                {T.retryButton}
                </button>
            </div>
            </>
        )}
        </div>
    </div>
)};

interface ApiIntegrationsPanelProps {
  currentUser: User;
  onUserUpdate: (user: User) => void;
  language: Language;
  veoTokenRefreshedAt: string | null;
  assignTokenProcess: () => Promise<{ success: boolean; error: string | null; }>;
}

const ApiIntegrationsPanel: React.FC<ApiIntegrationsPanelProps> = ({ currentUser, onUserUpdate, language, veoTokenRefreshedAt, assignTokenProcess }) => {
    const T = getTranslations().settingsView.api;
    const commonT_errors = getTranslations().common.errors;

    const [veoTokens, setVeoTokens] = useState<{ token: string; createdAt: string; totalUser?: number }[]>([]);
    
    const [personalAuthToken, setPersonalAuthToken] = useState(currentUser.personalAuthToken || '');
    const [showPersonalToken, setShowPersonalToken] = useState(false);
    const [personalTokenSaveStatus, setPersonalTokenSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    
    const [testStatus, setTestStatus] = useState<'idle' | 'testing'>('idle');
    const [testResults, setTestResults] = useState<TokenTestResult[] | null>(null);

    const [claimStatus, setClaimStatus] = useState<'idle' | 'searching' | 'success' | 'error'>('idle');
    const [claimError, setClaimError] = useState<string | null>(null);

    const [testingToken, setTestingToken] = useState<string | null>(null);
    const [testResultsMap, setTestResultsMap] = useState<Map<string, TokenTestResult[]>>(new Map());
    const [claimingToken, setClaimingToken] = useState<string | null>(null);
    const [tokenStatusMessage, setTokenStatusMessage] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);
    
    const handleTestSharedToken = useCallback(async (token: string) => {
        setTestingToken(token);
        // Run comprehensive test for this token
        const results = await runComprehensiveTokenTest(token);
        setTestResultsMap(prev => new Map(prev).set(token, results));
        setTestingToken(null);
    }, []);

    const handleClaimSharedToken = useCallback(async (token: string) => {
        // REMOVED CONFIRMATION DIALOG FOR FASTER UX
        setClaimingToken(token);
        setTokenStatusMessage({ type: 'loading', message: T.claiming.replace('{token}', token.slice(-6)) });

        // Assign the token using the standard assignment function
        const result = await assignPersonalTokenAndIncrementUsage(currentUser.id, token);

        if (result.success === false) {
            setTokenStatusMessage({ type: 'error', message: result.message || T.claimFail });
        } else {
            onUserUpdate(result.user);
            setTokenStatusMessage({ type: 'success', message: T.claimSuccess });
        }
        
        setClaimingToken(null);
        setTimeout(() => setTokenStatusMessage(null), 5000);
    }, [currentUser.id, onUserUpdate, T]);


    const handleClaimNewToken = useCallback(async () => {
        setClaimStatus('searching');
        setClaimError(null);

        const clearResult = await saveUserPersonalAuthToken(currentUser.id, null);
        
        if (clearResult.success === false) {
            setClaimError(clearResult.message || 'Failed to clear previous token.');
            setClaimStatus('error');
        } else {
            onUserUpdate(clearResult.user);
            
            const assignResult = await assignTokenProcess();
            if (assignResult.success) {
                setClaimStatus('success');
                setTimeout(() => {
                    setClaimStatus('idle');
                }, 2000);
            } else {
                setClaimError(assignResult.error || 'Failed to assign token.');
                setClaimStatus('error');
            }
        }
    }, [currentUser.id, onUserUpdate, assignTokenProcess]);

    const handleTestToken = useCallback(async () => {
        setTestStatus('testing');
        setTestResults(null);
        const results = await runComprehensiveTokenTest(personalAuthToken);
        setTestResults(results);
        setTestStatus('idle');
    }, [personalAuthToken]);

    useEffect(() => {
        const veoTokensJSON = sessionStorage.getItem('veoAuthTokens');
        if (veoTokensJSON) {
            try {
                const parsed = JSON.parse(veoTokensJSON);
                if (Array.isArray(parsed)) {
                    setVeoTokens(parsed);
                }
            } catch (e) {
                console.error("Failed to parse VEO auth from session storage", e);
                setVeoTokens([]);
            }
        } else {
            setVeoTokens([]);
        }
    }, [veoTokenRefreshedAt]);
    
    useEffect(() => {
        const tokenFromProp = currentUser.personalAuthToken || '';
        setPersonalAuthToken(tokenFromProp);
        setTestResults(null);
    }, [currentUser.personalAuthToken]);
    
    
    const locale = language === 'ms' ? 'ms-MY' : 'en-US';
    const activeApiKey = sessionStorage.getItem('monoklix_session_api_key');

    const handleSavePersonalToken = async () => {
        setPersonalTokenSaveStatus('saving');
        const result = await saveUserPersonalAuthToken(currentUser.id, personalAuthToken.trim() || null);

        if (result.success === false) {
            setPersonalTokenSaveStatus('error');
            if (result.message === 'DB_SCHEMA_MISSING_COLUMN_personal_auth_token' && currentUser.role === 'admin') {
                alert("Database schema is outdated.\n\nPlease go to your Supabase dashboard and run the following SQL command to add the required column:\n\nALTER TABLE public.users ADD COLUMN personal_auth_token TEXT;");
            }
        } else {
            onUserUpdate(result.user);
            setPersonalTokenSaveStatus('saved');
        }
        setTimeout(() => setPersonalTokenSaveStatus('idle'), 3000);
    };

    const getStatusBadge = (result: TokenTestResult | undefined, label: string) => {
        if (!result) {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                    {label}
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600"></span>
                </div>
            );
        }
        return (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${result.success 
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' 
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'}`}
                title={result.message}
            >
                {label}
                {result.success 
                    ? <CheckCircleIcon className="w-3 h-3" /> 
                    : <XIcon className="w-3 h-3" />
                }
            </div>
        );
    };

    const renderTokenPool = (
        title: string,
        poolTokens: { token: string; createdAt: string; totalUser?: number }[]
    ) => (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                        <VideoIcon className="w-5 h-5 text-blue-500"/>
                        {title}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600">
                        {poolTokens.length} Tokens
                    </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Premium tokens required for Veo 3.0 video generation and Imagen V3 image editing.
                </p>
            </div>

            {tokenStatusMessage && (
                <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 animate-zoomIn ${tokenStatusMessage.type === 'loading' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : tokenStatusMessage.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {tokenStatusMessage.type === 'loading' && <Spinner />}
                    {tokenStatusMessage.message}
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 max-h-[400px] xl:max-h-none">
                {poolTokens.length > 0 ? (
                    poolTokens.map((tokenData, index) => {
                        const results = testResultsMap.get(tokenData.token);
                        const imagenResult = results?.find(r => r.service === 'Imagen');
                        const veoResult = results?.find(r => r.service === 'Veo');
                        const isCurrentToken = currentUser.personalAuthToken === tokenData.token;
                        const isBeingTested = testingToken === tokenData.token;
                        const isBeingClaimed = claimingToken === tokenData.token;

                        return (
                            <div key={index} className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border transition-all duration-200 ${isCurrentToken ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/50 ring-1 ring-green-500/20' : 'bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCurrentToken ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'}`}>
                                        #{index + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <code className="text-xs font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                                                ...{tokenData.token.slice(-6)}
                                            </code>
                                            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800 ml-2">
                                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                                    {tokenData.totalUser ?? 0} Users
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-neutral-400 font-mono border-l border-neutral-300 dark:border-neutral-600 pl-2 whitespace-nowrap">
                                                {new Date(tokenData.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 self-end sm:self-auto">
                                    <div className="flex gap-1.5">
                                        {getStatusBadge(imagenResult, 'IMAGEN')}
                                        {getStatusBadge(veoResult, 'VEO3')}
                                    </div>
                                    
                                    <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 border border-neutral-200 dark:border-neutral-700 h-8">
                                        <button 
                                            onClick={() => handleTestSharedToken(tokenData.token)} 
                                            disabled={isBeingTested} 
                                            className="px-3 h-full text-[10px] font-bold text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 rounded-md transition-colors disabled:opacity-50"
                                        >
                                            {isBeingTested ? <Spinner /> : T.test}
                                        </button>
                                        <div className="w-px h-3 bg-neutral-300 dark:bg-neutral-600 mx-0.5"></div>
                                        <button
                                            onClick={() => handleClaimSharedToken(tokenData.token)}
                                            disabled={isBeingClaimed || isCurrentToken}
                                            className={`px-3 h-full text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 ${
                                                isCurrentToken
                                                ? 'bg-green-600 text-white shadow-sm opacity-100 cursor-default'
                                                : 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-600 shadow-sm disabled:opacity-50 disabled:text-neutral-400 disabled:shadow-none'
                                            }`}
                                        >
                                            {isBeingClaimed ? (
                                                <Spinner />
                                            ) : isCurrentToken ? (
                                                <>
                                                    <CheckCircleIcon className="w-3 h-3 text-white" />
                                                    Active
                                                </>
                                            ) : (
                                                T.claim
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-neutral-400 text-center">
                        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                            <AlertTriangleIcon className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium">{T.noTokens}</p>
                        <p className="text-xs mt-1">Check back later for updates.</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {claimStatus !== 'idle' && (
                <ClaimTokenModal
                    status={claimStatus}
                    error={claimError}
                    onClose={() => setClaimStatus('idle')}
                    onRetry={handleClaimNewToken}
                />
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Panel: Configuration */}
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm space-y-8 h-fit">
                    {/* MONOklix API Keys */}
                    <div>
                        <h2 className="text-xl font-semibold mb-2">{T.title}</h2>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700 flex items-start gap-3">
                            <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                            {T.description}
                            </p>
                        </div>
                        <div className="mt-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex justify-between items-center">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-200">{T.sharedStatus}</span>
                            {activeApiKey ? (
                                <span className="flex items-center gap-2 font-semibold text-green-600 dark:text-green-400">
                                    <CheckCircleIcon className="w-5 h-5" />
                                    {T.connected}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 font-semibold text-red-500">
                                    <XIcon className="w-5 h-5" />
                                    {T.notLoaded}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Personal Token */}
                    <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
                        <h2 className="text-xl font-semibold mb-2">{T.authTokenTitle}</h2>
                        <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-4">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                {T.hybridModeDesc}
                            </p>
                        </div>
                        <div className="relative">
                            <input
                                type={showPersonalToken ? 'text' : 'password'}
                                value={personalAuthToken}
                                onChange={(e) => {
                                    setPersonalAuthToken(e.target.value);
                                    setTestResults(null); // Reset test status on change
                                }}
                                placeholder={T.authTokenPlaceholder}
                                className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 pr-10 focus:ring-2 focus:ring-primary-500"
                            />
                            <button onClick={() => setShowPersonalToken(!showPersonalToken)} className="absolute inset-y-0 right-0 px-3 flex items-center text-neutral-500">
                                {showPersonalToken ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                            </button>
                        </div>
                        
                        <div className="mt-2 min-h-[24px]">
                            {testStatus === 'testing' && <div className="flex items-center gap-2 text-sm text-neutral-500"><Spinner /> {T.testing}</div>}
                            {testResults && (
                                <div className="space-y-2 mt-2">
                                    {testResults.map(result => (
                                        <div key={result.service} className={`flex items-start gap-2 text-sm p-2 rounded-md ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                            {result.success ? <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"/> : <XIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>}
                                            <div>
                                                <span className={`font-semibold ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-700 dark:text-red-300'}`}>{result.service} Service</span>
                                                <p className={`text-xs ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{result.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                            <button onClick={handleSavePersonalToken} disabled={personalTokenSaveStatus === 'saving'} className="bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 w-24 flex justify-center">
                                {personalTokenSaveStatus === 'saving' ? <Spinner/> : T.save}
                            </button>
                            <button onClick={handleTestToken} disabled={!personalAuthToken || testStatus === 'testing'} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2 disabled:opacity-50">
                                {testStatus === 'testing' ? <Spinner /> : <SparklesIcon className="w-4 h-4" />}
                                {T.runTest}
                            </button>
                            <button onClick={handleClaimNewToken} disabled={personalTokenSaveStatus === 'saving' || claimStatus !== 'idle'} className="bg-neutral-200 dark:bg-neutral-700 font-semibold py-2 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                                {T.claimNew}
                            </button>
                            {personalTokenSaveStatus === 'saved' && (
                                <span className="flex items-center gap-2 text-sm text-green-600">
                                    <CheckCircleIcon className="w-5 h-5" />
                                    {T.updated}
                                </span>
                            )}
                            {personalTokenSaveStatus === 'error' && (
                                <span className="flex items-center gap-2 text-sm text-red-600">
                                    <XIcon className="w-5 h-5" />
                                    {T.saveFail}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Token Pool */}
                <div className="h-full">
                    {renderTokenPool(T.veoTokenGroupTitle, veoTokens)}
                </div>
            </div>
        </>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, tempApiKey, onUserUpdate, language, setLanguage, veoTokenRefreshedAt, assignTokenProcess }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
    const tabs = getTabs();
    const T = getTranslations().settingsView;

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <ProfilePanel currentUser={currentUser} onUserUpdate={onUserUpdate} language={language} setLanguage={setLanguage} />
                        <div className="h-full">
                            <CacheManagerPanel />
                        </div>
                    </div>
                );
            case 'api':
                return (
                    <ApiIntegrationsPanel 
                        currentUser={currentUser} 
                        onUserUpdate={onUserUpdate} 
                        language={language} 
                        veoTokenRefreshedAt={veoTokenRefreshedAt} 
                        assignTokenProcess={assignTokenProcess} 
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold sm:text-3xl">{T.title}</h1>
            </div>
            
            <div className="flex-shrink-0 my-6 flex justify-center">
                <Tabs 
                    tabs={tabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isAdmin={currentUser.role === 'admin' || currentUser.status === 'lifetime'}
                />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};

export default SettingsView;
