import { addLogEntry } from './aiLogService';
import { type User } from '../types';
import { supabase } from './supabaseClient';
import { PROXY_SERVER_URLS } from './serverConfig';

// Default fallback servers from config
const FALLBACK_SERVERS = PROXY_SERVER_URLS;

export const getVeoProxyUrl = (): string => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  if (userSelectedProxy) {
      return userSelectedProxy;
  }
  // Default if nothing selected
  return 'https://veox.monoklix.com';
};

export const getImagenProxyUrl = (): string => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  const userSelectedProxy = sessionStorage.getItem('selectedProxyServer');
  if (userSelectedProxy) {
      return userSelectedProxy;
  }
  return 'https://gemx.monoklix.com';
};

const getPersonalToken = (): { token: string; createdAt: string; } | null => {
    try {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            if (user && user.personalAuthToken) {
                return { token: user.personalAuthToken, createdAt: 'personal' };
            }
        }
    } catch (e) {
        console.error("Could not parse user from localStorage to get personal token", e);
    }
    return null;
};

// Helper to get tokens from the shared pool based on service type
const getSharedTokensFromSession = (serviceType: 'veo' | 'imagen'): { token: string; createdAt: string }[] => {
    try {
        // UPDATED: Always use 'veoAuthTokens' as the unified source for shared tokens.
        // The Imagen specific pool is deprecated.
        const key = 'veoAuthTokens';
        const tokensJSON = sessionStorage.getItem(key);
        if (tokensJSON) {
            const parsed = JSON.parse(tokensJSON);
            if (Array.isArray(parsed)) {
                // Sort by newest first
                return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
        }
    } catch (e) {
        console.warn(`Failed to parse tokens from session:`, e);
    }
    return [];
};


const getCurrentUserInternal = (): User | null => {
    try {
        const savedUserJson = localStorage.getItem('currentUser');
        if (savedUserJson) {
            const user = JSON.parse(savedUserJson) as User;
            if (user && user.id) {
                return user;
            }
        }
    } catch (error) {
        console.error("Failed to parse user from localStorage for activity log.", error);
    }
    return null;
};

// --- EXECUTE REQUEST WITH ROBUST FAILOVER ---

interface RequestAttempt {
    token: string;
    serverUrl: string;
    source: 'Specific' | 'Personal' | 'Pool';
}

export const executeProxiedRequest = async (
  relativePath: string,
  serviceType: 'veo' | 'imagen',
  requestBody: any,
  logContext: string,
  specificToken?: string,
  onStatusUpdate?: (status: string) => void,
  overrideServerUrl?: string // New parameter to force a specific server
): Promise<{ data: any; successfulToken: string; successfulServerUrl: string }> => {
  const isStatusCheck = logContext === 'VEO STATUS';
  
  if (!isStatusCheck) {
      console.log(`[API Client] Starting process for: ${logContext}`);
  }
  
  // Use override URL if provided, otherwise default to standard proxy selection
  const currentServerUrl = overrideServerUrl || (serviceType === 'veo' ? getVeoProxyUrl() : getImagenProxyUrl());
  
  // 1. Acquire Server Slot (Rate Limiting at Server Level)
  const isGenerationRequest = logContext.includes('GENERATE') || logContext.includes('RECIPE');
  
  if (isGenerationRequest) {
    if (onStatusUpdate) onStatusUpdate('Queueing...');
    await supabase.rpc('request_generation_slot', { cooldown_seconds: 10, server_url: currentServerUrl });
    if (onStatusUpdate) onStatusUpdate('Processing...');
  }
  
  // 2. Build Attempt Strategy List
  let attempts: RequestAttempt[] = [];
  const usedAttempts = new Set<string>(); // To prevent duplicate token+server pairs

  const addAttempt = (attempt: RequestAttempt) => {
      const key = `${attempt.token.slice(-6)}@${attempt.serverUrl}`;
      if (!usedAttempts.has(key)) {
          attempts.push(attempt);
          usedAttempts.add(key);
      }
  };

  const personal = getPersonalToken();

  if (specificToken) {
      // SCENARIO A: Strict Mode (Health Check or multi-step process)
      // This path is for internal processes that require a specific token to be used on a specific server.
      const sourceLabel = (personal && personal.token === specificToken) ? 'Personal' : 'Specific';
      addAttempt({ token: specificToken, serverUrl: currentServerUrl, source: sourceLabel });
  } else if (personal) {
      // SCENARIO B: Personal Token Only Mode
      // If a user has a personal token, we ONLY try that token on the current server. No failover, no pool.
      console.log(`[API Client] Personal Token mode activated. Using only user's token.`);
      addAttempt({ token: personal.token, serverUrl: currentServerUrl, source: 'Personal' });
  } else {
      // SCENARIO C: Hybrid "Bulletproof" Mode (for users WITHOUT a personal token)
      console.log(`[API Client] Hybrid mode activated. User has no personal token.`);
      const allSharedTokens = getSharedTokensFromSession(serviceType);
      const newestPoolTokens = allSharedTokens.slice(0, 10);
      const shuffledPool = [...newestPoolTokens].sort(() => 0.5 - Math.random());

      // PHASE 1: Try on Current (or Overridden) Server with Pool
      shuffledPool.forEach(t => {
          addAttempt({ token: t.token, serverUrl: currentServerUrl, source: 'Pool' });
      });

      // PHASE 2: Try on Backup Servers (Only if NOT overriding server)
      if (!overrideServerUrl) {
          const otherServers = FALLBACK_SERVERS.filter(s => s !== currentServerUrl);
          const backupServers = [...otherServers].sort(() => 0.5 - Math.random()).slice(0, 2);

          backupServers.forEach(backupServer => {
              shuffledPool.slice(0, 3).forEach(t => {
                  addAttempt({ token: t.token, serverUrl: backupServer, source: 'Pool' });
              });
          });
      }
  }


  if (attempts.length === 0) {
      throw new Error(`No authentication tokens found. Please claim a token in Settings.`);
  }

  const currentUser = getCurrentUserInternal();
  let lastError: any = new Error("Unknown error");

  // 3. Execute the Strategy Loop
  for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const isLastAttempt = i === attempts.length - 1;
      
      try {
          const endpoint = `${attempt.serverUrl}/api/${serviceType}${relativePath}`;
          // console.log(`[API Client] Attempt ${i + 1}/${attempts.length} | ${attempt.source} Token | Server: ${attempt.serverUrl}`);

          const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${attempt.token}`,
                  'x-user-username': currentUser?.username || 'unknown',
              },
              body: JSON.stringify(requestBody),
          });

          let data;
          const textResponse = await response.text();
          try {
              data = JSON.parse(textResponse);
          } catch {
              data = { error: { message: `Proxy returned non-JSON (${response.status})` } };
          }

          if (!response.ok) {
              const status = response.status;
              let errorMessage = data.error?.message || data.message || `API call failed (${status})`;
              const lowerMsg = errorMessage.toLowerCase();

              if (status === 400 || lowerMsg.includes('safety') || lowerMsg.includes('blocked')) {
                  console.warn(`[API Client] 🛑 Non-retriable error (${status}). Prompt issue.`);
                  // ADDED: Include status code in error message for easier detection downstream
                  throw new Error(`[${status}] ${errorMessage}`);
              }
              
              // console.warn(`[API Client] ⚠️ Attempt ${i + 1} failed (${status}). Trying next...`);
              if (isLastAttempt) throw new Error(errorMessage);
              continue;
          }

          if (!isStatusCheck) {
              console.log(`✅ [API Client] Success using ${attempt.source} token on ${attempt.serverUrl}`);
          }
          return { data, successfulToken: attempt.token, successfulServerUrl: attempt.serverUrl };

      } catch (error) {
          lastError = error;
          const errMsg = error instanceof Error ? error.message : String(error);
          
          // UPDATED: Check for [400] pattern
          const isSafetyError = errMsg.includes('[400]') || errMsg.toLowerCase().includes('safety') || errMsg.toLowerCase().includes('blocked');

          if (isSafetyError) {
              // Safety errors should just bubble up to the UI without aggressive logging
              throw error;
          }

          if (isLastAttempt) {
              if (isSafetyError) {
                  console.warn(`⚠️ [API Client] Process stopped due to safety/bad request: ${errMsg}`);
              } else {
                  // console.error(`❌ [API Client] All ${attempts.length} attempts exhausted.`);
              }
              
              if (!specificToken) {
                  // Only log real system errors to DB/State, not user prompt errors
                  if (!isSafetyError) {
                      addLogEntry({ 
                          model: logContext, 
                          prompt: `Failed after ${attempts.length} attempts`, 
                          output: errMsg, 
                          tokenCount: 0, 
                          status: 'Error', 
                          error: errMsg 
                      });
                  }
              }
              throw lastError;
          }
      }
  }

  throw lastError;
};