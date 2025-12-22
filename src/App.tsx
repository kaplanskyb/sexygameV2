import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import confetti from 'canvas-confetti';

// --- SONIDOS ---
const playSound = (type: 'pop' | 'success' | 'fail' | 'drink' | 'click') => {
  const sounds = {
    pop: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
    success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    fail: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
    drink: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
    click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
  };
  const audio = new Audio(sounds[type]);
  audio.volume = 0.5;
  audio.play().catch(e => console.log("Audio interaction required", e));
};

import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query,      
    where, serverTimestamp, deleteDoc, getDocs, writeBatch, increment
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
    User as UserIcon, Lock, ChevronDown, ChevronUp, Flame, HelpCircle,
    Gamepad2, Trophy, Users, UserX, Trash2, RefreshCw, Settings,
    HeartHandshake, AlertTriangle, Info, BookOpen, Zap, CheckCircle, 
    Upload, FileSpreadsheet, Download, PauseCircle, PlayCircle, CheckSquare, 
    Square, Filter, ArrowUpDown, Search, Edit2, LogOut, MessageCircle, RefreshCcw, X, XCircle, ThumbsUp, ThumbsDown
} from 'lucide-react';

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
  isDrinkMode?: boolean;
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

// --- COMPONENTES AUXILIARES ---
const TutorialTooltip = ({ text, onClick, className, arrowPos = 'bottom' }: { text: string, onClick: () => void, className?: string, arrowPos?: 'top' | 'bottom' | 'left' | 'right' }) => (
    <div className={`absolute z-[200] cursor-pointer animate-bounce ${className}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <div className="bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.8)] relative whitespace-nowrap border-2 border-white pointer-events-auto">
            {text}
            {arrowPos === 'bottom' && <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-yellow-400"></div>}
            {arrowPos === 'top' && <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-yellow-400"></div>}
            {arrowPos === 'left' && <div className="absolute top-1/2 right-full -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-yellow-400"></div>}
            {arrowPos === 'right' && <div className="absolute top-1/2 left-full -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-yellow-400"></div>}
        </div>
    </div>
);

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
    const toggleSection = (section: string) => { setExpandedSection(expandedSection === section ? null : section); };

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm" onClick={onClose}>
            <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 ${glassPanel}`} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"><X size={24} /></button>
                <div className="p-8">
                    <h2 className="text-3xl font-black mb-8 flex items-center gap-3 border-b border-white/10 pb-4">
                        {type === 'admin' ? <BookOpen size={32} className="text-cyan-400" /> : <HelpCircle size={32} className="text-yellow-400" />}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">{type === 'admin' ? 'Game Master Manual' : 'Player Instructions'}</span>
                    </h2>
                    <div className="space-y-8 text-slate-300">
                        {type === 'admin' ? (
                            <>
                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Flame className="text-orange-500" /> The Game Modes (Click to expand)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className={`cursor-pointer border rounded-xl p-4 transition-all ${expandedSection === 'truth' ? 'bg-blue-900/40 border-blue-400' : 'bg-white/5 border-white/10'}`} onClick={() => toggleSection('truth')}>
                                            <div className="flex justify-between items-center mb-2"><strong className="text-blue-400 text-lg">1. Truth</strong>{expandedSection === 'truth' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                                            <p className="text-sm text-slate-400">Verbal questions.</p>
                                        </div>
                                        <div className={`cursor-pointer border rounded-xl p-4 transition-all ${expandedSection === 'dare' ? 'bg-pink-900/40 border-pink-400' : 'bg-white/5 border-white/10'}`} onClick={() => toggleSection('dare')}>
                                            <div className="flex justify-between items-center mb-2"><strong className="text-pink-400 text-lg">2. Dare</strong>{expandedSection === 'dare' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                                            <p className="text-sm text-slate-400">Physical actions.</p>
                                        </div>
                                        <div className={`cursor-pointer border rounded-xl p-4 transition-all ${expandedSection === 'match' ? 'bg-emerald-900/40 border-emerald-400' : 'bg-white/5 border-white/10'}`} onClick={() => toggleSection('match')}>
                                            <div className="flex justify-between items-center mb-2"><strong className="text-emerald-400 text-lg">3. Match</strong>{expandedSection === 'match' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                                            <p className="text-sm text-slate-400">Compatibility.</p>
                                        </div>
                                    </div>
                                </section>
                            </>
                        ) : (
                            <section><h3 className="text-xl font-bold text-white mb-3">👋 How to Play</h3><p>Follow instructions on screen!</p></section>
                        )}
                    </div>
                    <div className="mt-8 text-center border-t border-white/10 pt-6"><button onClick={onClose} className="bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-3 rounded-xl font-bold text-white uppercase">Got it</button></div>
                </div>
            </div>
        </div>
    );
};

const CouplePairing = ({ gender, onCodeObtained, value, onBack, onAutoJoin, db, currentUserUid, appId }: any) => {
    const [localCode] = useState(() => value ? value : Math.floor(100 + Math.random() * 900).toString());
    const [inputCode, setInputCode] = useState('');
    const [isLinked, setIsLinked] = useState(false);
    const isFemale = gender === 'female';
    
    useEffect(() => {
        if (isFemale && db && localCode) {
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'players'), where('coupleNumber', '==', localCode));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const partner = snapshot.docs.find(d => d.data().uid !== currentUserUid);
                if (partner) { setIsLinked(true); onCodeObtained(localCode); setTimeout(() => { onAutoJoin(localCode); }, 2000); }
            });
            return () => unsubscribe();
        }
    }, [isFemale, localCode, db, currentUserUid, appId]);

    const handleManSubmit = () => { if (inputCode.length !== 3) return; onCodeObtained(inputCode); setIsLinked(true); setTimeout(() => { onAutoJoin(inputCode); }, 1500); };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-8 uppercase tracking-widest text-center animate-pulse">{isLinked ? '❤️ LINKED! ❤️' : (isFemale ? 'WAITING FOR PARTNER...' : 'ENTER PARTNER CODE')}</h3>
            <div className="bg-slate-800 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center relative">
                {isLinked && (<div className="absolute inset-0 z-20 bg-emerald-500 rounded-3xl flex flex-col items-center justify-center animate-in zoom-in"><HeartHandshake size={64} className="text-white mb-4 animate-bounce" /><span className="text-white font-black text-3xl">CONNECTED</span></div>)}
                {isFemale ? (<div className="bg-white text-slate-900 font-mono font-black text-6xl py-8 px-8 rounded-2xl mb-6">{localCode}</div>) : (
                    <><input type="number" inputMode="numeric" maxLength={3} placeholder="000" className="w-full bg-slate-900 border-2 border-slate-700 text-white font-mono font-black text-5xl text-center py-4 rounded-xl mb-8" value={inputCode} onChange={(e) => setInputCode(e.target.value.slice(0, 3))} />
                    <button onClick={handleManSubmit} disabled={inputCode.length < 3} className="w-full py-4 font-black uppercase tracking-widest rounded-xl bg-purple-600 text-white">LINK NOW</button></>
                )}
            </div>
            {!isLinked && <button onClick={onBack} className="mt-8 text-slate-500 hover:text-white text-sm font-bold uppercase">Cancel</button>}
        </div>
    );
};

const AdminPanel = ({ players, onStartGame, onNextTurn, onReset, onKick }: any) => (
    <div className="bg-slate-800 p-4 rounded-xl border border-white/10 mb-6">
        <h3 className="text-xl font-bold text-pink-500 mb-4 border-b border-white/10 pb-2">Admin Control Panel</h3>
        <div className="space-y-4">
            <div className="bg-black/40 p-3 rounded-lg"><div className="grid grid-cols-2 gap-2"><button onClick={onStartGame} className="bg-emerald-600 p-2 rounded text-xs font-bold">Start Game</button><button onClick={onNextTurn} className="bg-blue-600 p-2 rounded text-xs font-bold">Force Next</button></div></div>
            <button onClick={onReset} className="w-full bg-red-900/50 border border-red-500/50 p-2 rounded text-xs font-bold text-red-200">Reset Entire Game</button>
            <div className="bg-black/40 p-3 rounded-lg max-h-40 overflow-y-auto">{players.map((p: any) => (<div key={p.uid} className="flex justify-between items-center text-xs py-1 border-b border-white/5"><span>{p.name}</span><button onClick={() => onKick(p.uid, p.name)} className="text-red-400">Kick</button></div>))}</div>
        </div>
    </div>
);

const DrinkAlert = () => (<div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"><div className="bg-red-600/90 border-4 border-yellow-400 p-8 rounded-3xl animate-bounce shadow-[0_0_100px_rgba(220,38,38,0.8)] rotate-3"><h1 className="text-6xl font-black text-yellow-300 drop-shadow-lg tracking-widest text-center">DRINK!</h1><p className="text-white text-xl font-bold text-center mt-2 uppercase">Penalty Time</p></div></div>);

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function TruthAndDareApp() {
    const [isJoined, setIsJoined] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
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
    const [isDrinkMode, setIsDrinkMode] = useState(false);
    const [tutorialStep, setTutorialStep] = useState<number | null>(null);
    const [codeTipShown, setCodeTipShown] = useState(false);
    const [resetTipShown, setResetTipShown] = useState(false);
    const [modeSwitchTipShown, setModeSwitchTipShown] = useState(false);
    const [viewSwitchTipShown, setViewSwitchTipShown] = useState(false);
    const [backToAdminTipShown, setBackToAdminTipShown] = useState(false);
    const [startRoundTipShown, setStartRoundTipShown] = useState(false);
    const [lobbySequence, setLobbySequence] = useState<'none' | 'tellingCode' | 'waitingPlayers'>('none');

    const gradientBtn = "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-900/30 active:scale-95 transition-all hover:brightness-110";

    // --- EFFECTS ---
    useEffect(() => { document.body.style.background = 'radial-gradient(circle at center, #1a1a2e 0%, #000000 100%)'; document.body.style.color = 'white'; document.body.style.minHeight = '100vh'; window.addEventListener('mouseup', () => setIsDragging(false)); return () => window.removeEventListener('mouseup', () => setIsDragging(false)); }, []);
    useEffect(() => { const initAuth = async () => { try { await signInAnonymously(auth); } catch (e) { console.error(e); } }; initAuth(); return onAuthStateChanged(auth, (u) => { setUser(u); const savedName = localStorage.getItem('td_username'); if (savedName) setUserName(savedName); }); }, []);
    useEffect(() => { if (user && players) { const isPlayerInGame = players.some(p => p.uid === user.uid); setIsJoined(isPlayerInGame); } }, [players, user]);
    useEffect(() => { const isNowAdmin = userName.toLowerCase().trim() === 'admin'; setIsAdmin(isNowAdmin); }, [userName]);
    
    // FETCH GAME DATA
    useEffect(() => {
        if (!user) return;
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
        const unsubGame = onSnapshot(gameRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as GameState;
                setGameState(data);
                if (data.code) setCode(data.code);
                if (data.isAutoMode !== undefined) setIsAutoSetup(data.isAutoMode);
                if (data.isDrinkMode !== undefined) setIsDrinkMode(data.isDrinkMode);
                if (data.roundLevel && data.roundLevel !== selectedLevel) setSelectedLevel(data.roundLevel);
                if (data.nextType && data.nextType !== selectedType) setSelectedType(data.nextType);
            } else {
                setGameState({ mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', matchHistory: [], isDrinkMode: false });
            }
            setLoading(false);
        });
        const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
        const unsubPlayers = onSnapshot(query(playersRef), (snapshot) => { const pList = snapshot.docs.map(d => d.data() as Player); pList.sort((a, b) => (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0)); setPlayers(pList); });
        const challengesRef = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
        const unsubChallenges = onSnapshot(query(challengesRef), (snapshot) => { setChallenges(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Challenge))); });
        const pairChallengesRef = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
        const unsubPairChallenges = onSnapshot(query(pairChallengesRef), (snapshot) => { setPairChallenges(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Challenge))); });
        return () => { unsubGame(); unsubPlayers(); unsubChallenges(); unsubPairChallenges(); };
    }, [user]);

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
            if (docSnap.exists()) setFetchedCard({id: docSnap.id, ...docSnap.data()} as Challenge);
          });
        }
    }, [gameState?.currentChallengeId, gameState?.mode]);

    useEffect(() => {
        if (!isAdmin || !gameState || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') return;
        let shouldAdvance = false;
        if (gameState.mode === 'yn') { if (Object.keys(gameState.answers).length >= players.length) shouldAdvance = true; } 
        else { const realPlayers = players.filter(p => !p.isBot); if (Object.keys(gameState.votes).length >= realPlayers.length - 1) shouldAdvance = true; }
        if (shouldAdvance) { const timer = setTimeout(() => { nextTurn(); }, 4000); return () => clearTimeout(timer); }
    }, [gameState, isAdmin, players.length]);

    // --- GAME LOGIC ---
    const showError = (msg: string) => setCustomError(msg);
    const closeError = () => setCustomError(null);
    const showSuccess = (msg: string) => { setCustomSuccess(msg); setTimeout(() => setCustomSuccess(null), 3000); };
    
    const handleUpdateName = async () => { if (!newName.trim() || !user) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { name: newName }); setUserName(newName); localStorage.setItem('td_username', newName); setIsEditingName(false); } catch (e) { showError("Error updating name"); } };
    const handleKickPlayer = async (uid: string, name: string) => { if(confirm(`Kick ${name}?`)) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid)); };
    const handleSelfLeave = async () => { if (!user) return; if (confirm("Leave and reset?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid)); };

    const checkCouplesCompleteness = () => { const couples = players.filter(p => p.relationshipStatus === 'couple'); const counts: Record<string, number> = {}; couples.forEach(p => counts[p.coupleNumber] = (counts[p.coupleNumber] || 0) + 1); const incompleteIds = Object.keys(counts).filter(id => counts[id] !== 2); return { valid: incompleteIds.length === 0, incompleteIds }; };

    const createGame = async (linkCodeInput?: any) => {
        if (!userName.trim() || !gender || !relationshipStatus || !user) { alert("Missing fields"); return; }
        let finalPartyCode = code || Math.floor(10000 + Math.random() * 90000).toString();
        let finalCoupleID = relationshipStatus === 'couple' ? (typeof linkCodeInput === 'string' ? linkCodeInput : coupleNumber) : 'ADMIN';
        if (relationshipStatus === 'couple' && !finalCoupleID) { alert("Link Error"); return; }
        
        setIsAdmin(true); localStorage.setItem('td_username', userName);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data'), { code: finalPartyCode, mode: 'lobby', currentTurn: null, adminUid: user.uid, createdAt: serverTimestamp(), isAutoMode: false, isDrinkMode: false });
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { uid: user.uid, name: userName, gender, relationshipStatus, coupleNumber: finalCoupleID, joinedAt: serverTimestamp(), isActive: true, isBot: false });
        setCode(finalPartyCode); setIsJoined(true);
    };

    const joinGame = async (codeOverride?: any) => {
        if (!userName.trim() || !gender || !relationshipStatus || !user) { alert("Missing fields"); return; }
        setShowScanner(false);
        const finalCoupleNumber = relationshipStatus === 'single' ? 'SGL_' + user.uid.slice(-6) : (codeOverride || coupleNumber);
        if (!finalCoupleNumber) { alert("Link partner first!"); return; }
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { uid: user.uid, name: userName, gender, coupleNumber: finalCoupleNumber, relationshipStatus, joinedAt: serverTimestamp(), isActive: true, isBot: false });
            setIsJoined(true); localStorage.setItem('td_username', userName);
        } catch (error) { alert("Error joining"); }
    };

    const toggleAutoMode = async () => { 
        const newMode = !gameState?.isAutoMode; 
        let updates: any = { isAutoMode: newMode };
        if (newMode) { 
            let sequence: string[] = [];
            for(let i=0; i<qtyTruth; i++) sequence.push('question');
            for(let i=0; i<qtyDare; i++) sequence.push('dare');
            for(let i=0; i<qtyMM; i++) sequence.push('yn');
            if (sequence.length > 0) { updates.sequence = sequence; updates.sequenceIndex = 0; }
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
    };

    const toggleDrinkMode = async () => {
        const newMode = !gameState?.isDrinkMode;
        playSound('click'); setIsDrinkMode(newMode);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { isDrinkMode: newMode });
    };

    const startGame = async () => {
        const realPlayers = players.filter(p => !p.isBot);
        if (realPlayers.length < 3) { showError("Need 3+ players"); return; }
        const { valid } = checkCouplesCompleteness();
        if (!valid) { showError("Couples incomplete"); return; }
        
        if (realPlayers.length % 2 !== 0) {
            const botUid = 'bot_' + Date.now();
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', botUid), { uid: botUid, name: "Brad Pitt (Bot)", gender: 'male', coupleNumber: '999', relationshipStatus: 'single', joinedAt: serverTimestamp(), isActive: true, isBot: true });
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', matchHistory: [], isEnding: false, currentChallengeId: null, answers: {}, votes: {} });
    };

    const resetGame = async () => {
        if (!confirm("RESET ALL?")) return;
        const snapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'players'));
        await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data'), { code: Math.floor(10000 + Math.random() * 90000).toString(), mode: 'lobby', currentTurn: null, loopSequence: [] });
        setIsJoined(false); setUserName('');
    };

    const startRound = async () => {
        if (!isAutoSetup && (!selectedLevel || !selectedType)) { showError("Select Level/Type"); return; }
        let sequence: string[] = [];
        if (isAutoSetup) { for(let i=0; i<qtyTruth; i++) sequence.push('question'); for(let i=0; i<qtyDare; i++) sequence.push('dare'); for(let i=0; i<qtyMM; i++) sequence.push('yn'); }
        let initialMode = isAutoSetup && sequence.length > 0 ? sequence[0] : (selectedType === 'yn' ? 'yn' : selectedType === 'truth' ? 'question' : 'dare');
        const typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';
        
        // Find Challenge logic simplified
        const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel, 'male'); // Simplificado para brevedad
        if (!nextChallenge) { showError("No challenges found"); return; }

        let initialAnswers: Record<string, string> = {};
        if (initialMode === 'yn') players.filter(p => p.isBot).forEach(b => { initialAnswers[b.uid] = Math.random() > 0.5 ? 'yes' : 'no'; });
        
        let updates: any = { mode: initialMode, currentTurnIndex: 0, answers: initialAnswers, votes: {}, currentChallengeId: nextChallenge.id, roundLevel: selectedLevel, isAutoMode: isAutoSetup, sequence, sequenceIndex: 0 };
        if (initialMode === 'yn') updates.pairs = computePairs();
        
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
        const coll = initialMode === 'yn' ? 'pairChallenges' : 'challenges';
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
    };

    const nextTurn = async () => {
        if (!gameState) return;
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
        if (gameState.isEnding) { await updateDoc(gameRef, { mode: 'ended' }); return; }
        
        // Puntos Logic
        const points = { ...(gameState.points || {}) };
        const batch = writeBatch(db);
        if (gameState.mode === 'question') {
            const currentUid = players[gameState.currentTurnIndex]?.uid;
            const likeVotes = Object.values(gameState.votes || {}).filter(v => v === 'like').length;
            if (currentUid) points[currentUid] = (points[currentUid] || 0) + likeVotes;
        } else if (gameState.mode === 'yn') {
             // Match Logic simplified
             Object.keys(gameState.pairs || {}).forEach(uid1 => {
                 const uid2 = gameState.pairs![uid1];
                 if(gameState.answers[uid1] === gameState.answers[uid2]) { points[uid1] = (points[uid1]||0)+1; points[uid2] = (points[uid2]||0)+1; }
             });
        }
        
        let updates: any = { points };
        let roundFinished = false;
        if (gameState.mode === 'yn') roundFinished = true;
        else {
            let nextIdx = gameState.currentTurnIndex + 1;
            while (nextIdx < players.length && players[nextIdx].isBot) nextIdx++;
            if (nextIdx < players.length) {
                updates.currentTurnIndex = nextIdx; updates.answers = {}; updates.votes = {};
                const typeChar = gameState.mode === 'question' ? 'T' : 'D';
                const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', players[nextIdx].gender);
                if (nextChallenge) { updates.currentChallengeId = nextChallenge.id; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'challenges', nextChallenge.id!), { answered: true }); }
                else roundFinished = true;
            } else roundFinished = true;
        }

        if (roundFinished) {
             if (gameState.isAutoMode && gameState.sequence) {
                 // Auto Logic
                 let nextSeqIdx = (gameState.sequenceIndex || 0) + 1;
                 if (nextSeqIdx >= gameState.sequence.length) nextSeqIdx = 0;
                 const nextMode = gameState.sequence[nextSeqIdx] === 'truth' ? 'question' : gameState.sequence[nextSeqIdx];
                 const typeChar = nextMode === 'yn' ? 'YN' : nextMode === 'question' ? 'T' : 'D';
                 const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', 'male');
                 if (nextChallenge) {
                     updates.mode = nextMode; updates.currentTurnIndex = 0; updates.sequenceIndex = nextSeqIdx; updates.answers = {}; updates.votes = {}; updates.currentChallengeId = nextChallenge.id;
                     if (nextMode === 'yn') { updates.pairs = computePairs(); players.filter(p=>p.isBot).forEach(b => updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no'); }
                     const coll = nextMode === 'yn' ? 'pairChallenges' : 'challenges';
                     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
                 } else { updates.mode = 'admin_setup'; updates.currentChallengeId = null; }
             } else {
                 updates.mode = 'admin_setup'; updates.currentTurnIndex = 0; updates.answers = {}; updates.votes = {}; updates.currentChallengeId = null;
             }
        }
        await updateDoc(gameRef, updates);
        await batch.commit();
    };

    // --- HELPERS ---
    const computePairs = () => { const pairs: Record<string, string> = {}; const used = new Set<string>(); const males = players.filter(p => p.gender === 'male' && p.isActive).sort(()=>Math.random()-0.5); const females = players.filter(p => p.gender === 'female' && p.isActive).sort(()=>Math.random()-0.5); for (const m of males) { const matchIdx = females.findIndex(f => !used.has(f.uid) && f.coupleNumber !== m.coupleNumber); if (matchIdx !== -1) { pairs[m.uid] = females[matchIdx].uid; pairs[females[matchIdx].uid] = m.uid; used.add(m.uid); used.add(females[matchIdx].uid); } } return pairs; };
    const findNextAvailableChallenge = async (type: string, lvl: string, gender: string) => { 
        let currentLvl = parseInt(lvl);
        let coll = type === 'YN' ? 'pairChallenges' : 'challenges';
        for(let i=0; i<5; i++) {
             let q = query(collection(db, 'artifacts', appId, 'public', 'data', coll), where('level', '==', (currentLvl+i).toString()), where('answered', '==', false));
             if (type !== 'YN') q = query(collection(db, 'artifacts', appId, 'public', 'data', coll), where('type', '==', type), where('level', '==', (currentLvl+i).toString()), where('answered', '==', false));
             const snapshot = await getDocs(q);
             let valid = snapshot.docs.filter(d => !d.data().paused);
             if (type !== 'YN') valid = valid.filter(d => { const s = (d.data().gender || 'B').toUpperCase(); return s==='B' || (gender==='male' ? s!=='F' : s!=='M'); });
             if (valid.length > 0) { const found = valid[Math.floor(Math.random()*valid.length)]; return {id: found.id, ...found.data()} as Challenge; }
        }
        return null;
    };
    const currentCard = () => { if (!gameState?.currentChallengeId) return undefined; if (gameState.mode === 'yn') return pairChallenges.find(c => c.id === gameState.currentChallengeId); return challenges.find(c => c.id === gameState.currentChallengeId); };
    const getCardText = (c: Challenge | undefined) => { if (!c) return 'Loading...'; if (gameState?.mode === 'yn') { const myP = players.find(p=>p.uid===user?.uid); if(!myP) return 'Waiting...'; return myP.gender==='female' ? c.female : c.male; } return c.text || 'No text'; };
    const getLevelStyle = (level: string | undefined) => { switch(level){ case '4': return 'border-red-600/50 bg-gradient-to-b from-red-950/80 to-black'; case '3': return 'border-orange-500/50 bg-gradient-to-b from-orange-950/80 to-black'; case '2': return 'border-yellow-500/50 bg-gradient-to-b from-yellow-950/80 to-black'; default: return 'border-white/10 bg-white/5'; } };
    const updateGlobalLevel = (v: string) => { setSelectedLevel(v); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { roundLevel: v }); };
    const updateGlobalType = (v: string) => { setSelectedType(v); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { nextType: v }); };

    // --- MANAGER LOGIC (Simplified imports) ---
    const handleUploadSingleCol = async (e: any, type: 'T' | 'D') => { 
        if (!e.target.files?.[0]) return; const text = await e.target.files[0].text(); const lines = text.split(/\r?\n/).slice(1);
        const batch = writeBatch(db); const ref = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
        let c = 0; lines.forEach(l => { const p = parseCSVLine(l); if (p && p[0]) { batch.set(doc(ref), { text: p[0], level: p[1], type, gender: p[2], answered: false, paused: false }); c++; } });
        await batch.commit(); showSuccess(`Uploaded ${c}`); 
    };
    const handleUploadDoubleCol = async (e: any) => {
        if (!e.target.files?.[0]) return; const text = await e.target.files[0].text(); const lines = text.split(/\r?\n/).slice(1);
        const batch = writeBatch(db); const ref = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
        let c = 0; lines.forEach(l => { const p = parseCSVLine(l); if (p && p[0]) { batch.set(doc(ref), { male: p[0], female: p[1], level: p[2], answered: false, paused: false }); c++; } });
        await batch.commit(); showSuccess(`Uploaded ${c}`);
    };

    // --- RENDERIZADO PRINCIPAL ---
    if (loading) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mb-4"></div>LOADING...</div>;

    // 1. PANTALLA DE INGRESO
    if (!isJoined) return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black"></div>
            <div className="w-full max-w-md relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <Flame className="w-16 h-16 text-pink-500 mb-4" />
                <h1 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">SEXY GAME</h1>
                <input type="text" placeholder="YOUR NAME" className="w-full py-4 text-center bg-black/40 border border-white/10 rounded-xl mb-4 text-xl font-bold" value={userName} onChange={e=>setUserName(e.target.value)} />
                <div className="grid grid-cols-2 gap-4 w-full mb-6">
                    <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-center"><option value="" disabled>Gender</option><option value="male">Male</option><option value="female">Female</option></select>
                    <select value={relationshipStatus} onChange={e=>setRelationshipStatus(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-center"><option value="" disabled>Status</option><option value="single">Single</option><option value="couple">Couple</option></select>
                </div>
                {userName.toLowerCase() === 'admin' ? (
                    <button onClick={() => createGame()} className={`w-full py-4 rounded-xl font-bold uppercase ${gradientBtn}`}>CREATE PARTY</button>
                ) : (
                    <>
                        <input type="number" placeholder="GAME CODE" className="w-full py-4 text-center bg-black/40 border border-white/10 rounded-xl mb-6 text-2xl font-black tracking-widest" value={code} onChange={e=>setCode(e.target.value)} />
                        {relationshipStatus === 'couple' && !coupleNumber ? 
                            <button onClick={()=>setShowScanner(true)} className="w-full py-4 rounded-xl bg-purple-600 font-bold uppercase">LINK PARTNER</button> :
                            <button onClick={()=>joinGame()} className={`w-full py-4 rounded-xl font-bold uppercase ${gradientBtn}`}>JOIN PARTY</button>
                        }
                    </>
                )}
            </div>
            {showScanner && <CouplePairing gender={gender} onCodeObtained={setCoupleNumber} value={coupleNumber} onBack={()=>setShowScanner(false)} onAutoJoin={(c:string)=>{setShowScanner(false); if(userName==='admin') createGame(c); else joinGame(c);}} db={db} currentUserUid={user?.uid} appId={appId} />}
        </div>
    );

    // 2. VISTA DE ADMIN (LOGICA CORREGIDA)
    if (isAdmin && !viewAsPlayer) {
        // A. ADMIN LOBBY
        if (!gameState || !gameState.mode || gameState.mode === 'lobby' || !['admin_setup', 'question', 'dare', 'yn', 'ended'].includes(gameState.mode)) {
             return (
                 <div className="min-h-screen p-4 flex flex-col items-center justify-center text-white relative">
                     <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full text-cyan-400"><Gamepad2 size={24}/></button>
                     <h2 className="text-2xl font-black text-white mb-4">LOBBY ({players.length})</h2>
                     <div className="bg-black/80 border border-white/10 p-6 rounded-xl mb-4 text-center w-full max-w-sm"><div className="text-xs uppercase text-slate-400">Code</div><div className="text-4xl font-black font-mono">{gameState?.code || code}</div></div>
                     <div className={`w-full max-w-sm mb-4 max-h-[40vh] overflow-y-auto p-4 ${glassPanel}`}>{players.map(p=><div key={p.uid} className="flex justify-between py-2 border-b border-white/5"><span>{p.name}</span><button onClick={()=>handleKickPlayer(p.uid, p.name)} className="text-red-500"><UserX size={18}/></button></div>)}</div>
                     {isManaging ? (
                        <div className="fixed inset-0 bg-black z-50 overflow-y-auto p-4">
                            <button onClick={()=>setIsManaging(false)} className="mb-4 text-white">Back</button>
                            <div className="flex gap-2 mb-4"><button onClick={()=>setManagerTab('truth')} className="bg-blue-900 p-2 rounded">Truth</button><button onClick={()=>setManagerTab('dare')} className="bg-pink-900 p-2 rounded">Dare</button><button onClick={()=>setManagerTab('mm')} className="bg-green-900 p-2 rounded">Match</button></div>
                            <div className="bg-white/10 p-4 rounded mb-4">
                                <label className="block mb-2">Upload CSV</label>
                                <input type="file" onChange={(e)=> managerTab==='mm' ? handleUploadDoubleCol(e) : handleUploadSingleCol(e, managerTab==='truth'?'T':'D')} />
                            </div>
                        </div>
                     ) : (
                         <button onClick={()=>setIsManaging(true)} className="w-full max-w-sm bg-white/5 p-4 rounded-xl font-bold mb-4 flex items-center justify-center gap-2"><Settings size={20}/> Manager</button>
                     )}
                     <button onClick={startGame} className="w-full bg-emerald-600 p-4 rounded-xl font-black tracking-widest hover:shadow-lg transition-all">START GAME</button>
                     <button onClick={resetGame} className="w-full bg-red-900/50 p-3 rounded-xl font-bold mt-4 text-red-200">RESET ALL</button>
                 </div>
             );
        }

        // B. ADMIN SETUP
        if (gameState.mode === 'admin_setup') {
            return (
                <div className="min-h-screen p-4 flex flex-col items-center justify-center text-white relative">
                     <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full text-cyan-400"><Gamepad2 size={24}/></button>
                     <h2 className="text-3xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">SETUP ROUND</h2>
                     <div className={`w-full max-w-md p-6 mb-4 ${glassPanel}`}>
                         <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                             <div><div className="text-[10px] uppercase font-bold text-slate-400">Mode</div><div className={`font-black text-xl ${isAutoSetup?'text-green-400':'text-cyan-400'}`}>{isAutoSetup?'AUTO':'MANUAL'}</div></div>
                             <button onClick={()=>setIsAutoSetup(!isAutoSetup)} className={`h-8 w-14 rounded-full ${isAutoSetup?'bg-green-500':'bg-slate-700'}`}><span className={`block h-6 w-6 bg-white rounded-full transition-transform ${isAutoSetup?'translate-x-7 translate-y-1':'translate-x-1 translate-y-1'}`}></span></button>
                         </div>
                         <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                             <div><div className="text-[10px] uppercase font-bold text-slate-400">Penalty</div><div className={`font-black text-xl ${isDrinkMode?'text-red-500':'text-slate-400'}`}>{isDrinkMode?'DRINK ON':'OFF'}</div></div>
                             <button onClick={toggleDrinkMode} className={`h-8 w-14 rounded-full ${isDrinkMode?'bg-red-600':'bg-slate-700'}`}><span className={`block h-6 w-6 bg-white rounded-full transition-transform ${isDrinkMode?'translate-x-7 translate-y-1':'translate-x-1 translate-y-1'}`}></span></button>
                         </div>
                         {isAutoSetup ? (
                             <div className="flex gap-2"><input type="number" className="w-full bg-black/40 p-2 rounded text-center text-white" value={qtyTruth} onChange={e=>setQtyTruth(parseInt(e.target.value))}/><input type="number" className="w-full bg-black/40 p-2 rounded text-center text-white" value={qtyDare} onChange={e=>setQtyDare(parseInt(e.target.value))}/><input type="number" className="w-full bg-black/40 p-2 rounded text-center text-white" value={qtyMM} onChange={e=>setQtyMM(parseInt(e.target.value))}/></div>
                         ) : (
                             <div className="space-y-4">
                                 <div className="flex justify-between items-center"><span className="font-bold">Risk Level</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 p-2 rounded text-white"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                                 <div className="flex justify-between items-center"><span className="font-bold">Game Type</span><select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-slate-900 p-2 rounded text-white"><option value="">Select</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match</option></select></div>
                             </div>
                         )}
                         {isAutoSetup && <div className="mt-4 flex justify-between items-center"><span className="font-bold">Risk Level</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 p-2 rounded text-white"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>}
                     </div>
                     <button onClick={startRound} className="w-full max-w-md bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-xl font-black tracking-widest">{isAutoSetup ? 'INITIATE AUTO' : 'START ROUND'}</button>
                     <button onClick={resetGame} className="w-full max-w-md bg-red-600 mt-4 p-3 rounded-xl font-bold text-xs">RESET ALL</button>
                </div>
            );
        }

        // C. ADMIN GAME PROGRESS (FIX: AHORA ESTÁ DENTRO DEL IF)
        const card = currentCard();
        const finalCard = card || fetchedCard;
        // FIX: Admin Sync
        if (gameState?.currentChallengeId && !finalCard) {
            return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
                <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-cyan-500 mb-4"></div>
                <div className="text-cyan-400 font-mono animate-pulse">SYNCING ADMIN...</div>
            </div>
            );
        }
        const cardStyle = getLevelStyle(finalCard?.level);
        const pending = players.filter(p=>!p.isBot).filter(p=>{
            if(gameState.mode==='yn') return !gameState.answers[p.uid];
            if(p.uid===players[gameState.currentTurnIndex]?.uid) return false;
            return !gameState.votes[p.uid];
        });

        return (
            <div className="min-h-screen text-white flex flex-col p-4 relative overflow-hidden">
                <button onClick={() => setViewAsPlayer(true)} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full text-cyan-400"><Gamepad2 size={24}/></button>
                <div className="mt-12 w-full max-w-md mx-auto"><div className="w-full p-2 mb-2 bg-white/5 rounded-xl text-center"><span className="text-xs uppercase font-bold text-cyan-400">Current Turn</span><div className="font-black text-xl">{players[gameState?.currentTurnIndex]?.name}</div></div></div>
                <div className="w-full max-w-md mx-auto p-4 mb-4 bg-white/5 rounded-xl border border-white/10">
                     <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold uppercase text-slate-400">Mode</span><div className="font-black text-xl text-cyan-400">{gameState.isAutoMode?'AUTO':'MANUAL'}</div><button onClick={toggleAutoMode} className={`h-6 w-12 rounded-full ${gameState.isAutoMode?'bg-green-500':'bg-slate-700'}`}><span className={`block h-4 w-4 bg-white rounded-full transition-transform ${gameState.isAutoMode?'translate-x-7 translate-y-1':'translate-x-1 translate-y-1'}`}></span></button></div>
                     {!gameState.isAutoMode && <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-slate-400">Next</span><select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-black/30 p-1 rounded text-white text-xs"><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match</option></select></div>}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
                    <div className={`w-full p-6 rounded-3xl text-center mb-4 transition-all duration-700 ${cardStyle} flex flex-col items-center justify-center min-h-[160px] relative border-2`}>
                        <div className="mb-4 opacity-80">{gameState.mode==='question'?<MessageCircle size={40}/>:gameState.mode==='yn'?<Users size={40}/>:<Flame size={40}/>}</div>
                        <h3 className="text-2xl font-bold leading-relaxed">{getCardText(finalCard)}</h3>
                    </div>
                    <div className="w-full p-4 mb-4 bg-white/5 rounded-xl">
                        <h4 className={`font-bold mb-2 text-xs uppercase ${pending.length>0?"text-cyan-400 animate-pulse":"text-white/50"}`}>Waiting: {pending.length>0?pending.map(p=>p.name).join(', '):'Ready'}</h4>
                    </div>
                    {gameState.isAutoMode ? <div className="text-emerald-400 font-bold animate-pulse mb-4 text-center">AUTO ADVANCING...</div> : <button onClick={nextTurn} className="w-full bg-indigo-600 p-4 rounded-xl font-bold mb-4">FORCE NEXT TURN</button>}
                    <div className="flex gap-2 w-full"><button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{isEnding:true})} className="flex-1 bg-red-900/30 border border-red-500/30 p-2 rounded text-red-400 text-xs font-bold">END GAME</button><button onClick={resetGame} className="flex-1 bg-white/5 border border-white/10 p-2 rounded text-white/50 text-xs font-bold">RESET</button></div>
                </div>
            </div>
        );
    }

    // ==========================================
    // 3. VISTA JUGADOR (DEFAULT)
    // ==========================================
    
    // A. LOBBY DE JUGADOR
    if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
                {isAdmin && <button onClick={() => { setLoading(false); setViewAsPlayer(false); }} className="absolute top-4 left-4 bg-white/10 p-3 rounded-full text-cyan-400 border border-cyan-500"><Settings size={24}/></button>}
                <div className="text-center py-2 mb-4 w-full flex items-center justify-center gap-2 relative flex-col mt-8">
                     {gameState?.mode === 'admin_setup' && isAdmin && viewAsPlayer ? 
                        <div className="mb-4 bg-cyan-900/40 border border-cyan-500/50 p-4 rounded-xl animate-pulse"><h3 className="text-xl font-black text-cyan-400">HOST SETTING UP...</h3></div> : 
                        <h1 className="text-4xl font-black text-yellow-400">{userName.toUpperCase()}</h1>
                     }
                     {relationshipStatus==='couple' && <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-mono mt-2">COUPLE: {coupleNumber}</div>}
                </div>
                <div className="text-center mt-8 mb-4">
                    {gameState?.mode==='lobby' ? <div className="text-2xl font-bold animate-pulse text-cyan-400">WAITING FOR PLAYERS...</div> : <div className="text-2xl font-bold animate-pulse text-yellow-400">GAME IN PROGRESS...</div>}
                </div>
                <div className="mt-auto w-full flex justify-center pb-8"><button onClick={handleSelfLeave} className="text-red-500/50 hover:text-red-500 flex items-center gap-2 text-xs uppercase"><LogOut size={14}/> Reset Player</button></div>
            </div>
        );
    }

    // B. GAME ENDED
    if (gameState.mode === 'ended') {
        return (<div className="min-h-screen text-white p-6 flex flex-col items-center justify-center relative"><Trophy className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-glow" /><h2 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">GAME OVER</h2><div className={`w-full max-w-sm max-h-[60vh] overflow-y-auto mb-8 p-4 ${glassPanel}`}>{players.map((p, i) => <div key={p.uid} className="py-3 border-b border-white/5 flex justify-between items-center last:border-0"><span className="font-bold">{p.name}</span><span className="font-black text-xl text-yellow-400">{gameState?.points[p.uid] || 0} pts</span></div>)}</div></div>);
    }

    // C. JUGADOR EN JUEGO (MATCH/TRUTH/DARE)
    const card = currentCard();
    const finalCard = card || fetchedCard;
    
    // FIX: Player Sync
    if (gameState?.currentChallengeId && !finalCard) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-black">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-500 mb-6"></div>
              <div className="text-xl font-black font-mono text-cyan-400 tracking-widest animate-pulse">SYNCING DATA...</div>
          </div>
        );
    }
    const cardStyle = getLevelStyle(finalCard?.level);
    
    // Logic for view
    const isMyTurnCheck = players[gameState.currentTurnIndex]?.uid === user?.uid;
    const allVoted = Object.keys(gameState.votes).length >= (players.length - 1);
    const allYN = Object.keys(gameState.answers).length >= players.length;
    let ynMatch = null; let myPartnerName = "???";
    if (gameState.mode === 'yn' && allYN) {
        const partnerUid = gameState.pairs?.[user?.uid||''];
        const myAns = gameState.answers[user?.uid||''];
        const pAns = gameState.answers[partnerUid||''];
        const pObj = players.find(p=>p.uid===partnerUid);
        if(pObj) myPartnerName = pObj.name;
        if(myAns && pAns) ynMatch = myAns === pAns;
    }

    // Drink Logic
    let showDrink = false; let showConf = false;
    if ((gameState.mode === 'question' || gameState.mode === 'dare') && allVoted && gameState.isDrinkMode) {
        const neg = gameState.mode==='question' ? 'dislike' : 'no';
        const negVotes = Object.values(gameState.votes).filter(v=>v===neg).length;
        const posVotes = Object.values(gameState.votes).length - negVotes;
        if (negVotes > posVotes) showDrink = true; else showConf = true;
    }
    if (gameState.mode === 'yn' && allYN) { if (ynMatch === false && gameState.isDrinkMode) showDrink = true; if (ynMatch === true) showConf = true; }
    
    useEffect(() => { if (showDrink) playSound('drink'); if (showConf) { playSound('success'); confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } }, [showDrink, showConf, gameState.currentTurnIndex]);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center relative overflow-hidden font-sans">
            {showDrink && <DrinkAlert />}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black"></div>
            {isAdmin && <button onClick={() => { setViewAsPlayer(false); }} className="absolute top-4 left-4 z-50 p-2 rounded-full bg-white/10 text-cyan-400 border border-cyan-500"><Settings size={20} /></button>}
            <div className="w-full p-4 flex justify-between items-center relative z-20 glass-header border-b border-white/10">
                <div className="flex items-center gap-3 ml-12"><div className="text-xs"><p className="text-white/50 uppercase tracking-widest">Code</p><p className="text-xl font-black text-pink-500 font-mono">{gameState?.code}</p></div></div>
                <div className="flex items-center gap-3"><span className="text-right hidden sm:block"><p className="font-bold text-sm text-white">{userName}</p></span><div className="w-10 h-10 rounded-full bg-cyan-600 border-2 border-cyan-400 flex items-center justify-center font-bold">{userName.charAt(0).toUpperCase()}</div></div>
            </div>
            <div className="flex-1 w-full relative z-10 flex flex-col p-4 overflow-y-auto lg:max-w-5xl lg:mx-auto">
                <div className={`w-full p-8 rounded-3xl text-center mb-6 transition-all duration-700 ${cardStyle} flex flex-col items-center justify-center min-h-[240px] relative border-2 shadow-2xl group`}>
                     <div className="absolute -top-3 bg-black/80 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full border border-white/20">{gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}</div>
                     <div className="mb-6 opacity-90">{gameState.mode === 'question' ? <MessageCircle size={48} className="text-cyan-200"/> : gameState.mode === 'yn' ? <Users size={48} className="text-emerald-200"/> : <Flame size={48} className="text-pink-200"/>}</div>
                     <h3 className="text-2xl sm:text-3xl font-bold leading-relaxed drop-shadow-md text-white">{getCardText(finalCard)}</h3>
                </div>
                <div className="w-full bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl">
                    {!isMyTurnCheck && gameState.mode !== 'yn' && (
                        <div className="text-center">
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">JUDGE: {players[gameState.currentTurnIndex]?.name}</p>
                            <div className="flex gap-3">
                                {gameState.mode === 'question' ? (
                                    <><button onClick={() => db && updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{[`votes.${user?.uid}`]:'like'})} disabled={!!gameState.votes?.[user?.uid||'']} className="flex-1 bg-blue-600 p-4 rounded-xl font-bold disabled:opacity-30">Good 👍</button>
                                    <button onClick={() => db && updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{[`votes.${user?.uid}`]:'dislike'})} disabled={!!gameState.votes?.[user?.uid||'']} className="flex-1 bg-white/10 p-4 rounded-xl font-bold disabled:opacity-30">Nah 😴</button></>
                                ) : (
                                    <><button onClick={() => db && updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{[`votes.${user?.uid}`]:'yes'})} disabled={!!gameState.votes?.[user?.uid||'']} className="flex-1 bg-green-600 p-4 rounded-xl font-bold disabled:opacity-30">Done ✅</button>
                                    <button onClick={() => db && updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{[`votes.${user?.uid}`]:'no'})} disabled={!!gameState.votes?.[user?.uid||'']} className="flex-1 bg-red-900 p-4 rounded-xl font-bold disabled:opacity-30">Fail ❌</button></>
                                )}
                            </div>
                        </div>
                    )}
                    {isMyTurnCheck && gameState.mode !== 'yn' && <div className="text-center py-4"><p className="font-bold text-yellow-400 text-lg uppercase tracking-widest">It's your turn!</p></div>}
                    {gameState.mode === 'yn' && (
                        <div className="text-center">
                            {!gameState.answers?.[user?.uid||''] ? (
                                <><p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">DO YOU AGREE?</p>
                                <div className="flex gap-3"><button onClick={() => db && updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{[`answers.${user?.uid}`]:'yes'})} className="flex-1 bg-emerald-600 p-6 rounded-xl font-black text-xl">YES</button><button onClick={() => db && updateDoc(doc(db,'artifacts',appId,'public','data','gameState','main'),{[`answers.${user?.uid}`]:'no'})} className="flex-1 bg-red-600 p-6 rounded-xl font-black text-xl">NO</button></div></>
                            ) : (
                                allYN ? <div className={`flex flex-col p-4 rounded-2xl border-2 ${ynMatch?'bg-green-900 border-green-500':'bg-red-900 border-red-500'}`}><h3 className="text-3xl font-black">{ynMatch?'MATCH!':'MISMATCH'}</h3><div className="mt-2">Partner: {myPartnerName}</div></div> : <div className="text-green-400 font-bold text-xl">Answered! 🔒</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}