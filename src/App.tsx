import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  query, serverTimestamp, updateDoc, getDocs, deleteDoc, where, writeBatch, increment
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  Flame, Zap, Trophy, Upload, ThumbsUp, ThumbsDown, Smile, Frown, 
  Settings, CheckSquare, Square, Filter, ArrowUpDown, AlertTriangle, 
  Trash2, PlayCircle, PauseCircle, Download, FileSpreadsheet, XCircle,
  MessageCircle, RefreshCw, HelpCircle, X, Edit2, UserX, BookOpen, Send, Search, Users, User as UserIcon, LogOut, ChevronDown, ChevronUp, CheckCircle, Share2
} from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAw5vlbzCXUa1WDR_YFXyzC6mZ-Dt6cms8",
  authDomain: "sexygame-6e8f3.firebaseapp.com",
  projectId: "sexygame-6e8f3",
  storageBucket: "sexygame-6e8f3.firebasestorage.app",
  messagingSenderId: "474661099120",
  appId: "1:474661099120:web:d594e499ac94200c3146b5"
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
  sexo?: string; // Legacy support
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

// --- COMPONENTES DE AYUDA (MANUAL) ---
const HelpModal = ({ onClose, type }: { onClose: () => void, type: 'admin' | 'player' }) => {
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
    const toggleSection = (section: string) => {
      setExpandedSection(expandedSection === section ? null : section);
    };
  
    return (
      <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-slate-800 rounded-2xl border border-slate-600 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative shadow-2xl animate-in fade-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
            <X size={24} />
          </button>
          
          <div className="p-8">
            <h2 className="text-3xl font-bold mb-8 text-yellow-500 flex items-center gap-3 border-b border-slate-700 pb-4">
              {type === 'admin' ? <BookOpen size={32}/> : <HelpCircle size={32}/>}
              {type === 'admin' ? 'Game Master Manual' : 'Player Instructions'}
            </h2>
  
            <div className="space-y-8 text-slate-300">
              
              {/* --- MANUAL DE ADMIN --- */}
              {type === 'admin' && (
                <>
                  <section>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Flame className="text-orange-500"/> The Game Modes (Click to expand)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* TRUTH BOX */}
                        <div 
                          className={`cursor-pointer border rounded-lg p-4 transition-all ${expandedSection === 'truth' ? 'bg-blue-900/40 border-blue-400 ring-2 ring-blue-500' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}
                          onClick={() => toggleSection('truth')}
                        >
                          <div className="flex justify-between items-center mb-2">
                              <strong className="text-blue-400 text-lg">1. Truth</strong>
                              {expandedSection === 'truth' ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                          </div>
                          <p className="text-sm text-slate-400">Verbal questions. The player reads aloud and answers.</p>
                          {expandedSection === 'truth' && (
                              <div className="mt-4 text-sm text-white border-t border-blue-500/30 pt-2 animate-in fade-in">
                                  <p className="mb-2"><strong>How it works:</strong> A question appears on the player's phone. You must read it to the group and answer honestly.</p>
                                  <p className="mb-2"><strong>Voting:</strong> The rest of the group votes "Good Answer" or "Nah..".</p>
                                  <em className="text-blue-300">Example: "Who in this room would you date if you were single?"</em>
                              </div>
                          )}
                        </div>
  
                        {/* DARE BOX */}
                        <div 
                          className={`cursor-pointer border rounded-lg p-4 transition-all ${expandedSection === 'dare' ? 'bg-pink-900/40 border-pink-400 ring-2 ring-pink-500' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}
                          onClick={() => toggleSection('dare')}
                        >
                          <div className="flex justify-between items-center mb-2">
                              <strong className="text-pink-400 text-lg">2. Dare</strong>
                              {expandedSection === 'dare' ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                          </div>
                          <p className="text-sm text-slate-400">Physical actions.</p>
                          {expandedSection === 'dare' && (
                              <div className="mt-4 text-sm text-white border-t border-pink-500/30 pt-2 animate-in fade-in">
                                  <p className="mb-2"><strong>How it works:</strong> A challenge appears. The player must perform the action immediately.</p>
                                  <p className="mb-2"><strong>Voting:</strong> The group acts as the judge. They vote "Completed" or "Failed".</p>
                                  <em className="text-pink-300">Example: "Let the person to your right read your last DM."</em>
                              </div>
                          )}
                        </div>
  
                        {/* MATCH BOX */}
                        <div 
                          className={`cursor-pointer border rounded-lg p-4 transition-all ${expandedSection === 'match' ? 'bg-green-900/40 border-green-400 ring-2 ring-green-500' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'}`}
                          onClick={() => toggleSection('match')}
                        >
                          <div className="flex justify-between items-center mb-2">
                              <strong className="text-green-400 text-lg">3. Match/Mismatch</strong>
                              {expandedSection === 'match' ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                          </div>
                          <p className="text-sm text-slate-400">Compatibility test. 2 players answer blindly.</p>
                          {expandedSection === 'match' && (
                              <div className="mt-4 text-sm text-white border-t border-green-500/30 pt-2 animate-in fade-in">
                                  <p className="mb-2"><strong>How it works:</strong> The system secretly pairs two people (e.g., John & Sarah). A statement appears (e.g., "I prefer lights off").</p>
                                  <p className="mb-2"><strong>The Goal:</strong> Both answer YES or NO secretly on their phones. If they <strong>MATCH</strong> (both Yes or both No), they get points.</p>
                              </div>
                          )}
                        </div>
                    </div>
                  </section>
  
                  <section>
                    <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Zap className="text-yellow-400"/> Game Control</h3>
                    <div className="space-y-4">
                        <div className="bg-slate-900 p-5 rounded-xl border-l-4 border-purple-500">
                            <h4 className="text-purple-400 font-bold text-lg mb-2">MODE A: MANUAL (The DJ)</h4>
                            <p className="text-sm mb-2">In this mode, <strong>YOU control everything</strong>. Before every single turn, you must select:</p>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                <li><strong>Risk Level:</strong> How intense should the next question be?</li>
                                <li><strong>Game Type:</strong> Do you want a Truth, a Dare, or a Match round next?</li>
                            </ul>
                            <p className="text-sm mt-2 italic text-slate-400">Use this when you want to read the room's vibe and adjust specifically.</p>
                        </div>
  
                        <div className="bg-slate-900 p-5 rounded-xl border-l-4 border-green-500">
                            <h4 className="text-green-400 font-bold text-lg mb-2">MODE B: AUTOMATIC (Autopilot)</h4>
                            <p className="text-sm mb-2">You set a "Loop Configuration" (e.g., 2 Truths, 2 Dares, 1 Match) and the game runs itself in that order endlessly.</p>
                            <p className="text-sm">You simply click "Next" (or let the timer do it) and the system automatically picks the type based on your sequence.</p>
                            <p className="text-sm mt-2 italic text-slate-400">Perfect for when you want to play along and not worry about managing the game.</p>
                        </div>
                    </div>
                  </section>
  
                  <section>
                    <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Settings className="text-gray-400"/> Admin Tools</h3>
                    <ul className="list-disc pl-5 space-y-4 text-sm">
                      <li>
                          <strong>1. Uploading Questions:</strong>
                          <div className="mt-2 space-y-3">
                              <div className="bg-slate-950 p-3 rounded border border-blue-900/50">
                                  <span className="text-blue-300 font-bold block mb-1">Truth & Dare Files (Use separate buttons):</span>
                                  <span className="text-slate-400">Headers must be:</span> <code className="text-green-400">text, level, gender</code>
                                  <br/><span className="text-xs text-slate-500">Gender = <strong>M</strong> for Male, <strong>F</strong> for Female, <strong>B</strong> for Both.</span>
                              </div>
                              <div className="bg-slate-950 p-3 rounded border border-green-900/50">
                                  <span className="text-green-300 font-bold block mb-1">Match Files:</span>
                                  <span className="text-slate-400">Headers must be:</span> <code className="text-green-400">male, female, level</code>
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
                    <ol className="list-decimal pl-5 space-y-3">
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
                        <div className="bg-slate-900 p-4 rounded-lg border-l-4 border-blue-500">
                            <strong className="text-blue-400 text-lg block mb-2">Truth Rounds</strong>
                            <p className="text-sm">When it's your turn, a question will appear. Read it aloud and answer honestly. The group will award points based on your answer.</p>
                        </div>
                        
                        <div className="bg-slate-900 p-4 rounded-lg border-l-4 border-pink-500">
                            <strong className="text-pink-400 text-lg block mb-2">Dare Rounds</strong>
                            <p className="text-sm">A challenge will appear. You must perform the action described to earn points.</p>
                        </div>
  
                        <div className="bg-slate-900 p-4 rounded-lg border-l-4 border-green-500">
                            <strong className="text-green-400 text-lg block mb-2">Match/Mismatch Rounds</strong>
                            <p className="text-sm mb-2">The system will secretly pair you with another player. A statement will appear on your screen.</p>
                            <p className="text-sm italic text-yellow-400 mb-2 font-mono bg-black/30 p-2 rounded text-center">"I prefer lights off"</p>
                            <p className="text-sm">You must answer <strong>YES</strong> or <strong>NO</strong> honestly. You only score points if your answer <strong>MATCHES</strong> your partner's answer!</p>
                        </div>
                    </div>
                  </section>
                </>
              )}
  
            </div>
            
            <div className="mt-8 text-center border-t border-slate-700 pt-6">
              <button onClick={onClose} className="bg-blue-600 px-8 py-3 rounded-xl font-bold text-white hover:bg-blue-500 shadow-lg transition-transform active:scale-95">
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    );
};

export default function TruthAndDareApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [gender, setGender] = useState(''); 
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
  
  // Modal States
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [showPlayerHelp, setShowPlayerHelp] = useState(false);

  // Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // Admin Code Setting State
  const [isSettingCode, setIsSettingCode] = useState(false);

  // MANAGER STATES
  const [isManaging, setIsManaging] = useState(false);
  const [managerTab, setManagerTab] = useState<'truth' | 'dare' | 'mm'>('truth');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: keyof Challenge, direction: 'asc' | 'desc'} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const selectionMode = useRef<'add' | 'remove'>('add');
  const [searchTerm, setSearchTerm] = useState(''); 
    
  // Bulk Edit
  const [bulkLevel, setBulkLevel] = useState('');
  const [bulkGender, setBulkGender] = useState('');

  // Auto Mode Config
  const [isAutoSetup, setIsAutoSetup] = useState(false);
  const [qtyTruth, setQtyTruth] = useState(1);
  const [qtyDare, setQtyDare] = useState(1);
  const [qtyMM, setQtyMM] = useState(1);

  // --- HELPER STYLES ---
  const getLevelStyle = (level: string | undefined) => {
    switch (level) {
      case '4': return 'border-red-600 bg-red-950/40 shadow-[0_0_30px_rgba(220,38,38,0.3)]'; 
      case '3': return 'border-orange-500 bg-orange-950/40 shadow-[0_0_20px_rgba(249,115,22,0.3)]'; 
      case '2': return 'border-yellow-500 bg-yellow-950/40'; 
      case '1': return 'border-green-500 bg-green-950/40'; 
      default: return 'border-slate-600 bg-slate-800';
    }
  };

  // 0. GLOBALS
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#0f172a';
    document.body.style.backgroundColor = '#0f172a';
    document.body.style.color = 'white';
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
      
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // 1. Auth & Sync
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

  // PERSISTENCIA DEL USUARIO (COUPLE ID)
  useEffect(() => {
    if (user && players.length > 0) {
        const me = players.find(p => p.uid === user.uid);
        if (me) {
            if (me.coupleNumber) setCoupleNumber(me.coupleNumber);
            if (me.relationshipStatus) setRelationshipStatus(me.relationshipStatus);
            if (me.name) setUserName(me.name); 
            if (me.gender) setGender(me.gender); 
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
    const unsubChallenges = onSnapshot(query(challengesRef), (snapshot) => {
      const cList = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Challenge));
      setChallenges(cList);
    });

    const pairChallengesRef = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
    const unsubPairChallenges = onSnapshot(query(pairChallengesRef), (snapshot) => {
      const pcList = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Challenge));
      setPairChallenges(pcList);
    });

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

  // 4. AUTO-AVANCE LOGIC
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
        const timer = setTimeout(() => { nextTurn(); }, 4000); 
        return () => clearTimeout(timer);
    }
  }, [gameState, isAdmin, players.length]);

  // --- HELPER FUNCTIONS ---
  const showError = (msg: string) => setCustomError(msg);
  const closeError = () => setCustomError(null);
  const showSuccess = (msg: string) => {
      setCustomSuccess(msg);
      setTimeout(() => setCustomSuccess(null), 3000);
  };

  const handleUpdateName = async () => { if (!newName.trim() || !user) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { name: newName }); setUserName(newName); localStorage.setItem('td_username', newName); setIsEditingName(false); } catch (e) { showError("Could not update name."); } };
  const handleKickPlayer = async (uid: string, name: string) => { if(confirm(`Reset player ${name}?`)) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid)); } };
  const handleSelfLeave = async () => { if (!user) return; if (confirm("Are you sure you want to leave and reset?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid)); } };

  const checkCouplesCompleteness = () => {
      const couples = players.filter(p => p.relationshipStatus === 'couple');
      const counts: Record<string, number> = {};
      couples.forEach(p => counts[p.coupleNumber] = (counts[p.coupleNumber] || 0) + 1);
      
      const incompleteIds = Object.keys(counts).filter(id => counts[id] !== 2);
      return { 
          valid: incompleteIds.length === 0, 
          incompleteIds 
      };
  };

  // --- GAME LOGIC ---

  const joinGame = async () => {
    if (!userName.trim() || !user) return;
    if (!gender) { showError("Please select a gender."); return; }
    if (!relationshipStatus) { showError("Please select a status (Single or Couple)."); return; }
    
    localStorage.setItem('td_username', userName);
    if (userName.toLowerCase() === 'admin') { setIsAdmin(true); return; }
    
    if (!code || !coupleNumber) return;
    
    // Case Insensitive Code Check
    if (code.trim().toUpperCase() !== gameState?.code.toUpperCase()) { showError('Invalid code'); return; }

    const existingPartner = players.find(p => p.coupleNumber === coupleNumber && p.gender === gender && p.uid !== user.uid);
    if (existingPartner) {
        if (confirm(`User ${existingPartner.name} is already registered with Couple ID ${coupleNumber} (${gender}). Do you want to RESET this slot and join?`)) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', existingPartner.uid));
        } else {
            return;
        }
    }
    const status = relationshipStatus as 'single' | 'couple';
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
      uid: user.uid, name: userName, gender, coupleNumber, relationshipStatus: status, joinedAt: serverTimestamp(), isActive: true, isBot: false, matches: 0, mismatches: 0
    });
  };

  const setGameCode = async () => { if (!code.trim()) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { code: code.trim().toUpperCase() }); setIsSettingCode(false); };
  const updateGlobalLevel = async (newLvl: string) => { setSelectedLevel(newLvl); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { roundLevel: newLvl }); };
  const updateGlobalType = async (newType: string) => { setSelectedType(newType); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { nextType: newType }); };

  const toggleAutoMode = async () => {
     const newMode = !gameState?.isAutoMode;
     let updates: any = { isAutoMode: newMode };
     if (newMode && (!gameState?.sequence || gameState.sequence.length === 0)) {
         let sequence: string[] = [];
         for(let i=0; i<qtyTruth; i++) sequence.push('question');
         for(let i=0; i<qtyDare; i++) sequence.push('dare');
         for(let i=0; i<qtyMM; i++) sequence.push('yn');
         updates.sequence = sequence;
         updates.sequenceIndex = 0;
     }
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
  };

  const startGame = async () => {
    // 3 PLAYER MINIMUM RULE
    const realPlayers = players.filter(p => !p.isBot);
    if (realPlayers.length < 3) { showError("You need at least 3 players to start!"); return; }

    const { total } = checkPendingSettings();
    if (total > 0) { showError(`Cannot start! There are ${total} questions without Level/Type/Gender set.`); return; }
    const { valid, incompleteIds } = checkCouplesCompleteness();
    if (!valid) { showError(`Cannot start! Missing partner for IDs: ${incompleteIds.join(', ')}`); return; }

    if (realPlayers.length % 2 !== 0) {
        const males = realPlayers.filter(p => p.gender === 'male').length;
        const females = realPlayers.filter(p => p.gender === 'female').length;
        let botName = "Brad Pitt";
        let botGender = "male";
        if (males > females) { botName = "Scarlett Johansson"; botGender = "female"; }
        
        const botUid = 'bot_' + Date.now();
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', botUid), {
            uid: botUid, name: botName, gender: botGender, coupleNumber: '999', relationshipStatus: 'single', joinedAt: serverTimestamp(), isActive: true, isBot: true, matches: 0, mismatches: 0
        });
        showError(`Odd number of players. Added bot: ${botName}!`);
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', matchHistory: [], isEnding: false });
  };

  const computePairs = () => {
    const pairs: Record<string, string> = {}; 
    const assigned = new Set<string>();
    const realCouples = players.filter(p => p.relationshipStatus === 'couple');
    realCouples.forEach(p1 => {
        if (assigned.has(p1.uid)) return;
        const p2 = realCouples.find(p => p.coupleNumber === p1.coupleNumber && p.uid !== p1.uid);
        if (p2 && !assigned.has(p2.uid)) { pairs[p1.uid] = p2.uid; pairs[p2.uid] = p1.uid; assigned.add(p1.uid); assigned.add(p2.uid); }
    });
    const remaining = players.filter(p => !assigned.has(p.uid));
    const males = remaining.filter(p => p.gender === 'male');
    const females = remaining.filter(p => p.gender === 'female');
    const shuffledMales = [...males].sort(() => Math.random() - 0.5);
    const shuffledFemales = [...females].sort(() => Math.random() - 0.5);
    const assignedFemales = new Set<string>();
    shuffledMales.forEach(male => {
        let partner = shuffledFemales.find(f => !assignedFemales.has(f.uid));
        if (partner) { pairs[male.uid] = partner.uid; pairs[partner.uid] = male.uid; assignedFemales.add(partner.uid); }
    });
    return pairs;
  };

  const startRound = async () => {
    // ADMIN VALIDATION
    if (isAutoSetup) {
        if (!selectedLevel) { showError("⚠️ Select a Level to start Auto Mode!"); return; }
    } else {
        if (!selectedLevel) { showError("⚠️ Select Risk Level!"); return; }
        if (!selectedType) { showError("⚠️ Select Game Type!"); return; }
    }

    let sequence: string[] = [];
    if (isAutoSetup) {
        for(let i=0; i<qtyTruth; i++) sequence.push('question');
        for(let i=0; i<qtyDare; i++) sequence.push('dare');
        for(let i=0; i<qtyMM; i++) sequence.push('yn');
    }

    let initialMode = isAutoSetup && sequence.length > 0 ? sequence[0] : (selectedType === 'yn' ? 'yn' : selectedType === 'truth' ? 'question' : 'dare');
    let typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';

    // 2. Check Match Participants Rule
    if (typeChar === 'YN' && players.length < 3) {
        showError("❌ You need at least 3 players to play Match/Mismatch!");
        return;
    }

    const firstPlayerGender = players.length > 0 ? players[0].gender : 'male';
    const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel, firstPlayerGender);
    
    if (!nextChallenge) { showError('No challenges found for this selection.'); return; }

    let initialAnswers: Record<string, string> = {};
    if (initialMode === 'yn') {
        players.filter(p => p.isBot).forEach(b => { initialAnswers[b.uid] = Math.random() > 0.5 ? 'yes' : 'no'; });
    }

    let updates: any = {
      mode: initialMode,
      currentTurnIndex: 0, 
      answers: initialAnswers, 
      votes: {},
      adminUid: players[0].uid, 
      currentChallengeId: nextChallenge.id,
      roundLevel: selectedLevel,
      isAutoMode: isAutoSetup,
      sequence: sequence,
      sequenceIndex: 0
    };
      
    if (initialMode === 'yn') updates.pairs = computePairs();
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
    const coll = initialMode === 'yn' ? 'pairChallenges' : 'challenges';
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
  };

  // ... (submitAnswer, submitVote, nextTurn, findNextAvailableChallenge - same as before)
  const submitAnswer = async (val: string) => { if (!user) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`answers.${user.uid}`]: val }); };
  const submitVote = async (vote: string) => { if (!user) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`votes.${user.uid}`]: vote }); };
  const findNextAvailableChallenge = async (type: string, startLevel: string, playerGender: string) => {
      let currentLvl = parseInt(startLevel);
      let found = null;
      let collectionName = type === 'YN' ? 'pairChallenges' : 'challenges';
      
      for(let i = 0; i < 10; i++) {
          let lvlString = (currentLvl + i).toString();
          let ref = collection(db, 'artifacts', appId, 'public', 'data', collectionName);
          let q = query(ref, where('level', '==', lvlString), where('answered', '==', false));
          if(type !== 'YN') {
             q = query(ref, where('type', '==', type), where('level', '==', lvlString), where('answered', '==', false));
          }
          const snapshot = await getDocs(q);
          let validDocs = snapshot.docs.filter(d => !d.data().paused);

          if (type !== 'YN') {
             validDocs = validDocs.filter(d => {
                 const data = d.data();
                 const qSex = (data.gender || data.sexo || 'B').toUpperCase();
                 if (qSex === 'B') return true; 
                 if (playerGender === 'male') {
                     return qSex !== 'F'; 
                 } else {
                     return qSex !== 'M'; 
                 }
             });
          }

          if (validDocs.length > 0) {
              found = validDocs[Math.floor(Math.random() * validDocs.length)];
              break;
          }
      }
      if(found) return { id: found.id, ...found.data() } as Challenge;
      return null;
  };

  const nextTurn = async () => {
    // ... (Keep existing nextTurn logic)
    if (!gameState) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
    if (gameState.isEnding) { await updateDoc(gameRef, { mode: 'ended' }); return; }

    let updates: any = {};
    const points = { ...(gameState.points || {}) };
    const batch = writeBatch(db); 
      
    if (gameState.mode === 'question') { 
      const currentUid = players[gameState.currentTurnIndex]?.uid;
      const likeVotes = Object.values(gameState.votes || {}).filter(v => v === 'like').length;
      if(currentUid) points[currentUid] = (points[currentUid] || 0) + likeVotes;
    } else if (gameState.mode === 'dare') {
      const currentUid = players[gameState.currentTurnIndex]?.uid;
      const yesVotes = Object.values(gameState.votes || {}).filter(v => v === 'yes').length;
      if(currentUid) points[currentUid] = (points[currentUid] || 0) + yesVotes;
    } else if (gameState.mode === 'yn') {
      const processed = new Set();
      const currentHistory = [...(gameState.matchHistory || [])]; 
      
      Object.keys(gameState.pairs || {}).forEach(uid1 => {
        if (processed.has(uid1)) return;
        const uid2 = gameState.pairs![uid1];
        processed.add(uid1);
        processed.add(uid2);
        const ans1 = gameState.answers[uid1];
        const ans2 = gameState.answers[uid2];
        const p1 = players.find(p=>p.uid===uid1);
        const p2 = players.find(p=>p.uid===uid2);

        if (ans1 && ans2) {
            const isMatch = ans1 === ans2;
            if (isMatch) { points[uid1] = (points[uid1] || 0) + 1; points[uid2] = (points[uid2] || 0) + 1; }
            if (p1 && p2) {
                currentHistory.push({ u1: uid1, u2: uid2, name1: p1.name, name2: p2.name, result: isMatch ? 'match' : 'mismatch', timestamp: Date.now() });
            }
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid1), { matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) });
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid2), { matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) });
        }
      });
      updates.matchHistory = currentHistory;
      await batch.commit(); 
    }
    updates.points = points;

    let roundFinished = false;
    if (gameState.mode === 'yn') {
        roundFinished = true;
    } else {
        let nextIdx = gameState.currentTurnIndex + 1;
        while(nextIdx < players.length && players[nextIdx].isBot) { nextIdx++; }
        if (nextIdx < players.length) {
            updates.currentTurnIndex = nextIdx;
            updates.answers = {};
            updates.votes = {};
            const typeChar = gameState.mode === 'question' ? 'T' : 'D';
            const nextPlayerGender = players[nextIdx].gender;
            const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', nextPlayerGender);
            if (nextChallenge) {
                updates.currentChallengeId = nextChallenge.id;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'challenges', nextChallenge.id!), { answered: true });
            } else { roundFinished = true; }
        } else { roundFinished = true; }
    }

    if (roundFinished) {
        if (gameState.isAutoMode && gameState.sequence) {
            let nextSeqIdx = (gameState.sequenceIndex || 0) + 1;
            if (nextSeqIdx >= gameState.sequence.length) { nextSeqIdx = 0; }
            const nextModeKey = gameState.sequence[nextSeqIdx]; 
            let mode = nextModeKey === 'truth' ? 'question' : nextModeKey; 
            if(mode === 'truth') mode = 'question'; 
            let typeChar = mode === 'yn' ? 'YN' : mode === 'question' ? 'T' : 'D';
            const nextPlayerGender = players.length > 0 ? players[0].gender : 'male';
            const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1', nextPlayerGender);
            if (nextChallenge) {
                updates.mode = mode;
                updates.currentTurnIndex = 0;
                updates.sequenceIndex = nextSeqIdx;
                updates.answers = {};
                updates.votes = {};
                updates.currentChallengeId = nextChallenge.id;
                if (mode === 'yn') {
                    updates.pairs = computePairs();
                    players.filter(p => p.isBot).forEach(b => { updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no'; });
                }
                const coll = mode === 'yn' ? 'pairChallenges' : 'challenges';
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
            } else { updates.mode = 'admin_setup'; }
        } else {
            updates.mode = 'admin_setup';
            updates.currentTurnIndex = 0;
            updates.answers = {};
            updates.votes = {};
        }
    }
    await updateDoc(gameRef, updates);
  };

  // --- UPLOADERS & MANAGER ---
  // ... (handleSort, handleRowMouseDown etc same as before)
  const handleSort = (key: keyof Challenge) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const handleRowMouseDown = (id: string, e: React.MouseEvent) => { setIsDragging(true); const newSet = new Set(selectedIds); if (newSet.has(id)) { newSet.delete(id); selectionMode.current = 'remove'; } else { newSet.add(id); selectionMode.current = 'add'; } setSelectedIds(newSet); };
  const handleRowMouseEnter = (id: string) => { if (isDragging) { const newSet = new Set(selectedIds); if (selectionMode.current === 'add') newSet.add(id); else newSet.delete(id); setSelectedIds(newSet); } };
  const toggleSelectAll = (filteredData: Challenge[]) => { if (selectedIds.size === filteredData.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredData.map(c => c.id!))); };
  const updateSingleField = async (collectionName: string, id: string, field: string, value: string | boolean) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id), { [field]: value }); };
  
  const applyBulkEdit = async () => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges'; // Updated check
      if (!confirm(`Update ${selectedIds.size}?`)) return;
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id);
          const updates: any = {};
          if (bulkLevel) updates.level = bulkLevel;
          if (managerTab !== 'mm' && bulkGender) updates.gender = bulkGender; 
          batch.update(ref, updates);
      });
      await batch.commit();
      setBulkLevel(''); setBulkGender(''); setSelectedIds(new Set());
  };
  const deleteSelected = async () => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges';
      if (!confirm(`Delete ${selectedIds.size}?`)) return;
      const batch = writeBatch(db);
      selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.delete(ref); });
      await batch.commit(); setSelectedIds(new Set());
  };
  const bulkPause = async (pauseStatus: boolean) => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'mm' ? 'pairChallenges' : 'challenges';
      const batch = writeBatch(db);
      selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.update(ref, { paused: pauseStatus }); });
      await batch.commit(); setSelectedIds(new Set());
  };
  const checkPendingSettings = () => {
      const pendingTD = challenges.filter(c => !c.level || !c.type || (!c.gender && !c.sexo)).length; 
      const pendingMM = pairChallenges.filter(c => !c.level).length;
      return { pendingTD, pendingMM, total: pendingTD + pendingMM };
  };
  
  const handleExportCSV = (isTemplate: boolean) => {
      const isMM = managerTab === 'mm';
      const headers = !isMM ? "text,level,gender" : "male,female,level"; 
      let csvContent = "data:text/csv;charset=utf-8," + headers + "\n";
      if (!isTemplate) {
          const data = isMM ? pairChallenges : challenges.filter(c => c.type === (managerTab === 'truth' ? 'T' : 'D'));
          data.forEach(row => {
              if (!isMM) {
                  const safeText = `"${(row.text || '').replace(/"/g, '""')}"`;
                  csvContent += `${safeText},${row.level||''},${row.gender||row.sexo||''}\n`;
              } else {
                  const safeMale = `"${(row.male || '').replace(/"/g, '""')}"`;
                  const safeFemale = `"${(row.female || '').replace(/"/g, '""')}"`;
                  csvContent += `${safeMale},${safeFemale},${row.level||''}\n`;
              }
          });
      }
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", isTemplate ? `template_${managerTab}.csv` : `export_${managerTab}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleUploadSingleCol = async (e: React.ChangeEvent<HTMLInputElement>, fixedType: 'T' | 'D') => {
      const file = e.target.files?.[0]; if(!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      const headerLine = lines[0].toLowerCase().trim();
      
      if (!headerLine.includes('text') || !headerLine.includes('level') || !headerLine.includes('gender')) {
          showError(`Invalid CSV for ${fixedType === 'T' ? 'Truth' : 'Dare'}.\nExpected headers: text, level, gender\nFound: ${headerLine}`);
          return;
      }

      setUploading(true);
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
      const batch = writeBatch(db);
      
      let count = 0;
      lines.slice(1).forEach(line => {
          if(!line.trim()) return;
          const parts = parseCSVLine(line); // Use robust parser
          if (!parts) return;

          const textVal = parts[0]?.trim();
          const levelVal = parts[1]?.trim();
          const genderVal = parts[2]?.trim();

          if(textVal) {
              const docRef = doc(ref);
              batch.set(docRef, { text: textVal, level: levelVal, type: fixedType, gender: genderVal, answered: false, paused: false }); 
              count++;
          }
      });
      await batch.commit(); 
      setUploading(false); 
      showSuccess(`Uploaded ${count} ${fixedType === 'T' ? 'Truth' : 'Dare'} questions.`);
      if(e.target) e.target.value = '';
  };

  const handleUploadDoubleCol = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if(!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      const headerLine = lines[0].toLowerCase().trim();

      if (!headerLine.includes('male') || !headerLine.includes('female') || !headerLine.includes('level')) {
          showError(`Invalid CSV for Match/Mismatch.\nExpected headers: male, female, level\nFound: ${headerLine}`);
          return;
      }

      setUploading(true);
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
      const batch = writeBatch(db);
      
      let count = 0;
      lines.slice(1).forEach(line => {
          if(!line.trim()) return;
          const parts = parseCSVLine(line); // Use robust parser
          if (!parts) return;
          
          const male = parts[0]?.trim();
          const female = parts[1]?.trim();
          const level = parts[2]?.trim();

          if (male && female) {
              const docRef = doc(ref);
              batch.set(docRef, { male, female, level, answered: false, paused: false });
              count++;
          }
      });
      await batch.commit(); 
      setUploading(false); 
      showSuccess(`Uploaded ${count} Match/Mismatch questions.`);
      if(e.target) e.target.value = '';
  };
  
  const handleEndGame = async () => { if(confirm('End game after this round?')) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { isEnding: true }); } };
  
  const handleReturnToLobby = async () => {
      if(confirm('Return to Lobby?')) {
          const batch = writeBatch(db);
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, isEnding: false });
          await batch.commit();
      }
  };

  const handleRestart = async () => { 
      if(confirm('RESET EVERYTHING? Use this only for a new party.')) { 
        // Clear local error state to avoid "Please select Level" showing up on reset
        setCustomError(null);
        setIsAutoSetup(false);
        setSelectedLevel('');
        
        const batch = writeBatch(db);
        (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'players'))).forEach(d=>batch.delete(d.ref));
        (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'challenges'))).forEach(d=>batch.update(d.ref, {answered:false}));
        (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges'))).forEach(d=>batch.update(d.ref, {answered:false}));
        batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', adminUid: null, matchHistory: [], isEnding: false });
        await batch.commit();
      }
  };

  const currentPlayerName = () => gameState && players.length > 0 ? players[gameState?.currentTurnIndex]?.name : 'Nobody';
  const currentPlayer = () => gameState && players.length > 0 ? players[gameState?.currentTurnIndex] : null;

  const currentCard = () => {
    if (!gameState || !gameState?.currentChallengeId) return undefined;
    if (gameState.mode === 'yn') return pairChallenges.find(c => c.id === gameState?.currentChallengeId);
    return challenges.find(c => c.id === gameState?.currentChallengeId);
  };
  const getCardText = (c: Challenge | undefined) => {
    if (!c) return 'Loading...'; 
    if (gameState?.mode === 'yn') {
        if (isAdmin) return `M: ${c.male} / F: ${c.female}`;
        const myPlayer = players.find(p => p.uid === user?.uid);
        if (!myPlayer) return 'Waiting...'; 
        return myPlayer.gender === 'female' ? c.female : c.male;
    }
    return c.text || 'No text found';
  };
  const isJoined = players.some(p => p.uid === user?.uid) || isAdmin;
  const isMyTurn = () => gameState && players[gameState?.currentTurnIndex]?.uid === user?.uid;

  // --- COMPONENTS ---
  const CustomAlert = () => customError ? (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[150]">
          <div className="bg-slate-800 p-6 rounded-xl border border-red-500 max-w-md text-center shadow-2xl animate-in zoom-in-95">
              <AlertTriangle className="mx-auto text-red-500 mb-2" size={40}/>
              <p className="text-white mb-4 whitespace-pre-line font-medium">{customError}</p>
              <button onClick={closeError} className="bg-red-600 px-6 py-2 rounded font-bold hover:bg-red-500 transition-colors">OK</button>
          </div>
      </div>
  ) : null;

  const CustomSuccess = () => customSuccess ? (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-2 z-[150] animate-in fade-in slide-in-from-top-4">
          <CheckCircle size={20} />
          <span className="font-bold">{customSuccess}</span>
      </div>
  ) : null;

  const MyMatchHistory = () => {
      // (Same history component)
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
          <div className="w-full bg-slate-800 p-2 mt-4 rounded-lg max-h-40 overflow-y-auto border border-slate-700">
              <div className="text-xs text-slate-400 mb-1 uppercase font-bold text-center">My Interactions</div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-600 text-slate-400"><th className="text-left py-1">Name</th><th className="text-center py-1 text-green-400">Match</th><th className="text-center py-1 text-red-400">Unmatch</th></tr></thead>
                <tbody>{Object.values(stats).map((s, idx) => (<tr key={idx} className="border-b border-slate-700/50"><td className="py-1 font-bold">{s.name}</td><td className="py-1 text-center font-bold text-green-400">{s.m}</td><td className="py-1 text-center font-bold text-red-400">{s.um}</td></tr>))}</tbody>
              </table>
          </div>
      );
  };

  const ScoreBoard = () => (
      <div className="w-full bg-slate-800 p-2 mb-4 rounded-lg flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-slate-700">
          <div className="w-full text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider flex justify-between"><span>Scoreboard</span><span>Players: {players.length}</span></div>
          {players.map(p => (
              <div key={p.uid} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${p.isBot ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-700/50'}`}>
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="text-yellow-400 font-bold ml-auto">{gameState?.points?.[p.uid] || 0}</span>
                  {isAdmin && (<button onClick={(e) => { e.stopPropagation(); handleKickPlayer(p.uid, p.name); }} className="ml-2 text-red-500 hover:text-red-300" title="Reset Player"><Trash2 size={12}/></button>)}
              </div>
          ))}
      </div>
  );

  // --- RENDER ---
  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;

  if (!isJoined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900 relative">
        <CustomAlert/>
        {showPlayerHelp && <HelpModal onClose={() => setShowPlayerHelp(false)} type="player" />}
        <button onClick={() => setShowPlayerHelp(true)} className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-blue-400 transition-all"><HelpCircle size={24} /></button>
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-purple-500/30 text-center shadow-2xl">
          <Flame className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-6 tracking-widest">SEXY GAME</h1>
          <input type="text" placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none" value={userName} onChange={e=>setUserName(e.target.value)} />
          <select value={gender} onChange={e=>setGender(e.target.value)} className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 focus:border-purple-500 outline-none ${gender === '' ? 'text-slate-400' : 'text-white'}`}>
              <option value="" disabled>Select Gender</option><option value="male">Male</option><option value="female">Female</option>
          </select>
          <div className="mb-4 text-left">
              <select value={relationshipStatus} onChange={e=>setRelationshipStatus(e.target.value as 'single'|'couple')} className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-purple-500 outline-none ${relationshipStatus === '' ? 'text-slate-400' : 'text-white'}`}>
                  <option value="" disabled>Select Status</option><option value="single">Single</option><option value="couple">Couple</option>
              </select>
          </div>
          <input type="number" placeholder="Male's Last 4 Phone Digits" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none" value={coupleNumber} onChange={e=>setCoupleNumber(e.target.value)} />
          {userName.toLowerCase()!=='admin' && <input type="text" placeholder="Ask code to admin" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none" value={code} onChange={e=>setCode(e.target.value)} />}
          <button onClick={joinGame} disabled={!userName.trim()} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform">Enter Game</button>
        </div>
      </div>
    );
  }

  // --- GAME ENDED SCREEN (MOVED TO TOP PRIORITY) ---
  if (gameState?.mode === 'ended') {
      return (
        <div className="min-h-screen text-white p-6 flex flex-col items-center justify-center bg-slate-900">
            <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
            <h2 className="text-2xl font-bold mb-4">Game Ended</h2>
            <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm max-h-96 overflow-y-auto mb-6">
                {players.map(p => (
                    <div key={p.uid} className="py-2 border-b border-slate-700 flex justify-between">
                        <span>{p.name}</span>
                        <span className="font-bold text-yellow-400">{gameState?.points[p.uid] || 0} pts</span>
                    </div>
                ))}
            </div>
            {isAdmin && (
                <button onClick={handleReturnToLobby} className="bg-blue-600 px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-500 transition-transform active:scale-95 w-full max-w-sm">
                    Return to Lobby (New Game)
                </button>
            )}
        </div>
      );
  }

  // --- MANAGER RENDER (MODIFIED) ---
  if (isAdmin && isManaging) {
      // Determine dataset based on tab
      const data = managerTab === 'mm' ? pairChallenges : challenges.filter(c => {
          if (managerTab === 'truth') return c.type === 'T' || c.type === 'question';
          if (managerTab === 'dare') return c.type === 'D' || c.type === 'dare';
          return false;
      });

      let displayedData = showPendingOnly ? data.filter(c => !c.level) : data;
      
      // SEARCH FILTER
      if (searchTerm) {
          displayedData = displayedData.filter(c => 
             (c.text && c.text.toLowerCase().includes(searchTerm.toLowerCase())) ||
             (c.male && c.male.toLowerCase().includes(searchTerm.toLowerCase())) ||
             (c.female && c.female.toLowerCase().includes(searchTerm.toLowerCase()))
          );
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

      // Check for blinking uploads
      const hasTruth = challenges.some(c => c.type === 'T' || c.type === 'question');
      const hasDare = challenges.some(c => c.type === 'D' || c.type === 'dare');
      const hasMatch = pairChallenges.length > 0;

      return (
        <div className="min-h-screen p-4 text-white bg-slate-900 flex flex-col" onMouseUp={()=>setIsDragging(false)}>
            <CustomSuccess />
            <CustomAlert />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Settings/> Content & Uploads</h2>
                <div className="flex gap-2">
                    <button onClick={()=>setIsManaging(false)} className="bg-red-600 px-3 py-1 rounded text-sm">Back</button>
                </div>
            </div>
            
            {/* NEW TABS */}
            <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2 overflow-x-auto">
                <button onClick={()=>setManagerTab('truth')} className={`px-4 py-2 rounded flex-shrink-0 ${managerTab==='truth' ? 'bg-blue-600 font-bold' : 'bg-slate-700'}`}>Truth</button>
                <button onClick={()=>setManagerTab('dare')} className={`px-4 py-2 rounded flex-shrink-0 ${managerTab==='dare' ? 'bg-pink-600 font-bold' : 'bg-slate-700'}`}>Dare</button>
                <button onClick={()=>setManagerTab('mm')} className={`px-4 py-2 rounded flex-shrink-0 ${managerTab==='mm' ? 'bg-green-600 font-bold' : 'bg-slate-700'}`}>Match</button>
            </div>

            {/* UPLOAD SECTION (CONTEXTUAL) - BIG BUTTONS */}
            <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700 flex flex-col gap-2">
                  
                  {managerTab === 'truth' && (
                      <label className={`group flex items-center justify-center gap-3 w-full p-6 rounded-xl cursor-pointer transition-all transform hover:scale-[1.02] shadow-lg border-2 border-blue-500/50 ${!hasTruth ? 'bg-gradient-to-r from-blue-900 to-blue-800 animate-pulse border-blue-400' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                          <div className="bg-blue-500/20 p-3 rounded-full group-hover:bg-blue-500 transition-colors"><Upload size={24} className="text-white"/></div>
                          <div className="flex flex-col text-left">
                             <span className="font-bold text-lg text-white">UPLOAD TRUTH CSV</span>
                             <span className="text-xs text-blue-200">Click to browse file...</span>
                          </div>
                          <input type="file" className="hidden" onChange={(e)=>handleUploadSingleCol(e, 'T')}/>
                      </label>
                  )}
                  {managerTab === 'dare' && (
                      <label className={`group flex items-center justify-center gap-3 w-full p-6 rounded-xl cursor-pointer transition-all transform hover:scale-[1.02] shadow-lg border-2 border-pink-500/50 ${!hasDare ? 'bg-gradient-to-r from-pink-900 to-pink-800 animate-pulse border-pink-400' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                          <div className="bg-pink-500/20 p-3 rounded-full group-hover:bg-pink-500 transition-colors"><Upload size={24} className="text-white"/></div>
                          <div className="flex flex-col text-left">
                             <span className="font-bold text-lg text-white">UPLOAD DARE CSV</span>
                             <span className="text-xs text-pink-200">Click to browse file...</span>
                          </div>
                          <input type="file" className="hidden" onChange={(e)=>handleUploadSingleCol(e, 'D')}/>
                      </label>
                  )}
                  {managerTab === 'mm' && (
                      <label className={`group flex items-center justify-center gap-3 w-full p-6 rounded-xl cursor-pointer transition-all transform hover:scale-[1.02] shadow-lg border-2 border-green-500/50 ${!hasMatch ? 'bg-gradient-to-r from-green-900 to-green-800 animate-pulse border-green-400' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                          <div className="bg-green-500/20 p-3 rounded-full group-hover:bg-green-500 transition-colors"><Upload size={24} className="text-white"/></div>
                          <div className="flex flex-col text-left">
                             <span className="font-bold text-lg text-white">UPLOAD MATCH/MISMATCH CSV</span>
                             <span className="text-xs text-green-200">Click to browse file...</span>
                          </div>
                          <input type="file" className="hidden" onChange={handleUploadDoubleCol}/>
                      </label>
                  )}
                  {uploading && <div className="text-xs text-yellow-400 text-center mt-2 font-bold animate-pulse">Processing file...</div>}
            </div>

            <div className="bg-slate-800 p-3 rounded-xl mb-4 flex flex-wrap gap-3 items-end text-sm">
                <div className="flex flex-col"><label className="text-xs text-slate-400">Set Level</label><select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkLevel} onChange={e=>setBulkLevel(e.target.value)}><option value="">-</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div>
                {managerTab !== 'mm' && (<div className="flex flex-col"><label className="text-xs text-slate-400">Set Gender</label><select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkGender} onChange={e=>setBulkGender(e.target.value)}><option value="">-</option><option value="F">Female</option><option value="B">Both</option></select></div>)}
                <button onClick={applyBulkEdit} disabled={selectedIds.size === 0} className="bg-green-600 px-3 py-1 rounded font-bold disabled:opacity-50">Apply ({selectedIds.size})</button>
                
                <button onClick={()=>bulkPause(true)} disabled={selectedIds.size === 0} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg border border-slate-500 disabled:opacity-50 transition-colors" title="Pause Selected"><PauseCircle size={20} className="text-yellow-400"/></button>
                <button onClick={()=>bulkPause(false)} disabled={selectedIds.size === 0} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg border border-slate-500 disabled:opacity-50 transition-colors" title="Resume Selected"><PlayCircle size={20} className="text-green-400"/></button>

                <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="bg-red-600 px-3 py-1 rounded font-bold flex items-center gap-2 disabled:opacity-50 ml-auto"><Trash2 size={16}/> Delete</button>
                <button onClick={()=>toggleSelectAll(displayedData)} className="bg-slate-600 px-3 py-1 rounded flex items-center gap-1">{selectedIds.size === displayedData.length ? <CheckSquare size={14}/> : <Square size={14}/>} All</button>
                <button onClick={()=>setShowPendingOnly(!showPendingOnly)} className={`px-3 py-1 rounded flex items-center gap-1 ${showPendingOnly ? 'bg-yellow-600' : 'bg-slate-600'}`}><Filter size={14}/> Needs Setup</button>
            </div>
            
            <div className="flex gap-2 mb-2 justify-end text-xs">
                <button onClick={()=>handleExportCSV(false)} className="bg-blue-600 px-3 py-1 rounded flex items-center gap-1"><Download size={14}/> Export Data</button>
                <button onClick={()=>handleExportCSV(true)} className="bg-slate-600 px-3 py-1 rounded flex items-center gap-1"><FileSpreadsheet size={14}/> Template</button>
            </div>
            
            {/* TABLE CONTAINER */}
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-700 rounded-xl" onMouseLeave={()=>setIsDragging(false)}>
                <table className="w-full text-left text-xs select-none min-w-[800px]">
                    <thead className="bg-slate-800 text-slate-400 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 w-8 text-center"><input type="checkbox" onChange={()=>toggleSelectAll(displayedData)} checked={selectedIds.size === displayedData.length && displayedData.length > 0} /></th>
                            <th className="p-2 w-8 text-center"></th>
                            <th className="p-2 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('level')}>Level <ArrowUpDown size={12} className="inline"/></th>
                            {/* Removed Type Column */}
                            {managerTab !== 'mm' && <th className="p-2 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('gender')}>Gender <ArrowUpDown size={12} className="inline"/></th>}
                            {managerTab !== 'mm' ? (
                                <th className="p-2 min-w-[300px]">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center cursor-pointer hover:text-white" onClick={()=>handleSort('text')}>Text <ArrowUpDown size={12} className="inline ml-1"/></div>
                                        <div className="relative">
                                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-600 rounded pl-6 pr-2 py-0.5 text-xs focus:border-blue-500 outline-none w-full text-white"/>
                                            <Search size={10} className="absolute left-1.5 top-1.5 text-slate-400"/>
                                        </div>
                                    </div>
                                </th>
                            ) : (
                                <>
                                    <th className="p-2 min-w-[200px]">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center cursor-pointer hover:text-white" onClick={()=>handleSort('male')}>Male Question <ArrowUpDown size={12} className="inline ml-1"/></div>
                                            <div className="relative">
                                                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-600 rounded pl-6 pr-2 py-0.5 text-xs focus:border-blue-500 outline-none w-full text-white"/>
                                                <Search size={10} className="absolute left-1.5 top-1.5 text-slate-400"/>
                                            </div>
                                        </div>
                                    </th>
                                    <th className="p-2 min-w-[200px]" onClick={()=>handleSort('female')}>Female Question <ArrowUpDown size={12} className="inline"/></th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {displayedData.map(c => (
                            <tr key={c.id} className={`cursor-pointer transition-colors ${c.paused ? 'text-red-400' : ''} ${selectedIds.has(c.id!) ? 'bg-blue-900/50' : 'hover:bg-slate-800'}`} onMouseDown={(e)=>handleRowMouseDown(c.id!, e)} onMouseEnter={()=>handleRowMouseEnter(c.id!)}>
                                <td className="p-2 text-center"><input type="checkbox" checked={selectedIds.has(c.id!)} readOnly /></td>
                                <td className="p-2 text-center" onMouseDown={(e)=>e.stopPropagation()}><button onClick={()=>updateSingleField(collectionName, c.id!, 'paused', !c.paused)}>{c.paused ? <PauseCircle size={16}/> : <PlayCircle size={16} className="text-green-500"/>}</button></td>
                                <td className="p-2">{c.level || <span className="text-red-500">?</span>}</td>
                                {managerTab !== 'mm' && <td className="p-2">{c.gender || c.sexo || <span className="text-red-500">?</span>}</td>}
                                {managerTab !== 'mm' ? (<td className="p-2" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none" value={c.text || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'text', e.target.value)}/></td>) : (<><td className="p-2" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none" value={c.male || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'male', e.target.value)}/></td><td className="p-2" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none" value={c.female || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'female', e.target.value)}/></td></>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      );
  }

  // --- ADMIN MAIN ---
  if (isAdmin) {
    // FIX: Catch-all for Lobby mode. If mode is undefined, null, empty string OR specifically 'lobby', render Lobby.
    // This fixes the "Blue Screen" issue when mode is manually cleared in Firebase.
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
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900 relative">
              {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
              <CustomSuccess />
              <button onClick={() => setShowAdminHelp(true)} className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-yellow-500 transition-all" title="Help / Manual"><HelpCircle size={24} /></button>
              <CustomAlert/>
              <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              <h2 className="text-2xl font-bold mb-4">Lobby ({players.length})</h2>
              
              <div className="flex gap-4 mb-4 text-xs font-mono bg-black/30 p-2 rounded-lg">
                  <div className="flex items-center gap-1 text-blue-400"><UserIcon size={14}/> Singles: {singlesCount}</div>
                  <div className="flex items-center gap-1 text-pink-400"><Users size={14}/> Couples: {couplesCount/2}</div>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm mb-6 border border-slate-700">
                {players.length === 0 && <span className="text-slate-500 text-sm">No players yet.</span>}
                {sortedPlayers.map(p => {
                    const isIncomplete = incompleteIds.includes(p.coupleNumber) && p.relationshipStatus === 'couple';
                    return (
                        <div key={p.uid} className={`flex justify-between items-center py-1 ${p.isBot?'text-purple-400':''}`}>
                            <div className="flex flex-col leading-tight">
                                <span className={isIncomplete ? "text-orange-400 font-bold animate-pulse" : ""}>{p.name} {p.isBot && '(Bot)'}</span>
                                {p.relationshipStatus === 'couple' && <span className={`text-[10px] ${isIncomplete ? "text-orange-300" : "text-pink-400"}`}>Couple #{p.coupleNumber} {isIncomplete ? "(Waiting partner)" : ""}</span>}
                            </div>
                            <button onClick={()=>handleKickPlayer(p.uid, p.name)} className="text-red-500 hover:text-red-300" title="Reset Player"><UserX size={16}/></button>
                        </div>
                    );
                })}
              </div>

              {/* ADMIN CODE SETTING SECTION - COMPACT */}
              {!isSettingCode ? (
                  <button onClick={() => setIsSettingCode(true)} className="w-full max-w-sm bg-blue-900/50 border border-blue-600/50 p-2 rounded-lg font-bold mb-4 text-blue-200 hover:bg-blue-800 transition flex items-center justify-center gap-2 text-sm">
                      <Send size={14}/> Set Game Code
                  </button>
              ) : (
                  <div className="w-full max-w-sm flex gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
                      <input 
                        type="text" 
                        placeholder="Enter Code..." 
                        className="bg-slate-800 border border-slate-600 rounded p-2 text-white flex-1 outline-none focus:border-blue-500" 
                        value={code} 
                        onChange={e=>setCode(e.target.value)} 
                        autoFocus
                      />
                      <button onClick={setGameCode} className="bg-green-600 px-3 rounded font-bold hover:bg-green-500">Save</button>
                      <button onClick={() => setIsSettingCode(false)} className="bg-red-600 px-3 rounded hover:bg-red-500">X</button>
                  </div>
              )}
              
              <button onClick={()=>setIsManaging(true)} className="w-full max-w-sm bg-slate-700 p-3 rounded-lg font-bold mb-4 flex items-center justify-center gap-2 border border-slate-600 hover:bg-slate-600 relative">
                  <Settings size={18}/> Content & Uploads
                  {total > 0 && <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
              </button>
              
              {!couplesValid && (
                  <div className="bg-red-900/80 p-3 rounded text-center text-sm mb-4 border border-red-500 max-w-sm w-full animate-pulse">
                      <strong className="block text-red-200 mb-1"><AlertTriangle className="inline mr-1" size={14}/> Incomplete Couples!</strong>
                      Wait for partners for IDs: {incompleteIds.join(', ')}
                  </div>
              )}

              {total > 0 ? (
                  <div className="bg-red-900/50 p-3 rounded text-center text-sm mb-4 border border-red-500">
                      <AlertTriangle className="inline mr-2" size={16}/>
                      Complete setup for {total} questions to start.
                  </div>
              ) : (
                  <button onClick={startGame} className="w-full max-w-sm bg-green-600 p-3 rounded-lg font-bold hover:bg-green-500 transition shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Start Game</button>
              )}
              <button onClick={handleRestart} className="w-full max-w-sm bg-red-600 p-3 rounded-lg font-bold mt-4 hover:bg-red-500 transition shadow-lg active:scale-95">Reset All</button>
            </div>
        );
    }

    if (gameState?.mode === 'admin_setup') {
         return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900 relative">
                {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
                <button onClick={() => setShowAdminHelp(true)} className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-yellow-500 transition-all"><HelpCircle size={24} /></button>
                <h2 className="text-2xl font-bold mb-4">Setup Round</h2>
                <ScoreBoard />
                
                <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 flex items-center justify-between">
                    <div><div className="text-xs text-slate-400 uppercase font-bold">Game Mode</div><div className={`font-black text-xl ${isAutoSetup ? 'text-green-400' : 'text-blue-400'}`}>{isAutoSetup ? 'AUTOMATIC' : 'MANUAL'}</div></div>
                    <button onClick={()=>setIsAutoSetup(!isAutoSetup)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isAutoSetup ? 'bg-green-600' : 'bg-slate-600'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAutoSetup ? 'translate-x-7' : 'translate-x-1'}`} /></button>
                </div>

                {isAutoSetup ? (
                    <div className="flex gap-2 w-full max-w-md bg-slate-800 p-3 rounded-lg border border-slate-700 mb-4 animate-in fade-in">
                        <div className="flex-1 text-center"><div className="text-xs text-blue-400">Truth</div><input type="number" className="w-full bg-slate-900 text-center border border-slate-600 rounded p-1" value={qtyTruth} onChange={e=>setQtyTruth(parseInt(e.target.value))}/></div>
                        <div className="flex-1 text-center"><div className="text-xs text-pink-400">Dare</div><input type="number" className="w-full bg-slate-900 text-center border border-slate-600 rounded p-1" value={qtyDare} onChange={e=>setQtyDare(parseInt(e.target.value))}/></div>
                        <div className="flex-1 text-center"><div className="text-xs text-green-400">Match</div><input type="number" className="w-full bg-slate-900 text-center border border-slate-600 rounded p-1" value={qtyMM} onChange={e=>setQtyMM(parseInt(e.target.value))}/></div>
                    </div>
                ) : (
                    <div className="w-full max-w-md space-y-3 mb-4">
                        <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-600"><span className="font-bold text-sm text-slate-300 pl-2">Risk Level</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-1 text-white text-sm w-32"><option value="">Select</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                        <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-600"><span className="font-bold text-sm text-slate-300 pl-2">Game Type</span><select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-slate-900 border border-slate-600 rounded p-1 text-white text-sm w-32"><option value="">Select</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match/Mismatch</option></select></div>
                    </div>
                )}
                
                {isAutoSetup && (
                    <select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Level (Required)</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
                )}

                <button onClick={startRound} className="w-full max-w-md bg-green-600 p-3 rounded-lg font-bold">{isAutoSetup ? 'Start Auto Sequence' : 'Start Round'}</button>
                <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset All</button>
            </div>
         );
    }
    // ... (Admin in-game render)
    const card = currentCard();
    const pendingPlayers = players.filter(p => !p.isBot).filter(p => {
        if(gameState.mode === 'question' || gameState.mode === 'dare') { if(p.uid === players[gameState.currentTurnIndex]?.uid) return false; return !gameState.votes?.[p.uid]; }
        if(gameState.mode === 'yn') { return !gameState.answers?.[p.uid]; }
        return false;
    });

    return (
      <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900 relative">
        {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
        <button onClick={() => setShowAdminHelp(true)} className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-yellow-500 transition-all z-50"><HelpCircle size={24} /></button>
        <ScoreBoard />
        <div className="flex justify-between items-center mb-6 mt-4"><div className="flex gap-2 font-bold text-lg"><Zap className="text-yellow-400"/> {gameState?.mode?.toUpperCase()} (Admin)</div><div className="text-sm text-slate-400">Turn: {currentPlayerName()}</div></div>
        
        <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl mb-4 border border-slate-600 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                 <div><div className="text-xs text-slate-400 uppercase font-bold">Current Mode</div><div className={`font-black text-lg ${gameState?.isAutoMode ? 'text-green-400' : 'text-blue-400'}`}>{gameState?.isAutoMode ? 'AUTOMATIC' : 'MANUAL'}</div></div>
                 <button onClick={toggleAutoMode} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${gameState?.isAutoMode ? 'bg-green-600' : 'bg-slate-600'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${gameState?.isAutoMode ? 'translate-x-7' : 'translate-x-1'}`} /></button>
            </div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-400 font-bold uppercase">Level:</span><select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm w-36">{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
            {!gameState?.isAutoMode && (<div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300"><span className="text-sm text-slate-400 font-bold uppercase">Next Type:</span><select value={selectedType} onChange={e=>updateGlobalType(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm w-36"><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match/Mismatch</option></select></div>)}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-full max-w-md p-8 rounded-3xl border-4 text-center mb-8 transition-all duration-500 ${cardStyle} flex flex-col items-center justify-center min-h-[200px] relative`}>
              <div className="absolute top-4 left-4 text-xs font-bold opacity-60 uppercase tracking-widest text-white/50">
                  GAME: {gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}
              </div>
              <div className="mb-4 opacity-50">{gameState.mode === 'question' ? <MessageCircle size={32}/> : gameState.mode === 'yn' ? null : <Flame size={32}/>}</div>
              <h3 className="text-2xl font-bold leading-relaxed drop-shadow-md">{getCardText(card)}</h3>
          </div>
          <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl mb-4">
              <h4 className="font-bold mb-2 flex items-center gap-2"><RefreshCw size={14} className={pendingPlayers.length > 0 ? "animate-spin" : ""}/> Progress:</h4>
              {pendingPlayers.length === 0 ? (<div className="text-green-400 font-bold text-center">All done!</div>) : (<div className="text-sm text-slate-300">Waiting for: <span className="font-bold text-white">{pendingPlayers.map(p => p.name).join(', ')}</span></div>)}
          </div>
          {gameState?.isAutoMode ? (<div className="text-center text-green-400 font-bold animate-pulse mb-4 flex items-center gap-2 justify-center"><RefreshCw className="animate-spin" size={16}/> Auto-Advancing Sequence...</div>) : (<button onClick={nextTurn} className="w-full max-w-md bg-indigo-600 p-3 rounded-lg font-bold">Next (Force)</button>)}
          <button onClick={handleEndGame} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">{gameState.isEnding ? "Ending after round..." : "End Game"}</button>
          <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset All</button>
        </div>
      </div>
    );
  }

  // --- VISTA JUGADOR ---
  // (Lobby and Ended states remain the same, simplified for brevity in this answer)
  if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
      // ... (Player Lobby same as before)
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900 relative">
            <CustomAlert/>
            {showPlayerHelp && <HelpModal onClose={() => setShowPlayerHelp(false)} type="player" />}
            <button onClick={() => setShowPlayerHelp(true)} className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-blue-400 transition-all z-50"><HelpCircle size={24} /></button>
            <div className="text-center py-2 border-b border-slate-700 mb-4 w-full flex items-center justify-center gap-2 relative flex-col">
                <div className="flex items-center gap-2">
                    {isEditingName ? (<div className="flex gap-2"><input className="bg-slate-800 border border-slate-600 p-1 rounded text-center text-lg font-bold text-white w-40" autoFocus placeholder={userName} value={newName} onChange={(e) => setNewName(e.target.value)} /><button onClick={handleUpdateName} className="bg-green-600 px-2 rounded font-bold">Save</button><button onClick={() => setIsEditingName(false)} className="bg-red-600 px-2 rounded">X</button></div>) : (<><h1 className="text-3xl font-black text-white">{userName}</h1><button onClick={() => { setIsEditingName(true); setNewName(userName); }} className="text-slate-500 hover:text-white"><Edit2 size={16}/></button></>)}
                </div>
                {relationshipStatus === 'couple' && (<div className="text-xs text-pink-400 font-mono mt-1">Couple #: {coupleNumber}</div>)}
            </div>
            <ScoreBoard />
            <MyMatchHistory />
            <div className="text-2xl font-bold animate-pulse mb-4 text-center mt-6">Waiting for next round...</div>
            <div className="text-slate-400 text-center mb-8">{gameState?.mode === 'lobby' ? "You are in the lobby." : "Round is starting..."}</div>
            <div className="mt-auto w-full flex justify-center pb-4"><button onClick={handleSelfLeave} className="bg-red-900/50 border border-red-600 px-4 py-2 rounded-lg text-red-200 flex items-center gap-2 text-sm hover:bg-red-900"><LogOut size={14}/> Reset Player</button></div>
        </div>
      );
  }

  const card = currentCard();
  if (!card && gameState.currentChallengeId) { return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900"><div className="text-xl animate-pulse">Syncing card data...</div></div>; }

  const playerAnswered = gameState?.answers?.[user?.uid || ''];
  const allVoted = Object.keys(gameState?.votes || {}).length >= (players.length - 1);
  const allYNAnswered = Object.keys(gameState.answers).length >= players.length;
  let ynMatch = null;
  let myPartnerName = "???";

  if (gameState.mode === 'yn' && allYNAnswered) {
      const myPartnerUid = gameState.pairs?.[user?.uid || ''];
      const myAns = gameState.answers[user?.uid || ''];
      const partnerAns = gameState.answers[myPartnerUid || ''];
      const pObj = players.find(p => p.uid === myPartnerUid);
      if(pObj) myPartnerName = pObj.name;
      if(myAns && partnerAns) { ynMatch = myAns === partnerAns; }
  }

  const isRoundFinishedTOrD = (gameState.mode === 'question' || gameState.mode === 'dare') && allVoted;
  const cardStyle = getLevelStyle(card?.level);
  const currentPlayerObj = currentPlayer();

  return (
    <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900 overflow-hidden relative">
      {card?.level === '4' && <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none z-0"></div>}
      <CustomAlert/>
      
      {/* HEADER: GOLD STYLE (Fixed) */}
      <div className="text-center py-4 border-b border-slate-700 mb-4 z-10 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-3">
                {isEditingName ? (
                    <div className="flex gap-2">
                        <input className="bg-slate-800 border border-slate-600 p-2 rounded text-center text-xl font-bold text-white w-48" autoFocus placeholder={userName} value={newName} onChange={(e) => setNewName(e.target.value)} />
                        <button onClick={handleUpdateName} className="bg-green-600 px-3 rounded font-bold">✔</button>
                        <button onClick={() => setIsEditingName(false)} className="bg-red-600 px-3 rounded">✖</button>
                    </div>
                ) : (
                    <>
                        <h1 className="text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-100 to-yellow-600 drop-shadow-md filter backdrop-brightness-150">
                            {userName.toUpperCase()}
                        </h1>
                        <button onClick={() => { setIsEditingName(true); setNewName(userName); }} className="text-yellow-600 hover:text-yellow-200 transition-colors"><Edit2 size={20}/></button>
                    </>
                )}
            </div>
            
            {/* PERSISTENT COUPLE ID */}
            {relationshipStatus === 'couple' && (
                <div className="mt-2 inline-flex items-center justify-center gap-2 bg-slate-800/80 px-4 py-1 rounded-full border border-yellow-500/30 animate-in fade-in slide-in-from-top-1">
                    <Users size={12} className="text-yellow-500"/>
                    <span className="text-yellow-500 text-xs font-bold uppercase">COUPLE:</span>
                    <span className="text-white font-mono font-bold tracking-widest">{coupleNumber}</span>
                </div>
            )}
        </div>

      <ScoreBoard />
      <MyMatchHistory />

      <div className="flex-1 flex flex-col items-center justify-center z-10 relative">
        {isRoundFinishedTOrD ? (
             <div className="bg-slate-800/90 backdrop-blur p-8 rounded-2xl text-center text-white border-2 border-slate-700 w-full max-w-md shadow-2xl">
                <div className="text-2xl font-bold mb-2">Round Finished</div>
                <div className="text-slate-400 animate-pulse">Loading next victim...</div>
            </div>
        ) : (
            <>
                {/* CARD WITH INTERNAL HEADER */}
                <div className={`w-full max-w-md p-8 rounded-3xl border-4 text-center mb-8 transition-all duration-500 ${cardStyle} flex flex-col items-center justify-center min-h-[200px] relative`}>
                    <div className="absolute top-4 left-4 text-xs font-bold opacity-60 uppercase tracking-widest text-white/50">
                        GAME: {gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'}
                    </div>
                    <div className="mb-4 opacity-50">{gameState.mode === 'question' ? <MessageCircle size={32}/> : gameState.mode === 'yn' ? null : <Flame size={32}/>}</div>
                    <h3 className="text-2xl font-bold leading-relaxed drop-shadow-md">{getCardText(card)}</h3>
                </div>

                <div className="w-full max-w-md space-y-4">
                    {!isMyTurn() && gameState.mode !== 'yn' && (
                        <div className="text-center mb-6">
                            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Current Player</div>
                            <div className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 uppercase transition-all animate-pulse`}>{currentPlayerName()}</div>
                        </div>
                    )}
                    {gameState?.mode==='question' && isMyTurn() && (<div className="text-xl font-bold text-center mb-4 text-green-400 animate-pulse bg-green-900/20 py-2 rounded-lg border border-green-500/50">YOUR TURN<br/><span className="text-sm text-white font-normal">Read aloud & Answer!</span></div>)}
                    {gameState?.mode==='question' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (<div className="grid grid-cols-2 gap-4"><button onClick={()=>submitVote('like')} className="bg-gradient-to-b from-green-500 to-green-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><ThumbsUp className="mb-1" size={24}/><span className="font-bold">Good Answer</span></button><button onClick={()=>submitVote('no like')} className="bg-gradient-to-b from-red-500 to-red-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><ThumbsDown className="mb-1" size={24}/><span className="font-bold">Nah..</span></button></div>)}
                    {gameState?.mode==='dare' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (<div className="grid grid-cols-2 gap-4"><button onClick={()=>submitVote('yes')} className="bg-gradient-to-b from-green-500 to-green-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><CheckSquare className="mb-1" size={24}/><span className="font-bold">Completed</span></button><button onClick={()=>submitVote('no')} className="bg-gradient-to-b from-red-500 to-red-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><XCircle className="mb-1" size={24}/><span className="font-bold">Failed</span></button></div>)}
                    {gameState?.mode==='yn' && !playerAnswered && (<div className="grid grid-cols-2 gap-4"><button onClick={()=>submitAnswer('yes')} className="bg-gradient-to-b from-green-500 to-green-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform font-bold text-xl">YES</button><button onClick={()=>submitAnswer('no')} className="bg-gradient-to-b from-red-500 to-red-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform font-bold text-xl">NO</button></div>)}
                    
                    {gameState?.mode==='yn' && allYNAnswered && (
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-2xl border border-slate-600 shadow-xl">
                            <div className="mb-4 text-lg">Partner was: <span className="font-bold text-yellow-400 text-xl block">{myPartnerName}</span></div>
                            {ynMatch === true ? (<div className="animate-bounce"><Smile className="w-24 h-24 text-green-400 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]"/><h3 className="text-4xl font-black text-green-400 tracking-tighter">MATCH!</h3></div>) : (<div className="animate-pulse"><Frown className="w-24 h-24 text-red-500 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"/><h3 className="text-4xl font-black text-red-500 tracking-tighter">MISMATCH!</h3></div>)}
                            <div className="text-slate-500 mt-4 text-xs font-mono">Next round auto-starting...</div>
                        </div>
                    )}
                    
                    {((gameState?.mode==='question' && !isMyTurn() && gameState?.votes?.[user?.uid || '']) || (gameState?.mode==='dare' && !isMyTurn() && gameState?.votes?.[user?.uid || '']) || (gameState?.mode==='yn' && playerAnswered && !allYNAnswered)) && (
                        <div className="text-center p-4 bg-slate-800/50 rounded-xl"><div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full mb-2"></div><div className="text-slate-400 text-sm">Waiting for others...</div></div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
}