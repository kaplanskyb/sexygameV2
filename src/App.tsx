
import React, { useState, useEffect, useRef } from 'react';
import QRCode from "react-qr-code";
import { QrReader } from "react-qr-reader";
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    onSnapshot, 
    collection, 
    query,      
    where,      
    serverTimestamp, // <--- AQUÍ FALTABA LA COMA
    deleteDoc,       // <--- Ahora sí funcionará
    getDocs
  } from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
    User as UserIcon, Lock, ChevronDown, ChevronUp, QrCode, Flame, HelpCircle,
    Gamepad2, Trophy, Users, UserX, Play, Trash2, RefreshCw, Settings,
    HeartHandshake, Send, Shuffle, SkipForward, Power, AlertTriangle, Check, X,
    Info, BookOpen, Zap, CheckCircle, Upload, FileSpreadsheet, Download,
    PauseCircle, PlayCircle, CheckSquare, Square, Filter, ArrowUpDown, Search,
    Edit2, LogOut, MessageCircle, RefreshCcw 
} from 'lucide-react';
// --- CORRECCIÓN DE IMPORTS DE FIREBASE (AGREGA ESTO A TU LISTA DE IMPORTS) ---
import { 
    writeBatch, 
    increment,
    // ... mantén los que ya tenías (getFirestore, doc, etc.)
} from 'firebase/firestore';



// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, 
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'truth-dare-v1';

// --- INTERFACES ---
interface Player {
  uid: string;
  name: string;
  gender: string;
  coupleNumber: string;
  relationshipStatus: 'single' | 'couple';
  joinedAt: any;
  isActive: boolean;
  isBot?: boolean;
  matches?: number;
  mismatches?: number;
}
interface Challenge {
  id?: string;
  level: string;
  type: string;
  text?: string;
  gender?: string;
  sexo?: string;
  male?: string;
  female?: string;
  answered: boolean;
  paused?: boolean;
}
interface HistoryEntry {
    u1: string;
    u2: string;
    name1: string;
    name2: string;
    result: 'match' | 'mismatch';
    timestamp: number;
}
interface GameState {
  mode: string;
  currentTurnIndex: number;
  answers: Record<string, string>;
  votes: Record<string, string>;
  points: Record<string, number>;
  code: string;
  adminUid?: string | null;
  currentChallengeId?: string;
  pairs?: Record<string, string>;
  roundLevel?: string;
  isAutoMode?: boolean;
  sequence?: string[];
  sequenceIndex?: number;
  matchHistory?: HistoryEntry[];
  nextType?: string;
  isEnding?: boolean;
}

// --- HELPER CSV PARSER ---
const parseCSVLine = (text: string) => {
    const re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    if (!re_valid.test(text)) return null;
    const a = [];
    text.replace(re_value, function(m0, m1, m2, m3) {
        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    if (/,\s*$/.test(text)) a.push('');
    return a;
};

// --- ESTILOS NEÓN Y GLASS ---
const glassPanel = "bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-xl";
const glassInput = "bg-black/20 border border-white/10 rounded-lg p-2 text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all";
const disabledBtn = "opacity-50 cursor-not-allowed";

// --- COMPONENTES AUXILIARES ---

// Tutorial Tooltip: Posicionamiento inteligente con flecha
const TutorialTooltip = ({ text, onClick, className, arrowPos = 'bottom' }: { text: string, onClick: () => void, className?: string, arrowPos?: 'top' | 'bottom' | 'left' | 'right' }) => (
    <div className={`absolute z-[200] cursor-pointer animate-bounce ${className}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <div className="bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.8)] relative whitespace-nowrap border-2 border-white pointer-events-auto">
            {text}
            {/* Flecha Abajo (Apunta abajo) */}
            {arrowPos === 'bottom' && <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-yellow-400"></div>}
            {/* Flecha Arriba (Apunta arriba) */}
            {arrowPos === 'top' && <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-yellow-400"></div>}
            {/* Flecha Izquierda (Apunta izquierda) */}
            {arrowPos === 'left' && <div className="absolute top-1/2 right-full -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-yellow-400"></div>}
            {/* Flecha Derecha (Apunta derecha) */}
            {arrowPos === 'right' && <div className="absolute top-1/2 left-full -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-yellow-400"></div>}
        </div>
    </div>
);

// Helper Icon with Popover
const InfoIcon = ({ text }: { text: string }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-flex items-center ml-1 z-40">
            <Info size={14} className="text-cyan-400 cursor-pointer hover:text-white transition-colors" onClick={() => setShow(!show)} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}/>
            {show && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 bg-black/90 p-2 rounded text-[10px] text-white z-50 border border-white/10 shadow-xl pointer-events-none text-center animate-in fade-in zoom-in-95">{text}</div>}
        </div>
    );
};

const HelpModal = ({ onClose, type }: { onClose: () => void, type: 'admin' | 'player' }) => {
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm" onClick={onClose}>
            <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 ${glassPanel}`} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <div className="p-8">
                    <h2 className="text-3xl font-black mb-8 flex items-center gap-3 border-b border-white/10 pb-4">
                        {type === 'admin' ? <BookOpen size={32} className="text-cyan-400" /> : <HelpCircle size={32} className="text-yellow-400" />}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                            {type === 'admin' ? 'Game Master Manual' : 'Player Instructions'}
                        </span>
                    </h2>

                    <div className="space-y-8 text-slate-300">

                        {/* --- MANUAL DE ADMIN --- */}
                        {type === 'admin' && (
                            <>
                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Flame className="text-orange-500" /> The Game Modes (Click to expand)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* TRUTH BOX */}
                                        <div
                                            className={`cursor-pointer border rounded-xl p-4 transition-all ${expandedSection === 'truth' ? 'bg-blue-900/40 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                            onClick={() => toggleSection('truth')}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <strong className="text-blue-400 text-lg">1. Truth</strong>
                                                {expandedSection === 'truth' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                            <p className="text-sm text-slate-400">Verbal questions. The player reads aloud and answers.</p>
                                            {expandedSection === 'truth' && (
                                                <div className="mt-4 text-sm text-white border-t border-blue-500/30 pt-2 animate-in fade-in">
                                                    <p className="mb-2"><strong>How it works:</strong> A question appears on the player's phone. You must read it to the group and answer honestly.</p>
                                                    <p className="mb-2"><strong>Voting:</strong> The rest of the group votes "Good Answer" or "Nah..".</p>
                                                    <em className="text-blue-300 block mt-2">Example: "Who in this room would you date if you were single?"</em>
                                                </div>
                                            )}
                                        </div>

                                        {/* DARE BOX */}
                                        <div
                                            className={`cursor-pointer border rounded-xl p-4 transition-all ${expandedSection === 'dare' ? 'bg-pink-900/40 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                            onClick={() => toggleSection('dare')}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <strong className="text-pink-400 text-lg">2. Dare</strong>
                                                {expandedSection === 'dare' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                            <p className="text-sm text-slate-400">Physical actions.</p>
                                            {expandedSection === 'dare' && (
                                                <div className="mt-4 text-sm text-white border-t border-pink-500/30 pt-2 animate-in fade-in">
                                                    <p className="mb-2"><strong>How it works:</strong> A challenge appears. The player must perform the action immediately.</p>
                                                    <p className="mb-2"><strong>Voting:</strong> The group acts as the judge. They vote "Completed" or "Failed".</p>
                                                    <em className="text-pink-300 block mt-2">Example: "Let the person to your right read your last DM."</em>
                                                </div>
                                            )}
                                        </div>

                                        {/* MATCH BOX */}
                                        <div
                                            className={`cursor-pointer border rounded-xl p-4 transition-all ${expandedSection === 'match' ? 'bg-emerald-900/40 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                            onClick={() => toggleSection('match')}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <strong className="text-emerald-400 text-lg">3. Match/Mismatch</strong>
                                                {expandedSection === 'match' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                            <p className="text-sm text-slate-400">Compatibility test. 2 players answer blindly.</p>
                                            {expandedSection === 'match' && (
                                                <div className="mt-4 text-sm text-white border-t border-emerald-500/30 pt-2 animate-in fade-in">
                                                    <p className="mb-2"><strong>How it works:</strong> The system secretly pairs two people (e.g., John & Sarah). A statement appears (e.g., "I prefer lights off").</p>
                                                    <p className="mb-2"><strong>The Goal:</strong> Both answer YES or NO secretly on their phones. If they <strong>MATCH</strong> (both Yes or both No), they get points.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Zap className="text-yellow-400" /> Game Control</h3>
                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-5 rounded-xl border-l-4 border-purple-500">
                                            <h4 className="text-purple-400 font-bold text-lg mb-2">MODE A: MANUAL (The DJ)</h4>
                                            <p className="text-sm mb-2 text-slate-300">In this mode, <strong>YOU control everything</strong>. Before every single turn, you must select:</p>
                                            <ul className="list-disc pl-5 text-sm space-y-1 text-slate-400">
                                                <li><strong>Risk Level:</strong> How intense should the next question be?</li>
                                                <li><strong>Game Type:</strong> Do you want a Truth, a Dare, or a Match round next?</li>
                                            </ul>
                                            <p className="text-sm mt-2 italic text-white/50">Use this when you want to read the room's vibe and adjust specifically.</p>
                                        </div>

                                        <div className="bg-white/5 p-5 rounded-xl border-l-4 border-emerald-500">
                                            <h4 className="text-emerald-400 font-bold text-lg mb-2">MODE B: AUTOMATIC (Autopilot)</h4>
                                            <p className="text-sm mb-2 text-slate-300">You set a "Loop Configuration" (e.g., 2 Truths, 2 Dares, 1 Match) and the game runs itself in that order endlessly.</p>
                                            <p className="text-sm text-slate-300">You simply click "Next" (or let the timer do it) and the system automatically picks the type based on your sequence.</p>
                                            <p className="text-sm mt-2 italic text-white/50">Perfect for when you want to play along and not worry about managing the game.</p>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Settings className="text-gray-400" /> Admin Tools</h3>
                                    <ul className="list-disc pl-5 space-y-4 text-sm text-slate-300">
                                        <li>
                                            <strong>1. Uploading Questions:</strong>
                                            {/* Nueva linea agregada */}
                                            <p className="text-xs text-cyan-400 mb-2 mt-1 font-bold">💡 Tip: Use the "Download Template" button in the manager to get an empty file with correct headers.</p>
                                            
                                            <div className="mt-2 space-y-3">
                                                <div className="bg-black/40 p-3 rounded border border-blue-500/30">
                                                    <span className="text-blue-300 font-bold block mb-1">Truth & Dare Files (Use separate buttons):</span>
                                                    <span className="text-slate-400">Headers must be:</span> <code className="text-green-400 bg-white/10 px-1 rounded">text, level, gender</code>
                                                    <br /><span className="text-xs text-slate-500 mt-1 block">Gender = <strong>M</strong> for Male, <strong>F</strong> for Female, <strong>B</strong> for Both.</span>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded border border-emerald-500/30">
                                                    <span className="text-emerald-300 font-bold block mb-1">Match Files:</span>
                                                    <span className="text-slate-400">Headers must be:</span> <code className="text-green-400 bg-white/10 px-1 rounded">male, female, level</code>
                                                </div>
                                            </div>
                                        </li>
                                        <li><strong>Singles vs Couples:</strong> The system <strong>understands</strong> if players are Single or Couples. If Couples join, the game <strong>will not start</strong> until both partners (matching ID) are present.</li>
                                        <li><strong>Bot System:</strong> If total players are odd, "Brad Pitt" (or "Scarlett Johansson") joins to ensure everyone has a partner in Match rounds.</li>
                                    </ul>
                                </section>
                            </>
                        )}

                        {/* --- MANUAL DE JUGADOR --- */}
                        {type === 'player' && (
                            <>
                                <section>
                                    <h3 className="text-xl font-bold text-white mb-3">👋 How to Join</h3>
                                    <ol className="list-decimal pl-5 space-y-3 text-slate-300">
                                        <li><strong>Name & Gender:</strong> Enter your nickname and select your gender.</li>
                                        <li><strong>Status:</strong> Choose if you are <strong>Single</strong> or playing with a <strong>Couple</strong>.</li>
                                        <li><strong>Linking (Couples Only):</strong>
                                            <ul className="list-disc pl-5 mt-1 text-slate-400 text-sm">
                                                <li><strong>Females:</strong> You will see a specific 4-digit code on your screen.</li>
                                                <li><strong>Males:</strong> You must enter the code displayed on your partner's phone to link.</li>
                                                <li><em className="text-white/50">Singles skip this step automatically.</em></li>
                                            </ul>
                                        </li>
                                        <li><strong>Game Code:</strong> Ask the Admin (Game Master) for the code.</li>
                                    </ol>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-3">🎮 How to Play</h3>
                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-4 rounded-xl border-l-4 border-blue-500">
                                            <strong className="text-blue-400 text-lg block mb-2">Truth Rounds</strong>
                                            <p className="text-sm text-slate-300">When it's your turn, a question will appear. Read it aloud and answer honestly. The group will award points based on your answer.</p>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl border-l-4 border-pink-500">
                                            <strong className="text-pink-400 text-lg block mb-2">Dare Rounds</strong>
                                            <p className="text-sm text-slate-300">A challenge will appear. You must perform the action described to earn points.</p>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl border-l-4 border-emerald-500">
                                            <strong className="text-emerald-400 text-lg block mb-2">Match/Mismatch Rounds</strong>
                                            <p className="text-sm mb-2 text-slate-300">The system will secretly pair you with another player. A statement will appear on your screen.</p>
                                            <p className="text-sm italic text-yellow-400 mb-2 font-mono bg-black/30 p-2 rounded text-center">"I prefer lights off"</p>
                                            <p className="text-sm text-slate-300">You must answer <strong>YES</strong> or <strong>NO</strong> honestly. You only score points if your answer <strong>MATCHES</strong> your partner's answer!</p>
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}

                    </div>

                    <div className="mt-8 text-center border-t border-white/10 pt-6">
                        <button onClick={onClose} className="bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-3 rounded-xl font-bold text-white hover:brightness-110 shadow-lg transition-transform active:scale-95 text-sm uppercase tracking-wider">
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Asegúrate de tener estos imports arriba:
// import { QrReader } from 'react-qr-reader';
// import { Check, X } from 'lucide-react';

// Asegúrate de que estos imports estén arriba en tu archivo:
// import { QrReader } from 'react-qr-reader';
// import { Check, X, Camera } from 'lucide-react';

const CouplePairing = ({ 
    gender, 
    onCodeObtained, 
    value, 
    onBack,
    onAutoJoin,
    db,
    currentUserUid,
    appId
}: any) => {
    
    // Generar código de 4 dígitos (Solo mujer/Host)
    const [localCode] = useState(() => {
        if (value) return value;
        return Math.floor(1000 + Math.random() * 9000).toString();
    });

    const [inputCode, setInputCode] = useState('');
    const [isLinked, setIsLinked] = useState(false);
    const isFemale = gender === 'female';
    const currentAppId = appId || 'sexy_game_v2';

    // 1. LÓGICA MUJER: Escuchar la BD
    useEffect(() => {
        if (isFemale && db && localCode) {
            const q = query(
                collection(db, 'artifacts', currentAppId, 'public', 'data', 'players'),
                where('coupleNumber', '==', localCode)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const partner = snapshot.docs.find(d => d.data().uid !== currentUserUid);
                if (partner) {
                    setIsLinked(true);
                    onCodeObtained(localCode);
                    // Pasamos el código también aquí por seguridad
                    setTimeout(() => { onAutoJoin(localCode); }, 2000); 
                }
            });
            return () => unsubscribe();
        }
    }, [isFemale, localCode, db, currentUserUid, currentAppId]);

    // 2. LÓGICA HOMBRE: Enviar código y ENTRAR
    const handleManSubmit = () => {
        if (inputCode.length !== 4) return;
        
        onCodeObtained(inputCode);
        setIsLinked(true);

        // CAMBIO CLAVE: Enviamos 'inputCode' como argumento al salir
        setTimeout(() => { 
            onAutoJoin(inputCode); 
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-8 uppercase tracking-widest text-center animate-pulse">
                {isLinked ? '❤️ LINKED! ❤️' : (isFemale ? 'WAITING FOR PARTNER...' : 'ENTER PARTNER CODE')}
            </h3>

            <div className="bg-slate-800 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center relative">
                {isLinked && (
                    <div className="absolute inset-0 z-20 bg-emerald-500 rounded-3xl flex flex-col items-center justify-center animate-in zoom-in duration-300">
                        <HeartHandshake size={64} className="text-white mb-4 animate-bounce" />
                        <span className="text-white font-black text-3xl tracking-widest">CONNECTED</span>
                        <span className="text-white/80 text-sm mt-2 font-bold tracking-widest animate-pulse">STARTING GAME...</span>
                    </div>
                )}
                {isFemale ? (
                    <>
                        <div className="bg-white text-slate-900 font-mono font-black text-6xl tracking-widest py-8 px-8 rounded-2xl mb-6 shadow-[0_0_30px_rgba(255,255,255,0.2)] leading-none border-4 border-pink-500/30">{localCode}</div>
                        <div className="flex items-center gap-3 text-slate-400 text-sm uppercase tracking-wide animate-pulse"><div className="w-2 h-2 bg-pink-500 rounded-full"></div>Waiting for partner...</div>
                    </>
                ) : (
                    <>
                        <p className="text-slate-400 text-center mb-6 text-sm uppercase tracking-wide">Ask your partner for their code</p>
                        <input type="number" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="0000" className="w-full bg-slate-900 border-2 border-slate-700 focus:border-purple-500 text-white font-mono font-black text-5xl text-center py-4 rounded-xl outline-none transition-all mb-8 placeholder:text-slate-700" value={inputCode} onChange={(e) => setInputCode(e.target.value.slice(0, 4))} />
                        <button onClick={handleManSubmit} disabled={inputCode.length < 4} className={`w-full py-4 font-black uppercase tracking-widest rounded-xl transition-all shadow-lg ${inputCode.length === 4 ? 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-500/25' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>LINK NOW</button>
                    </>
                )}
            </div>
            {!isLinked && <button onClick={onBack} className="mt-8 text-slate-500 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors">Cancel</button>}
        </div>
    );
};

// PEGAR ESTO ANTES DE "export default function..."
const AdminPanel = ({ players, gameState, onStartGame, onNextTurn, onReset, onKick }: any) => {
    return (
        <div className="bg-slate-800 p-4 rounded-xl border border-white/10 mb-6">
            <h3 className="text-xl font-bold text-pink-500 mb-4 border-b border-white/10 pb-2">Admin Control Panel</h3>
            <div className="space-y-4">
                <div className="bg-black/40 p-3 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                         <button onClick={onStartGame} className="bg-emerald-600 p-2 rounded text-xs font-bold">Start Game</button>
                         <button onClick={onNextTurn} className="bg-blue-600 p-2 rounded text-xs font-bold">Force Next</button>
                    </div>
                </div>
                <button onClick={onReset} className="w-full bg-red-900/50 border border-red-500/50 p-2 rounded text-xs font-bold text-red-200">Reset Entire Game</button>
                <div className="bg-black/40 p-3 rounded-lg max-h-40 overflow-y-auto">
                     {players.map((p: any) => (
                         <div key={p.uid} className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                             <span>{p.name}</span>
                             <button onClick={() => onKick(p.uid, p.name)} className="text-red-400">Kick</button>
                         </div>
                     ))}
                </div>
            </div>
        </div>
    );
};

export default function TruthAndDareApp() {
    const [isJoined, setIsJoined] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false); // <--- OJO: Si esto da error, muévelo arriba con los otros useState
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [gender, setGender] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const gradientBtn = "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-900/30 active:scale-95 transition-all hover:brightness-110";
  const [coupleNumber, setCoupleNumber] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState<'single'|'couple'|''>('');
  const [code, setCode] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [pairChallenges, setPairChallenges] = useState<Challenge[]>([]);
  const [uniqueLevels, setUniqueLevels] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customSuccess, setCustomSuccess] = useState<string | null>(null);
  const [viewAsPlayer, setViewAsPlayer] = useState(false);
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [showPlayerHelp, setShowPlayerHelp] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSettingCode, setIsSettingCode] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [managerTab, setManagerTab] = useState<'truth' | 'dare' | 'mm'>('truth');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: keyof Challenge, direction: 'asc' | 'desc'} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const selectionMode = useRef<'add' | 'remove'>('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkLevel, setBulkLevel] = useState('');
  const [bulkGender, setBulkGender] = useState('');
  const [isAutoSetup, setIsAutoSetup] = useState(false);
  const [qtyTruth, setQtyTruth] = useState(1);
  const [qtyDare, setQtyDare] = useState(1);
  const [qtyMM, setQtyMM] = useState(1);
  const [fetchedCard, setFetchedCard] = useState<Challenge | null>(null);
  const [showRiskInfo, setShowRiskInfo] = useState(false);

  // Sincronizar el estado isJoined con la lista de jugadores
  useEffect(() => {
    if (user && players) {
      const isPlayerInGame = players.some(p => p.uid === user.uid);
      setIsJoined(isPlayerInGame);
    }
  }, [players, user]);
  // --- PEGA ESTO EN SU LUGAR ---
  // --- DETECCIÓN DE ADMIN Y RESETEO DE ESTADO ---
  useEffect(() => {
    const isNowAdmin = userName.toLowerCase().trim() === 'admin';
    setIsAdmin(isNowAdmin);

    if (isNowAdmin) {
      const autoCode = Math.floor(10000 + Math.random() * 90000).toString();
      setCode(autoCode);
      
      // RESETEO AUTOMÁTICO DE PARÁMETROS DEL JUEGO
      const resetGameParams = async () => {
          try {
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), {
                  code: autoCode, // Actualizamos el código en la BD
                  mode: 'lobby',
                  roundLevel: '1',     // Reset Risk Level
                  nextType: 'truth',   // Reset Type
                  isAutoMode: false,   // Reset Auto Mode
                  answers: {},
                  votes: {},
                  currentTurnIndex: 0,
                  isEnding: false
              });
          } catch(e) { console.error("Auto reset failed", e); }
      };
      resetGameParams();

    } else {
      if (code && code.length > 5) setCode(''); 
    }
  }, [userName]);

  // --- PEGAR AQUÍ EL NUEVO EFECTO ---
useEffect(() => {
    // Si cambio de Pareja a Soltero, borro el código QR guardado
    if (relationshipStatus === 'single') {
        setCoupleNumber('');
    }
    // Si el juego se resetea a Lobby (Admin dio Reset All), limpiamos datos locales
    if (gameState?.mode === 'lobby' && !isJoined) {
        setCoupleNumber('');
    }
}, [relationshipStatus, gameState?.mode, isJoined]);

// --- TUTORIAL REACTIVO (NAGGING LOOP 5s) ---
useEffect(() => {
    // Si no ha entrado al juego, no hacemos nada
    if (!isJoined) return;

    const nagInterval = setInterval(() => {
      // 1. Si es Admin y el juego no ha empezado -> Recordar iniciar
      if (userName === 'admin' && gameState?.mode === 'lobby') {
        const startBtn = document.getElementById('btn-start-game');
        startBtn?.classList.add('animate-bounce');
        setTimeout(() => startBtn?.classList.remove('animate-bounce'), 1000);
      }

      // 2. Si es Jugador, ya entró, pero FALTA GÉNERO o STATUS -> Vibrar form
      if (userName !== 'admin' && (!gender || !relationshipStatus)) {
        if (navigator.vibrate) navigator.vibrate(200);
        const formContainer = document.getElementById('profile-form-container');
        formContainer?.classList.add('animate-shake'); 
        setTimeout(() => formContainer?.classList.remove('animate-shake'), 500);
      }

      // 3. CORRECCIÓN AQUÍ: Usamos !coupleNumber en lugar de !isLinked
      // Si es Mujer, está en Pareja y NO tiene número de pareja -> Animar input
      if (gender === 'female' && relationshipStatus === 'couple' && !coupleNumber) {
         const codeInput = document.getElementById('input-couple-code');
         codeInput?.focus(); 
      }

    }, 5000); 

    return () => clearInterval(nagInterval); 
    // CORRECCIÓN AQUÍ TAMBIÉN: Quitamos isLinked de la lista de dependencias
  }, [isJoined, userName, gameState?.mode, gender, relationshipStatus, coupleNumber]);

  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [codeTipShown, setCodeTipShown] = useState(false);
  const [resetTipShown, setResetTipShown] = useState(false);
  const [modeSwitchTipShown, setModeSwitchTipShown] = useState(false);
  const [viewSwitchTipShown, setViewSwitchTipShown] = useState(false);
  const [backToAdminTipShown, setBackToAdminTipShown] = useState(false);
  const [startRoundTipShown, setStartRoundTipShown] = useState(false);
  // Status to track sequence "Tell Code" -> "Wait Players"
  const [lobbySequence, setLobbySequence] = useState<'none' | 'tellingCode' | 'waitingPlayers'>('none');

  useEffect(() => {
      // Cerebro del Tutorial
      if (isAdmin && !viewAsPlayer) {
          const checkTutorial = () => {
              if (gameState?.mode === 'lobby') {
                  // 1. Falta Código (Obligatorio)
                  if (!gameState.code) {
                      setTutorialStep(1); return;
                  }
                  
                  // 1.5. Sequence: Tell Code (4s)
                  if (lobbySequence === 'tellingCode') {
                      setTutorialStep(15); return;
                  }
                  // 1.8. Sequence: Waiting Players (3s)
                  if (lobbySequence === 'waitingPlayers') {
                      setTutorialStep(18); return;
                  }

                  // 2. Faltan jugadores (Obligatorio si no hay secuencia activa)
                  if (players.length < 3 && lobbySequence === 'none') {
                      setTutorialStep(null); return; 
                  }
                  
                  // 3. Reset Players (Una vez, 3s)
                  if (players.length > 2 && !resetTipShown) {
                      setTutorialStep(3);
                      setTimeout(() => { setResetTipShown(true); setTutorialStep(null); }, 3000);
                      return;
                  }
                  // 4. Start Game (Obligatorio)
                  const couples = players.filter(p => p.relationshipStatus === 'couple');
                  const counts: Record<string, number> = {};
                  couples.forEach(p => counts[p.coupleNumber] = (counts[p.coupleNumber] || 0) + 1);
                  const incompleteIds = Object.keys(counts).filter(id => counts[id] !== 2);
                  const couplesValid = incompleteIds.length === 0;

                  if (players.length >= 3 && gameState.code && couplesValid) {
                      setTutorialStep(4); return;
                  }
              }
              else if (gameState?.mode === 'admin_setup') {
                   // 5. Switch Mode Tip (Una vez, 3s) - Forced before inputs
                   if (!modeSwitchTipShown) {
                        setTutorialStep(5);
                        setTimeout(() => { setModeSwitchTipShown(true); setTutorialStep(null); }, 3000);
                        return;
                   }
                   // 6. Validacion Obligatoria de Inputs
                   if (isAutoSetup && !selectedLevel) {
                        setTutorialStep(51); return;
                   }
                   if (!isAutoSetup) {
                       if (!selectedLevel) { setTutorialStep(52); return; }
                       if (!selectedType) { setTutorialStep(53); return; }
                   }
                   
                   // 7. Start Round Tip (4s)
                   if ((isAutoSetup && selectedLevel) || (!isAutoSetup && selectedLevel && selectedType)) {
                       if (!startRoundTipShown) {
                           setTutorialStep(6);
                           setTimeout(() => { setStartRoundTipShown(true); setTutorialStep(null); }, 4000);
                           return;
                       }
                   }
              }
              else if (['question', 'dare', 'yn'].includes(gameState?.mode || '')) {
                   // 8. View Switch Tip (Una vez, 4s)
                   if (!viewSwitchTipShown) {
                       setTutorialStep(7);
                       setTimeout(() => { setViewSwitchTipShown(true); setTutorialStep(null); }, 4000);
                       return;
                   }
              }
              
              setTutorialStep(null);
          };

          checkTutorial();
          const timer = setInterval(checkTutorial, 5000); 
          return () => clearInterval(timer);
      } else if (isAdmin && viewAsPlayer) {
          // 9. Back to Admin Tip (Una vez, 4s)
          if (!backToAdminTipShown) {
              setTutorialStep(8);
              setTimeout(() => { setBackToAdminTipShown(true); setTutorialStep(null); }, 4000);
          }
      }
  }, [isAdmin, viewAsPlayer, gameState?.mode, gameState?.code, players.length, lobbySequence, resetTipShown, modeSwitchTipShown, startRoundTipShown, viewSwitchTipShown, backToAdminTipShown, selectedLevel, selectedType, isAutoSetup]);


  // --- HELPER STYLES ---
  const getLevelStyle = (level: string | undefined) => {
    switch (level) {
      case '4': return 'border-red-600/50 shadow-[0_0_50px_rgba(220,38,38,0.4)] bg-gradient-to-b from-red-950/80 to-black';
      case '3': return 'border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.3)] bg-gradient-to-b from-orange-950/80 to-black';
      case '2': return 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] bg-gradient-to-b from-yellow-950/80 to-black';
      case '1': return 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)] bg-gradient-to-b from-green-950/80 to-black';
      default: return 'border-white/10 bg-white/5';
    }
  };

  // 0. GLOBALS
  useEffect(() => {
    document.body.style.background = 'radial-gradient(circle at center, #1a1a2e 0%, #000000 100%)';
    document.body.style.color = 'white';
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // 1. AUTH & DATA FETCHING
  useEffect(() => {
    const initAuth = async () => { try { await signInAnonymously(auth); } catch (e) { console.error(e); } };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      const savedName = localStorage.getItem('td_username');
      if (savedName) {
          setUserName(savedName);
          if (savedName.toLowerCase() === 'admin') setIsAdmin(true);
      }
    });
  }, []);

  useEffect(() => {
    if (user && players.length > 0) {
        const me = players.find(p => p.uid === user.uid);
        if (me) {
            if (me.coupleNumber && me.coupleNumber !== coupleNumber) setCoupleNumber(me.coupleNumber);
            if (me.relationshipStatus && me.relationshipStatus !== relationshipStatus) setRelationshipStatus(me.relationshipStatus);
            if (me.name && me.name !== userName) setUserName(me.name);
            if (me.gender && me.gender !== gender) setGender(me.gender);
        }
    }
  }, [user, players]);

  useEffect(() => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GameState;
        setGameState(data);
        if (data.isAutoMode !== undefined) setIsAutoSetup(data.isAutoMode);
        if (data.roundLevel && data.roundLevel !== selectedLevel) setSelectedLevel(data.roundLevel);
        if (data.nextType && data.nextType !== selectedType) setSelectedType(data.nextType);
      } else {
        setDoc(gameRef, { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', timestamp: serverTimestamp(), matchHistory: [] });
      }
      setLoading(false);
    });
    const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsubPlayers = onSnapshot(query(playersRef), (snapshot) => {
      const pList = snapshot.docs.map(d => d.data() as Player);
      pList.sort((a, b) => (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0));
      setPlayers(pList);
    });
    const challengesRef = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
    const unsubChallenges = onSnapshot(query(challengesRef), (snapshot) => { setChallenges(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Challenge))); });
    const pairChallengesRef = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
    const unsubPairChallenges = onSnapshot(query(pairChallengesRef), (snapshot) => { setPairChallenges(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Challenge))); });
    return () => { unsubGame(); unsubPlayers(); unsubChallenges(); unsubPairChallenges(); };
  }, [user]);
  useEffect(() => {
    console.log("View changed to:", viewAsPlayer ? "Player" : "Admin");
    if (!viewAsPlayer) {
      console.log("Forzando no loading al volver a admin");
      setLoading(false); // Force no loading al volver a admin
    }
  }, [viewAsPlayer]);
    
  useEffect(() => {
    if(challenges.length > 0 || pairChallenges.length > 0){
        const availableChallenges = [...challenges, ...pairChallenges].filter(c => !c.answered && !c.paused && c.level);
        const levels = availableChallenges.map(c => c.level?.toString());
        const allLevels = [...new Set(levels)].filter(l => l && l !== 'undefined');
        setUniqueLevels(allLevels.sort((a,b) => a.localeCompare(b, undefined, {numeric: true})));
    }
  }, [challenges, pairChallenges]);

  useEffect(() => {
    if (gameState?.currentChallengeId && !currentCard()) {
      const coll = gameState.mode === 'yn' ? 'pairChallenges' : 'challenges';
      getDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, gameState.currentChallengeId)).then(docSnap => {
        if (docSnap.exists()) {
          setFetchedCard({id: docSnap.id, ...docSnap.data()} as Challenge);
        }
      });
    }
  }, [gameState?.currentChallengeId, gameState?.mode]);

  useEffect(() => {
    if (!isAdmin || !gameState || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') return;
    let shouldAdvance = false;
    if (gameState.mode === 'yn') {
        const totalAnswers = Object.keys(gameState.answers).length;
        if (totalAnswers >= players.length) shouldAdvance = true;
    } else {
        const totalVotes = Object.keys(gameState.votes).length;
        const realPlayers = players.filter(p => !p.isBot);
        const neededVotes = realPlayers.length - 1;
        if (totalVotes >= neededVotes) shouldAdvance = true;
    }
    if (shouldAdvance) {
        // CORRECCIÓN: Aumentado a 4000ms (4 segundos) para ver el resultado
        const timer = setTimeout(() => { nextTurn(); }, 4000); 
        return () => clearTimeout(timer);
    }
    // (Aquí no debe haber nada)
  }, [gameState, isAdmin, players.length]);

  // --- LOGICA DE JUEGO ---
  const showError = (msg: string) => setCustomError(msg);
  const closeError = () => setCustomError(null);
  const showSuccess = (msg: string) => { setCustomSuccess(msg); setTimeout(() => setCustomSuccess(null), 3000); };
  const handleUpdateName = async () => { if (!newName.trim() || !user) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { name: newName }); setUserName(newName); localStorage.setItem('td_username', newName); setIsEditingName(false); } catch (e) { showError("Could not update name."); } };
  const handleKickPlayer = async (uid: string, name: string) => { if(confirm(`Reset player ${name}?`)) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid)); } };
  const handleSelfLeave = async () => { if (!user) return; if (confirm("Are you sure you want to leave and reset?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid)); } };
  const checkCouplesCompleteness = () => { const couples = players.filter(p => p.relationshipStatus === 'couple'); const counts: Record<string, number> = {}; couples.forEach(p => counts[p.coupleNumber] = (counts[p.coupleNumber] || 0) + 1); const incompleteIds = Object.keys(counts).filter(id => counts[id] !== 2); return { valid: incompleteIds.length === 0, incompleteIds }; };

  const createGame = async (codeOverride?: any) => {
    if (!userName.trim()) {
        alert("⛔ ERROR: Please enter a Nickname.");
        return;
    }
    if (!gender || !relationshipStatus) {
        alert("⛔ ERROR: Please select Gender and Status.");
        return;
    }
    if (!user) return;
    
    // TRUCO: Si codeOverride es un string (el código manual), úsalo. 
    // Si no (es un evento de click), usa el estado 'coupleNumber'.
    const finalCoupleNumber = (typeof codeOverride === 'string' && codeOverride) ? codeOverride : coupleNumber;

    // Validación usando el valor final real
    if (relationshipStatus === 'couple' && !finalCoupleNumber) {
        alert("Please link with your partner first!");
        return;
    }

    setIsAdmin(true);
    localStorage.setItem('td_username', userName);

    // 1. Crear Sala
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data'), {
      code: code, 
      mode: 'lobby',
      currentTurn: null,
      adminUid: user.uid,
      createdAt: serverTimestamp(),
      riskLevel: 1,
      autoLoop: false,
      loopConfig: { truth: 1, dare: 1, match: 1 },
      loopIndex: 0,
      loopSequence: [],
      lastAction: 'CREATED'
    });
    
    // 2. Crear Jugador Admin (USANDO finalCoupleNumber)
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
      uid: user.uid, 
      name: userName, 
      gender: gender, 
      relationshipStatus: relationshipStatus, 
      // AQUÍ ESTÁ LA SOLUCIÓN: Usamos la variable local, no el estado lento
      coupleNumber: relationshipStatus === 'couple' ? finalCoupleNumber : 'ADMIN', 
      joinedAt: serverTimestamp(), 
      isActive: true, 
      isBot: false,
      matches: 0, 
      mismatches: 0
    });
  };

  // --- FUNCIÓN CORREGIDA ---
  const joinGame = async (codeOverride?: any) => {
    // 1. VALIDACIÓN INICIAL DE CAMPOS
    if (!userName.trim()) {
        alert("⛔ Please enter a Nickname.");
        return;
    }
    if (!gender || !relationshipStatus) {
        alert("⛔ Please, enter Gender & Status");
        return;
    }

    // 2. CERRAR MODAL INMEDIATAMENTE
    setShowScanner(false);

    if (!user) return;

   

    // 4. DETERMINAR CÓDIGO DE PAREJA
    // Usamos el que viene del modal (codeOverride) o el del estado
    const actualCoupleInput = (typeof codeOverride === 'string' && codeOverride) ? codeOverride : coupleNumber;
    let finalCoupleNumber = actualCoupleInput;

    if (relationshipStatus === 'single') {
        finalCoupleNumber = 'SGL_' + user.uid.slice(-6); 
    } else {
        // Si es pareja, DEBE tener número
        if (!finalCoupleNumber) {
            alert("Please link with your partner first!"); 
            return;
        }
    }

    try {
        // 5. GUARDAR EN FIREBASE
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { 
            uid: user.uid, 
            name: userName, 
            gender: gender || 'unknown', 
            coupleNumber: finalCoupleNumber, 
            relationshipStatus: relationshipStatus, 
            joinedAt: serverTimestamp(), 
            isActive: true, 
            isBot: false, 
            matches: 0, 
            mismatches: 0 
        });
        
        // 6. ENTRAR AL JUEGO
        setIsJoined(true); 
        localStorage.setItem('td_username', userName);

    } catch (error) {
        console.error("Error al unirse:", error);
        alert("Error joining. See console.");
    }
  };    
  
  const setGameCode = async () => { 
      if (!code.trim()) return; 
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { code: code.trim().toUpperCase() }); 
      setIsSettingCode(false);
      // Trigger sequence
      setLobbySequence('tellingCode');
      setTimeout(() => {
          setLobbySequence('waitingPlayers');
          setTimeout(() => setLobbySequence('done'), 4000); // 4 seconds for Telling Code
      }, 4000); 
  };

  const updateGlobalLevel = async (newLvl: string) => { setSelectedLevel(newLvl); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { roundLevel: newLvl }); };
  const updateGlobalType = async (newType: string) => { setSelectedType(newType); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { nextType: newType }); };
  const toggleAutoMode = async () => { 
    const newMode = !gameState?.isAutoMode; 
    let updates: any = { isAutoMode: newMode };
    
    // CORRECCIÓN: Si activamos el modo (newMode es true), SIEMPRE regeneramos la secuencia
    // con los valores actuales de los inputs (qtyTruth, etc.), eliminando la condición vieja.
    if (newMode) { 
        let sequence: string[] = []; 
        for(let i=0; i<qtyTruth; i++) sequence.push('question');
        for(let i=0; i<qtyDare; i++) sequence.push('dare'); 
        for(let i=0; i<qtyMM; i++) sequence.push('yn'); 
        
        // Solo actualizamos si hay algo en la secuencia
        if (sequence.length > 0) {
            updates.sequence = sequence; 
            updates.sequenceIndex = 0; // Reiniciamos el ciclo al principio
        }
    } 
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates); 
};
  const startGame = async () => {
    const realPlayers = players.filter(p => !p.isBot);
    if (realPlayers.length < 3) { showError("You need at least 3 players to start!"); return; }
    const { total } = checkPendingSettings();
    if (total > 0) { showError(`Cannot start! There are ${total} questions without Level/Type/Gender set.`); return; }
    const { valid, incompleteIds } = checkCouplesCompleteness();
    if (!valid) { showError(`Cannot start! Missing partner for IDs: ${incompleteIds.join(', ')}`); return; }
    if (realPlayers.length % 2 !== 0) {
        const males = realPlayers.filter(p => p.gender === 'male').length;
        const females = realPlayers.filter(p => p.gender === 'female').length;
        let botName = "Brad Pitt"; let botGender = "male"; if (males > females) { botName = "Scarlett Johansson"; botGender = "female"; }
        const botUid = 'bot_' + Date.now();
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', botUid), { uid: botUid, name: botName, gender: botGender, coupleNumber: '999', relationshipStatus: 'single', joinedAt: serverTimestamp(), isActive: true, isBot: true, matches: 0, mismatches: 0 });
        showError(`Odd number of players. Added bot: ${botName}!`);
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', matchHistory: [], isEnding: false });
  };
  
// --- FUNCIÓN DE RESETEO (PEGAR ANTES DEL RETURN) ---
const resetGame = async () => {
    if (!window.confirm("⚠️ ¿RESET TOTAL? Esto expulsará a TODOS los jugadores (incluido tú) y reiniciará el código.")) return;

    try {
      // 1. Borrar jugadores uno por uno
      const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
      const snapshot = await getDocs(playersRef);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // 2. Generar nuevo código y reiniciar juego
      const newCode = Math.floor(10000 + Math.random() * 90000).toString();
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data'), {
        code: newCode,
        mode: 'lobby',
        currentTurn: null,
        loopSequence: [],
        lastAction: 'RESET_ALL' // Esto avisará a los clientes que se reinicien
      });

      // 3. Forzar salida local del Admin (para que vea la pantalla de inicio)
      setIsJoined(false);
      setUserName('');
      // Opcional: window.location.reload(); para asegurar limpieza total

    } catch (error) {
      console.error("Error reset:", error);
    }
  };

  // PAIR LOGIC
  const computePairs = () => { 
      const pairs: Record<string, string> = {}; 
      const used = new Set<string>();
      const males = players.filter(p => p.gender === 'male' && p.isActive).sort(() => Math.random() - 0.5);
      const females = players.filter(p => p.gender === 'female' && p.isActive).sort(() => Math.random() - 0.5);
      for (const male of males) {
          const matchIndex = females.findIndex(f => !used.has(f.uid) && f.coupleNumber !== male.coupleNumber);
          if (matchIndex !== -1) {
              const female = females[matchIndex];
              pairs[male.uid] = female.uid;
              pairs[female.uid] = male.uid;
              used.add(male.uid);
              used.add(female.uid);
          }
      }
      return pairs; 
  };

  const startRound = async () => {
    if (isAutoSetup) { if (!selectedLevel) { showError("⚠️ Select a Level to start Auto Mode!"); return; } } else { if (!selectedLevel) { showError("⚠️ Select Risk Level!"); return; } if (!selectedType) { showError("⚠️ Select Game Type!"); return; } }
    let sequence: string[] = []; if (isAutoSetup) { for(let i=0; i<qtyTruth; i++) sequence.push('question'); for(let i=0; i<qtyDare; i++) sequence.push('dare'); for(let i=0; i<qtyMM; i++) sequence.push('yn'); }
    let initialMode = isAutoSetup && sequence.length > 0 ? sequence[0] : (selectedType === 'yn' ? 'yn' : selectedType === 'truth' ? 'question' : 'dare');
    let typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';
    if (typeChar === 'YN' && players.length < 3) { showError("❌ You need at least 3 players to play Match/Mismatch!"); return; }
    const firstPlayerGender = players.length > 0 ? players[0].gender : 'male';
    let currentLvl = parseInt(selectedLevel);
    let found = null;
    let collectionName = typeChar === 'YN' ? 'pairChallenges' : 'challenges';
    let lvlString = currentLvl.toString();
    let ref = collection(db, 'artifacts', appId, 'public', 'data', collectionName);
    let q = query(ref, where('level', '==', lvlString), where('answered', '==', false));
    if(typeChar !== 'YN') {
        q = query(ref, where('type', '==', typeChar), where('level', '==', lvlString), where('answered', '==', false));
    }
    const snapshot = await getDocs(q);
    let validDocs = snapshot.docs.filter(d => !d.data().paused);
    if (typeChar !== 'YN') {
        validDocs = validDocs.filter(d => {
            const data = d.data();
            const qSex = (data.gender || data.sexo || 'B').toUpperCase();
            if (qSex === 'B') return true;
            if (firstPlayerGender === 'male') return qSex !== 'F';
            else return qSex !== 'M';
        });
    }
    if (validDocs.length > 0) {
        found = validDocs[Math.floor(Math.random() * validDocs.length)];
    } else {
        const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel, firstPlayerGender);
        if(nextChallenge) {
             found = { id: nextChallenge.id, data: () => nextChallenge };
        }
    }
    const nextChallengeToUse = found ? { id: found.id, ...found.data() } as Challenge : null;
    
    if (!nextChallengeToUse) { showError('No challenges found for this selection.'); return; }
    let initialAnswers: Record<string, string> = {};
    if (initialMode === 'yn') { players.filter(p => p.isBot).forEach(b => { initialAnswers[b.uid] = Math.random() > 0.5 ? 'yes' : 'no'; }); }
    let updates: any = { mode: initialMode, currentTurnIndex: 0, answers: initialAnswers, votes: {}, adminUid: players[0].uid, currentChallengeId: nextChallengeToUse.id, roundLevel: selectedLevel, isAutoMode: isAutoSetup, sequence: sequence, sequenceIndex: 0 };
    if (initialMode === 'yn') updates.pairs = computePairs();
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
    const coll = initialMode === 'yn' ? 'pairChallenges' : 'challenges';
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallengeToUse.id!), { answered: true });
  };
  const submitAnswer = async (val: string) => { if (!user) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`answers.${user.uid}`]: val }); };
  const submitVote = async (vote: string) => { if (!user) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`votes.${user.uid}`]: vote }); };
  const findNextAvailableChallenge = async (type: string, startLevel: string, playerGender: string) => { let currentLvl = parseInt(startLevel); let found = null; let collectionName = type === 'YN' ? 'pairChallenges' : 'challenges'; for(let i = 0; i < 10; i++) { let lvlString = (currentLvl + i).toString(); let ref = collection(db, 'artifacts', appId, 'public', 'data', collectionName); let q = query(ref, where('level', '==', lvlString), where('answered', '==', false)); if(type !== 'YN') { q = query(ref, where('type', '==', type), where('level', '==', lvlString), where('answered', '==', false)); } const snapshot = await getDocs(q); let validDocs = snapshot.docs.filter(d => !d.data().paused); if (type !== 'YN') { validDocs = validDocs.filter(d => { const data = d.data(); const qSex = (data.gender || data.sexo || 'B').toUpperCase(); if (qSex === 'B') return true; if (playerGender === 'male') { return qSex !== 'F'; } else { return qSex !== 'M'; } }); } if (validDocs.length > 0) { found = validDocs[Math.floor(Math.random() * validDocs.length)]; break; } } if(found) return { id: found.id, ...found.data() } as Challenge; return null; };
  const nextTurn = async () => { if (!gameState) return; const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'); if (gameState.isEnding) { await updateDoc(gameRef, { mode: 'ended' }); return; } let updates: any = {}; const points = { ...(gameState.points || {}) }; const batch = writeBatch(db); if (gameState.mode === 'question') { const currentUid = players[gameState.currentTurnIndex]?.uid; const likeVotes = Object.values(gameState.votes || {}).filter(v => v === 'like').length; if(currentUid) points[currentUid] = (points[currentUid] || 0) + likeVotes; } else if (gameState.mode === 'dare') { const currentUid = players[gameState.currentTurnIndex]?.uid; const yesVotes = Object.values(gameState.votes || {}).filter(v => v === 'yes').length; if(currentUid) points[currentUid] = (points[currentUid] || 0) + yesVotes; } else if (gameState.mode === 'yn') { const processed = new Set(); const currentHistory = [...(gameState.matchHistory || [])]; Object.keys(gameState.pairs || {}).forEach(uid1 => { if (processed.has(uid1)) return; const uid2 = gameState.pairs![uid1]; processed.add(uid1); processed.add(uid2); const ans1 = gameState.answers[uid1]; const ans2 = gameState.answers[uid2]; const p1 = players.find(p=>p.uid===uid1); const p2 = players.find(p=>p.uid===uid2); if (ans1 && ans2) { const isMatch = ans1 === ans2; if (isMatch) { points[uid1] = (points[uid1] || 0) + 1; points[uid2] = (points[uid2] || 0) + 1; } if (p1 && p2) { currentHistory.push({ u1: uid1, u2: uid2, name1: p1.name, name2: p2.name, result: isMatch ? 'match' : 'mismatch', timestamp: Date.now() }); } batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid1), { matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) }); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid2), { matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) }); } }); updates.matchHistory = currentHistory; await batch.commit(); } updates.points = points; let roundFinished = false; if (gameState.mode === 'yn') { roundFinished = true; } else { let nextIdx = gameState.currentTurnIndex + 1; while(nextIdx < players.length && players[nextIdx].isBot) { nextIdx++; } if (nextIdx < players.length) { updates.currentTurnIndex = nextIdx; updates.answers = {}; updates.votes = {}; const typeChar = gameState.mode === 'question' ? 'T' : 'D'; const nextPlayerGender = players[nextIdx].gender; const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', nextPlayerGender); if (nextChallenge) { updates.currentChallengeId = nextChallenge.id; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'challenges', nextChallenge.id!), { answered: true }); } else { roundFinished = true; } } else { roundFinished = true; } } if (roundFinished) { if (gameState.isAutoMode && gameState.sequence) { let nextSeqIdx = (gameState.sequenceIndex || 0) + 1; if (nextSeqIdx >= gameState.sequence.length) { nextSeqIdx = 0; } const nextModeKey = gameState.sequence[nextSeqIdx]; let mode = nextModeKey === 'truth' ? 'question' : nextModeKey; if(mode === 'truth') mode = 'question'; let typeChar = mode === 'yn' ? 'YN' : mode === 'question' ? 'T' : 'D'; const nextPlayerGender = players.length > 0 ? players[0].gender : 'male'; const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', nextPlayerGender); if (nextChallenge) { updates.mode = mode; updates.currentTurnIndex = 0; updates.sequenceIndex = nextSeqIdx; updates.answers = {}; updates.votes = {}; updates.currentChallengeId = nextChallenge.id; if (mode === 'yn') { updates.pairs = computePairs(); players.filter(p => p.isBot).forEach(b => { updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no'; }); } const coll = mode === 'yn' ? 'pairChallenges' : 'challenges'; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true }); } else { updates.mode = 'admin_setup'; } } else { updates.mode = 'admin_setup'; updates.currentTurnIndex = 0; updates.answers = {}; updates.votes = {}; } } await updateDoc(gameRef, updates); };

  // ... (Manager Logic)
  const handleSort = (key: keyof Challenge) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const handleRowMouseDown = (id: string, e: React.MouseEvent) => { setIsDragging(true); const newSet = new Set(selectedIds); if (newSet.has(id)) { newSet.delete(id); selectionMode.current = 'remove'; } else { newSet.add(id); selectionMode.current = 'add'; } setSelectedIds(newSet); };
  const handleRowMouseEnter = (id: string) => { if (isDragging) { const newSet = new Set(selectedIds); if (selectionMode.current === 'add') newSet.add(id); else newSet.delete(id); setSelectedIds(newSet); } };
  const toggleSelectAll = (filteredData: Challenge[]) => { if (selectedIds.size === filteredData.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredData.map(c => c.id!))); };
  const updateSingleField = async (collectionName: string, id: string, field: string, value: string | boolean) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id), { [field]: value }); };
  const applyBulkEdit = async () => { if (selectedIds.size === 0) return; const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; if (!confirm(`Update ${selectedIds.size}?`)) return; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); const updates: any = {}; if (bulkLevel) updates.level = bulkLevel; if (managerTab !== 'mm' && bulkGender) updates.gender = bulkGender; batch.update(ref, updates); }); await batch.commit(); setBulkLevel(''); setBulkGender(''); setSelectedIds(new Set()); };
  const deleteSelected = async () => { if (selectedIds.size === 0) return; const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; if (!confirm(`Delete ${selectedIds.size}?`)) return; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.delete(ref); }); await batch.commit(); setSelectedIds(new Set()); };
  const bulkPause = async (pauseStatus: boolean) => { if (selectedIds.size === 0) return; const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.update(ref, { paused: pauseStatus }); }); await batch.commit(); setSelectedIds(new Set()); };
  const checkPendingSettings = () => { const pendingTD = challenges.filter(c => !c.level || !c.type || (!c.gender && !c.sexo)).length; const pendingMM = pairChallenges.filter(c => !c.level).length; return { pendingTD, pendingMM, total: pendingTD + pendingMM }; };
  const handleExportCSV = (isTemplate: boolean) => { const isMM = managerTab === 'mm'; const headers = !isMM ? "text,level,gender" : "male,female,level"; let csvContent = "data:text/csv;charset=utf-8," + headers + "\n"; if (!isTemplate) { const data = isMM ? pairChallenges : challenges.filter(c => c.type === (managerTab === 'truth' ? 'T' : 'D')); data.forEach(row => { if (!isMM) { const safeText = `"${(row.text || '').replace(/"/g, '""')}"`; csvContent += `${safeText},${row.level||''},${row.gender||row.sexo||''}\n`; } else { const safeMale = `"${(row.male || '').replace(/"/g, '""')}"`; const safeFemale = `"${(row.female || '').replace(/"/g, '""')}"`; csvContent += `${safeMale},${safeFemale},${row.level||''}\n`; } }); } const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", isTemplate ? `template_${managerTab}.csv` : `export_${managerTab}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); };
  const handleUploadSingleCol = async (e: React.ChangeEvent<HTMLInputElement>, fixedType: 'T' | 'D') => { const file = e.target.files?.[0]; if(!file) return; const text = await file.text(); const lines = text.split(/\r?\n/); const headerLine = lines[0].toLowerCase().trim(); if (!headerLine.includes('text') || !headerLine.includes('level') || !headerLine.includes('gender')) { showError(`Invalid CSV for ${fixedType === 'T' ? 'Truth' : 'Dare'}.\nExpected headers: text, level, gender\nFound: ${headerLine}`); return; } setUploading(true); const ref = collection(db, 'artifacts', appId, 'public', 'data', 'challenges'); const batch = writeBatch(db); let count = 0; lines.slice(1).forEach(line => { if(!line.trim()) return; const parts = parseCSVLine(line); if (!parts) return; const textVal = parts[0]?.trim(); const levelVal = parts[1]?.trim(); const genderVal = parts[2]?.trim(); if(textVal) { const docRef = doc(ref); batch.set(docRef, { text: textVal, level: levelVal, type: fixedType, gender: genderVal, answered: false, paused: false }); count++; } }); await batch.commit(); setUploading(false); showSuccess(`Uploaded ${count} ${fixedType === 'T' ? 'Truth' : 'Dare'} questions.`); if(e.target) e.target.value = ''; };
  const handleUploadDoubleCol = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if(!file) return; const text = await file.text(); const lines = text.split(/\r?\n/); const headerLine = lines[0].toLowerCase().trim(); if (!headerLine.includes('male') || !headerLine.includes('female') || !headerLine.includes('level')) { showError(`Invalid CSV for Match/Mismatch.\nExpected headers: male, female, level\nFound: ${headerLine}`); return; } setUploading(true); const ref = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges'); const batch = writeBatch(db); let count = 0; lines.slice(1).forEach(line => { if(!line.trim()) return; const parts = parseCSVLine(line); if (!parts) return; const male = parts[0]?.trim(); const female = parts[1]?.trim(); const level = parts[2]?.trim(); if (male && female) { const docRef = doc(ref); batch.set(docRef, { male, female, level, answered: false, paused: false }); count++; } }); await batch.commit(); setUploading(false); showSuccess(`Uploaded ${count} Match/Mismatch questions.`); if(e.target) e.target.value = ''; };
  const handleEndGame = async () => { if(confirm('End game after this round?')) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { isEnding: true }); } };
  const handleReturnToSetup = async () => { if(confirm('Start a new game (Return to Setup)?')) { const batch = writeBatch(db); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', currentTurnIndex: 0, answers: {}, votes: {}, isEnding: false }); await batch.commit(); } };
  const handleRestart = async () => { if(confirm('RESET EVERYTHING? Use this only for a new party.')) { setCustomError(null); setIsAutoSetup(false); setSelectedLevel(''); const batch = writeBatch(db); (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'players'))).forEach(d=>batch.delete(d.ref)); (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'challenges'))).forEach(d=>batch.update(d.ref, {answered:false})); (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges'))).forEach(d=>batch.update(d.ref, {answered:false})); batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', adminUid: null, matchHistory: [], isEnding: false }); await batch.commit(); } };
  const currentPlayerName = () => gameState && players.length > 0 ? players[gameState?.currentTurnIndex]?.name : 'Nobody';
  const currentPlayer = () => gameState && players.length > 0 ? players[gameState?.currentTurnIndex] : null;
  const currentCard = () => { if (!gameState || !gameState?.currentChallengeId) return undefined; if (gameState.mode === 'yn') return pairChallenges.find(c => c.id === gameState?.currentChallengeId); return challenges.find(c => c.id === gameState?.currentChallengeId); };
  const getCardText = (c: Challenge | undefined) => { if (!c) return 'Loading...'; if (gameState?.mode === 'yn') { if (isAdmin) return `M: ${c.male} / F: ${c.female}`; const myPlayer = players.find(p => p.uid === user?.uid); if (!myPlayer) return 'Waiting...'; return myPlayer.gender === 'female' ? c.female : c.male; } return c.text || 'No text found'; };
  
  const isMyTurn = () => gameState && players[gameState?.currentTurnIndex]?.uid === user?.uid;

  // --- COMPONENTS ---
  const CustomAlert = () => customError ? ( <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[150]"> <div className={`p-6 max-w-md text-center ${glassPanel} border-red-500/50`}> <AlertTriangle className="mx-auto text-red-500 mb-2" size={40}/> <p className="text-white mb-4 whitespace-pre-line font-medium">{customError}</p> <button onClick={closeError} className="bg-red-600/80 hover:bg-red-500 px-6 py-2 rounded font-bold transition-colors">OK</button> </div> </div> ) : null;
  const CustomSuccess = () => customSuccess ? ( <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-2 z-[150] animate-in fade-in slide-in-from-top-4"> <CheckCircle size={20} /> <span className="font-bold">{customSuccess}</span> </div> ) : null;
  
  const MyMatchHistory = () => {
      const myUid = user?.uid;
      const history = gameState?.matchHistory || [];
      const stats: Record<string, {name: string, m: number, um: number}> = {};
      history.forEach(h => {
          if (h.u1 !== myUid && h.u2 !== myUid) return;
          const isU1 = h.u1 === myUid;
          const partnerName = isU1 ? h.name2 : h.name1;
          const partnerUid = isU1 ? h.u2 : h.u1;
          if (!stats[partnerUid]) { stats[partnerUid] = { name: partnerName, m: 0, um: 0 }; }
          if (h.result === 'match') { stats[partnerUid].m += 1; } else { stats[partnerUid].um += 1; }
      });
      if (Object.keys(stats).length === 0) return null;
      return (
          <div className={`w-full p-2 mt-2 max-h-32 overflow-y-auto ${glassPanel}`}>
              <div className="text-xs text-slate-400 mb-1 uppercase font-bold text-center tracking-widest">Interactions</div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/10 text-slate-400"><th className="text-left py-1">Name</th><th className="text-center py-1 text-green-400">Match</th><th className="text-center py-1 text-red-400">Miss</th></tr></thead>
                <tbody>{Object.values(stats).map((s, idx) => (<tr key={idx} className="border-b border-white/5"><td className="py-1 font-bold">{s.name}</td><td className="py-1 text-center font-bold text-green-400">{s.m}</td><td className="py-1 text-center font-bold text-red-400">{s.um}</td></tr>))}</tbody>
              </table>
          </div>
      );
  };
  
  const ScoreBoard = () => (
      <div className={`w-full p-2 mb-2 flex flex-col items-center gap-2 max-h-40 overflow-y-auto ${glassPanel}`}>
          <div className="w-full text-xs text-center text-cyan-300 uppercase font-black tracking-[0.2em] border-b border-white/10 pb-1 mb-1">Scoreboard</div>
          <div className="flex flex-wrap gap-2 justify-center w-full">
            {players.map(p => (
                <div key={p.uid} className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-2 border ${p.isBot ? 'bg-purple-900/30 border-purple-500/50' : 'bg-white/10 border-white/10'}`}>
                    <span className="font-bold text-white">{p.name}</span>
                    <span className="text-yellow-400 font-black">{gameState?.points?.[p.uid] || 0}</span>
                    {isAdmin && (<button onClick={(e) => { e.stopPropagation(); handleKickPlayer(p.uid, p.name); }} className="text-red-400 hover:text-red-200 transition-colors" title="Reset Player"><Trash2 size={12}/></button>)}
                </div>
            ))}
          </div>
      </div>
  );

  // --- RENDER ---
  if (loading) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mb-4"></div><span className="animate-pulse">Loading System...</span></div>;

  // --- PANTALLA DE INGRESO (LOBBY) ---
  // --- PANTALLA DE INGRESO (LOBBY) ---
// --- PANTALLA DE INGRESO (LOBBY) ---
// =================================================================
    // BLOQUE DE LOGIN (SI VES "SET GAME CODE" ES QUE NO PEGÁSTE ESTO)
    // =================================================================
    if (!isJoined) return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            
            {/* FONDO ANIMADO */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black"></div>
            </div>

            <div id="profile-form-container" className="w-full max-w-md relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                
                {/* CABECERA */}
                <div className="mb-6 relative inline-block"><Flame className="w-16 h-16 text-pink-500 relative z-10 mx-auto drop-shadow-lg" /></div>
                <h1 className="text-4xl font-black mb-8 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500">SEXY GAME</h1>
                
                {/* 1. INPUT NOMBRE */}
                <div className="relative mb-4 w-full">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20}/>
                    <input type="text" placeholder="" className="w-full pl-12 py-4 font-bold tracking-wider text-center text-xl text-yellow-400 placeholder:text-white/20 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-pink-500 transition-all" value={userName} onChange={e=>setUserName(e.target.value)} onBlur={(e) => { if (!e.target.value.trim()) alert("Nickname cannot be empty!"); }} maxLength={12}/>
                </div>
                
                {/* 2. SELECTORES */}
                <div className="grid grid-cols-2 gap-4 mb-6 w-full">
                    <div className="relative">
                        <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl text-white p-4 focus:outline-none text-center"><option value="" disabled>Gender</option><option value="male">Male</option><option value="female">Female</option></select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16}/>
                    </div>
                    <div className="relative">
                        <select value={relationshipStatus} onChange={e=>setRelationshipStatus(e.target.value as 'single'|'couple')} className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl text-white p-4 focus:outline-none text-center"><option value="" disabled>Status</option><option value="single">Single</option><option value="couple">Couple</option></select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16}/>
                    </div>
                </div>
                
                {/* 3. CÓDIGO (AQUÍ ESTÁ EL ARREGLO VISUAL) */}
                {userName.toLowerCase().trim() === 'admin' ? (
                   /* ---> SI SOY ADMIN: VEO MI CÓDIGO GIGANTE (NO INPUT) <--- */
                   <div className="mb-8 w-full relative group animate-in zoom-in">
                      <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative w-full py-4 bg-black/80 border border-white/10 rounded-xl flex flex-col items-center justify-center">
                          <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Your Party Code</span>
                          <span className="text-3xl font-black font-mono tracking-[0.3em] text-white shadow-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                            {code || '...'}
                          </span> 
                      </div>
                   </div>
                ) : (
                   /* ---> SI SOY JUGADOR: VEO EL INPUT DE CÓDIGO <--- */
                   <div className="relative mb-8 w-full">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20}/>
                    <input 
                    type="number" inputMode="numeric" pattern="[0-9]*" placeholder="ENTER GAME CODE (Ask the Admin)" 
                    className="w-full pl-12 py-4 text-center tracking-[0.5em] font-mono font-bold text-2xl bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500 transition-all text-white placeholder:text-white placeholder:text-sm placeholder:tracking-widest placeholder:font-bold"
                    value={code} 
                    onChange={e=>setCode(e.target.value)} 
                    />
                    </div>
                
                    )}
                
                    {/* 4. BOTONES */}
                    <div className="w-full">
                    {relationshipStatus === 'couple' && !coupleNumber ? (
                    <>
                        <span className="block text-xs text-white/50 uppercase mb-1 tracking-widest font-bold text-center">ENTER GAME CODE</span>
                        <button onClick={() => {
                        if (!code.trim()) {
                            alert("Enter Game Code (ask the Admin)");
                            return;
                        }
                        setShowScanner(true);
                        }} className="w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/50">
                        <HeartHandshake size={24} />
                        </button>
                        <span className="block text-xs text-white/50 mt-1 text-center">(Ask to the Admin)</span>
                    </>
                    ) : (
                    // el resto no cambia, but ensure this is followed by valid JSX
                    userName.toLowerCase().trim() === 'admin' ? (
                                <button 
                                onClick={() => {
                                    if (!gender || !relationshipStatus) {
                                    alert("Please, fill Gender and Status");
                                    return;
                                    }
                                    if (!code.trim()) {
                                    alert("Enter Game Code (ask the Admin)");
                                    return;
                                    }
                                    joinGame();
                                }} 
                                className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-all shadow-lg hover:shadow-pink-500/50 ${gradientBtn}`}
                                >
                                {coupleNumber ? 'ENTER (LINKED)' : 'JOIN PARTY'}
                                </button>
                            ) : (
                                <button 
                                onClick={() => {
                                if (!gender || !relationshipStatus) {
                                alert("Please, fill Gender and Status");
                                return;
                                }
                                if (!code.trim()) {
                                alert("Enter the Game Code (ask the Admin)");
                                return;
                                }
                                joinGame();
                            }} 
                            className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-all shadow-lg hover:shadow-pink-500/50 ${gradientBtn}`}
                            >
                            {coupleNumber ? 'ENTER (LINKED)' : 'JOIN PARTY'}
                            </button>
                            )
                        )}
                    </div>

                    <div className="mt-8 text-xs text-white/20 tracking-widest">SECURE CONNECTION • v5.0 FIXED</div>
                </div>

            {/* MODAL DE EMPAREJAMIENTO */}
            {showScanner && (
                <CouplePairing 
                    gender={gender} 
                    onCodeObtained={(c: string) => setCoupleNumber(c)} 
                    value={coupleNumber} 
                    onBack={() => setShowScanner(false)}
                    // ESTO CIERRA EL MODAL Y ENTRA
                    onAutoJoin={(manualCode: string) => {
                        setShowScanner(false);
                        if (userName.toLowerCase().trim() === 'admin') {
                            createGame(manualCode);
                        } else {
                            joinGame(manualCode);
                        }
                    }}
                    db={db}
                    currentUserUid={user?.uid}
                    appId={appId}
                />
            )}
        </div>
    ); 
  

  // --- GAME ENDED SCREEN ---
  if (gameState?.mode === 'ended') {
      return (
        <div className="min-h-screen text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 to-black pointer-events-none"></div>
            <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-glow" />
            <h2 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">GAME OVER</h2>
            <div className={`w-full max-w-sm max-h-[60vh] overflow-y-auto mb-8 p-4 ${glassPanel}`}>
                {players.map((p, i) => (
                    <div key={p.uid} className="py-3 border-b border-white/5 flex justify-between items-center last:border-0">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-white/50 text-sm">#{i+1}</span>
                            <span className="font-bold text-lg">{p.name}</span>
                        </div>
                        <span className="font-black text-xl text-yellow-400">{gameState?.points[p.uid] || 0} pts</span>
                    </div>
                ))}
            </div>
            {isAdmin && (
                <button onClick={handleReturnToSetup} className="bg-cyan-600 px-8 py-4 rounded-xl font-bold shadow-lg shadow-cyan-900/30 hover:bg-cyan-500 transition-all active:scale-95 w-full max-w-sm">
                    New Game (Setup)
                </button>
            )}
        </div>
      );
  }

  // --- MANAGER RENDER ---
  if (isAdmin && isManaging) {
      const data = managerTab === 'mm' ? pairChallenges : challenges.filter(c => {
          if (managerTab === 'truth') return c.type === 'T' || c.type === 'question';
          if (managerTab === 'dare') return c.type === 'D' || c.type === 'dare';
          return false;
      });
      let displayedData = showPendingOnly ? data.filter(c => !c.level) : data;
      if (searchTerm) {
          displayedData = displayedData.filter(c => (c.text && c.text.toLowerCase().includes(searchTerm.toLowerCase())) || (c.male && c.male.toLowerCase().includes(searchTerm.toLowerCase())) || (c.female && c.female.toLowerCase().includes(searchTerm.toLowerCase())));
      }
      if (sortConfig) {
          displayedData = [...displayedData].sort((a, b) => {
              // @ts-ignore
              const valA = a[sortConfig.key] || '';
              // @ts-ignore
              const valB = b[sortConfig.key] || '';
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges';
      const hasTruth = challenges.some(c => c.type === 'T' || c.type === 'question');
      const hasDare = challenges.some(c => c.type === 'D' || c.type === 'dare');
      const hasMatch = pairChallenges.length > 0;

      return (
        <div className="min-h-screen p-4 text-white flex flex-col bg-slate-900" onMouseUp={()=>setIsDragging(false)}>
            <CustomSuccess />
            <CustomAlert />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400"><Settings/> Data Manager</h2>
                <button onClick={()=>setIsManaging(false)} className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg text-sm transition-colors">Exit</button>
            </div>
            
            <div className="flex gap-2 mb-4 border-b border-white/10 pb-2 overflow-x-auto">
                <button onClick={()=>setManagerTab('truth')} className={`px-6 py-2 rounded-t-lg transition-colors ${managerTab==='truth' ? 'bg-cyan-900/50 text-cyan-400 border-b-2 border-cyan-400' : 'text-white/50 hover:text-white'}`}>Truth</button>
                <button onClick={()=>setManagerTab('dare')} className={`px-6 py-2 rounded-t-lg transition-colors ${managerTab==='dare' ? 'bg-pink-900/50 text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white'}`}>Dare</button>
                <button onClick={()=>setManagerTab('mm')} className={`px-6 py-2 rounded-t-lg transition-colors ${managerTab==='mm' ? 'bg-emerald-900/50 text-emerald-400 border-b-2 border-emerald-400' : 'text-white/50 hover:text-white'}`}>Match</button>
            </div>

            {/* UPLOAD SECTION */}
            <div className={`p-6 mb-4 flex flex-col gap-4 ${glassPanel}`}>
                  {managerTab === 'truth' && (
                      <label className={`group flex items-center justify-center gap-4 w-full p-8 rounded-xl cursor-pointer border-2 border-dashed transition-all ${!hasTruth ? 'border-cyan-500 bg-cyan-900/20 animate-pulse' : 'border-white/20 hover:border-cyan-500/50 hover:bg-white/5'}`}>
                          <Upload size={32} className="text-cyan-400"/>
                          <div className="flex flex-col text-left">
                             <span className="font-bold text-lg text-white">Upload TRUTH CSV</span>
                             <span className="text-xs text-white/50">Format: text, level, gender</span>
                          </div>
                          <input type="file" className="hidden" onChange={(e)=>handleUploadSingleCol(e, 'T')}/>
                      </label>
                  )}
                  {managerTab === 'dare' && (
                      <label className={`group flex items-center justify-center gap-4 w-full p-8 rounded-xl cursor-pointer border-2 border-dashed transition-all ${!hasDare ? 'border-pink-500 bg-pink-900/20 animate-pulse' : 'border-white/20 hover:border-pink-500/50 hover:bg-white/5'}`}>
                          <Upload size={32} className="text-pink-400"/>
                          <div className="flex flex-col text-left">
                             <span className="font-bold text-lg text-white">Upload DARE CSV</span>
                             <span className="text-xs text-white/50">Format: text, level, gender</span>
                          </div>
                          <input type="file" className="hidden" onChange={(e)=>handleUploadSingleCol(e, 'D')}/>
                      </label>
                  )}
                  {managerTab === 'mm' && (
                      <label className={`group flex items-center justify-center gap-4 w-full p-8 rounded-xl cursor-pointer border-2 border-dashed transition-all ${!hasMatch ? 'border-emerald-500 bg-emerald-900/20 animate-pulse' : 'border-white/20 hover:border-emerald-500/50 hover:bg-white/5'}`}>
                          <Upload size={32} className="text-emerald-400"/>
                          <div className="flex flex-col text-left">
                             <span className="font-bold text-lg text-white">Upload MATCH CSV</span>
                             <span className="text-xs text-white/50">Format: male, female, level</span>
                          </div>
                          <input type="file" className="hidden" onChange={handleUploadDoubleCol}/>
                      </label>
                  )}
                  {uploading && <div className="text-sm text-yellow-400 text-center font-bold animate-pulse">Processing file...</div>}

                  {/* RESTORED EXPORT BUTTONS */}
                  <div className="grid grid-cols-2 gap-3 mt-2 pt-4 border-t border-white/10">
                      <button onClick={() => handleExportCSV(true)} className="bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold text-white/70 transition-colors">
                          <FileSpreadsheet size={16} /> Download Template
                      </button>
                      <button onClick={() => handleExportCSV(false)} className="bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold text-white/70 transition-colors">
                          <Download size={16} /> Export All Data
                      </button>
                  </div>
            </div>

            <div className={`p-4 rounded-xl mb-4 flex flex-wrap gap-3 items-end text-sm ${glassPanel}`}>
                <div className="flex flex-col"><label className="text-xs text-white/50 mb-1">Set Level</label><select className="bg-slate-900 border border-white/20 p-2 rounded-lg text-white" value={bulkLevel} onChange={e=>setBulkLevel(e.target.value)}><option value="">-</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div>
                {managerTab !== 'mm' && (<div className="flex flex-col"><label className="text-xs text-white/50 mb-1">Set Gender</label><select className="bg-slate-900 border border-white/20 p-2 rounded-lg text-white" value={bulkGender} onChange={e=>setBulkGender(e.target.value)}><option value="">-</option><option value="F">Female</option><option value="B">Both</option></select></div>)}
                <button onClick={applyBulkEdit} disabled={selectedIds.size === 0} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed">Apply ({selectedIds.size})</button>
                
                <div className="ml-auto flex gap-2">
                    <button onClick={()=>bulkPause(true)} disabled={selectedIds.size === 0} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg disabled:opacity-30"><PauseCircle size={20} className="text-yellow-400"/></button>
                    <button onClick={()=>bulkPause(false)} disabled={selectedIds.size === 0} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg disabled:opacity-30"><PlayCircle size={20} className="text-emerald-400"/></button>
                    <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="bg-red-900/50 hover:bg-red-900 border border-red-500/50 px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"><Trash2 size={16}/> Delete</button>
                </div>
                <div className="w-full h-px bg-white/10 my-2"></div>
                <button onClick={()=>toggleSelectAll(displayedData)} className="bg-white/10 px-3 py-1 rounded flex items-center gap-1">{selectedIds.size === displayedData.length ? <CheckSquare size={14}/> : <Square size={14}/>} All</button>
                <button onClick={()=>setShowPendingOnly(!showPendingOnly)} className={`px-3 py-1 rounded flex items-center gap-1 ${showPendingOnly ? 'bg-yellow-600 text-black font-bold' : 'bg-white/10'}`}><Filter size={14}/> Needs Setup</button>
            </div>
            
            {/* TABLE */}
            <div className={`flex-1 overflow-x-auto overflow-y-auto border border-white/10 rounded-xl ${glassPanel}`} onMouseLeave={()=>setIsDragging(false)}>
                <table className="w-full text-left text-xs select-none min-w-[800px]">
                    <thead className="bg-black/40 text-white/50 sticky top-0 z-10 uppercase tracking-wider font-bold">
                        <tr>
                            <th className="p-3 w-10 text-center"><input type="checkbox" onChange={()=>toggleSelectAll(displayedData)} checked={selectedIds.size === displayedData.length && displayedData.length > 0} /></th>
                            <th className="p-3 w-10"></th>
                            <th className="p-3 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('level')}>Lvl <ArrowUpDown size={12} className="inline"/></th>
                            {managerTab !== 'mm' && <th className="p-3 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('gender')}>Sex <ArrowUpDown size={12} className="inline"/></th>}
                            {managerTab !== 'mm' ? (
                                <th className="p-3 w-full">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center cursor-pointer hover:text-white" onClick={()=>handleSort('text')}>Text Content <ArrowUpDown size={12} className="inline ml-1"/></div>
                                        <div className="relative">
                                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg pl-8 pr-2 py-1 text-xs focus:border-cyan-500 outline-none w-full text-white"/>
                                            <Search size={12} className="absolute left-2.5 top-1.5 text-white/40"/>
                                        </div>
                                    </div>
                                </th>
                            ) : (
                                <>
                                    <th className="p-3 w-1/2">Male Question</th>
                                    <th className="p-3 w-1/2">Female Question</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {displayedData.map(c => (
                            <tr key={c.id} className={`cursor-pointer transition-colors ${c.paused ? 'opacity-50 grayscale' : ''} ${selectedIds.has(c.id!) ? 'bg-cyan-900/30' : 'hover:bg-white/5'}`} onMouseDown={(e)=>handleRowMouseDown(c.id!, e)} onMouseEnter={()=>handleRowMouseEnter(c.id!)}>
                                <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.has(c.id!)} readOnly /></td>
                                <td className="p-3 text-center" onMouseDown={(e)=>e.stopPropagation()}><button onClick={()=>updateSingleField(collectionName, c.id!, 'paused', !c.paused)}>{c.paused ? <PauseCircle size={16} className="text-yellow-500"/> : <PlayCircle size={16} className="text-emerald-500"/>}</button></td>
                                <td className="p-3 font-mono text-center">{c.level || <span className="text-red-500 font-bold">!</span>}</td>
                                {managerTab !== 'mm' && <td className="p-3 font-mono text-center">{c.gender || c.sexo || <span className="text-red-500 font-bold">!</span>}</td>}
                                {managerTab !== 'mm' ? (<td className="p-3" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-cyan-500 outline-none transition-colors" value={c.text || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'text', e.target.value)}/></td>) : (<><td className="p-3" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-cyan-500 outline-none transition-colors" value={c.male || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'male', e.target.value)}/></td><td className="p-3" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-cyan-500 outline-none transition-colors" value={c.female || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'female', e.target.value)}/></td></>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      );
  }

  // --- ADMIN MAIN ---
  if (isAdmin && !viewAsPlayer) {
    if (!gameState || !gameState.mode || gameState.mode === 'lobby' || !['admin_setup', 'question', 'dare', 'yn', 'ended'].includes(gameState.mode)) {
        const { total } = checkPendingSettings();
        const singlesCount = players.filter(p => p.relationshipStatus === 'single').length;
        const couplesCount = players.filter(p => p.relationshipStatus === 'couple').length;
        const { valid: couplesValid, incompleteIds } = checkCouplesCompleteness();
        const sortedPlayers = [...players].sort((a, b) => {
            const aIncomplete = incompleteIds.includes(a.coupleNumber) && a.relationshipStatus === 'couple';
            const bIncomplete = incompleteIds.includes(b.coupleNumber) && b.relationshipStatus === 'couple';
            if (aIncomplete && !bIncomplete) return -1;
            if (!aIncomplete && bIncomplete) return 1;
            return 0;
        });

        return (
            <div className="min-h-screen p-4 flex flex-col items-center justify-center text-white relative">
              {/* TUTORIAL TOOLTIPS */}
              {tutorialStep === 0 && <TutorialTooltip text="Read the Manual first!" onClick={() => setTutorialStep(1)} className="top-14 right-4" arrowPos="top" />}
              {tutorialStep === 1 && <TutorialTooltip text="Set Secret Code" onClick={() => setTutorialStep(2)} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
              
              {/* Step 15: Tell code (Visible over button as fallback position) */}
              {tutorialStep === 15 && <TutorialTooltip text="Tell the code to the players" onClick={() => { setCodeTipShown(true); setTutorialStep(18); }} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
              
              {/* Wait for players: Pointing to list */}
              {tutorialStep === 18 && <TutorialTooltip text="Waiting for players..." onClick={() => setTutorialStep(3)} className="left-full ml-4 top-1/2 -translate-y-1/2" arrowPos="left" />}
              
              {tutorialStep === 4 && total === 0 && couplesValid && <TutorialTooltip text="Start the Party!" onClick={() => {}} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}

              <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-cyan-400 transition-all z-50 backdrop-blur-md" title="Switch to Player View"><Gamepad2 size={24} /></button>
              {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
              <CustomSuccess />
              <button onClick={() => { setShowAdminHelp(true); if(tutorialStep===0) setTutorialStep(1); }} className="absolute top-4 right-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-yellow-400 transition-all backdrop-blur-md z-50"><HelpCircle size={24} /></button>
              <CustomAlert/>
              
              <div className="flex items-center gap-2 mb-2 mt-8">
                 <Users size={32} className="text-cyan-400"/>
                 <h2 className="text-2xl font-black tracking-widest text-white">LOBBY ({players.length})</h2>
              </div>
              
              <div className="flex gap-4 mb-4 text-xs font-mono bg-black/40 p-2 rounded-lg border border-white/10 relative">
                  {/* Anchor for Waiting Players Tooltip */}
                  {tutorialStep === 18 && <div className="absolute right-0 top-0 w-1 h-full"></div>}
                  <div className="flex items-center gap-1 text-cyan-400"><UserIcon size={14}/> Singles: {singlesCount}</div>
                  <div className="flex items-center gap-1 text-pink-400"><Users size={14}/> Couples: {couplesCount/2}</div>
              </div>

              <div className={`w-full max-w-sm mb-4 max-h-[40vh] overflow-y-auto p-4 ${glassPanel} relative`}>
                {players.length === 0 && <span className="text-white/30 text-sm text-center block">Waiting for players to join...</span>}
                {sortedPlayers.map((p, idx) => {
                    const isIncomplete = incompleteIds.includes(p.coupleNumber) && p.relationshipStatus === 'couple';
                    return (
                        <div key={p.uid} className={`flex justify-between items-center py-2 border-b border-white/5 last:border-0 ${p.isBot?'text-purple-400':''}`}>
                            <div className="flex flex-col leading-tight">
                                <span className={isIncomplete ? "text-orange-400 font-bold animate-pulse" : "font-bold"}>{p.name} {p.isBot && '(Bot)'}</span>
                                {p.relationshipStatus === 'couple' && <span className={`text-[10px] ${isIncomplete ? "text-orange-300" : "text-pink-400"}`}>Couple #{p.coupleNumber} {isIncomplete ? "(Waiting partner)" : ""}</span>}
                            </div>
                            <div className="relative">
                                {tutorialStep === 3 && idx === 0 && <TutorialTooltip text="Reset players if needed" onClick={() => { setResetTipShown(true); setTutorialStep(4); }} className="right-8 top-1/2 -translate-y-1/2" arrowPos="right" />}
                                <button onClick={()=>handleKickPlayer(p.uid, p.name)} className="text-red-500/70 hover:text-red-500 transition-colors" title="Reset Player"><UserX size={18}/></button>
                            </div>
                        </div>
                    );
                })}
              </div>

             {/* BLOQUE DE CÓDIGO DEL ADMIN (NUEVO: SOLO LECTURA) */}
             <div className="mb-6 w-full max-w-sm relative group animate-in zoom-in">
                  <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative w-full py-6 bg-black/80 border border-white/10 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Party Code</span>
                      <span className="text-4xl font-black font-mono tracking-[0.3em] text-white shadow-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] select-all">
                        {code || '...'}
                      </span>
                  </div>
                  
                  {/* Tooltip del Tutorial (Mantenemos esto para que no se rompa el tutorial) */}
                  {tutorialStep === 15 && <TutorialTooltip text="Tell this code to the players" onClick={() => { setCodeTipShown(true); setTutorialStep(18); }} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
              </div>
              
              <button onClick={()=>setIsManaging(true)} className="w-full max-w-sm bg-white/5 p-4 rounded-xl font-bold mb-4 flex items-center justify-center gap-3 border border-white/10 hover:bg-white/10 transition-all relative">
                  <Settings size={20}/> Content & Uploads
                  {total > 0 && <span className="absolute top-3 right-3 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
              </button>
              
              {!couplesValid && <div className="bg-red-900/80 p-3 rounded-xl text-center text-sm mb-4 border border-red-500 max-w-sm w-full animate-pulse backdrop-blur-sm"><strong className="block text-red-200 mb-1"><AlertTriangle className="inline mr-1" size={14}/> Incomplete Couples!</strong>Wait for partners for IDs: {incompleteIds.join(', ')}</div>}
              
              <div className="relative w-full max-w-sm">
                  {tutorialStep === 4 && total === 0 && couplesValid && <TutorialTooltip text="Start the Party!" onClick={() => {}} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
                  {total > 0 ? (
                      <div className="bg-red-900/50 p-3 rounded-xl text-center text-sm mb-4 border border-red-500 backdrop-blur-sm"><AlertTriangle className="inline mr-2" size={16}/>Complete setup for {total} questions to start.</div>
                  ) : (
                    <button 
                    id="btn-start-game"   // <--- ✅ ESTO ES LO NUEVO
                    onClick={startGame} 
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 p-4 rounded-xl font-black tracking-widest hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    START GAME
                </button>
                  )}
              </div>
              <button onClick={handleRestart} className="w-full max-w-sm bg-red-600 hover:bg-red-500 text-white p-3 rounded-xl font-bold mt-4 transition-colors text-sm shadow-lg shadow-red-900/30">RESET ALL</button>
            </div>
        );
    }

    if (gameState?.mode === 'admin_setup') {
         return (
            <div className="min-h-screen p-4 flex flex-col items-center justify-center text-white relative">
                <CustomAlert />
                
                {tutorialStep === 5 && <TutorialTooltip text="Switch Mode Anytime!" onClick={() => setTutorialStep(6)} className="top-1/2 right-full mr-4 -translate-y-1/2" arrowPos="right" />}
                
                <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-cyan-400 transition-all z-50 backdrop-blur-md" title="Switch to Player View"><Gamepad2 size={24} /></button>
                {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
                <button onClick={() => setShowAdminHelp(true)} className="absolute top-4 right-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-yellow-400 transition-all backdrop-blur-md z-50"><HelpCircle size={24} /></button>
                
                <h2 className="text-3xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mt-8">SETUP ROUND</h2>
                
                <div className={`w-full max-w-md p-6 mb-4 ${glassPanel}`}>
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 relative">
                        <div className="flex items-center gap-2 justify-center w-full">
                             <div className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Game Mode</div>
                             <InfoIcon text="Auto: loops through Truth/Dare/Match. Manual: lets you pick every turn." />
                             <div className={`font-black text-xl ml-2 ${isAutoSetup ? 'text-green-400' : 'text-cyan-400'}`}>{isAutoSetup ? 'AUTOMATIC' : 'MANUAL'}</div>
                        </div>
                        <div className="relative">
                        <button onClick={()=>setIsAutoSetup(!isAutoSetup)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isAutoSetup ? 'bg-green-500' : 'bg-slate-700'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAutoSetup ? 'translate-x-7' : 'translate-x-1'}`} /></button>
                        {tutorialStep === 5 && <TutorialTooltip text="Switch Manual/Auto Mode Anytime!" onClick={() => setTutorialStep(6)} className="right-full mr-3 top-1/2 -translate-y-1/2" arrowPos="right" />}
                        </div>     
                        </div>

                    {isAutoSetup ? (
                        <div className="flex gap-3 animate-in fade-in">
                            <div className="flex-1 text-center bg-black/20 rounded-lg p-2 relative">
                            <div className="text-xs text-cyan-400 font-bold mb-1">Truth</div><input type="number" className="w-full bg-transparent text-center border border-white/20 rounded p-1 text-white font-mono" value={qtyTruth} onChange={e=>setQtyTruth(parseInt(e.target.value))}/></div>
                            <div className="flex-1 text-center bg-black/20 rounded-lg p-2"><div className="text-xs text-pink-400 font-bold mb-1">Dare</div><input type="number" className="w-full bg-transparent text-center border border-white/20 rounded p-1 text-white font-mono" value={qtyDare} onChange={e=>setQtyDare(parseInt(e.target.value))}/></div>
                            <div className="flex-1 text-center bg-black/20 rounded-lg p-2"><div className="text-xs text-emerald-400 font-bold mb-1">Match</div><input type="number" className="w-full bg-transparent text-center border border-white/20 rounded p-1 text-white font-mono" value={qtyMM} onChange={e=>setQtyMM(parseInt(e.target.value))}/></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 relative">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white/70">Risk Level</span>
                                    <InfoIcon text="You can change the risk level any time." />
                                </div>
                                <div className="relative">
                                    {tutorialStep === 52 && <TutorialTooltip text="Select Level" onClick={() => setTutorialStep(53)} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
                                    <select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 relative">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white/70">Next Game Type</span>
                                    <InfoIcon text="You can change the game type any time." />
                                </div>
                                <div className="relative">
                                    {tutorialStep === 53 && <TutorialTooltip text="Select Type" onClick={() => setTutorialStep(6)} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
                                    <select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match/Mismatch</option></select>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {isAutoSetup && (
                        <div className="mt-4 flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 relative">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white/70">Risk Level</span>
                                <InfoIcon text="You can change the risk level any time." />
                            </div>
                             {tutorialStep === 51 && <TutorialTooltip text="Select Level" onClick={() => setTutorialStep(6)} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
                            <select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
                        </div>
                    )}
                </div>
                
                <div className="relative w-full max-w-md">
                    {tutorialStep === 6 && <TutorialTooltip text="Click to Start!" onClick={() => setTutorialStep(7)} className="bottom-full mb-2 left-1/2 -translate-x-1/2" arrowPos="bottom" />}
                    <button onClick={startRound} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-xl font-black tracking-widest shadow-lg shadow-emerald-900/40 active:scale-95 transition-all">{isAutoSetup ? 'INITIATE AUTO SEQUENCE' : 'START ROUND'}</button>
                </div>
                <div className="mt-4 w-full max-w-md"><ScoreBoard /></div>
                <button onClick={handleRestart} className="w-full max-w-md bg-red-600 hover:bg-red-500 text-white p-3 rounded-xl font-bold mt-4 transition-colors text-sm shadow-lg shadow-red-900/30">RESET ALL</button>
            </div>
         );
    }

    const card = currentCard();
    const finalCard = card || fetchedCard;
    const cardStyle = getLevelStyle(finalCard?.level);

    if (!finalCard && gameState?.currentChallengeId) {
        return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-black"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500 mb-4"></div><div className="text-xl animate-pulse font-mono text-cyan-400">SYNCING DATA...</div></div>;
    }

    const pendingPlayers = players.filter(p => !p.isBot).filter(p => {
        if(gameState.mode === 'question' || gameState.mode === 'dare') { if(p.uid === players[gameState.currentTurnIndex]?.uid) return false; return !gameState.votes?.[p.uid]; }
        if(gameState.mode === 'yn') { return !gameState.answers?.[p.uid]; }
        return false;
    });

    return (
      <div className="min-h-screen text-white flex flex-col p-4 relative overflow-hidden">
        {tutorialStep === 7 && <TutorialTooltip text="Switch between admin and player!" onClick={() => setTutorialStep(null)} className="top-4 left-16" arrowPos="left" />}
        <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-cyan-400 transition-all z-50 backdrop-blur-md" title="Switch to Player View"><Gamepad2 size={24} /></button>
        {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
        <button onClick={() => setShowAdminHelp(true)} className="absolute top-4 right-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-yellow-400 transition-all backdrop-blur-md z-50"><HelpCircle size={24} /></button>
        
        <div className="mt-8 w-full max-w-md mx-auto mb-2"><ScoreBoard /></div>
        
        <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
            <div className="flex gap-2 font-bold text-xl items-center"><Zap className="text-yellow-400 fill-yellow-400"/> <span className="tracking-widest">{gameState?.mode === 'yn' ? 'MATCH' : gameState?.mode?.toUpperCase()}</span></div>
            <div className="text-xs text-white/50 uppercase tracking-widest font-bold">Turn: <span className="text-white">{currentPlayerName()}</span></div>
        </div>
        
        <div className={`w-full max-w-md p-4 mb-4 flex flex-col gap-4 ${glassPanel}`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 relative">
                 <div className="flex items-center gap-2 justify-center w-full">
                    <div className="text-[10px] text-white/50 uppercase font-bold">Current Mode</div>
                    <div className={`font-black text-lg ${gameState?.isAutoMode ? 'text-green-400' : 'text-cyan-400'}`}>{gameState?.isAutoMode ? 'AUTO' : 'MANUAL'}</div>
                 </div>
                 <button onClick={toggleAutoMode} className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${gameState?.isAutoMode ? 'bg-green-500' : 'bg-slate-700'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gameState?.isAutoMode ? 'translate-x-7' : 'translate-x-1'}`} /></button>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50 font-bold uppercase">Risk Level</span>
                    <InfoIcon text="You can change the risk level any time." />
                </div>
                <select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-black/30 border border-white/20 rounded p-1 text-white text-xs w-32"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
            </div>
            {!gameState?.isAutoMode && (<div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300"><span className="text-xs text-white/50 font-bold uppercase">Next Game Type</span><div className="flex items-center gap-2"><InfoIcon text="You can change the game type any time." /><select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-black/30 border border-white/20 rounded p-1 text-white text-xs w-32"><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match</option></select></div></div>)}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
          <div className={`w-full p-6 rounded-3xl text-center mb-4 transition-all duration-700 ${cardStyle} flex flex-col items-center justify-center min-h-[160px] relative border-2`}>
              <div className="absolute top-4 left-4 text-[10px] font-black opacity-80 uppercase tracking-[0.2em] text-white bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                  {gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}
              </div>
              <div className="mb-4 opacity-80 drop-shadow-glow">{gameState.mode === 'question' ? <MessageCircle size={40} className="text-cyan-200"/> : gameState.mode === 'yn' ? <Users size={40} className="text-emerald-200"/> : <Flame size={40} className="text-pink-200"/>}</div>
              <h3 className="text-2xl font-bold leading-relaxed drop-shadow-md">{getCardText(finalCard)}</h3>
          </div>

          <div className={`w-full p-4 mb-4 ${glassPanel}`}>
              <h4 className={`font-bold mb-2 flex items-center gap-2 text-xs uppercase tracking-widest ${pendingPlayers.length > 0 ? "text-cyan-400 animate-pulse" : "text-white/50"}`}><RefreshCw size={12} className={pendingPlayers.length > 0 ? "animate-spin" : ""}/> Waiting for answers:</h4>
              {pendingPlayers.length === 0 ? (<div className="text-emerald-400 font-bold text-center">Ready for next!</div>) : (<div className="text-sm text-white/70 font-bold text-center">{pendingPlayers.map(p => p.name).join(', ')}</div>)}
          </div>

          {gameState?.isAutoMode ? (<div className="text-center text-emerald-400 font-bold animate-pulse mb-4 flex items-center gap-2 justify-center text-sm uppercase tracking-widest"><RefreshCw className="animate-spin" size={14}/> Auto-Advancing...</div>) : (
            <div className="w-full flex items-center gap-2">
                <button onClick={nextTurn} className="flex-1 bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-bold shadow-lg shadow-indigo-900/50 transition-all">FORCE NEXT TURN</button>
                <InfoIcon text="Use this to skip waiting if a player is stuck!" />
            </div>
          )}
          <div className="flex gap-4 w-full mt-4">
             <button onClick={handleEndGame} className="flex-1 bg-red-900/30 border border-red-500/30 p-3 rounded-xl font-bold text-red-400 hover:bg-red-900/50 text-xs">END GAME</button>
             <button onClick={handleRestart} className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl font-bold text-white/50 hover:bg-white/10 text-xs">RESET ALL</button>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA JUGADOR ---
  if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
            <CustomAlert/>
            {tutorialStep === 8 && <TutorialTooltip text="Switch between player and admin" onClick={() => setTutorialStep(null)} className="top-4 left-16" arrowPos="left" />}
            {isAdmin && (
                <button onClick={() => { console.log("Switching to admin"); setLoading(false); setViewAsPlayer(false); }} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-cyan-500 text-cyan-400 transition-all z-50 backdrop-blur-md" title="Back to Admin View"><Settings size={24} /></button>
            )}
            {showPlayerHelp && <HelpModal onClose={() => setShowPlayerHelp(false)} type="player" />}
            <button onClick={() => setShowPlayerHelp(true)} className="absolute top-4 right-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-white/10 text-cyan-400 transition-all z-50 backdrop-blur-md"><HelpCircle size={24} /></button>
            
            <div className="text-center py-2 border-b border-white/10 mb-4 w-full flex items-center justify-center gap-2 relative flex-col mt-8">
                {gameState?.mode === 'admin_setup' && isAdmin && viewAsPlayer ? (
                   <div className="mb-4 bg-cyan-900/40 border border-cyan-500/50 p-4 rounded-xl animate-pulse">
                      <h3 className="text-xl font-black text-cyan-400 mb-1">HOST IS SETTING UP ROUND...</h3>
                      <p className="text-xs text-cyan-200">Wait for the host to start the game.</p>
                   </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {isEditingName ? (<div className="flex gap-2"><input className="bg-black/30 border border-white/20 p-2 rounded text-center text-2xl font-black text-yellow-400 w-48 outline-none" autoFocus placeholder={userName} value={newName} onChange={(e) => setNewName(e.target.value)} /><button onClick={handleUpdateName} className="bg-green-600 px-3 rounded font-bold">✔</button><button onClick={() => setIsEditingName(false)} className="bg-red-600 px-3 rounded">✖</button></div>) : (<><h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-600 drop-shadow-sm">{userName.toUpperCase()}</h1><button onClick={() => { setIsEditingName(true); setNewName(userName); }} className="text-white/30 hover:text-white transition-colors"><Edit2 size={18}/></button></>)}
                    </div>
                )}
                {relationshipStatus === 'couple' && (<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-mono mt-2"><Users size={12}/> COUPLE ID: {coupleNumber}</div>)}
            </div>
            
            <div className="w-full max-w-md"><ScoreBoard /></div>
            <div className="w-full max-w-md"><MyMatchHistory /></div>
            
            <div className="text-center mt-8 mb-4">
                {gameState?.mode === 'lobby' ? (
                   <div className="text-2xl font-bold animate-pulse mb-2 text-cyan-400">WAITING FOR THE PLAYERS TO JOIN</div>
                ) : (
                   <div className="text-2xl font-bold animate-pulse mb-2 text-yellow-400">GAME IN PROGRESS...</div>
                )}
            </div>
            
            <div className="mt-auto w-full flex justify-center pb-8"><button onClick={handleSelfLeave} className="text-red-500/50 hover:text-red-500 flex items-center gap-2 text-xs uppercase tracking-widest transition-colors"><LogOut size={14}/> Reset Player</button></div>
        </div>
      );
  }

  // ... (Keep existing game ended logic and card logic)
  if (gameState.mode === 'ended') {
      return (<div className="min-h-screen text-white p-6 flex flex-col items-center justify-center relative"><Trophy className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-glow" /><h2 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">GAME OVER</h2><div className={`w-full max-w-sm max-h-[60vh] overflow-y-auto mb-8 p-4 ${glassPanel}`}>{players.map((p, i) => <div key={p.uid} className="py-3 border-b border-white/5 flex justify-between items-center last:border-0"><span className="font-bold">{p.name}</span><span className="font-black text-xl text-yellow-400">{gameState?.points[p.uid] || 0} pts</span></div>)}</div></div>);
  }

  // -----------------------------------------------------------
  // BLOQUE DE CÁLCULOS DEL JUEGO (PEGAR ESTO ANTES DEL RETURN)
  // -----------------------------------------------------------

  // 1. Obtener la carta actual
  const card = currentCard();
  const finalCard = card || fetchedCard; // Usamos fetchedCard si la local no ha cargado

  // 2. Pantalla de carga si hay ID de reto pero no tenemos los datos
  if (!finalCard && gameState.currentChallengeId) { 
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-black">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500 mb-4"></div>
            <div className="text-xl animate-pulse font-mono text-cyan-400">SYNCING DATA...</div>
        </div>
      ); 
  }

  // 3. Calcular estilos y estados básicos
  const cardStyle = getLevelStyle(finalCard?.level);
  const playerAnswered = gameState?.answers?.[user?.uid || ''];
  const allVoted = Object.keys(gameState?.votes || {}).length >= (players.length - 1);
  const allYNAnswered = Object.keys(gameState.answers).length >= players.length;

  // 4. Lógica específica para MATCH/MISMATCH (YN)
  let ynMatch = null;
  let myPartnerName = "???";
  
  if (gameState.mode === 'yn' && allYNAnswered) {
      const myPartnerUid = gameState.pairs?.[user?.uid || ''];
      const myAns = gameState.answers[user?.uid || ''];
      const partnerAns = gameState.answers[myPartnerUid || ''];
      
      const pObj = players.find(p => p.uid === myPartnerUid);
      if(pObj) myPartnerName = pObj.name;
      
      if(myAns && partnerAns) { 
          ynMatch = myAns === partnerAns; 
      }
  }

  // 5. Calcular jugadores pendientes (Para mostrar en la UI)
  const pendingPlayers = players.filter(p => !p.isBot).filter(p => {
       if(gameState?.mode === 'question' || gameState?.mode === 'dare') { 
           // Si es turno de alguien, esa persona no cuenta como pendiente de votar (ella responde)
           if(p.uid === players[gameState.currentTurnIndex]?.uid) return false; 
           // Los demás deben votar
           return !gameState.votes?.[p.uid]; 
       }
       if(gameState?.mode === 'yn') { return !gameState.answers?.[p.uid]; }
       return false;
   });
   
   // Variable auxiliar para saber si soy Admin
   // (Asegúrate de haber movido el useState de showAdminPanel arriba como indiqué en el Paso 1)

  // -----------------------------------------------------------
  // FIN DEL BLOQUE DE CÁLCULOS
  // -----------------------------------------------------------
   

  // --- RENDERIZADO PRINCIPAL DEL JUEGO (ESTO VA AL FINAL) ---
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center relative overflow-hidden font-sans">
        
        {/* Fondo Animado */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black"></div>
            <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent opacity-50"></div>
        </div>

        {/* --- HEADER --- */}
        <div className="w-full p-4 flex justify-between items-center relative z-20 glass-header backdrop-blur-md border-b border-white/10">
            <div className="flex items-center gap-3">
                {/* Botón para alternar Admin Panel */}
                {/* Botón CORREGIDO: Volver a Admin View */}
                {isAdmin && (
                    <button 
                        onClick={() => {
                            setLoading(false); 
                            setViewAsPlayer(false); // <--- ESTO ES LA CLAVE
                        }}
                        className="p-2 rounded-full bg-white/10 text-cyan-400 hover:text-white border border-cyan-500/50 hover:bg-white/20 transition-all shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                        title="Back to Admin Panel"
                    >
                        <Settings size={20} />
                    </button>
                )}
                {/* Código Pequeño en Header */}
                 <div className="text-xs hidden sm:block animate-in fade-in slide-in-from-left-5">
                    <p className="text-white/50 uppercase tracking-widest">Party Code</p>
                    <p className="text-xl font-black text-pink-500 font-mono tracking-widest drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">
                        {gameState?.code || code}
                    </p>
                </div>
            </div>
            
            {/* Info del Usuario */}
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-5">
                <span className="text-right hidden sm:block">
                    <p className="font-bold text-sm text-white tracking-wide">{userName}</p>
                    <p className="text-[10px] text-white/50 uppercase tracking-wider">{gender} • {relationshipStatus === 'couple' ? 'Couple' : 'Single'}</p>
                </span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg border-2 ${gender === 'male' ? 'bg-cyan-600 border-cyan-400 shadow-cyan-500/20' : (gender === 'female' ? 'bg-pink-600 border-pink-400 shadow-pink-500/20' : 'bg-purple-600 border-purple-400 shadow-purple-500/20')}`}>
                    {userName.charAt(0).toUpperCase()}
                </div>
            </div>
        </div>

        {/* --- ÁREA PRINCIPAL DE CONTENIDO --- */}
        <div className="flex-1 w-full relative z-10 flex flex-col p-4 overflow-y-auto lg:max-w-5xl lg:mx-auto">
            
            {/* A) PANEL DE ADMIN (Si soy admin y está activo) */}
            {isAdmin && showAdminPanel ? (
                <AdminPanel 
                    players={players} 
                    gameState={gameState}
                    onStartGame={startGame}
                    onNextTurn={nextTurn}
                    onReset={resetGame}
                    onKick={kickPlayer}
                />
            ) : (
                /* B) VISTA DE JUGADOR (Para todos, incluido Admin en modo juego) */
                gameState?.mode === 'lobby' ? (
                    /* B.1) LOBBY DE ESPERA */
<div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in w-full max-w-2xl mx-auto">
    
    {/* ---> CÓDIGO GIGANTE EN EL LOBBY <--- */}
    <div className="mb-12 relative group cursor-default">
        <div className="absolute -inset-2 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-[2rem] blur-xl opacity-30 group-hover:opacity-50 transition duration-1000 animate-pulse-slow"></div>
        <div className="relative bg-black/60 backdrop-blur-xl border-2 border-white/10 p-8 rounded-[2rem] shadow-2xl">
            <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400 text-sm font-bold uppercase tracking-[0.5em] mb-2">Party Code</h3>
            <div className="text-7xl sm:text-8xl md:text-9xl font-black text-white tracking-[0.15em] font-mono drop-shadow-[0_0_25px_rgba(255,255,255,0.4)] select-all transition-all">
                {gameState?.code || code}
            </div>
        </div>
    </div>

    {/* ---> AQUÍ ESTÁ EL CAMBIO DE TEXTO QUE PEDISTE <--- */}
    <div className="mb-6 relative">
        <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 animate-pulse"></div>
        <Trophy className="w-20 h-20 text-yellow-400 relative z-10 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-bounce-slow" />
    </div>
    
    {/* TEXTO ACTUALIZADO */}
    <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 uppercase tracking-widest drop-shadow-lg animate-pulse">
        Waiting for the game to start...
    </h2>
    <p className="text-white/60 text-lg font-medium tracking-wide max-w-md mx-auto">
        Get ready!
    </p>
    
    {isAdmin && (
        <p className="mt-8 text-pink-400 text-sm font-bold bg-pink-500/10 p-4 rounded-xl border border-pink-500/30">
            ( Switch to Admin Panel to start the game )
        </p>
    )}
</div>
                ) : (
/* B.2) INTERFAZ DEL JUEGO ACTIVO */
<div className="flex-1 w-full max-w-md mx-auto flex flex-col animate-in fade-in duration-500">
                    
{/* --- 1. TARJETA DEL DESAFÍO --- */}
<div className={`w-full p-8 rounded-3xl text-center mb-6 transition-all duration-700 ${cardStyle} flex flex-col items-center justify-center min-h-[240px] relative border-2 shadow-2xl group`}>
    <div className="absolute -top-3 bg-black/80 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full border border-white/20 backdrop-blur-md shadow-xl">
        {gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}
    </div>
    <div className="mb-6 opacity-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] transform group-hover:scale-110 transition-transform duration-500">
            {gameState.mode === 'question' ? <MessageCircle size={48} className="text-cyan-200"/> : gameState.mode === 'yn' ? <Users size={48} className="text-emerald-200"/> : <Flame size={48} className="text-pink-200"/>}
    </div>
    <h3 className="text-2xl sm:text-3xl font-bold leading-relaxed drop-shadow-md text-white">
        {getCardText(finalCard)}
    </h3>
    <div className="absolute bottom-4 right-4 opacity-50 font-mono text-xs border border-white/30 px-2 rounded">
        LVL {finalCard?.level || '?'}
    </div>
</div>

{/* --- 2. ÁREA DE ACCIÓN (VOTAR / RESPONDER) --- */}
<div className="w-full bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl">
    
    {/* A) TURNO DE OTRO JUGADOR */}
    {!isMyTurn() && gameState.mode !== 'yn' && (
        <div className="text-center">
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
                JUDGE THE PLAYER: {currentPlayerName()}
            </p>
            <div className="flex gap-3">
                {gameState.mode === 'question' ? (
                    <>
                    <button onClick={() => submitVote('like')} disabled={!!gameState.votes?.[user?.uid || '']} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 p-4 rounded-xl font-bold hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-lg">Good Answer 👍</button>
                    <button onClick={() => submitVote('dislike')} disabled={!!gameState.votes?.[user?.uid || '']} className="flex-1 bg-white/10 p-4 rounded-xl font-bold hover:bg-white/20 disabled:opacity-30 transition-all">Boring 😴</button>
                    </>
                ) : (
                    <>
                    <button onClick={() => submitVote('yes')} disabled={!!gameState.votes?.[user?.uid || '']} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 p-4 rounded-xl font-bold hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-lg">Done! ✅</button>
                    <button onClick={() => submitVote('no')} disabled={!!gameState.votes?.[user?.uid || '']} className="flex-1 bg-red-900/50 border border-red-500/50 p-4 rounded-xl font-bold hover:bg-red-900/80 disabled:opacity-30 transition-all text-red-200">Failed ❌</button>
                    </>
                )}
            </div>
            {gameState.votes?.[user?.uid || ''] && <div className="mt-2 text-xs text-green-400 font-bold animate-pulse">Vote Submitted!</div>}
        </div>
    )}

    {/* B) MI TURNO */}
    {isMyTurn() && gameState.mode !== 'yn' && (
        <div className="text-center py-4">
            <div className="animate-bounce mb-2 text-4xl">👇</div>
            <p className="font-bold text-yellow-400 text-lg uppercase tracking-widest">It's your turn!</p>
            <p className="text-sm text-white/70 mt-1">Read aloud and perform the action.</p>
        </div>
    )}

    {/* C) MODO MATCH */}
    {gameState.mode === 'yn' && (
        <div className="text-center">
            {gameState.answers?.[user?.uid || ''] && !allYNAnswered ? (
                <div className="py-4">
                    <div className="text-green-400 font-bold text-xl mb-2">Answered! 🔒</div>
                    <p className="text-white/50 text-xs uppercase tracking-widest">Waiting for partner...</p>
                </div>
            ) : !allYNAnswered ? (
                <>
                    <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">DO YOU AGREE?</p>
                    <div className="flex gap-3">
                        <button onClick={() => submitAnswer('yes')} className="flex-1 bg-emerald-600 p-6 rounded-xl font-black text-xl hover:bg-emerald-500 shadow-lg shadow-emerald-900/30 transition-transform active:scale-95">YES</button>
                        <button onClick={() => submitAnswer('no')} className="flex-1 bg-red-600 p-6 rounded-xl font-black text-xl hover:bg-red-500 shadow-lg shadow-red-900/30 transition-transform active:scale-95">NO</button>
                    </div>
                </>
            ) : null}

            {/* RESULTADO COMPACTO DE MATCH/UNMATCH */}
            {allYNAnswered && (
                <div className={`flex flex-col p-4 rounded-2xl w-full animate-in zoom-in duration-500 shadow-xl border-2 ${ynMatch ? 'bg-green-900/60 border-green-500 shadow-green-500/10' : 'bg-red-900/60 border-red-500 shadow-red-500/10'}`}>
                    <div className="flex items-center justify-center gap-4 mb-2">
                        {ynMatch === true ? (
                            <>
                                <HeartHandshake className="w-12 h-12 text-green-400 animate-bounce drop-shadow-glow" strokeWidth={2} />
                                <div className="text-left">
                                    <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-600 italic tracking-tighter">MATCH!</h3>
                                    <div className="text-green-200 text-[10px] font-bold uppercase tracking-widest">Perfect Sync</div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Usamos AlertTriangle o Frown si está importado */}
                                <AlertTriangle className="w-12 h-12 text-red-500 animate-pulse drop-shadow-glow" strokeWidth={2} />
                                <div className="text-left">
                                    <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 italic tracking-tighter">UNMATCH</h3>
                                    <div className="text-red-300 text-[10px] font-bold uppercase tracking-widest">Different Vibes</div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="mt-1 text-center w-full bg-black/40 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Partner</div>
                        <div className="font-black text-xl text-white drop-shadow-md">{myPartnerName}</div>
                    </div>
                    <div className="text-white/20 mt-2 text-[9px] font-mono tracking-widest uppercase text-center">Next round in 4s...</div>
                </div>
            )}
        </div>
    )}
</div>

{/* --- 3. ESTADO DE ESPERA --- */}
<div className="mt-6 text-center">
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/10 ${pendingPlayers.length > 0 ? 'animate-pulse' : ''}`}>
        <RefreshCw size={14} className={pendingPlayers.length > 0 ? "animate-spin text-cyan-400" : "text-emerald-400"}/>
        <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
            {pendingPlayers.length > 0 ? `${pendingPlayers.length} Waiting...` : "ALL READY"}
        </span>
    </div>
    {pendingPlayers.length > 0 && (
        <div className="text-[10px] text-white/30 mt-2 max-w-xs mx-auto leading-relaxed">
            Waiting for: {pendingPlayers.map(p => p.name).slice(0, 3).join(', ')}{pendingPlayers.length > 3 && '...'}
        </div>
    )}
</div>
</div>  
)
)}
</div>
<CustomAlert/>
</div>
);
}