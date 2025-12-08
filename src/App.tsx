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
  MessageCircle, RefreshCw, HelpCircle, X, Edit2, UserX, BookOpen, Send
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
  // Auto Mode Fields
  isAutoMode?: boolean;
  sequence?: string[]; 
  sequenceIndex?: number;
  matchHistory?: HistoryEntry[];
  nextType?: string; 
}

// --- COMPONENTES DE AYUDA (ADMIN VS PLAYER) ---

const HelpModal = ({ onClose, type }: { onClose: () => void, type: 'admin' | 'player' }) => (
  <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
    <div className="bg-slate-800 rounded-2xl border border-slate-600 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative shadow-2xl animate-in fade-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
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
                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Flame className="text-orange-500"/> The Game Concept</h3>
                <p className="mb-2 leading-relaxed">
                  **Sexy Game** is a high-energy social game designed to test boundaries, honesty, and compatibility. As the Admin, you control the flow. The game revolves around earning points by completing challenges or matching answers with a partner.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                   <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                      <strong className="text-blue-400 block mb-2 text-lg">1. Truth (Verdad)</strong>
                      <p className="text-sm">The player must answer a question honestly. Other players vote "Good Answer" or "Punish".</p>
                      <em className="text-xs text-slate-500 block mt-2">Example: "What is your biggest sexual regret?"</em>
                   </div>
                   <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                      <strong className="text-pink-400 block mb-2 text-lg">2. Dare (Reto)</strong>
                      <p className="text-sm">Physical or social actions. The player must perform it to get points.</p>
                      <em className="text-xs text-slate-500 block mt-2">Example: "Let the person to your right check your browser history."</em>
                   </div>
                   <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                      <strong className="text-green-400 block mb-2 text-lg">3. Match/Mismatch</strong>
                      <p className="text-sm">The system pairs two people (secretly). A question appears (e.g., "Would you kiss?"). Both answer YES/NO secretly. If they match, they score!</p>
                   </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Settings className="text-gray-400"/> Technical Setup</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Uploading Questions:</strong> You must upload CSV files.
                    <br/><code className="text-xs bg-slate-950 p-1 rounded text-green-300">Truth/Dare Header: text, level, type, sexo</code> (Note: 'type' must be T or D. 'sexo' must be F, M or B).
                    <br/><code className="text-xs bg-slate-950 p-1 rounded text-green-300">Match Header: male, female, level</code> (Male question column and Female question column).
                  </li>
                  <li><strong>Game Code:</strong> Set a simple code (e.g., "PARTY") and tell players to enter it. This links everyone to your screen.</li>
                  <li><strong>Bot System:</strong> If you have an odd number of players (e.g., 7), the system automatically adds a Bot (like "Brad Pitt") to ensure everyone has a partner during Match/Mismatch rounds.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Zap className="text-yellow-400"/> Managing the Game</h3>
                <p className="mb-2"><strong>Risk Levels (1-4):</strong> Use this to control the "heat". Start with Level 1 (Icebreakers) and move to Level 4 (Extreme) as the night progresses.</p>
                <p className="mb-2"><strong>Auto vs. Manual:</strong>
                    <br/>- <em>Manual:</em> You pick "Next is Truth, Level 3". Best for control.
                    <br/>- <em>Auto:</em> You define a loop (e.g., 2 Truths, 1 Match). The game runs itself.
                </p>
                <div className="bg-red-900/20 p-4 rounded border border-red-500/50 mt-4">
                    <strong className="text-red-400">⚠️ Reset vs Kick Player</strong>
                    <ul className="list-disc pl-5 mt-1 text-sm">
                        <li><strong>Kick (Trash Icon in Scoreboard):</strong> Removes ONE player. Use this if someone leaves early.</li>
                        <li><strong>RESET ALL (Bottom Button):</strong> Wipes EVERYTHING (Score, Players, History). Only use this when starting a completely new game with new people.</li>
                    </ul>
                </div>
              </section>
            </>
          )}

          {/* --- MANUAL DE JUGADOR --- */}
          {type === 'player' && (
            <>
               <section>
                <h3 className="text-xl font-bold text-white mb-3">👋 How to Join</h3>
                <ol className="list-decimal pl-5 space-y-3">
                    <li><strong>Name:</strong> Enter your nickname.</li>
                    <li><strong>Gender:</strong> Select Male or Female (this affects which questions you get).</li>
                    <li><strong>Couple Number:</strong> <span className="text-yellow-400">Important!</span> This is used to identify existing real-life couples.
                        <br/><span className="text-sm text-slate-400">If you are here with a partner, enter the <strong>Last 4 digits of the Male's phone number</strong> (or any shared secret number). If you are single, enter a random number like 1234.</span>
                    </li>
                    <li><strong>Game Code:</strong> Ask the Admin (Game Master) for the code.</li>
                </ol>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-3">🎮 How to Play</h3>
                <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-lg">
                        <strong className="text-blue-400">When it's your turn (Truth/Dare):</strong>
                        <p className="text-sm mt-1">Your phone will turn green. Read the question aloud to the group! Then answer it or do the dare. The group will vote if you passed or failed.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                        <strong className="text-green-400">Match/Mismatch Rounds:</strong>
                        <p className="text-sm mt-1">The system will pair you with someone random. A question will appear on your screen (e.g., "Would we make a good couple?").</p>
                        <p className="text-sm mt-1">Answer <strong>YES</strong> or <strong>NO</strong> honestly. You only get points if your answer <strong>MATCHES</strong> your partner's answer!</p>
                    </div>
                </div>
              </section>
            </>
          )}

        </div>
        
        <div className="mt-8 text-center border-t border-slate-700 pt-6">
          <button onClick={onClose} className="bg-blue-600 px-8 py-3 rounded-xl font-bold text-white hover:bg-blue-500 shadow-lg transition-transform active:scale-95">
            Close Manual
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default function TruthAndDareApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [gender, setGender] = useState('male');
  const [coupleNumber, setCoupleNumber] = useState('');
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
  
  // Modal States
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [showPlayerHelp, setShowPlayerHelp] = useState(false);

  // Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // MANAGER STATES
  const [isManaging, setIsManaging] = useState(false);
  const [managerTab, setManagerTab] = useState<'td' | 'mm'>('td');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: keyof Challenge, direction: 'asc' | 'desc'} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const selectionMode = useRef<'add' | 'remove'>('add');
    
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
      case '4': return 'border-red-600 bg-red-950/40 shadow-[0_0_30px_rgba(220,38,38,0.3)]'; // Extremo
      case '3': return 'border-orange-500 bg-orange-950/40 shadow-[0_0_20px_rgba(249,115,22,0.3)]'; // Picante
      case '2': return 'border-yellow-500 bg-yellow-950/40'; // Intermedio
      case '1': return 'border-green-500 bg-green-950/40'; // Suave
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

  useEffect(() => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GameState;
        setGameState(data);
        
        // Sincronizar Setup Local con Global
        if (data.isAutoMode !== undefined) setIsAutoSetup(data.isAutoMode);
        
        // Sincronizar selectores si vienen del estado global
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

  const handleUpdateName = async () => {
    if (!newName.trim() || !user) return;
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), { name: newName });
        setUserName(newName);
        localStorage.setItem('td_username', newName);
        setIsEditingName(false);
    } catch (e) {
        showError("Could not update name.");
    }
  };

  const handleKickPlayer = async (uid: string, name: string) => {
      if(confirm(`Reset player ${name}?`)) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid));
      }
  };

  // --- GAME LOGIC ---

  const joinGame = async () => {
    if (!userName.trim() || !user) return;
    localStorage.setItem('td_username', userName);
    if (userName.toLowerCase() === 'admin') { setIsAdmin(true); return; }
    if (!gender || !code || !coupleNumber) return;
    if (code !== gameState?.code) { showError('Invalid code'); return; }

    const existingPartner = players.find(p => p.coupleNumber === coupleNumber && p.gender === gender && p.uid !== user.uid);
    if (existingPartner) {
        if (confirm(`User ${existingPartner.name} is already registered with Couple ID ${coupleNumber} (${gender}). Do you want to RESET this slot and join?`)) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', existingPartner.uid));
        } else {
            return;
        }
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
      uid: user.uid, name: userName, gender, coupleNumber, joinedAt: serverTimestamp(), isActive: true, isBot: false, matches: 0, mismatches: 0
    });
  };

  const setGameCode = async () => {
    if (!code.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { code: code });
  };

  const updateGlobalLevel = async (newLvl: string) => {
    setSelectedLevel(newLvl);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { roundLevel: newLvl });
  };

  const updateGlobalType = async (newType: string) => {
    setSelectedType(newType);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { nextType: newType });
  };

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
    const { total } = checkPendingSettings();
    if (total > 0) {
        showError(`Cannot start! There are ${total} questions without Level/Type/Gender set.`);
        return;
    }

    const realPlayers = players.filter(p => !p.isBot);
    if (realPlayers.length % 2 !== 0) {
        const males = realPlayers.filter(p => p.gender === 'male').length;
        const females = realPlayers.filter(p => p.gender === 'female').length;
        let botName = "Brad Pitt";
        let botGender = "male";
        if (males > females) { botName = "Scarlett Johansson"; botGender = "female"; }
        
        const botUid = 'bot_' + Date.now();
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', botUid), {
            uid: botUid, name: botName, gender: botGender, coupleNumber: '999', joinedAt: serverTimestamp(), isActive: true, isBot: true, matches: 0, mismatches: 0
        });
        showError(`Odd number of players. Added bot: ${botName}!`);
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup', matchHistory: [] });
  };

  const computePairs = () => {
    const pairs: Record<string, string> = {}; 
    const males = players.filter(p => p.gender === 'male');
    const females = players.filter(p => p.gender === 'female');
    const shuffledMales = [...males].sort(() => Math.random() - 0.5);
    const shuffledFemales = [...females].sort(() => Math.random() - 0.5);
    const assignedFemales = new Set<string>();

    shuffledMales.forEach(male => {
        let partner = shuffledFemales.find(f => !assignedFemales.has(f.uid) && f.coupleNumber !== male.coupleNumber);
        if (!partner) partner = shuffledFemales.find(f => !assignedFemales.has(f.uid));
        if (partner) {
            pairs[male.uid] = partner.uid;
            pairs[partner.uid] = male.uid;
            assignedFemales.add(partner.uid);
        }
    });
    return pairs;
  };

  // GENERO LOGIC: pasamos el género del jugador actual
  const startRound = async () => {
    let sequence: string[] = [];
    if (isAutoSetup) {
        for(let i=0; i<qtyTruth; i++) sequence.push('question');
        for(let i=0; i<qtyDare; i++) sequence.push('dare');
        for(let i=0; i<qtyMM; i++) sequence.push('yn');
    }

    let initialMode = isAutoSetup && sequence.length > 0 ? sequence[0] : (selectedType === 'yn' ? 'yn' : selectedType === 'truth' ? 'question' : 'dare');
    let typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';

    const firstPlayerGender = players.length > 0 ? players[0].gender : 'male';
    const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel, firstPlayerGender);
    
    if (!nextChallenge) { showError('No challenges found for this selection.'); return; }

    let initialAnswers: Record<string, string> = {};
    if (initialMode === 'yn') {
        players.filter(p => p.isBot).forEach(b => {
            initialAnswers[b.uid] = Math.random() > 0.5 ? 'yes' : 'no';
        });
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

  const submitAnswer = async (val: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`answers.${user.uid}`]: val });
  };

  const submitVote = async (vote: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { [`votes.${user.uid}`]: vote });
  };

  // GENERO LOGIC: filtramos segun playerGender
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

          // LOGICA DE FILTRO DE GÉNERO
          if (type !== 'YN') {
             validDocs = validDocs.filter(d => {
                 const data = d.data();
                 const qSex = (data.sexo || 'B').toUpperCase();
                 if (qSex === 'B') return true; 
                 if (playerGender === 'male') {
                     return qSex !== 'F'; // Si soy Hombre, NO quiero preguntas marcadas 'F'
                 } else {
                     return qSex !== 'M'; // Si soy Mujer, NO quiero preguntas marcadas 'M'
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
    if (!gameState) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
    let updates: any = {};
    const points = { ...(gameState.points || {}) };
    const batch = writeBatch(db); 
     
    // 1. SUMAR PUNTOS
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
            if (isMatch) {
              points[uid1] = (points[uid1] || 0) + 1;
              points[uid2] = (points[uid2] || 0) + 1;
            }
            if (p1 && p2) {
                currentHistory.push({
                    u1: uid1, u2: uid2, 
                    name1: p1.name, name2: p2.name,
                    result: isMatch ? 'match' : 'mismatch',
                    timestamp: Date.now()
                });
            }

            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid1), { 
                matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) 
            });
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid2), { 
                matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) 
            });
        }
      });
      updates.matchHistory = currentHistory;
      await batch.commit(); 
    }
    updates.points = points;

    // 2. LOGICA DE NAVEGACION
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
            } else {
                roundFinished = true;
            }
        } else {
            roundFinished = true;
        }
    }

    if (roundFinished) {
        if (gameState.isAutoMode && gameState.sequence) {
            let nextSeqIdx = (gameState.sequenceIndex || 0) + 1;
            if (nextSeqIdx >= gameState.sequence.length) {
                nextSeqIdx = 0; 
            }

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
                    players.filter(p => p.isBot).forEach(b => {
                        updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no';
                    });
                }
                const coll = mode === 'yn' ? 'pairChallenges' : 'challenges';
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
            } else {
                updates.mode = 'admin_setup'; 
            }
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
  const handleSort = (key: keyof Challenge) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };
  const handleRowMouseDown = (id: string, e: React.MouseEvent) => {
      setIsDragging(true);
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) { newSet.delete(id); selectionMode.current = 'remove'; } else { newSet.add(id); selectionMode.current = 'add'; }
      setSelectedIds(newSet);
  };
  const handleRowMouseEnter = (id: string) => {
      if (isDragging) {
          const newSet = new Set(selectedIds);
          if (selectionMode.current === 'add') newSet.add(id); else newSet.delete(id);
          setSelectedIds(newSet);
      }
  };
  const toggleSelectAll = (filteredData: Challenge[]) => {
      if (selectedIds.size === filteredData.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredData.map(c => c.id!)));
  };
  const updateSingleField = async (collectionName: string, id: string, field: string, value: string | boolean) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id), { [field]: value });
  };
  const applyBulkEdit = async () => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'td' ? 'challenges' : 'pairChallenges';
      if (!confirm(`Update ${selectedIds.size}?`)) return;
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id);
          const updates: any = {};
          if (bulkLevel) updates.level = bulkLevel;
          if (managerTab === 'td' && bulkGender) updates.sexo = bulkGender;
          batch.update(ref, updates);
      });
      await batch.commit();
      setBulkLevel(''); setBulkGender(''); setSelectedIds(new Set());
  };
  const deleteSelected = async () => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'td' ? 'challenges' : 'pairChallenges';
      if (!confirm(`Delete ${selectedIds.size}?`)) return;
      const batch = writeBatch(db);
      selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.delete(ref); });
      await batch.commit(); setSelectedIds(new Set());
  };
  const bulkPause = async (pauseStatus: boolean) => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'td' ? 'challenges' : 'pairChallenges';
      const batch = writeBatch(db);
      selectedIds.forEach(id => { const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id); batch.update(ref, { paused: pauseStatus }); });
      await batch.commit(); setSelectedIds(new Set());
  };
  const checkPendingSettings = () => {
      const pendingTD = challenges.filter(c => !c.level || !c.type || !c.sexo).length;
      const pendingMM = pairChallenges.filter(c => !c.level).length;
      return { pendingTD, pendingMM, total: pendingTD + pendingMM };
  };
  const handleExportCSV = (isTemplate: boolean) => {
      const isTD = managerTab === 'td';
      const headers = isTD ? "text,level,type,sexo" : "male,female,level";
      let csvContent = "data:text/csv;charset=utf-8," + headers + "\n";
      if (!isTemplate) {
          const data = isTD ? challenges : pairChallenges;
          data.forEach(row => {
              if (isTD) {
                  const safeText = `"${(row.text || '').replace(/"/g, '""')}"`;
                  csvContent += `${safeText},${row.level||''},${row.type||''},${row.sexo||''}\n`;
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
      const lines = text.split('\n');
      const header = lines[0].toLowerCase();
      if (!header.includes('text') && !header.includes('pregunta')) { if(!confirm("Header 'text' missing. Upload?")) return; }
      if (lines.length > 1) { const r1 = lines[1]; if (r1.split(',').length > 2 && !r1.includes('"')) { if(!confirm("Multi-column detected. Continue?")) return; } }
      setUploading(true);
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
      const batch = writeBatch(db);
      lines.slice(1).forEach(line => {
          if(!line.trim()) return;
          const cleanText = line.trim().replace(/^"|"$/g, ''); 
          const docRef = doc(ref);
          batch.set(docRef, { text: cleanText, level: '', type: fixedType, sexo: '', answered: false, paused: false });
      });
      await batch.commit(); setUploading(false); showError(`Uploaded ${fixedType} questions.`);
  };
  const handleUploadDoubleCol = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if(!file) return;
      const text = await file.text();
      const lines = text.split('\n');
      const header = lines[0].toLowerCase();
      if (!['male', 'female', 'hombre', 'mujer'].some(h => header.includes(h))) { if(!confirm("Header missing. Upload?")) return; }
      setUploading(true);
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
      const batch = writeBatch(db);
      lines.slice(1).forEach(line => {
          if(!line.trim()) return;
          const parts = line.split(',');
          if (parts.length < 2) return;
          const male = parts[0].trim().replace(/^"|"$/g, '');
          const female = parts.slice(1).join(',').trim().replace(/^"|"$/g, '');
          const docRef = doc(ref);
          batch.set(docRef, { male, female, level: '', answered: false, paused: false });
      });
      await batch.commit(); setUploading(false); showError(`Uploaded pairs.`);
  };
  const handleEndGame = async () => { if(confirm('End game?')) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'ended' }); };
  const handleRestart = async () => { if(confirm('Restart?')) { 
        const batch = writeBatch(db);
        (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'players'))).forEach(d=>batch.delete(d.ref));
        (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'challenges'))).forEach(d=>batch.update(d.ref, {answered:false}));
        (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges'))).forEach(d=>batch.update(d.ref, {answered:false}));
        batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', adminUid: null, matchHistory: [] });
        await batch.commit();
  }};

  const currentPlayerName = () => gameState && players.length > 0 ? players[gameState?.currentTurnIndex]?.name : 'Nobody';
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
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-slate-800 p-6 rounded-xl border border-red-500 max-w-sm text-center">
              <AlertTriangle className="mx-auto text-red-500 mb-2" size={40}/>
              <p className="text-white mb-4">{customError}</p>
              <button onClick={closeError} className="bg-red-600 px-6 py-2 rounded font-bold">OK</button>
          </div>
      </div>
  ) : null;

  // NUEVO COMPONENTE: HISTORIAL AGRUPADO
  const MyMatchHistory = () => {
      const myUid = user?.uid;
      const history = gameState?.matchHistory || [];
      
      const stats: Record<string, {name: string, m: number, um: number}> = {};

      history.forEach(h => {
          if (h.u1 !== myUid && h.u2 !== myUid) return;

          const isU1 = h.u1 === myUid;
          const partnerName = isU1 ? h.name2 : h.name1;
          const partnerUid = isU1 ? h.u2 : h.u1;

          if (!stats[partnerUid]) {
              stats[partnerUid] = { name: partnerName, m: 0, um: 0 };
          }

          if (h.result === 'match') {
              stats[partnerUid].m += 1;
          } else {
              stats[partnerUid].um += 1;
          }
      });

      if (Object.keys(stats).length === 0) return null;

      return (
          <div className="w-full bg-slate-800 p-2 mt-4 rounded-lg max-h-40 overflow-y-auto border border-slate-700">
              <div className="text-xs text-slate-400 mb-1 uppercase font-bold text-center">My Interactions</div>
              <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-600 text-slate-400">
                        <th className="text-left py-1">Name</th>
                        <th className="text-center py-1 text-green-400">Match</th>
                        <th className="text-center py-1 text-red-400">Unmatch</th>
                    </tr>
                </thead>
                <tbody>
                  {Object.values(stats).map((s, idx) => (
                      <tr key={idx} className="border-b border-slate-700/50">
                          <td className="py-1 font-bold">{s.name}</td>
                          <td className="py-1 text-center font-bold text-green-400">{s.m}</td>
                          <td className="py-1 text-center font-bold text-red-400">{s.um}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
          </div>
      );
  };

  const ScoreBoard = () => (
      <div className="w-full bg-slate-800 p-2 mb-4 rounded-lg flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-slate-700">
          <div className="w-full text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider flex justify-between">
              <span>Scoreboard</span><span>Players: {players.length}</span>
          </div>
          {players.map(p => (
              <div key={p.uid} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${p.isBot ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-700/50'}`}>
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="text-yellow-400 font-bold ml-auto">{gameState?.points?.[p.uid] || 0}</span>
                  {/* ADMIN KICK BUTTON IN SCOREBOARD */}
                  {isAdmin && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleKickPlayer(p.uid, p.name); }}
                        className="ml-2 text-red-500 hover:text-red-300"
                        title="Reset Player"
                    >
                        <Trash2 size={12}/>
                    </button>
                  )}
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

        {/* Player Login Help Button */}
        <button 
          onClick={() => setShowPlayerHelp(true)} 
          className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-blue-400 transition-all"
        >
          <HelpCircle size={24} />
        </button>

        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-purple-500/30 text-center shadow-2xl">
          <Flame className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-6 tracking-widest">SEXY GAME</h1>
          
          <input type="text" placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none" value={userName} onChange={e=>setUserName(e.target.value)} />
          <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none"><option value="male">Male</option><option value="female">Female</option></select>
          <input type="number" placeholder="Couple ID (e.g. 1234)" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none" value={coupleNumber} onChange={e=>setCoupleNumber(e.target.value)} />
          {userName.toLowerCase()!=='admin' && <input type="text" placeholder="Game Code" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-purple-500 outline-none" value={code} onChange={e=>setCode(e.target.value)} />}
          <button onClick={joinGame} disabled={!userName.trim()} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform">Enter Game</button>
        </div>
      </div>
    );
  }

  // --- MANAGER RENDER ---
  if (isAdmin && isManaging) {
      const data = managerTab === 'td' ? challenges : pairChallenges;
      let displayedData = showPendingOnly ? (managerTab === 'td' ? data.filter(c => !c.level || !c.type || !c.sexo) : data.filter(c => !c.level)) : data;
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
      const collectionName = managerTab === 'td' ? 'challenges' : 'pairChallenges';

      return (
        <div className="min-h-screen p-4 text-white bg-slate-900 flex flex-col" onMouseUp={()=>setIsDragging(false)}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Settings/> Content Manager</h2>
                <button onClick={()=>setIsManaging(false)} className="bg-red-600 px-3 py-1 rounded text-sm">Back</button>
            </div>
            <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
                <button onClick={()=>setManagerTab('td')} className={`px-4 py-2 rounded ${managerTab==='td' ? 'bg-blue-600' : 'bg-slate-700'}`}>Truth/Dare</button>
                <button onClick={()=>setManagerTab('mm')} className={`px-4 py-2 rounded ${managerTab==='mm' ? 'bg-pink-600' : 'bg-slate-700'}`}>Match/Mismatch</button>
            </div>
            <div className="bg-slate-800 p-3 rounded-xl mb-4 flex flex-wrap gap-3 items-end text-sm">
                <div className="flex flex-col"><label className="text-xs text-slate-400">Set Level</label><select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkLevel} onChange={e=>setBulkLevel(e.target.value)}><option value="">-</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div>
                {managerTab === 'td' && (<div className="flex flex-col"><label className="text-xs text-slate-400">Set Gender</label><select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkGender} onChange={e=>setBulkGender(e.target.value)}><option value="">-</option><option value="F">Female</option><option value="B">Both</option></select></div>)}
                <button onClick={applyBulkEdit} disabled={selectedIds.size === 0} className="bg-green-600 px-3 py-1 rounded font-bold disabled:opacity-50">Apply ({selectedIds.size})</button>
                <button onClick={()=>bulkPause(true)} disabled={selectedIds.size === 0} className="bg-yellow-600 px-3 py-1 rounded disabled:opacity-50" title="Pause"><PauseCircle size={16}/></button>
                <button onClick={()=>bulkPause(false)} disabled={selectedIds.size === 0} className="bg-green-700 px-3 py-1 rounded disabled:opacity-50" title="Resume"><PlayCircle size={16}/></button>
                <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="bg-red-600 px-3 py-1 rounded font-bold flex items-center gap-2 disabled:opacity-50"><Trash2 size={16}/> Delete</button>
                <button onClick={()=>toggleSelectAll(displayedData)} className="bg-slate-600 px-3 py-1 rounded flex items-center gap-1">{selectedIds.size === displayedData.length ? <CheckSquare size={14}/> : <Square size={14}/>} All</button>
                <button onClick={()=>setShowPendingOnly(!showPendingOnly)} className={`ml-auto px-3 py-1 rounded flex items-center gap-1 ${showPendingOnly ? 'bg-yellow-600' : 'bg-slate-600'}`}><Filter size={14}/> Needs Setup</button>
            </div>
            <div className="flex gap-2 mb-2 justify-end text-xs">
                <button onClick={()=>handleExportCSV(false)} className="bg-blue-600 px-3 py-1 rounded flex items-center gap-1"><Download size={14}/> Export Data</button>
                <button onClick={()=>handleExportCSV(true)} className="bg-slate-600 px-3 py-1 rounded flex items-center gap-1"><FileSpreadsheet size={14}/> Template</button>
            </div>
            
            {/* TABLE CONTAINER: SCROLLABLE */}
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-700 rounded-xl" onMouseLeave={()=>setIsDragging(false)}>
                <table className="w-full text-left text-xs select-none min-w-[800px]">
                    <thead className="bg-slate-800 text-slate-400 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 w-8 text-center"><input type="checkbox" onChange={()=>toggleSelectAll(displayedData)} checked={selectedIds.size === displayedData.length && displayedData.length > 0} /></th>
                            <th className="p-2 w-8 text-center"></th>
                            <th className="p-2 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('level')}>Level <ArrowUpDown size={12} className="inline"/></th>
                            {managerTab === 'td' && <th className="p-2 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('type')}>Type <ArrowUpDown size={12} className="inline"/></th>}
                            {managerTab === 'td' && <th className="p-2 cursor-pointer hover:text-white whitespace-nowrap" onClick={()=>handleSort('sexo')}>Gender <ArrowUpDown size={12} className="inline"/></th>}
                            {managerTab === 'td' ? <th className="p-2 cursor-pointer hover:text-white min-w-[300px]" onClick={()=>handleSort('text')}>Text <ArrowUpDown size={12} className="inline"/></th> : <><th className="p-2 cursor-pointer hover:text-white min-w-[200px]" onClick={()=>handleSort('male')}>Male Question <ArrowUpDown size={12} className="inline"/></th><th className="p-2 cursor-pointer hover:text-white min-w-[200px]" onClick={()=>handleSort('female')}>Female Question <ArrowUpDown size={12} className="inline"/></th></>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {displayedData.map(c => (
                            <tr key={c.id} className={`cursor-pointer transition-colors ${c.paused ? 'text-red-400' : ''} ${selectedIds.has(c.id!) ? 'bg-blue-900/50' : 'hover:bg-slate-800'}`} onMouseDown={(e)=>handleRowMouseDown(c.id!, e)} onMouseEnter={()=>handleRowMouseEnter(c.id!)}>
                                <td className="p-2 text-center"><input type="checkbox" checked={selectedIds.has(c.id!)} readOnly /></td>
                                <td className="p-2 text-center" onMouseDown={(e)=>e.stopPropagation()}><button onClick={()=>updateSingleField(collectionName, c.id!, 'paused', !c.paused)}>{c.paused ? <PauseCircle size={16}/> : <PlayCircle size={16} className="text-green-500"/>}</button></td>
                                <td className="p-2">{c.level || <span className="text-red-500">?</span>}</td>
                                {managerTab === 'td' && <td className="p-2">{c.type || <span className="text-red-500">?</span>}</td>}
                                {managerTab === 'td' && <td className="p-2">{c.sexo || <span className="text-red-500">?</span>}</td>}
                                {managerTab === 'td' ? (<td className="p-2" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none" value={c.text || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'text', e.target.value)}/></td>) : (<><td className="p-2" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none" value={c.male || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'male', e.target.value)}/></td><td className="p-2" onMouseDown={(e)=>e.stopPropagation()}><input className="bg-transparent w-full border-b border-transparent focus:border-blue-500 outline-none" value={c.female || ''} onChange={(e)=>updateSingleField(collectionName, c.id!, 'female', e.target.value)}/></td></>)}
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
    if (!gameState || gameState?.mode === 'lobby') {
        const { total } = checkPendingSettings();
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900 relative">
              {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
              
              <button 
                onClick={() => setShowAdminHelp(true)} 
                className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-yellow-500 transition-all"
                title="Help / Manual"
              >
                <HelpCircle size={24} />
              </button>

              <CustomAlert/>
              <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              <h2 className="text-2xl font-bold mb-4">Lobby ({players.length})</h2>
              
              <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm mb-6 border border-slate-700">
                {players.length === 0 && <span className="text-slate-500 text-sm">No players yet.</span>}
                {players.map(p=>(
                    <div key={p.uid} className={`flex justify-between items-center py-1 ${p.isBot?'text-purple-400':''}`}>
                        <span>{p.name} {p.isBot && '(Bot)'}</span>
                        <button onClick={()=>handleKickPlayer(p.uid, p.name)} className="text-red-500 hover:text-red-300" title="Reset Player"><UserX size={16}/></button>
                    </div>
                ))}
              </div>

              <input type="text" placeholder="Set Code" className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white focus:border-blue-500 outline-none" value={code} onChange={e=>setCode(e.target.value)} />
              
              {/* BUTTON SEND CODE - VISIBLE CLICK */}
              <button onClick={setGameCode} className="w-full max-w-sm bg-blue-600 p-3 rounded-lg font-bold mb-4 shadow-lg active:scale-95 transition-transform duration-100 flex items-center justify-center gap-2 hover:bg-blue-500">
                  <Send size={18}/> Set Code
              </button>
              
              <div className="flex flex-col gap-2 w-full max-w-sm mb-2">
                  <div className="flex gap-2">
                      <label className="flex-1 bg-blue-900/50 border border-blue-500 p-3 rounded text-center text-xs cursor-pointer hover:bg-blue-800 transition"><Upload size={14} className="inline mr-1"/> Upload Truth (1 Col) <input type="file" className="hidden" onChange={(e)=>handleUploadSingleCol(e, 'T')}/></label>
                      <label className="flex-1 bg-pink-900/50 border border-pink-500 p-3 rounded text-center text-xs cursor-pointer hover:bg-pink-800 transition"><Upload size={14} className="inline mr-1"/> Upload Dare (1 Col) <input type="file" className="hidden" onChange={(e)=>handleUploadSingleCol(e, 'D')}/></label>
                  </div>
                  <label className="w-full bg-green-900/50 border border-green-500 p-3 rounded text-center text-xs cursor-pointer hover:bg-green-800 transition"><Upload size={14} className="inline mr-1"/> Upload Match/Mismatch (2 Col) <input type="file" className="hidden" onChange={handleUploadDoubleCol}/></label>
              </div>
              
              <button onClick={()=>setIsManaging(true)} className="w-full max-w-sm bg-slate-700 p-3 rounded-lg font-bold mb-4 flex items-center justify-center gap-2 border border-slate-600 hover:bg-slate-600 relative">
                  <Settings size={18}/> Manage Questions
                  {total > 0 && <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
              </button>
              
              {uploading && <div className="text-yellow-400 mb-2">Uploading...</div>}
              
              {total > 0 ? (
                  <div className="bg-red-900/50 p-3 rounded text-center text-sm mb-4 border border-red-500">
                      <AlertTriangle className="inline mr-2" size={16}/>
                      Complete setup for {total} questions to start.
                  </div>
              ) : (
                  <button onClick={startGame} className="w-full max-w-sm bg-green-600 p-3 rounded-lg font-bold hover:bg-green-500 transition shadow-lg active:scale-95">Start Game</button>
              )}
              
              <button onClick={handleRestart} className="w-full max-w-sm bg-red-600 p-3 rounded-lg font-bold mt-4 hover:bg-red-500 transition shadow-lg active:scale-95">Reset All</button>
            </div>
        );
    }

    if (gameState?.mode === 'admin_setup') {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900 relative">
                {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
                <button 
                  onClick={() => setShowAdminHelp(true)} 
                  className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-yellow-500 transition-all"
                  title="Help / Manual"
                >
                  <HelpCircle size={24} />
                </button>

                <h2 className="text-2xl font-bold mb-4">Setup Round</h2>
                <ScoreBoard />
                
                {/* AUTO MODE SWITCH & TITLE */}
                <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-400 uppercase font-bold">Game Mode</div>
                        <div className={`font-black text-xl ${isAutoSetup ? 'text-green-400' : 'text-blue-400'}`}>
                            {isAutoSetup ? 'AUTOMATIC' : 'MANUAL'}
                        </div>
                    </div>
                    <button 
                        onClick={()=>setIsAutoSetup(!isAutoSetup)} 
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isAutoSetup ? 'bg-green-600' : 'bg-slate-600'}`}
                    >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAutoSetup ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* OPTIONS FOR AUTO MODE */}
                {isAutoSetup ? (
                    <div className="flex gap-2 w-full max-w-md bg-slate-800 p-3 rounded-lg border border-slate-700 mb-4 animate-in fade-in">
                        <div className="flex-1 text-center"><div className="text-xs text-blue-400">Truth</div><input type="number" className="w-full bg-slate-900 text-center border border-slate-600 rounded p-1" value={qtyTruth} onChange={e=>setQtyTruth(parseInt(e.target.value))}/></div>
                        <div className="flex-1 text-center"><div className="text-xs text-pink-400">Dare</div><input type="number" className="w-full bg-slate-900 text-center border border-slate-600 rounded p-1" value={qtyDare} onChange={e=>setQtyDare(parseInt(e.target.value))}/></div>
                        <div className="flex-1 text-center"><div className="text-xs text-green-400">Match/Mismatch</div><input type="number" className="w-full bg-slate-900 text-center border border-slate-600 rounded p-1" value={qtyMM} onChange={e=>setQtyMM(parseInt(e.target.value))}/></div>
                    </div>
                ) : (
                  /* OPTIONS FOR MANUAL MODE */
                  <div className="w-full max-w-md space-y-3 mb-4">
                      {/* Risk Level Selector */}
                      <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-600">
                          <span className="font-bold text-sm text-slate-300 pl-2">Risk Level</span>
                          <select 
                             value={selectedLevel} 
                             onChange={e=>updateGlobalLevel(e.target.value)} 
                             className="bg-slate-900 border border-slate-600 rounded p-1 text-white text-sm w-32"
                          >
                             <option value="">Select</option>
                             {uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}
                          </select>
                      </div>

                      {/* Game Type Selector */}
                      <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-600">
                          <span className="font-bold text-sm text-slate-300 pl-2">Game Type</span>
                          <select 
                             value={selectedType} 
                             onChange={e=>updateGlobalType(e.target.value)} 
                             className="bg-slate-900 border border-slate-600 rounded p-1 text-white text-sm w-32"
                          >
                              <option value="">Select</option>
                              <option value="truth">Truth</option>
                              <option value="dare">Dare</option>
                              <option value="yn">Match/Mismatch</option>
                          </select>
                      </div>
                  </div>
                )}
                
                {isAutoSetup && (
                  <select value={selectedLevel} onChange={e=>updateGlobalLevel(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Level</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
                )}

                <button onClick={startRound} disabled={!selectedLevel || (!isAutoSetup && !selectedType)} className="w-full max-w-md bg-green-600 p-3 rounded-lg font-bold">
                    {isAutoSetup ? 'Start Auto Sequence' : 'Start Round'}
                </button>
                <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset All</button>
            </div>
        );
    }

    const card = currentCard();
    const answers = gameState?.answers || {};
    return (
      <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900 relative">
        {showAdminHelp && <HelpModal onClose={() => setShowAdminHelp(false)} type="admin" />}
        <button 
          onClick={() => setShowAdminHelp(true)} 
          className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-yellow-500 transition-all z-50"
          title="Help / Manual"
        >
          <HelpCircle size={24} />
        </button>

        <ScoreBoard />
        <div className="flex justify-between items-center mb-6 mt-4"><div className="flex gap-2 font-bold text-lg"><Zap className="text-yellow-400"/> {gameState?.mode?.toUpperCase()} (Admin)</div><div className="text-sm text-slate-400">Turn: {currentPlayerName()}</div></div>
        
        {/* CONTROLES EN VIVO */}
        <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl mb-4 border border-slate-600 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                 <div>
                    <div className="text-xs text-slate-400 uppercase font-bold">Current Mode</div>
                    <div className={`font-black text-lg ${gameState?.isAutoMode ? 'text-green-400' : 'text-blue-400'}`}>
                        {gameState?.isAutoMode ? 'AUTOMATIC' : 'MANUAL'}
                    </div>
                 </div>
                 <button 
                    onClick={toggleAutoMode} 
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${gameState?.isAutoMode ? 'bg-green-600' : 'bg-slate-600'}`}
                 >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${gameState?.isAutoMode ? 'translate-x-7' : 'translate-x-1'}`} />
                 </button>
            </div>
            
            <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400 font-bold uppercase">Level:</span>
                <select 
                    value={selectedLevel} 
                    onChange={e=>updateGlobalLevel(e.target.value)} 
                    className="bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm w-36"
                >
                    {uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {!gameState?.isAutoMode && (
                <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-sm text-slate-400 font-bold uppercase">Next Type:</span>
                    <select 
                        value={selectedType} 
                        onChange={e=>updateGlobalType(e.target.value)} 
                        className="bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm w-36"
                    >
                        <option value="truth">Truth</option>
                        <option value="dare">Dare</option>
                        <option value="yn">Match/Mismatch</option>
                    </select>
                </div>
            )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-full max-w-md p-8 rounded-2xl border-2 text-center mb-8 border-indigo-500 bg-indigo-900/20`}><h3 className="text-2xl font-bold">{getCardText(card)}</h3></div>
          <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl mb-4"><h4 className="font-bold mb-2">Progress:</h4>{players.map(p => (<div key={p.uid} className="flex justify-between py-1 border-b border-slate-700"><span>{p.name} {p.isBot && '(Bot)'}</span><span className="font-bold">{gameState?.mode === 'question' || gameState?.mode === 'yn' ? (answers[p.uid] ? 'Answered' : '-') : (gameState?.votes?.[p.uid] || '-')}</span></div>))}</div>
          {gameState?.isAutoMode ? (
              <div className="text-center text-green-400 font-bold animate-pulse mb-4 flex items-center gap-2 justify-center"><RefreshCw className="animate-spin" size={16}/> Auto-Advancing Sequence...</div>
          ) : (
              <button onClick={nextTurn} className="w-full max-w-md bg-indigo-600 p-3 rounded-lg font-bold">Next (Force)</button>
          )}
          <button onClick={handleEndGame} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">End Game</button>
          <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset All</button>
        </div>
      </div>
    );
  }

  // --- VISTA JUGADOR (MODIFICADA) ---

  if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900 relative">
            <CustomAlert/>
            {showPlayerHelp && <HelpModal onClose={() => setShowPlayerHelp(false)} type="player" />}
            
            <button 
              onClick={() => setShowPlayerHelp(true)} 
              className="absolute top-4 right-4 bg-slate-800 p-2 rounded-full hover:bg-slate-700 border border-slate-600 text-blue-400 transition-all z-50"
            >
              <HelpCircle size={24} />
            </button>

            {/* NAME EDIT HEADER */}
            <div className="text-center py-2 border-b border-slate-700 mb-4 w-full flex items-center justify-center gap-2 relative">
                {isEditingName ? (
                    <div className="flex gap-2">
                        <input 
                            className="bg-slate-800 border border-slate-600 p-1 rounded text-center text-lg font-bold text-white w-40" 
                            autoFocus
                            placeholder={userName}
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)} 
                        />
                        <button onClick={handleUpdateName} className="bg-green-600 px-2 rounded font-bold">Save</button>
                        <button onClick={() => setIsEditingName(false)} className="bg-red-600 px-2 rounded">X</button>
                    </div>
                ) : (
                    <>
                        <h1 className="text-3xl font-black text-white">{userName}</h1>
                        <button onClick={() => { setIsEditingName(true); setNewName(userName); }} className="text-slate-500 hover:text-white"><Edit2 size={16}/></button>
                    </>
                )}
            </div>
            
            <ScoreBoard />
            <MyMatchHistory />
            <div className="text-2xl font-bold animate-pulse mb-4 text-center mt-10">Waiting for next round...</div>
            <div className="text-slate-400">{gameState?.mode === 'lobby' ? "You are in the lobby." : "Round is starting..."}</div>
        </div>
    );
  }

  if (gameState.mode === 'ended') {
    return (
      <div className="min-h-screen text-white p-6 flex flex-col items-center justify-center bg-slate-900">
        <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
        <h2 className="text-2xl font-bold mb-4">Game Ended</h2>
        <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm max-h-96 overflow-y-auto mb-6">
          {players.map(p => <div key={p.uid} className="py-2 border-b border-slate-700 flex justify-between"><span>{p.name}</span><span className="font-bold text-yellow-400">{gameState?.points[p.uid] || 0} pts</span></div>)}
        </div>
      </div>
    );
  }

  const card = currentCard();
  if (!card && gameState.currentChallengeId) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900">
            <div className="text-xl animate-pulse">Syncing card data...</div>
        </div>
      );
  }

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
      if(myAns && partnerAns) {
          ynMatch = myAns === partnerAns;
      }
  }

  const isRoundFinishedTOrD = (gameState.mode === 'question' || gameState.mode === 'dare') && allVoted;
  const cardStyle = getLevelStyle(card?.level);

  return (
    <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900 overflow-hidden relative">
      {card?.level === '4' && <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none z-0"></div>}
       
      <CustomAlert/>
       
      {/* HEADER WITH EDIT NAME */}
      <div className="text-center py-2 border-b border-slate-700 mb-4 z-10 flex items-center justify-center gap-2">
        {isEditingName ? (
            <div className="flex gap-2">
                <input 
                    className="bg-slate-800 border border-slate-600 p-1 rounded text-center text-lg font-bold text-white w-40" 
                    autoFocus
                    placeholder={userName}
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                />
                <button onClick={handleUpdateName} className="bg-green-600 px-2 rounded font-bold">Save</button>
                <button onClick={() => setIsEditingName(false)} className="bg-red-600 px-2 rounded">X</button>
            </div>
        ) : (
            <>
                <h1 className="text-3xl font-black tracking-widest">{userName.toUpperCase()}</h1>
                <button onClick={() => { setIsEditingName(true); setNewName(userName); }} className="text-slate-500 hover:text-white"><Edit2 size={16}/></button>
            </>
        )}
      </div>
       
      <ScoreBoard />
      <MyMatchHistory />
       
      <div className="flex justify-between items-center mb-6 mt-4 z-10">
        <div className="font-bold flex gap-2 items-center bg-slate-800 px-3 py-1 rounded-full text-xs">
          <Zap size={14} className="text-yellow-400"/> 
          {gameState.mode === 'yn' ? 'MATCH' : gameState.mode === 'question' ? 'TRUTH' : 'DARE'} 
          {gameState.mode !== 'yn' && card?.level && <span className={`ml-2 px-2 rounded text-black font-bold ${card.level === '4' ? 'bg-red-500' : 'bg-slate-400'}`}>Lvl {card.level}</span>}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10 relative">
        {isRoundFinishedTOrD ? (
             <div className="bg-slate-800/90 backdrop-blur p-8 rounded-2xl text-center text-white border-2 border-slate-700 w-full max-w-md shadow-2xl">
                <div className="text-2xl font-bold mb-2">Round Finished</div>
                <div className="text-slate-400 animate-pulse">Loading next victim...</div>
            </div>
        ) : (
            <>
                <div className={`w-full max-w-md p-8 rounded-3xl border-4 text-center mb-8 transition-all duration-500 ${cardStyle} flex flex-col items-center justify-center min-h-[200px]`}>
                    <div className="mb-4 opacity-50">
                        {gameState.mode === 'question' ? <MessageCircle size={32}/> : gameState.mode === 'yn' ? null : <Flame size={32}/>}
                    </div>
                    <h3 className="text-2xl font-bold leading-relaxed drop-shadow-md">
                        {getCardText(card)}
                    </h3>
                </div>

                <div className="w-full max-w-md space-y-4">
                    {!isMyTurn() && gameState.mode !== 'yn' && (
                        <div className="text-center mb-6">
                            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Current Player</div>
                            <div className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 uppercase transition-all`}>
                                {currentPlayerName()}
                            </div>
                        </div>
                    )}

                    {gameState?.mode==='question' && isMyTurn() && (
                        <div className="text-xl font-bold text-center mb-4 text-green-400 animate-pulse bg-green-900/20 py-2 rounded-lg border border-green-500/50">YOUR TURN<br/><span className="text-sm text-white font-normal">Read aloud & Answer!</span></div>
                    )}
                     
                    {gameState?.mode==='question' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>submitVote('like')} className="bg-gradient-to-b from-green-500 to-green-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><ThumbsUp className="mb-1" size={24}/><span className="font-bold">Good Answer</span></button>
                            <button onClick={()=>submitVote('no like')} className="bg-gradient-to-b from-red-500 to-red-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><ThumbsDown className="mb-1" size={24}/><span className="font-bold">Punish!</span></button>
                        </div>
                    )}
                     
                    {gameState?.mode==='dare' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (
                         <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>submitVote('yes')} className="bg-gradient-to-b from-green-500 to-green-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><CheckSquare className="mb-1" size={24}/><span className="font-bold">Completed</span></button>
                            <button onClick={()=>submitVote('no')} className="bg-gradient-to-b from-red-500 to-red-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform"><XCircle className="mb-1" size={24}/><span className="font-bold">Failed</span></button>
                        </div>
                    )}

                    {gameState?.mode==='yn' && !playerAnswered && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>submitAnswer('yes')} className="bg-gradient-to-b from-green-500 to-green-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform font-bold text-xl">YES</button>
                            <button onClick={()=>submitAnswer('no')} className="bg-gradient-to-b from-red-500 to-red-700 p-4 rounded-2xl flex flex-col items-center shadow-lg active:scale-95 transition-transform font-bold text-xl">NO</button>
                        </div>
                    )}

                    {gameState?.mode==='yn' && allYNAnswered && (
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-2xl border border-slate-600 shadow-xl">
                            <div className="mb-4 text-lg">Partner was: <span className="font-bold text-yellow-400 text-xl block">{myPartnerName}</span></div>
                            {ynMatch === true ? (
                                <div className="animate-bounce">
                                    <Smile className="w-24 h-24 text-green-400 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]"/>
                                    <h3 className="text-4xl font-black text-green-400 tracking-tighter">MATCH!</h3>
                                </div>
                            ) : (
                                <div className="animate-pulse">
                                    <Frown className="w-24 h-24 text-red-500 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"/>
                                    <h3 className="text-4xl font-black text-red-500 tracking-tighter">MISMATCH!</h3>
                                </div>
                            )}
                             <div className="text-slate-500 mt-4 text-xs font-mono">Next round auto-starting...</div>
                        </div>
                    )}
                     
                    {((gameState?.mode==='question' && !isMyTurn() && gameState?.votes?.[user?.uid || '']) || 
                      (gameState?.mode==='dare' && !isMyTurn() && gameState?.votes?.[user?.uid || '']) ||
                      (gameState?.mode==='yn' && playerAnswered && !allYNAnswered)) && (
                        <div className="text-center p-4 bg-slate-800/50 rounded-xl">
                            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full mb-2"></div>
                            <div className="text-slate-400 text-sm">Waiting for others...</div>
                        </div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
}