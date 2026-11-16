import React, { useState, useEffect } from 'react';
import { RefreshCw, ServerOff, Terminal, Sparkles, AlertTriangle } from 'lucide-react';
import { checkHealth, API_BASE_URL } from '../services/api';

export default function BackendConnectionBoundary({ children }) {
  const [isConnected, setIsConnected] = useState(null); // null = checking, true = ok, false = error
  const [isChecking, setIsChecking] = useState(true);
  const [errorDetails, setErrorDetails] = useState('');

  const verifyConnection = async () => {
    setIsChecking(true);
    setErrorDetails('');
    try {
      const ok = await checkHealth();
      if (ok) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        setErrorDetails('Endpoint GET /health returned invalid payload (status != ok).');
      }
    } catch (err) {
      setIsConnected(false);
      setErrorDetails(err.message || 'Unable to establish HTTP connection to http://localhost:8000');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    verifyConnection();
  }, []);

  if (isChecking && isConnected === null) {
    return (
      <div className="min-h-screen bg-[#080D1B] flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <div className="absolute w-10 h-10 rounded-xl bg-cyan-950/60 flex items-center justify-center border border-cyan-400/40">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
        </div>
        <h2 className="text-base font-bold text-white mb-1 tracking-tight">
          Connecting to LOOKING FOR STAR Backend Engine...
        </h2>
        <p className="text-slate-400 text-xs max-w-md text-center">
          Verifying genuine telemetry connection with <span className="text-cyan-300 font-mono">{API_BASE_URL}/health</span> [Policy: Zero Mocks / Real NASA Telemetry].
        </p>
      </div>
    );
  }

  if (isConnected === false) {
    return (
      <div className="min-h-screen bg-[#080D1B] flex items-center justify-center p-6 text-slate-100 font-sans">
        <div className="max-w-xl w-full cosmic-card p-6 md:p-8 shadow-2xl border border-red-500/50">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3.5 bg-red-950/50 rounded-2xl border border-red-500/50 text-red-400 shrink-0">
              <ServerOff className="w-7 h-7" />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950 border border-red-800 text-red-300 mb-1.5 uppercase tracking-wide">
                Strict Protocol: Zero Mocks / Genuine Space Science
              </span>
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
                No Connection to Backend Engine on localhost:8000
              </h1>
              <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
                LOOKING FOR STAR requires live data from NASA SPHEREx, NASA IRSA, and ESA Gaia DR3. Synthetic mocks and fake canvas animations are strictly disabled.
              </p>
            </div>
          </div>

          <div className="bg-[#080D1B]/80 rounded-xl border border-white/10 p-3.5 mb-5 font-mono text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-2 text-[11px]">
              <span className="uppercase text-[10px]">Target Endpoint:</span>
              <span className="text-cyan-400 font-bold">GET {API_BASE_URL}/health</span>
            </div>
            {errorDetails && (
              <div className="text-red-400 pt-1 text-[11px]">
                <span className="text-slate-500 text-[10px] block uppercase font-sans">Diagnostic Message:</span>
                {errorDetails}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="text-xs text-slate-400 flex items-start gap-2.5 bg-[#080D1B]/60 p-3 rounded-xl border border-white/10">
              <Terminal className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200 mb-1 text-[11px] uppercase tracking-wide">
                  Start the FastAPI backend server in terminal:
                </p>
                <code className="text-cyan-300 bg-[#0F1A34] px-2.5 py-1 rounded block w-fit border border-white/10 font-mono text-xs select-all">
                  python3 -m uvicorn app:app --reload --port 8000
                </code>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 font-sans">
                NASA Space Apps Challenge • SPHEREx Explorer
              </span>
              <button
                onClick={verifyConnection}
                disabled={isChecking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(37,217,242,0.4)] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Verifying...' : 'Retry Connection'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
