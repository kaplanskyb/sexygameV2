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
                                        <li><strong>Male's Last 4 Phone Digits:</strong>
                                            <ul className="list-disc pl-5 mt-1 text-slate-400 text-sm">
                                                <li>If you are a <strong>Couple</strong>: Both of you must enter the SAME number here (e.g., the last 4 digits of the boyfriend's phone). This links you together.</li>
                                                <li>If you are <strong>Single</strong>: Enter YOUR own last 4 phone digits (or any number you will remember).</li>
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

    // DENTRO DE CouplePairing...
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-8 uppercase tracking-widest text-center animate-pulse">
                {isLinked ? '❤️ LINKED! ❤️' : (isFemale ? 'PARTNER CODE' : 'LINKING...')}
            </h3>

            <div className="bg-slate-800 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center relative">
                {isLinked && (
                    <div className="absolute inset-0 z-20 bg-emerald-500 rounded-3xl flex flex-col items-center justify-center animate-in zoom-in duration-300">
                        <HeartHandshake size={64} className="text-white mb-4 animate-bounce" />
                        <span className="text-white font-black text-3xl tracking-widest">CONNECTED</span>
                    </div>
                )}
                {isFemale ? (
                    <>
                        <div className="bg-white text-slate-900 font-mono font-black text-6xl tracking-widest py-8 px-8 rounded-2xl mb-6 shadow-[0_0_30px_rgba(255,255,255,0.2)] leading-none border-4 border-pink-500/30">{localCode}</div>
                        <div className="flex items-center gap-3 text-white font-bold text-sm uppercase tracking-wide animate-pulse bg-white/10 px-4 py-2 rounded-full border border-white/5">
                            <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                            GIVE THIS CODE TO YOUR PARTNER
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-white font-black text-center mb-6 text-sm uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            ASK YOUR PARTNER FOR THE CODE
                        </p>
                        
                        {/* 1. INPUT DEL CÓDIGO (Blanco Brillante con Sombra) */}
                        <input 
                            type="number" 
                            inputMode="numeric" 
                            pattern="[0-9]*" 
                            maxLength={4} 
                            placeholder="0000" 
                            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-purple-500 text-white font-mono font-black text-5xl text-center py-4 rounded-xl outline-none transition-all mb-8 placeholder:text-slate-700 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" 
                            value={inputCode} 
                            onChange={(e) => setInputCode(e.target.value.slice(0, 4))} 
                        />
                        
                        {/* 2. BOTÓN (Texto Blanco Brillante) */}
                        <button 
                            onClick={handleManSubmit} 
                            disabled={inputCode.length < 4} 
                            className={`w-full py-4 font-black uppercase tracking-widest rounded-xl transition-all shadow-lg ${inputCode.length === 4 ? 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-500/25' : 'bg-slate-700 text-white/30 cursor-not-allowed'}`}
                        >
                           <span className={inputCode.length === 4 ? "drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" : ""}>
                               ENTER YOUR PARTNER'S CODE
                           </span>
                        </button>
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
    // 1. HOOKS Y ESTADOS
  const [isJoined, setIsJoined] = useState(false);
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
  const [showAdminPanel, setShowAdminPanel] = useState(false); // <--- SOLO UNA VEZ AQUÍ
  
  // Tutorial States
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [codeTipShown, setCodeTipShown] = useState(false);
  const [resetTipShown, setResetTipShown] = useState(false);
  const [modeSwitchTipShown, setModeSwitchTipShown] = useState(false);
  const [viewSwitchTipShown, setViewSwitchTipShown] = useState(false);
  const [backToAdminTipShown, setBackToAdminTipShown] = useState(false);
  const [startRoundTipShown, setStartRoundTipShown] = useState(false);
  const [lobbySequence, setLobbySequence] = useState<'none' | 'tellingCode' | 'waitingPlayers'>('none');

  // 2. EFFECTS
  useEffect(() => {
    if (user && players) {
      const isPlayerInGame = players.some(p => p.uid === user.uid);
      setIsJoined(isPlayerInGame);
    }
  }, [players, user]);

  useEffect(() => {
    // Resetear params del admin al loguearse como admin
    const isNowAdmin = userName.toLowerCase().trim() === 'admin';
    setIsAdmin(isNowAdmin);
    if (isNowAdmin) {
      const autoCode = Math.floor(10000 + Math.random() * 90000).toString();
      setCode(autoCode);
    } else {
      if (code && code.length > 5) setCode(''); 
    }
  }, [userName]);

  // Sync Global Effect
  useEffect(() => {
    if (relationshipStatus === 'single') setCoupleNumber('');
    if (gameState?.mode === 'lobby' && !isJoined) setCoupleNumber('');
  }, [relationshipStatus, gameState?.mode, isJoined]);

  // Auth & Data Fetching
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

  // Data Listeners
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

  // Card Fetching
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

  // Global Helpers
  useEffect(() => {
    document.body.style.background = 'radial-gradient(circle at center, #1a1a2e 0%, #000000 100%)';
    document.body.style.color = 'white';
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // 3. LOGICA GLOBAL (CALCULADA AQUÍ PARA EVITAR CRASHES)
  // -----------------------------------------------------------------------
  let localCard = null;
  if (gameState?.currentChallengeId) {
      const source = gameState.mode === 'yn' ? pairChallenges : challenges;
      localCard = (source || []).find(c => c.id === gameState.currentChallengeId);
  }
  // Carta segura
  const finalCard = localCard || fetchedCard || { level: '1', text: 'Loading...', type: 'T', male: '...', female: '...' };

  // Estilos seguros
  let computedStyle = 'border-white/10 bg-white/5';
  const lvlStr = (finalCard.level || '1').toString();
  if (lvlStr === '4') computedStyle = 'border-red-600/50 shadow-[0_0_50px_rgba(220,38,38,0.4)] bg-gradient-to-b from-red-950/80 to-black';
  else if (lvlStr === '3') computedStyle = 'border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.3)] bg-gradient-to-b from-orange-950/80 to-black';
  else if (lvlStr === '2') computedStyle = 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] bg-gradient-to-b from-yellow-950/80 to-black';
  else if (lvlStr === '1') computedStyle = 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)] bg-gradient-to-b from-green-950/80 to-black';
  const cardStyle = computedStyle; 

  // Variables de Juego seguras
  const currentUid = user?.uid || 'unknown';
  const playersSafe = players || [];
  const playersCount = playersSafe.length > 0 ? playersSafe.length : 1;
  const votesCount = gameState?.votes ? Object.keys(gameState.votes).length : 0;
  const allVoted = votesCount >= (playersCount - 1);
  const answersCount = gameState?.answers ? Object.keys(gameState.answers).length : 0;
  const allYNAnswered = answersCount >= playersCount;
  
  // Variables Match
  let ynMatch = null;
  let myPartnerName = "???";
  if (gameState?.mode === 'yn' && playersSafe.length > 0) {
      const myPartnerUid = gameState.pairs ? gameState.pairs[currentUid] : null;
      const myAns = gameState.answers ? gameState.answers[currentUid] : null;
      const partnerAns = (myPartnerUid && gameState.answers) ? gameState.answers[myPartnerUid] : null;
      if (myPartnerUid) {
          const pObj = playersSafe.find(p => p.uid === myPartnerUid);
          if(pObj) myPartnerName = pObj.name;
      }
      if(myAns && partnerAns) { ynMatch = myAns === partnerAns; }
  }

  // Jugadores Pendientes
  const pendingPlayers = playersSafe.filter(p => !p.isBot).filter(p => {
       if(!gameState) return false;
       if(gameState.mode === 'question' || gameState.mode === 'dare') { 
           const turnIdx = gameState.currentTurnIndex || 0;
           const currentPlayer = playersSafe[turnIdx];
           if (currentPlayer && p.uid === currentPlayer.uid) return false; 
           return !gameState.votes?.[p.uid]; 
       }
       if(gameState.mode === 'yn') { return !gameState.answers?.[p.uid]; }
       return false;
  });

  // Funciones Auxiliares del Juego
  const showError = (msg: string) => setCustomError(msg);
  const closeError = () => setCustomError(null);
  const showSuccess = (msg: string) => { setCustomSuccess(msg); setTimeout(() => setCustomSuccess(null), 3000); };
  
  // ... Resto de funciones (createGame, joinGame, etc. las definimos aquí abajo o asumimos que están) ...
  // Para que esto funcione bien al copiar y pegar, voy a poner las funciones críticas aquí.

  const createGame = async (codeOverride?: any) => {
    if (!userName.trim()) { alert("⛔ Please enter your Name first!"); return; }
    if (!gender) { alert("⛔ Please select your Gender!"); return; }
    if (!relationshipStatus) { alert("⛔ Please select your Status!"); return; }
    if (!user) return;
    const finalCoupleNumber = (typeof codeOverride === 'string' && codeOverride) ? codeOverride : coupleNumber;
    if (relationshipStatus === 'couple' && !finalCoupleNumber) { alert("Please link with your partner first!"); return; }

    setIsAdmin(true);
    localStorage.setItem('td_username', userName);
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data'), {
          code: code, mode: 'lobby', currentTurn: null, adminUid: user.uid, createdAt: serverTimestamp(),
          riskLevel: 1, autoLoop: false, loopConfig: { truth: 1, dare: 1, match: 1 }, loopIndex: 0, loopSequence: [], lastAction: 'CREATED'
        });
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
          uid: user.uid, name: userName, gender: gender, relationshipStatus: relationshipStatus,
          coupleNumber: relationshipStatus === 'couple' ? finalCoupleNumber : 'ADMIN',
          joinedAt: serverTimestamp(), isActive: true, isBot: false, matches: 0, mismatches: 0
        });
        setIsJoined(true);
    } catch (e) { console.error(e); }
  };

  const joinGame = async (codeOverride?: any) => {
    if (!userName.trim() || !gender || !relationshipStatus) { alert("⛔ Please complete all fields!"); return; }
    setShowScanner(false);
    if (!user) return;
    const isUserAdmin = userName.toLowerCase() === 'admin';
    if (!isUserAdmin && !code) { alert("Please enter Game Code!"); return; }
    const actualCoupleInput = (typeof codeOverride === 'string' && codeOverride) ? codeOverride : coupleNumber;
    let finalCoupleNumber = actualCoupleInput;
    if (relationshipStatus === 'single') { finalCoupleNumber = 'SGL_' + user.uid.slice(-6); } 
    else { if (!finalCoupleNumber) { alert("Link partner first!"); return; } }

    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { 
            uid: user.uid, name: userName, gender: gender || 'unknown', coupleNumber: finalCoupleNumber, 
            relationshipStatus: relationshipStatus, joinedAt: serverTimestamp(), isActive: true, isBot: false, matches: 0, mismatches: 0 
        });
        setIsJoined(true); 
        localStorage.setItem('td_username', userName);
    } catch (e) { console.error(e); alert("Error joining"); }
  };

  // -----------------------------------------------------------------------
  // 4. VISTAS DEL ADMIN (LOBBY + SETUP + HOST VIEW)
  // -----------------------------------------------------------------------
  if (isAdmin && !viewAsPlayer) {
      // 4.1 LOBBY ADMIN
      if (!gameState || !gameState.mode || gameState.mode === 'lobby') {
          // ... (Aquí iría el código del Lobby Admin que ya tenías)
          // Para simplificar y asegurar, pongo un resumen funcional. Si tienes tu código de Lobby Admin personalizado, úsalo aquí.
          // Pero como hubo errores, te doy uno limpio:
           return (
            <div className="min-h-screen p-4 flex flex-col items-center justify-center text-white relative">
              <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full text-cyan-400"><Gamepad2 size={24} /></button>
              <div className="flex items-center gap-2 mb-2 mt-8"><Users size={32} className="text-cyan-400"/><h2 className="text-2xl font-black tracking-widest text-white">LOBBY ({players.length})</h2></div>
              
              <div className="w-full max-w-sm mb-4 max-h-[40vh] overflow-y-auto p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl relative">
                  {players.map((p, idx) => (
                      <div key={p.uid} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                          <span className="font-bold">{p.name} {p.isBot && '(Bot)'}</span>
                          <button onClick={() => {if(confirm(`Reset ${p.name}?`)) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', p.uid))}} className="text-red-500/70"><UserX size={18}/></button>
                      </div>
                  ))}
              </div>

              {/* CODIGO ADMIN */}
              <div className="mb-6 w-full max-w-sm relative group animate-in zoom-in">
                  <div className="relative w-full py-6 bg-black/80 border border-white/10 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Party Code</span>
                      <span className="text-4xl font-black font-mono tracking-[0.3em] text-white select-all">{code}</span>
                  </div>
              </div>

              <div className="relative w-full max-w-sm">
                  <button onClick={() => {
                      // START GAME LOGIC
                      const realPlayers = players.filter(p => !p.isBot);
                      if (realPlayers.length < 3) { setCustomError("Need 3+ players!"); return; }
                      // Bot logic
                      if (realPlayers.length % 2 !== 0) {
                           const males = realPlayers.filter(p => p.gender === 'male').length;
                           const females = realPlayers.filter(p => p.gender === 'female').length;
                           const botUid = 'bot_' + Date.now();
                           setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', botUid), { 
                               uid: botUid, name: males > females ? "Scarlett" : "Brad", gender: males > females ? "female" : "male", 
                               coupleNumber: '999', relationshipStatus: 'single', joinedAt: serverTimestamp(), isActive: true, isBot: true, matches: 0, mismatches: 0 
                           });
                      }
                      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', matchHistory: [], isEnding: false });
                  }} className="w-full bg-gradient-to-r from-emerald-600 to-green-600 p-4 rounded-xl font-black tracking-widest hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all">START GAME</button>
              </div>
              <CustomAlert />
            </div>
           );
      }

      // 4.2 SETUP ROUND
      if (gameState.mode === 'admin_setup') {
          return (
            <div className="min-h-screen p-4 flex flex-col items-center justify-center text-white relative">
                 <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full text-cyan-400"><Gamepad2 size={24} /></button>
                 <h2 className="text-3xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mt-8">SETUP ROUND</h2>
                 
                 <div className="w-full max-w-md p-6 mb-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                          <div className={`font-black text-xl ${isAutoSetup ? 'text-green-400' : 'text-cyan-400'}`}>{isAutoSetup ? 'AUTOMATIC' : 'MANUAL'}</div>
                          <button onClick={()=>setIsAutoSetup(!isAutoSetup)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isAutoSetup ? 'bg-green-500' : 'bg-slate-700'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAutoSetup ? 'translate-x-7' : 'translate-x-1'}`} /></button>
                      </div>

                      {isAutoSetup ? (
                          <div className="flex gap-3 animate-in fade-in">
                              <div className="flex-1 text-center bg-black/20 rounded-lg p-2"><div className="text-xs text-cyan-400 font-bold mb-1">Truth</div><input type="number" className="w-full bg-transparent text-center border border-white/20 rounded p-1 text-white font-mono" value={qtyTruth} onChange={e=>setQtyTruth(parseInt(e.target.value))}/></div>
                              <div className="flex-1 text-center bg-black/20 rounded-lg p-2"><div className="text-xs text-pink-400 font-bold mb-1">Dare</div><input type="number" className="w-full bg-transparent text-center border border-white/20 rounded p-1 text-white font-mono" value={qtyDare} onChange={e=>setQtyDare(parseInt(e.target.value))}/></div>
                              <div className="flex-1 text-center bg-black/20 rounded-lg p-2"><div className="text-xs text-emerald-400 font-bold mb-1">Match</div><input type="number" className="w-full bg-transparent text-center border border-white/20 rounded p-1 text-white font-mono" value={qtyMM} onChange={e=>setQtyMM(parseInt(e.target.value))}/></div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="flex justify-between"><span className="font-bold text-sm text-white/70">Risk Level</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                              <div className="flex justify-between"><span className="font-bold text-sm text-white/70">Type</span><select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match</option></select></div>
                          </div>
                      )}
                      
                      {isAutoSetup && (
                          <div className="mt-4 flex justify-between"><span className="font-bold text-sm text-white/70">Risk Level</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                      )}
                 </div>

                 <button onClick={isAutoSetup ? startAutoSequence : startRound} className="w-full max-w-md bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-xl font-black tracking-widest shadow-lg active:scale-95 transition-all">
                    {isAutoSetup ? 'INITIATE AUTO SEQUENCE' : 'START ROUND'}
                 </button>
                 <CustomAlert />
            </div>
          );
      }

      // 4.3 HOST VIEW (Juego Activo)
      if (['question', 'dare', 'yn'].includes(gameState.mode)) {
          return (
            <div className="min-h-screen text-white flex flex-col p-4 relative overflow-hidden bg-slate-900">
                <div className="flex justify-between items-center mb-6">
                     <div className="flex items-center gap-2"><button onClick={() => setViewAsPlayer(true)} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><Gamepad2 size={20}/></button><span className="text-pink-500 font-black tracking-widest uppercase">HOST VIEW</span></div>
                </div>
                <div className="flex-1 flex flex-col items-center max-w-md mx-auto w-full">
                    <div className={`w-full p-6 rounded-3xl text-center mb-6 border-2 ${cardStyle} relative`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full border border-white/20">{gameState.mode === 'yn' ? 'MATCH ROUND' : 'CURRENT CARD'}</div>
                        <h3 className="text-xl font-bold mt-4 mb-2">{getCardText(finalCard)}</h3>
                        {gameState.mode === 'yn' && <div className="text-xs text-white/50 bg-black/40 p-2 rounded mt-2">(Showing combined data)</div>}
                    </div>
                    <div className="w-full bg-black/40 p-4 rounded-xl border border-white/10 mb-6 text-center">
                        <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">CURRENT STATUS</p>
                        {pendingPlayers.length > 0 ? ( <div className="text-cyan-400 font-bold animate-pulse">WAITING FOR: {pendingPlayers.map(p => p.name).join(', ')}</div> ) : ( <div className="text-emerald-400 font-bold text-lg">ROUND COMPLETE! ✅</div> )}
                    </div>
                    <button onClick={nextTurn} className="w-full bg-blue-600 p-4 rounded-xl font-bold mb-4 shadow-lg">FORCE NEXT TURN ⏭</button>
                    <button onClick={handleReturnToSetup} className="bg-slate-700 p-3 rounded-xl font-bold text-white text-xs">BACK TO SETUP</button>
                </div>
                <CustomAlert />
            </div>
          );
      }
  }
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
                {isAdmin && (
                    <button 
                        onClick={() => setShowAdminPanel(!showAdminPanel)}
                        className={`p-2 rounded-full transition-all ${showAdminPanel ? 'bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'bg-white/10 text-slate-400 hover:text-white border border-white/10'}`}
                    >
                        {showAdminPanel ? <X size={20} /> : <Gamepad2 size={20} />}
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
                    /* ========================================================================
   PEGAR ESTO EN LUGAR DE <GameInterface ... />
   ======================================================================== */
<div className="flex-1 w-full max-w-md mx-auto flex flex-col animate-in fade-in duration-500">
    
    {/* --- 1. TARJETA DEL DESAFÍO --- */}
    <div className={`w-full p-8 rounded-3xl text-center mb-6 transition-all duration-700 ${cardStyle} flex flex-col items-center justify-center min-h-[240px] relative border-2 shadow-2xl group`}>
        {/* Etiqueta Superior */}
        <div className="absolute -top-3 bg-black/80 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full border border-white/20 backdrop-blur-md shadow-xl">
            {gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}
        </div>
        
        {/* Icono Central */}
        <div className="mb-6 opacity-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] transform group-hover:scale-110 transition-transform duration-500">
                {gameState.mode === 'question' ? <MessageCircle size={48} className="text-cyan-200"/> : gameState.mode === 'yn' ? <Users size={48} className="text-emerald-200"/> : <Flame size={48} className="text-pink-200"/>}
        </div>

        {/* Texto de la Carta */}
        <h3 className="text-2xl sm:text-3xl font-bold leading-relaxed drop-shadow-md text-white">
            {getCardText(finalCard)}
        </h3>
        
        {/* Nivel de Riesgo (Esquina) */}
        <div className="absolute bottom-4 right-4 opacity-50 font-mono text-xs border border-white/30 px-2 rounded">
            LVL {finalCard?.level || '?'}
        </div>
    </div>

    {/* --- 2. ÁREA DE ACCIÓN (VOTAR / RESPONDER) --- */}
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl">
        
        {/* A) TURNO DE OTRO JUGADOR: MODO JUEZ/ESPECTADOR */}
        {!isMyTurn() && gameState.mode !== 'yn' && (
            <div className="text-center">

                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-3">
                    NOW PLAYING: {currentPlayerName()}
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

        {/* B) MI TURNO (TRUTH / DARE) */}
        {isMyTurn() && gameState.mode !== 'yn' && (
             <div className="text-center py-4">
                 <div className="animate-bounce mb-2 text-4xl">👇</div>
                 <p className="font-bold text-yellow-400 text-lg uppercase tracking-widest">It's your turn!</p>
                 <p className="text-sm text-white/70 mt-1">Read aloud and perform the action.</p>
             </div>
        )}

        {/* C) MODO MATCH (TODOS JUEGAN) */}
        {gameState.mode === 'yn' && (
            <div className="text-center">
                 {gameState.answers?.[user?.uid || ''] ? (
                     <div className="py-4">
                         <div className="text-green-400 font-bold text-xl mb-2">Answer Locked! 🔒</div>
                         <p className="text-white/50 text-xs uppercase tracking-widest">Waiting for partner...</p>
                     </div>
                 ) : (
                     <>
                        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">DO YOU AGREE?</p>
                        <div className="flex gap-3">
                            <button onClick={() => submitAnswer('yes')} className="flex-1 bg-emerald-600 p-6 rounded-xl font-black text-xl hover:bg-emerald-500 shadow-lg shadow-emerald-900/30 transition-transform active:scale-95">YES</button>
                            <button onClick={() => submitAnswer('no')} className="flex-1 bg-red-600 p-6 rounded-xl font-black text-xl hover:bg-red-500 shadow-lg shadow-red-900/30 transition-transform active:scale-95">NO</button>
                        </div>
                     </>
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