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
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    
    // Tutorial States
    const [tutorialStep, setTutorialStep] = useState<number | null>(null);
    const [codeTipShown, setCodeTipShown] = useState(false);
    const [resetTipShown, setResetTipShown] = useState(false);
    const [modeSwitchTipShown, setModeSwitchTipShown] = useState(false);
    const [viewSwitchTipShown, setViewSwitchTipShown] = useState(false);
    const [backToAdminTipShown, setBackToAdminTipShown] = useState(false);
    const [startRoundTipShown, setStartRoundTipShown] = useState(false);
    const [lobbySequence, setLobbySequence] = useState<'none' | 'tellingCode' | 'waitingPlayers'>('none');
  
    const gradientBtn = "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-900/30 active:scale-95 transition-all hover:brightness-110";
  
    // 2. EFFECTS
    useEffect(() => {
      if (user && players) {
        const isPlayerInGame = players.some(p => p.uid === user.uid);
        setIsJoined(isPlayerInGame);
      }
    }, [players, user]);
  
    useEffect(() => {
      const isNowAdmin = userName.toLowerCase().trim() === 'admin';
      setIsAdmin(isNowAdmin);
      if (isNowAdmin) {
        const autoCode = Math.floor(10000 + Math.random() * 90000).toString();
        setCode(autoCode);
        const resetGameParams = async () => {
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), {
                    code: autoCode, mode: 'lobby', roundLevel: '1', nextType: 'truth', isAutoMode: false, answers: {}, votes: {}, currentTurnIndex: 0, isEnding: false
                });
            } catch(e) { console.error("Auto reset failed", e); }
        };
        resetGameParams();
      } else {
        if (code && code.length > 5) setCode(''); 
      }
    }, [userName]);
  
    useEffect(() => {
      if (relationshipStatus === 'single') setCoupleNumber('');
      if (gameState?.mode === 'lobby' && !isJoined) setCoupleNumber('');
    }, [relationshipStatus, gameState?.mode, isJoined]);
  
    useEffect(() => {
      if (!isJoined) return;
      const nagInterval = setInterval(() => {
        if (userName === 'admin' && gameState?.mode === 'lobby') {
          const startBtn = document.getElementById('btn-start-game');
          startBtn?.classList.add('animate-bounce');
          setTimeout(() => startBtn?.classList.remove('animate-bounce'), 1000);
        }
        if (userName !== 'admin' && (!gender || !relationshipStatus)) {
          if (navigator.vibrate) navigator.vibrate(200);
          const formContainer = document.getElementById('profile-form-container');
          formContainer?.classList.add('animate-shake'); 
          setTimeout(() => formContainer?.classList.remove('animate-shake'), 500);
        }
        if (gender === 'female' && relationshipStatus === 'couple' && !coupleNumber) {
           const codeInput = document.getElementById('input-couple-code');
           codeInput?.focus(); 
        }
      }, 5000); 
      return () => clearInterval(nagInterval); 
    }, [isJoined, userName, gameState?.mode, gender, relationshipStatus, coupleNumber]);
  
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
      document.body.style.background = 'radial-gradient(circle at center, #1a1a2e 0%, #000000 100%)';
      document.body.style.color = 'white';
      document.body.style.margin = '0';
      document.body.style.minHeight = '100vh';
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);
  
    // 3. LOGICA GLOBAL SEGURA (Calculada aquí para evitar crash)
    // -----------------------------------------------------------------------
    let localCard = null;
    if (gameState?.currentChallengeId) {
        const source = gameState.mode === 'yn' ? pairChallenges : challenges;
        localCard = (source || []).find(c => c.id === gameState.currentChallengeId);
    }
    const finalCard = localCard || fetchedCard || { level: '1', text: 'Loading...', type: 'T', male: '...', female: '...' };
  
    let computedStyle = 'border-white/10 bg-white/5';
    const lvlStr = (finalCard.level || '1').toString();
    if (lvlStr === '4') computedStyle = 'border-red-600/50 shadow-[0_0_50px_rgba(220,38,38,0.4)] bg-gradient-to-b from-red-950/80 to-black';
    else if (lvlStr === '3') computedStyle = 'border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.3)] bg-gradient-to-b from-orange-950/80 to-black';
    else if (lvlStr === '2') computedStyle = 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] bg-gradient-to-b from-yellow-950/80 to-black';
    else if (lvlStr === '1') computedStyle = 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)] bg-gradient-to-b from-green-950/80 to-black';
    const cardStyle = computedStyle; 
  
    const currentUid = user?.uid || 'unknown';
    const playersSafe = players || [];
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
  
    // Match Vars
    let ynMatch = null;
    let myPartnerName = "???";
    let myPartnerUid = null;
    if (gameState?.mode === 'yn' && playersSafe.length > 0) {
        myPartnerUid = gameState.pairs ? gameState.pairs[currentUid] : null;
        const myAns = gameState.answers ? gameState.answers[currentUid] : null;
        const partnerAns = (myPartnerUid && gameState.answers) ? gameState.answers[myPartnerUid] : null;
        if (myPartnerUid) {
            const pObj = playersSafe.find(p => p.uid === myPartnerUid);
            if(pObj) myPartnerName = pObj.name;
        }
        if(myAns && partnerAns) { ynMatch = myAns === partnerAns; }
    }
    const answersCount = gameState?.answers ? Object.keys(gameState.answers).length : 0;
    const playersCount = playersSafe.length > 0 ? playersSafe.length : 1;
    const allYNAnswered = answersCount >= playersCount;
  
    // Funciones Auxiliares
    const showError = (msg: string) => setCustomError(msg);
    const closeError = () => setCustomError(null);
    const showSuccess = (msg: string) => { setCustomSuccess(msg); setTimeout(() => setCustomSuccess(null), 3000); };
    
    const handleUpdateName = async () => { if (!newName.trim() || !user) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { name: newName }); setUserName(newName); localStorage.setItem('td_username', newName); setIsEditingName(false); } catch (e) { showError("Could not update name."); } };
    const handleKickPlayer = async (uid: string, name: string) => { if(confirm(`Reset player ${name}?`)) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid)); } };
    const handleSelfLeave = async () => { if (!user) return; if (confirm("Are you sure you want to leave and reset?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid)); } };
    const handleEndGame = async () => { if(confirm('End game after this round?')) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { isEnding: true }); } };
    const handleReturnToSetup = async () => { if(confirm('Start a new game (Return to Setup)?')) { const batch = writeBatch(db); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', currentTurnIndex: 0, answers: {}, votes: {}, isEnding: false }); await batch.commit(); } };
    const handleRestart = async () => { if(confirm('RESET EVERYTHING? Use this only for a new party.')) { setCustomError(null); setIsAutoSetup(false); setSelectedLevel(''); const batch = writeBatch(db); (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'players'))).forEach(d=>batch.delete(d.ref)); (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'challenges'))).forEach(d=>batch.update(d.ref, {answered:false})); (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges'))).forEach(d=>batch.update(d.ref, {answered:false})); batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', adminUid: null, matchHistory: [], isEnding: false }); await batch.commit(); } };
    const currentPlayerName = () => gameState && players.length > 0 ? players[gameState?.currentTurnIndex]?.name : 'Nobody';
    const currentCard = () => { if (!gameState || !gameState?.currentChallengeId) return undefined; if (gameState.mode === 'yn') return pairChallenges.find(c => c.id === gameState?.currentChallengeId); return challenges.find(c => c.id === gameState?.currentChallengeId); };
    const isMyTurn = () => gameState && players[gameState?.currentTurnIndex]?.uid === user?.uid;
    const submitAnswer = async (val: string) => { if (!user) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`answers.${user.uid}`]: val }); };
    const submitVote = async (vote: string) => { if (!user) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`votes.${user.uid}`]: vote }); };
    const checkCouplesCompleteness = () => { const couples = players.filter(p => p.relationshipStatus === 'couple'); const counts: Record<string, number> = {}; couples.forEach(p => counts[p.coupleNumber] = (counts[p.coupleNumber] || 0) + 1); const incompleteIds = Object.keys(counts).filter(id => counts[id] !== 2); return { valid: incompleteIds.length === 0, incompleteIds }; };
    const checkPendingSettings = () => { const pendingTD = challenges.filter(c => !c.level || !c.type || (!c.gender && !c.sexo)).length; const pendingMM = pairChallenges.filter(c => !c.level).length; return { pendingTD, pendingMM, total: pendingTD + pendingMM }; };
    const computePairs = () => { const pairs: Record<string, string> = {}; const used = new Set<string>(); const males = players.filter(p => p.gender === 'male' && p.isActive).sort(() => Math.random() - 0.5); const females = players.filter(p => p.gender === 'female' && p.isActive).sort(() => Math.random() - 0.5); for (const male of males) { const matchIndex = females.findIndex(f => !used.has(f.uid) && f.coupleNumber !== male.coupleNumber); if (matchIndex !== -1) { const female = females[matchIndex]; pairs[male.uid] = female.uid; pairs[female.uid] = male.uid; used.add(male.uid); used.add(female.uid); } } return pairs; };
    const findNextAvailableChallenge = async (type: string, startLevel: string, playerGender: string) => { let currentLvl = parseInt(startLevel); let found = null; let collectionName = type === 'YN' ? 'pairChallenges' : 'challenges'; for(let i = 0; i < 10; i++) { let lvlString = (currentLvl + i).toString(); let ref = collection(db, 'artifacts', appId, 'public', 'data', collectionName); let q = query(ref, where('level', '==', lvlString), where('answered', '==', false)); if(type !== 'YN') { q = query(ref, where('type', '==', type), where('level', '==', lvlString), where('answered', '==', false)); } const snapshot = await getDocs(q); let validDocs = snapshot.docs.filter(d => !d.data().paused); if (type !== 'YN') { validDocs = validDocs.filter(d => { const data = d.data(); const qSex = (data.gender || data.sexo || 'B').toUpperCase(); if (qSex === 'B') return true; if (playerGender === 'male') { return qSex !== 'F'; } else { return qSex !== 'M'; } }); } if (validDocs.length > 0) { found = validDocs[Math.floor(Math.random() * validDocs.length)]; break; } } if(found) return { id: found.id, ...found.data() } as Challenge; return null; };
    
    const createGame = async (codeOverride?: any) => {
      if (!userName.trim()) { alert("⛔ Please enter your Name first!"); return; }
      if (!gender) { alert("⛔ Please select your Gender!"); return; }
      if (!relationshipStatus) { alert("⛔ Please select your Status!"); return; }
      if (!user) return;
      const finalCoupleNumber = (typeof codeOverride === 'string' && codeOverride) ? codeOverride : coupleNumber;
      if (relationshipStatus === 'couple' && !finalCoupleNumber) { alert("Please link with your partner first!"); return; }
      setIsAdmin(true); localStorage.setItem('td_username', userName);
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data'), { code: code, mode: 'lobby', currentTurn: null, adminUid: user.uid, createdAt: serverTimestamp(), riskLevel: 1, autoLoop: false, loopConfig: { truth: 1, dare: 1, match: 1 }, loopIndex: 0, loopSequence: [], lastAction: 'CREATED' });
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { uid: user.uid, name: userName, gender: gender, relationshipStatus: relationshipStatus, coupleNumber: relationshipStatus === 'couple' ? finalCoupleNumber : 'ADMIN', joinedAt: serverTimestamp(), isActive: true, isBot: false, matches: 0, mismatches: 0 });
          setIsJoined(true);
      } catch (e) { console.error("Error creating game:", e); }
    };
  
    const joinGame = async (codeOverride?: any) => {
      if (!userName.trim() || !gender || !relationshipStatus) { alert("⛔ Please complete all fields!"); return; }
      setShowScanner(false); if (!user) return;
      const isUserAdmin = userName.toLowerCase() === 'admin';
      if (!isUserAdmin && !code) { alert("Please enter Game Code!"); return; }
      const actualCoupleInput = (typeof codeOverride === 'string' && codeOverride) ? codeOverride : coupleNumber;
      let finalCoupleNumber = actualCoupleInput;
      if (relationshipStatus === 'single') { finalCoupleNumber = 'SGL_' + user.uid.slice(-6); } else { if (!finalCoupleNumber) { alert("Link partner first!"); return; } }
      try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { uid: user.uid, name: userName, gender: gender || 'unknown', coupleNumber: finalCoupleNumber, relationshipStatus: relationshipStatus, joinedAt: serverTimestamp(), isActive: true, isBot: false, matches: 0, mismatches: 0 }); setIsJoined(true); localStorage.setItem('td_username', userName); } catch (e) { console.error(e); }
    };
    const setGameCode = async () => { if (!code.trim()) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { code: code.trim().toUpperCase() }); setIsSettingCode(false); setLobbySequence('tellingCode'); setTimeout(() => { setLobbySequence('waitingPlayers'); setTimeout(() => setLobbySequence('none'), 4000); }, 4000); };
    const updateGlobalLevel = async (newLvl: string) => { setSelectedLevel(newLvl); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { roundLevel: newLvl }); };
    const updateGlobalType = async (newType: string) => { setSelectedType(newType); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { nextType: newType }); };
    
    const nextTurn = async () => { if (!gameState) return; const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'); if (gameState.isEnding) { await updateDoc(gameRef, { mode: 'ended' }); return; } let updates: any = {}; const points = { ...(gameState.points || {}) }; const batch = writeBatch(db); if (gameState.mode === 'question') { const currentUid = players[gameState.currentTurnIndex]?.uid; const likeVotes = Object.values(gameState.votes || {}).filter(v => v === 'like').length; if(currentUid) points[currentUid] = (points[currentUid] || 0) + likeVotes; } else if (gameState.mode === 'dare') { const currentUid = players[gameState.currentTurnIndex]?.uid; const yesVotes = Object.values(gameState.votes || {}).filter(v => v === 'yes').length; if(currentUid) points[currentUid] = (points[currentUid] || 0) + yesVotes; } else if (gameState.mode === 'yn') { const processed = new Set(); const currentHistory = [...(gameState.matchHistory || [])]; Object.keys(gameState.pairs || {}).forEach(uid1 => { if (processed.has(uid1)) return; const uid2 = gameState.pairs![uid1]; processed.add(uid1); processed.add(uid2); const ans1 = gameState.answers[uid1]; const ans2 = gameState.answers[uid2]; const p1 = players.find(p=>p.uid===uid1); const p2 = players.find(p=>p.uid===uid2); if (ans1 && ans2) { const isMatch = ans1 === ans2; if (isMatch) { points[uid1] = (points[uid1] || 0) + 1; points[uid2] = (points[uid2] || 0) + 1; } if (p1 && p2) { currentHistory.push({ u1: uid1, u2: uid2, name1: p1.name, name2: p2.name, result: isMatch ? 'match' : 'mismatch', timestamp: Date.now() }); } batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid1), { matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) }); batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid2), { matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) }); } }); updates.matchHistory = currentHistory; await batch.commit(); } updates.points = points; let roundFinished = false; if (gameState.mode === 'yn') { roundFinished = true; } else { let nextIdx = gameState.currentTurnIndex + 1; while(nextIdx < players.length && players[nextIdx].isBot) { nextIdx++; } if (nextIdx < players.length) { updates.currentTurnIndex = nextIdx; updates.answers = {}; updates.votes = {}; const typeChar = gameState.mode === 'question' ? 'T' : 'D'; const nextPlayerGender = players[nextIdx].gender; const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', nextPlayerGender); if (nextChallenge) { updates.currentChallengeId = nextChallenge.id; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'challenges', nextChallenge.id!), { answered: true }); } else { roundFinished = true; } } else { roundFinished = true; } } 
    if (roundFinished) { if (gameState.isAutoMode && gameState.sequence) { const nextSeqIdx = (gameState.sequenceIndex || 0) + 1; if (nextSeqIdx >= gameState.sequence.length) { updates.mode = 'admin_setup'; updates.isAutoMode = false; updates.sequence = []; showSuccess("Auto Sequence Finished!"); } else { const nextModeKey = gameState.sequence[nextSeqIdx]; let mode = nextModeKey === 'truth' ? 'question' : nextModeKey; if(mode === 'truth') mode = 'question'; let typeChar = mode === 'yn' ? 'YN' : mode === 'question' ? 'T' : 'D'; const nextPlayerGender = players.length > 0 ? players[0].gender : 'male'; const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', nextPlayerGender); if (nextChallenge) { updates.mode = mode; updates.currentTurnIndex = 0; updates.sequenceIndex = nextSeqIdx; updates.answers = {}; updates.votes = {}; updates.currentChallengeId = nextChallenge.id; if (mode === 'yn') { updates.pairs = computePairs(); players.filter(p => p.isBot).forEach(b => { updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no'; }); } const coll = mode === 'yn' ? 'pairChallenges' : 'challenges'; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true }); } else { updates.mode = 'admin_setup'; } } } else { updates.mode = 'admin_setup'; updates.currentTurnIndex = 0; updates.answers = {}; updates.votes = {}; } } await updateDoc(gameRef, updates); };
  
    const startRound = async () => {
      if (!selectedLevel) { showError("⚠️ Select Risk Level!"); return; } if (!selectedType) { showError("⚠️ Select Game Type!"); return; }
      let initialMode = selectedType === 'yn' ? 'yn' : selectedType === 'truth' ? 'question' : 'dare';
      let typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';
      if (typeChar === 'YN' && players.length < 3) { showError("❌ You need at least 3 players to play Match/Mismatch!"); return; }
      const firstPlayerGender = players.length > 0 ? players[0].gender : 'male';
      const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel, firstPlayerGender);
      if (!nextChallenge) { showError('No challenges found for this selection.'); return; }
      let updates: any = { mode: initialMode, currentTurnIndex: 0, answers: {}, votes: {}, adminUid: players[0].uid, currentChallengeId: nextChallenge.id, roundLevel: selectedLevel, isAutoMode: false, sequence: [], sequenceIndex: 0 };
      if (initialMode === 'yn') { updates.pairs = computePairs(); players.filter(p => p.isBot).forEach(b => { updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no'; }); }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
      const coll = initialMode === 'yn' ? 'pairChallenges' : 'challenges';
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
    };
  
    const startAutoSequence = async () => {
        if (!selectedLevel) { showError("⚠️ Select a Level to start!"); return; }
        let sequence: string[] = []; for(let i=0; i<qtyTruth; i++) sequence.push('question'); for(let i=0; i<qtyDare; i++) sequence.push('dare'); for(let i=0; i<qtyMM; i++) sequence.push('yn');
        sequence.sort(() => Math.random() - 0.5);
        if (sequence.length === 0) { showError("⚠️ Select at least 1 round!"); return; }
        const initialMode = sequence[0];
        const typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';
        const firstPlayerGender = players[0].gender;
        const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel, firstPlayerGender);
        if (!nextChallenge) { showError('No challenges found for these settings.'); return; }
        let updates: any = { mode: initialMode, currentTurnIndex: 0, answers: {}, votes: {}, adminUid: user?.uid, currentChallengeId: nextChallenge.id, roundLevel: selectedLevel, isAutoMode: true, sequence: sequence, sequenceIndex: 0 };
        if (initialMode === 'yn') { updates.pairs = computePairs(); players.filter(p => p.isBot).forEach(b => { updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no'; }); }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
        const coll = initialMode === 'yn' ? 'pairChallenges' : 'challenges';
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
    };
    
    // Manager Logic
    const handleSort = (key: keyof Challenge) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
    const handleRowMouseDown = (id: string, e: React.MouseEvent) => { setIsDragging(true); const newSet = new Set(selectedIds); if (newSet.has(id)) { newSet.delete(id); selectionMode.current = 'remove'; } else { newSet.add(id); selectionMode.current = 'add'; } setSelectedIds(newSet); };
    const handleRowMouseEnter = (id: string) => { if (isDragging) { const newSet = new Set(selectedIds); if (selectionMode.current === 'add') newSet.add(id); else newSet.delete(id); setSelectedIds(newSet); } };
    const toggleSelectAll = (filteredData: Challenge[]) => { if (selectedIds.size === filteredData.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredData.map(c => c.id!))); };
    const updateSingleField = async (collectionName: string, id: string, field: string, value: string | boolean) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id), { [field]: value }); };
    const applyBulkEdit = async () => { if (selectedIds.size === 0) return; const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; if (!confirm(`Update ${selectedIds.size}?`)) return; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); const updates: any = {}; if (bulkLevel) updates.level = bulkLevel; if (managerTab !== 'mm' && bulkGender) updates.gender = bulkGender; batch.update(ref, updates); }); await batch.commit(); setBulkLevel(''); setBulkGender(''); setSelectedIds(new Set()); };
    const deleteSelected = async () => { if (selectedIds.size === 0) return; const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; if (!confirm(`Delete ${selectedIds.size}?`)) return; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.delete(ref); }); await batch.commit(); setSelectedIds(new Set()); };
    const bulkPause = async (pauseStatus: boolean) => { if (selectedIds.size === 0) return; const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.update(ref, { paused: pauseStatus }); }); await batch.commit(); setSelectedIds(new Set()); };
    const handleExportCSV = (isTemplate: boolean) => { const isMM = managerTab === 'mm'; const headers = !isMM ? "text,level,gender" : "male,female,level"; let csvContent = "data:text/csv;charset=utf-8," + headers + "\n"; if (!isTemplate) { const data = isMM ? pairChallenges : challenges.filter(c => c.type === (managerTab === 'truth' ? 'T' : 'D')); data.forEach(row => { if (!isMM) { const safeText = `"${(row.text || '').replace(/"/g, '""')}"`; csvContent += `${safeText},${row.level||''},${row.gender||row.sexo||''}\n`; } else { const safeMale = `"${(row.male || '').replace(/"/g, '""')}"`; const safeFemale = `"${(row.female || '').replace(/"/g, '""')}"`; csvContent += `${safeMale},${safeFemale},${row.level||''}\n`; } }); } const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", isTemplate ? `template_${managerTab}.csv` : `export_${managerTab}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const handleUploadSingleCol = async (e: React.ChangeEvent<HTMLInputElement>, fixedType: 'T' | 'D') => { const file = e.target.files?.[0]; if(!file) return; const text = await file.text(); const lines = text.split(/\r?\n/); const headerLine = lines[0].toLowerCase().trim(); if (!headerLine.includes('text') || !headerLine.includes('level') || !headerLine.includes('gender')) { showError(`Invalid CSV for ${fixedType === 'T' ? 'Truth' : 'Dare'}.\nExpected headers: text, level, gender\nFound: ${headerLine}`); return; } setUploading(true); const ref = collection(db, 'artifacts', appId, 'public', 'data', 'challenges'); const batch = writeBatch(db); let count = 0; lines.slice(1).forEach(line => { if(!line.trim()) return; const parts = parseCSVLine(line); if (!parts) return; const textVal = parts[0]?.trim(); const levelVal = parts[1]?.trim(); const genderVal = parts[2]?.trim(); if(textVal) { const docRef = doc(ref); batch.set(docRef, { text: textVal, level: levelVal, type: fixedType, gender: genderVal, answered: false, paused: false }); count++; } }); await batch.commit(); setUploading(false); showSuccess(`Uploaded ${count} ${fixedType === 'T' ? 'Truth' : 'Dare'} questions.`); if(e.target) e.target.value = ''; };
    const handleUploadDoubleCol = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if(!file) return; const text = await file.text(); const lines = text.split(/\r?\n/); const headerLine = lines[0].toLowerCase().trim(); if (!headerLine.includes('male') || !headerLine.includes('female') || !headerLine.includes('level')) { showError(`Invalid CSV for Match/Mismatch.\nExpected headers: male, female, level\nFound: ${headerLine}`); return; } setUploading(true); const ref = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges'); const batch = writeBatch(db); let count = 0; lines.slice(1).forEach(line => { if(!line.trim()) return; const parts = parseCSVLine(line); if (!parts) return; const male = parts[0]?.trim(); const female = parts[1]?.trim(); const level = parts[2]?.trim(); if (male && female) { const docRef = doc(ref); batch.set(docRef, { male, female, level, answered: false, paused: false }); count++; } }); await batch.commit(); setUploading(false); showSuccess(`Uploaded ${count} Match/Mismatch questions.`); if(e.target) e.target.value = ''; };
  
    const CustomAlert = () => customError ? ( <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[150]"> <div className={`p-6 max-w-md text-center ${glassPanel} border-red-500/50`}> <AlertTriangle className="mx-auto text-red-500 mb-2" size={40}/> <p className="text-white mb-4 whitespace-pre-line font-medium">{customError}</p> <button onClick={closeError} className="bg-red-600/80 hover:bg-red-500 px-6 py-2 rounded font-bold transition-colors">OK</button> </div> </div> ) : null;
    const CustomSuccess = () => customSuccess ? ( <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-2 z-[150] animate-in fade-in slide-in-from-top-4"> <CheckCircle size={20} /> <span className="font-bold">{customSuccess}</span> </div> ) : null;
    const MyMatchHistory = () => { const myUid = user?.uid; const history = gameState?.matchHistory || []; const stats: Record<string, {name: string, m: number, um: number}> = {}; history.forEach(h => { if (h.u1 !== myUid && h.u2 !== myUid) return; const isU1 = h.u1 === myUid; const partnerName = isU1 ? h.name2 : h.name1; const partnerUid = isU1 ? h.u2 : h.u1; if (!stats[partnerUid]) { stats[partnerUid] = { name: partnerName, m: 0, um: 0 }; } if (h.result === 'match') { stats[partnerUid].m += 1; } else { stats[partnerUid].um += 1; } }); if (Object.keys(stats).length === 0) return null; return ( <div className={`w-full p-2 mt-2 max-h-32 overflow-y-auto ${glassPanel}`}> <div className="text-xs text-slate-400 mb-1 uppercase font-bold text-center tracking-widest">Interactions</div> <table className="w-full text-xs"> <thead><tr className="border-b border-white/10 text-slate-400"><th className="text-left py-1">Name</th><th className="text-center py-1 text-green-400">Match</th><th className="text-center py-1 text-red-400">Miss</th></tr></thead> <tbody>{Object.values(stats).map((s, idx) => (<tr key={idx} className="border-b border-white/5"><td className="py-1 font-bold">{s.name}</td><td className="py-1 text-center font-bold text-green-400">{s.m}</td><td className="py-1 text-center font-bold text-red-400">{s.um}</td></tr>))}</tbody> </table> </div> ); };
    const ScoreBoard = () => ( <div className={`w-full p-2 mb-2 flex flex-col items-center gap-2 max-h-40 overflow-y-auto ${glassPanel}`}> <div className="w-full text-xs text-center text-cyan-300 uppercase font-black tracking-[0.2em] border-b border-white/10 pb-1 mb-1">Scoreboard</div> <div className="flex flex-wrap gap-2 justify-center w-full"> {players.map(p => ( <div key={p.uid} className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-2 border ${p.isBot ? 'bg-purple-900/30 border-purple-500/50' : 'bg-white/10 border-white/10'}`}> <span className="font-bold text-white">{p.name}</span> <span className="text-yellow-400 font-black">{gameState?.points?.[p.uid] || 0}</span> {isAdmin && (<button onClick={(e) => { e.stopPropagation(); handleKickPlayer(p.uid, p.name); }} className="text-red-400 hover:text-red-200 transition-colors" title="Reset Player"><Trash2 size={12}/></button>)} </div> ))} </div> </div> );
  
    if (loading) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mb-4"></div><span className="animate-pulse">Loading System...</span></div>;
  
    // ----------------------------------------------------------------------------------
    // 4. ADMIN HOST VIEWS (Protegidos)
    // ----------------------------------------------------------------------------------
    if (isAdmin && !viewAsPlayer) {
        if (['question', 'dare', 'yn'].includes(gameState?.mode || '')) {
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
        // ADMIN LOBBY & SETUP
        if (!gameState || !gameState.mode || gameState.mode === 'lobby') {
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
                <div className="mb-6 w-full max-w-sm relative group animate-in zoom-in">
                    <div className="relative w-full py-6 bg-black/80 border border-white/10 rounded-xl flex flex-col items-center justify-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Party Code</span>
                        <span className="text-4xl font-black font-mono tracking-[0.3em] text-white select-all">{code}</span>
                    </div>
                </div>
                <div className="relative w-full max-w-sm">
                    <button onClick={() => {
                        const realPlayers = players.filter(p => !p.isBot);
                        if (realPlayers.length < 3) { setCustomError("Need 3+ players!"); return; }
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
                        {isAutoSetup && (<div className="mt-4 flex justify-between"><span className="font-bold text-sm text-white/70">Risk Level</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-white/20 rounded p-1 text-white text-sm w-36"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>)}
                   </div>
                   <button onClick={isAutoSetup ? startAutoSequence : startRound} className="w-full max-w-md bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-xl font-black tracking-widest shadow-lg active:scale-95 transition-all">{isAutoSetup ? 'INITIATE AUTO SEQUENCE' : 'START ROUND'}</button>
                   <CustomAlert />
              </div>
            );
        }
    }
  
    // MANAGER RENDER
    if (isAdmin && isManaging) {
         // ... (Esto lo mantenemos igual, ya funciona bien) ...
         // (Por simplicidad en este bloque de rescate, lo omito, pero si lo tienes en tu código original, déjalo aquí)
         // Si lo borraste, avísame y te paso el bloque del Manager también.
    }
  
    if (gameState?.mode === 'ended') {
        return (<div className="min-h-screen text-white p-6 flex flex-col items-center justify-center relative"><Trophy className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-glow" /><h2 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">GAME OVER</h2><div className={`w-full max-w-sm max-h-[60vh] overflow-y-auto mb-8 p-4 ${glassPanel}`}>{players.map((p, i) => <div key={p.uid} className="py-3 border-b border-white/5 flex justify-between items-center last:border-0"><span className="font-bold">{p.name}</span><span className="font-black text-xl text-yellow-400">{gameState?.points[p.uid] || 0} pts</span></div>)}</div> <button onClick={handleReturnToSetup} className="bg-cyan-600 px-8 py-4 rounded-xl font-bold shadow-lg">New Game (Setup)</button></div>);
    }
  
    // ----------------------------------------------------------------------------------
    // 5. PLAYER VIEW (Y ADMIN "VIEW AS PLAYER")
    // ----------------------------------------------------------------------------------
    if (!isJoined) {
       return (
          <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
              <div className="absolute inset-0 z-0"><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black"></div></div>
              <div id="profile-form-container" className="w-full max-w-md relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                  <div className="mb-6 relative inline-block"><Flame className="w-16 h-16 text-pink-500 relative z-10 mx-auto drop-shadow-lg" /></div>
                  <h1 className="text-4xl font-black mb-8 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500">SEXY GAME</h1>
                  <div className="relative mb-4 w-full"><UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20}/><input type="text" placeholder="YOUR NICKNAME" className="w-full pl-12 py-4 font-bold tracking-wider text-center text-xl text-yellow-400 placeholder:text-white/20 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-pink-500 transition-all" value={userName} onChange={e=>setUserName(e.target.value)} maxLength={12}/></div>
                  <div className="grid grid-cols-2 gap-4 mb-6 w-full"><div className="relative"><select value={gender} onChange={e=>setGender(e.target.value)} className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl text-white p-4 focus:outline-none text-center"><option value="" disabled>Gender</option><option value="male">Male</option><option value="female">Female</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16}/></div><div className="relative"><select value={relationshipStatus} onChange={e=>setRelationshipStatus(e.target.value as 'single'|'couple')} className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl text-white p-4 focus:outline-none text-center"><option value="" disabled>Status</option><option value="single">Single</option><option value="couple">Couple</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16}/></div></div>
                  {userName.toLowerCase().trim() === 'admin' ? (
                     <div className="mb-8 w-full relative group animate-in zoom-in">
                        <div className="relative w-full py-4 bg-black/80 border border-white/10 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Your Party Code</span>
                            <span className="text-3xl font-black font-mono tracking-[0.3em] text-white shadow-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{code || '...'}</span>
                        </div>
                     </div>
                  ) : (
                     <div className="relative mb-8 w-full"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20}/><input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="GAME CODE" className="w-full pl-12 py-4 text-center tracking-[0.5em] font-mono font-bold text-2xl bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500 transition-all text-white placeholder:text-white placeholder:text-sm placeholder:tracking-widest placeholder:font-bold" value={code} onChange={e=>setCode(e.target.value)} /></div>
                  )}
                  <div className="w-full">
                      {relationshipStatus === 'couple' && !coupleNumber ? (
                          <button onClick={() => setShowScanner(true)} className="w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/50"><HeartHandshake size={24} /> SET GAME CODE (ask admin)</button>
                      ) : (
                          userName.toLowerCase().trim() === 'admin' ? (
                              <button onClick={() => createGame()} className={`w-full py-4 rounded-xl font-black text-xl uppercase tracking-widest transition-all shadow-lg hover:shadow-cyan-500/50 ${gradientBtn}`}>START PARTY NOW</button>
                          ) : (
                              <button onClick={() => joinGame()} disabled={!code} className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-all shadow-lg hover:shadow-pink-500/50 ${gradientBtn} ${!code ? 'opacity-50 cursor-not-allowed' : ''}`}>{coupleNumber ? 'ENTER (LINKED)' : 'JOIN PARTY'}</button>
                          )
                      )}
                  </div>
                  <div className="mt-8 text-xs text-white/20 tracking-widest">SECURE CONNECTION • v5.0 FIXED</div>
              </div>
              {showScanner && <CouplePairing gender={gender} onCodeObtained={(c: string) => setCoupleNumber(c)} value={coupleNumber} onBack={() => setShowScanner(false)} onAutoJoin={(manualCode: string) => { setShowScanner(false); if (userName.toLowerCase().trim() === 'admin') { createGame(manualCode); } else { joinGame(manualCode); } }} db={db} currentUserUid={user?.uid} appId={appId} />}
          </div>
       );
    }
  
    // LOBBY JUGADOR
    if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
              <CustomAlert/>
              {isAdmin && (<button onClick={() => setViewAsPlayer(false)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-yellow-500 text-yellow-500 transition-all z-50 animate-pulse backdrop-blur-md" title="Back to Admin View"><Settings size={24} /></button>)}
              <div className="text-center py-2 border-b border-white/10 mb-4 w-full flex items-center justify-center gap-2 relative flex-col mt-8">
                  <div className="flex items-center gap-3"><h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-600 drop-shadow-sm">{userName.toUpperCase()}</h1></div>
                  {relationshipStatus === 'couple' && (<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-mono mt-2"><Users size={12}/> COUPLE ID: {coupleNumber}</div>)}
              </div>
              <div className="w-full max-w-md"><ScoreBoard /></div>
              <div className="w-full max-w-md"><MyMatchHistory /></div>
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in w-full max-w-2xl mx-auto">
                  <div className="mb-12 relative group cursor-default">
                      <div className="absolute -inset-2 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-[2rem] blur-xl opacity-30 group-hover:opacity-50 transition duration-1000 animate-pulse-slow"></div>
                      <div className="relative bg-black/60 backdrop-blur-xl border-2 border-white/10 p-8 rounded-[2rem] shadow-2xl">
                          <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400 text-sm font-bold uppercase tracking-[0.5em] mb-2">Party Code</h3>
                          <div className="text-7xl sm:text-8xl md:text-9xl font-black text-white tracking-[0.15em] font-mono drop-shadow-[0_0_25px_rgba(255,255,255,0.4)] select-all transition-all">{gameState?.code || code}</div>
                      </div>
                  </div>
                  <div className="mb-6 relative"><div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 animate-pulse"></div><Trophy className="w-20 h-20 text-yellow-400 relative z-10 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-bounce-slow" /></div>
                  <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 uppercase tracking-widest drop-shadow-lg animate-pulse">Waiting for the game to start...</h2>
                  <p className="text-white/60 text-lg font-medium tracking-wide max-w-md mx-auto">Get ready!</p>
              </div>
              <div className="mt-auto w-full flex justify-center pb-8"><button onClick={handleSelfLeave} className="text-red-500/50 hover:text-red-500 flex items-center gap-2 text-xs uppercase tracking-widest transition-colors"><LogOut size={14}/> Reset Player</button></div>
          </div>
        );
    }
  
    // --- FINAL RETURN: INTERFAZ DE JUEGO ACTIVO ---
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center relative overflow-hidden font-sans">
        {/* Fondo */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black"></div>
        
        <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center flex-1 p-4 animate-in fade-in">
             
             {/* Header */}
             <div className="w-full flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                     <span className="font-black text-xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">SEXY GAME</span>
                 </div>
                 {relationshipStatus === 'couple' && <div className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded text-white/50">{coupleNumber}</div>}
             </div>

             {/* RESULTADO MATCH (OVERLAY) */}
             {gameState.mode === 'yn' && allYNAnswered && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in zoom-in duration-300">
                    <div className="text-center p-6">
                        <div className="text-8xl mb-6 animate-bounce">{ynMatch ? '❤️' : '💔'}</div>
                        <h2 className={`text-5xl font-black uppercase tracking-tighter mb-4 ${ynMatch ? 'text-green-500 drop-shadow-[0_0_30px_rgba(34,197,94,0.8)]' : 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]'}`}>
                            {ynMatch ? 'IT\'S A MATCH!' : 'MISMATCH!'}
                        </h2>
                        <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
                            <p className="text-sm text-white/50 uppercase tracking-widest mb-2">PARTNER'S ANSWER</p>
                            <p className="text-3xl font-black text-white">{myPartnerName} said {gameState.answers[gameState.pairs?.[user?.uid || ''] || '']?.toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TARJETA DEL JUEGO */}
            <div className={`w-full p-8 rounded-3xl text-center mb-6 transition-all duration-700 ${cardStyle} flex flex-col items-center justify-center min-h-[240px] relative border-2 shadow-2xl group`}>
                <div className="absolute -top-3 bg-black/80 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full border border-white/20 backdrop-blur-md shadow-xl">
                    {gameState.mode === 'yn' ? 'MATCH ROUND' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}
                </div>
                
                {/* Indicador de Partner (Match Mode) */}
                {gameState.mode === 'yn' && (
                    <div className="w-full bg-black/50 border border-white/20 rounded-xl p-3 mb-4 flex items-center justify-center gap-3 animate-pulse">
                         <Users size={16} className="text-emerald-400"/>
                         <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">PLAYING WITH:</span>
                         <span className="text-emerald-400 font-black text-sm uppercase">{myPartnerName}</span>
                     </div>
                )}

                <h3 className="text-2xl sm:text-3xl font-bold leading-relaxed drop-shadow-md text-white">
                    {getCardText(finalCard)}
                </h3>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="w-full bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl relative z-20">
                
                {/* A) MODO ESPECTADOR / JUEZ */}
                {!isMyTurn() && gameState.mode !== 'yn' && (
                    <div className="text-center">
                        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">NOW PLAYING: {currentPlayerName()}</p>
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
                         {gameState.answers?.[user?.uid || ''] ? (
                             <div className="py-4">
                                 <div className="text-green-400 font-bold text-xl mb-2 animate-bounce">Answered! <CheckCircle className="inline ml-1" size={20}/></div>
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
            
            <div className="mt-4 w-full"><MyMatchHistory /></div>
            
            <div className="mt-6 text-center">
                 <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/10 ${pendingPlayers.length > 0 ? 'animate-pulse' : ''}`}>
                     <RefreshCw size={14} className={pendingPlayers.length > 0 ? "animate-spin text-cyan-400" : "text-emerald-400"}/>
                     <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
                         {pendingPlayers.length > 0 ? `${pendingPlayers.length} Waiting...` : "ALL READY"}
                     </span>
                 </div>
            </div>
        </div>
        
        {/* BOTONES FLOTANTES */}
        <button onClick={() => setShowPlayerHelp(true)} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><HelpCircle size={24}/></button>
        {isAdmin && (<button onClick={() => setViewAsPlayer(false)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full hover:bg-white/20 border border-yellow-500 text-yellow-500 transition-all z-50" title="Admin Panel"><Settings size={24} /></button>)}
        
        {/* MODALS */}
        {showPlayerHelp && <HelpModal onClose={() => setShowPlayerHelp(false)} />}
        <CustomAlert />
        <CustomSuccess />
    </div>
  );
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