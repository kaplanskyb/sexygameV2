import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  query, serverTimestamp, updateDoc, getDocs, deleteDoc, addDoc, where, writeBatch, increment
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  Flame, Zap, Trophy, Upload, ThumbsUp, ThumbsDown, Smile, Frown, 
  Settings, CheckSquare, Square, Filter, ArrowUpDown, AlertTriangle, 
  Trash2, PlayCircle, PauseCircle, Download, FileSpreadsheet, RotateCcw, XCircle
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
  matches?: number;    // Nuevo
  mismatches?: number; // Nuevo
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
  sequence?: string[]; // ['question', 'question', 'dare', 'yn']
  sequenceIndex?: number;
}

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
  const [customError, setCustomError] = useState<string | null>(null); // Custom Alert

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
      if (docSnap.exists()) setGameState(docSnap.data() as GameState);
      else setDoc(gameRef, { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', timestamp: serverTimestamp() });
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
    // En YN avanzamos cuando todos contestan
    if (gameState.mode === 'yn') {
        const totalAnswers = Object.keys(gameState.answers).length;
        if (totalAnswers >= players.length) shouldAdvance = true;
    } else {
        // En T/D avanzamos cuando todos (menos el turno) votan
        const totalVotes = Object.keys(gameState.votes).length;
        const realPlayers = players.filter(p => !p.isBot);
        const neededVotes = realPlayers.length - 1; 
        if (totalVotes >= neededVotes) shouldAdvance = true;
    }

    if (shouldAdvance) {
        // 4 Segundos de espera para ver resultados
        const timer = setTimeout(() => { nextTurn(); }, 4000); 
        return () => clearTimeout(timer);
    }
  }, [gameState, isAdmin, players.length]);

  // --- HELPERS ---
  const showError = (msg: string) => setCustomError(msg);
  const closeError = () => setCustomError(null);

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

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup' });
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

  const startRound = async () => {
    // Generate Sequence if Auto
    let sequence: string[] = [];
    if (isAutoSetup) {
        for(let i=0; i<qtyTruth; i++) sequence.push('question');
        for(let i=0; i<qtyDare; i++) sequence.push('dare');
        for(let i=0; i<qtyMM; i++) sequence.push('yn');
        // Shuffle sequence? No, keep order T -> D -> MM usually better flow.
        // Or strictly as user asked: sequence of games.
    }

    // Determine first mode
    let initialMode = isAutoSetup && sequence.length > 0 ? sequence[0] : (selectedType === 'yn' ? 'yn' : selectedType === 'truth' ? 'question' : 'dare');
    let typeChar = initialMode === 'yn' ? 'YN' : initialMode === 'question' ? 'T' : 'D';

    const nextChallenge = await findNextAvailableChallenge(typeChar, selectedLevel);
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

  const findNextAvailableChallenge = async (type: string, startLevel: string) => {
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
          const validDocs = snapshot.docs.filter(d => !d.data().paused);
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
    const batch = writeBatch(db); // Para actualizar stats de jugadores
    
    // 1. SUMAR PUNTOS Y ESTADISTICAS
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
      Object.keys(gameState.pairs || {}).forEach(uid1 => {
        if (processed.has(uid1)) return;
        const uid2 = gameState.pairs![uid1];
        processed.add(uid1);
        processed.add(uid2);
        const ans1 = gameState.answers[uid1];
        const ans2 = gameState.answers[uid2];
        if (ans1 && ans2) {
            const isMatch = ans1 === ans2;
            if (isMatch) {
              points[uid1] = (points[uid1] || 0) + 1;
              points[uid2] = (points[uid2] || 0) + 1;
            }
            // Update stats
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid1), { 
                matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) 
            });
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'players', uid2), { 
                matches: increment(isMatch ? 1 : 0), mismatches: increment(isMatch ? 0 : 1) 
            });
        }
      });
      await batch.commit(); // Guardar stats de Match/Mismatch
    }
    updates.points = points;

    // 2. LOGICA DE NAVEGACION
    let roundFinished = false;

    if (gameState.mode === 'yn') {
        roundFinished = true;
    } else {
        // Truth/Dare
        let nextIdx = gameState.currentTurnIndex + 1;
        while(nextIdx < players.length && players[nextIdx].isBot) { nextIdx++; }

        if (nextIdx < players.length) {
            // Siguiente jugador de la misma ronda
            updates.currentTurnIndex = nextIdx;
            updates.answers = {};
            updates.votes = {};
            const typeChar = gameState.mode === 'question' ? 'T' : 'D';
            const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1');
            if (nextChallenge) {
                updates.currentChallengeId = nextChallenge.id;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'challenges', nextChallenge.id!), { answered: true });
            } else {
                roundFinished = true; // No hay más preguntas
            }
        } else {
            roundFinished = true;
        }
    }

    if (roundFinished) {
        if (gameState.isAutoMode && gameState.sequence) {
            // AUTO MODE: Siguiente juego en la secuencia
            const nextSeqIdx = (gameState.sequenceIndex || 0) + 1;
            if (nextSeqIdx < gameState.sequence.length) {
                // Hay siguiente juego
                const nextModeKey = gameState.sequence[nextSeqIdx]; // 'question', 'dare', 'yn'
                let mode = nextModeKey === 'truth' ? 'question' : nextModeKey; // normalize just in case
                if(mode === 'truth') mode = 'question'; // safe check

                let typeChar = mode === 'yn' ? 'YN' : mode === 'question' ? 'T' : 'D';
                const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1');
                
                if (nextChallenge) {
                    updates.mode = mode;
                    updates.currentTurnIndex = 0;
                    updates.sequenceIndex = nextSeqIdx;
                    updates.answers = {};
                    updates.votes = {};
                    updates.currentChallengeId = nextChallenge.id;
                    if (mode === 'yn') {
                        updates.pairs = computePairs();
                        // Bot answers
                        players.filter(p => p.isBot).forEach(b => {
                            updates[`answers.${b.uid}`] = Math.random() > 0.5 ? 'yes' : 'no';
                        });
                    }
                    const coll = mode === 'yn' ? 'pairChallenges' : 'challenges';
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, nextChallenge.id!), { answered: true });
                } else {
                    updates.mode = 'admin_setup'; // Se acabaron las preguntas
                }
            } else {
                // Fin de secuencia, volver al principio? o admin? 
                // Mejor volver a Admin para que no sea infinito sin control
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
  // (Simplificado para brevedad, usando las mismas funciones v16)
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
        batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', adminUid: null });
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

  const PairsStats = () => {
      const pairMap: Record<string, {names: string[], m: number, mm: number}> = {};
      players.forEach(p => {
          if (!pairMap[p.coupleNumber]) pairMap[p.coupleNumber] = {names: [], m: 0, mm: 0};
          pairMap[p.coupleNumber].names.push(p.name);
          pairMap[p.coupleNumber].m += (p.matches || 0);
          pairMap[p.coupleNumber].mm += (p.mismatches || 0);
      });
      return (
          <div className="w-full bg-slate-800 p-2 mt-4 rounded-lg max-h-32 overflow-y-auto border border-slate-700">
              <div className="text-xs text-slate-400 mb-1 uppercase font-bold text-center">Pairs Stats</div>
              {Object.entries(pairMap).map(([id, data]) => (
                  <div key={id} className="text-xs border-b border-slate-700 py-1 flex justify-between">
                      <span>#{id} {data.names.join(' & ')}</span>
                      <span className="flex gap-2">
                          <span className="text-green-400 font-bold">{Math.floor(data.m/2)} Match</span>
                          <span className="text-red-400 font-bold">{Math.floor(data.mm/2)} Fail</span>
                      </span>
                  </div>
              ))}
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
              </div>
          ))}
      </div>
  );

  // --- RENDER ---
  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;

  if (!isJoined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900">
        <CustomAlert/>
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-purple-500/30 text-center">
          <Flame className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">SEXY GAME v17</h1>
          <p className="text-slate-400 mb-4 text-sm">Auto-Mode Edition</p>
          <input type="text" placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={userName} onChange={e=>setUserName(e.target.value)} />
          <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="male">Male</option><option value="female">Female</option></select>
          <input type="number" placeholder="Male's Phone (Last 4 digits)" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={coupleNumber} onChange={e=>setCoupleNumber(e.target.value)} />
          {userName.toLowerCase()!=='admin' && <input type="text" placeholder="Ask code to admin" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={code} onChange={e=>setCode(e.target.value)} />}
          <button onClick={joinGame} disabled={!userName.trim()} className="w-full bg-purple-600 p-3 rounded-lg font-bold">Enter</button>
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
                <button onClick={exitManager} className="bg-red-600 px-3 py-1 rounded text-sm">Back</button>
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
            <div className="flex-1 overflow-auto border border-slate-700 rounded-xl" onMouseLeave={()=>setIsDragging(false)}>
                <table className="w-full text-left text-xs select-none">
                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                        <tr>
                            <th className="p-2 w-8 text-center"><input type="checkbox" onChange={()=>toggleSelectAll(displayedData)} checked={selectedIds.size === displayedData.length && displayedData.length > 0} /></th>
                            <th className="p-2 w-8 text-center"></th>
                            <th className="p-2 cursor-pointer hover:text-white" onClick={()=>handleSort('level')}>Level <ArrowUpDown size={12} className="inline"/></th>
                            {managerTab === 'td' && <th className="p-2 cursor-pointer hover:text-white" onClick={()=>handleSort('type')}>Type <ArrowUpDown size={12} className="inline"/></th>}
                            {managerTab === 'td' && <th className="p-2 cursor-pointer hover:text-white" onClick={()=>handleSort('sexo')}>Gender <ArrowUpDown size={12} className="inline"/></th>}
                            {managerTab === 'td' ? <th className="p-2 cursor-pointer hover:text-white" onClick={()=>handleSort('text')}>Text <ArrowUpDown size={12} className="inline"/></th> : <><th className="p-2 cursor-pointer hover:text-white" onClick={()=>handleSort('male')}>Male Question <ArrowUpDown size={12} className="inline"/></th><th className="p-2 cursor-pointer hover:text-white" onClick={()=>handleSort('female')}>Female Question <ArrowUpDown size={12} className="inline"/></th></>}
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
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900">
              <CustomAlert/>
              <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              <h2 className="text-2xl font-bold mb-4">Lobby ({players.length})</h2>
              <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm mb-6">
                {players.map(p=><div key={p.uid} className={p.isBot?'text-purple-400':''}>{p.name} {p.isBot && '(Bot)'}</div>)}
              </div>
              <input type="text" placeholder="Set Code" className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={code} onChange={e=>setCode(e.target.value)} />
              <button onClick={setGameCode} className="w-full max-w-sm bg-blue-600 p-3 rounded-lg font-bold mb-4">Set Code</button>
              
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
                  <button onClick={startGame} className="w-full max-w-sm bg-green-600 p-3 rounded-lg font-bold hover:bg-green-500 transition">Start Game</button>
              )}
              
              <button onClick={handleRestart} className="w-full max-w-sm bg-red-600 p-3 rounded-lg font-bold mt-4 hover:bg-red-500 transition">Reset</button>
            </div>
        );
    }

    if (gameState?.mode === 'admin_setup') {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900">
                <h2 className="text-2xl font-bold mb-4">Setup Round</h2>
                <ScoreBoard />
                
                {/* AUTO MODE TOGGLE */}
                <div className="flex items-center gap-4 mb-4 bg-slate-800 p-3 rounded-xl border border-slate-700 w-full max-w-md">
                    <button onClick={()=>setIsAutoSetup(!isAutoSetup)} className={`flex-1 py-2 rounded font-bold ${isAutoSetup ? 'bg-green-600' : 'bg-slate-600'}`}>
                        {isAutoSetup ? 'Auto Mode ON' : 'Manual Mode'}
                    </button>
                    {isAutoSetup && (
                        <div className="flex gap-2">
                            <div className="text-center"><div className="text-xs text-blue-400">Truth</div><input type="number" className="w-10 bg-slate-900 text-center border rounded" value={qtyTruth} onChange={e=>setQtyTruth(parseInt(e.target.value))}/></div>
                            <div className="text-center"><div className="text-xs text-pink-400">Dare</div><input type="number" className="w-10 bg-slate-900 text-center border rounded" value={qtyDare} onChange={e=>setQtyDare(parseInt(e.target.value))}/></div>
                            <div className="text-center"><div className="text-xs text-green-400">M/M</div><input type="number" className="w-10 bg-slate-900 text-center border rounded" value={qtyMM} onChange={e=>setQtyMM(parseInt(e.target.value))}/></div>
                        </div>
                    )}
                </div>

                <select value={selectedLevel} onChange={e=>setSelectedLevel(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Level</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
                
                {!isAutoSetup && (
                    <select value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Type</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match/Mismatch</option></select>
                )}

                <button onClick={startRound} disabled={!selectedLevel || (!isAutoSetup && !selectedType)} className="w-full max-w-md bg-green-600 p-3 rounded-lg font-bold">
                    {isAutoSetup ? 'Start Auto Sequence' : 'Start Round'}
                </button>
                <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset</button>
            </div>
        );
    }

    const card = currentCard();
    const answers = gameState?.answers || {};
    return (
      <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900">
        <ScoreBoard />
        <div className="flex justify-between items-center mb-6"><div className="flex gap-2 font-bold text-lg"><Zap className="text-yellow-400"/> {gameState?.mode?.toUpperCase()} (Admin)</div><div className="text-sm text-slate-400">Turn: {currentPlayerName()}</div></div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-full max-w-md p-8 rounded-2xl border-2 text-center mb-8 border-indigo-500 bg-indigo-900/20`}><h3 className="text-2xl font-bold">{getCardText(card)}</h3></div>
          <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl mb-4"><h4 className="font-bold mb-2">Progress:</h4>{players.map(p => (<div key={p.uid} className="flex justify-between py-1 border-b border-slate-700"><span>{p.name} {p.isBot && '(Bot)'}</span><span className="font-bold">{gameState?.mode === 'question' || gameState?.mode === 'yn' ? (answers[p.uid] ? 'Answered' : '-') : (gameState?.votes?.[p.uid] || '-')}</span></div>))}</div>
          {gameState?.isAutoMode ? (
              <div className="text-center text-green-400 font-bold animate-pulse mb-4">Auto-Advancing Sequence...</div>
          ) : (
              <button onClick={nextTurn} className="w-full max-w-md bg-indigo-600 p-3 rounded-lg font-bold">Next (Force)</button>
          )}
          <button onClick={handleEndGame} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">End Game</button>
          <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset</button>
        </div>
      </div>
    );
  }

  // --- VISTA JUGADOR ---

  if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900">
            <CustomAlert/>
            <div className="text-center py-2 border-b border-slate-700 mb-4 w-full"><h1 className="text-3xl font-black text-white">{userName}</h1></div>
            <ScoreBoard />
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
  const showCard = true; 

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

  const gameTitle = gameState.mode === 'yn' ? 'MATCH/MISMATCH' : gameState.mode.toUpperCase();
  const isRoundFinishedTOrD = (gameState.mode === 'question' || gameState.mode === 'dare') && allVoted;

  return (
    <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900">
      <CustomAlert/>
      <div className="text-center py-2 border-b border-slate-700 mb-4"><h1 className="text-3xl font-black text-white">{userName}</h1></div>
      <ScoreBoard />
      <div className="flex justify-between items-center mb-6 mt-4">
        <div className="font-bold flex gap-2"><Zap className="text-yellow-400"/> {gameTitle}</div>
        <div className="text-sm text-slate-400">Turn: {currentPlayerName()}</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {isRoundFinishedTOrD ? (
             <div className="bg-slate-800 p-8 rounded-2xl text-center text-white text-xl font-bold animate-pulse border-2 border-slate-700">
                Turn Finished<br/><span className="text-sm font-normal text-slate-400">Waiting for next turn...</span>
            </div>
        ) : (
            <>
                <div className={`w-full max-w-md p-8 rounded-2xl border-2 text-center mb-8 ${gameState?.mode==='question'?'border-indigo-500 bg-indigo-900/20':'border-pink-500 bg-pink-900/20'}`}>
                    <h3 className="text-2xl font-bold">{getCardText(card)}</h3>
                </div>

                <div className="w-full max-w-md space-y-4">
                    {!isMyTurn() && gameState.mode !== 'yn' && (
                        <div className="text-3xl font-black text-yellow-400 mb-6 text-center animate-pulse uppercase">
                            {currentPlayerName()}'s TURN
                        </div>
                    )}

                    {/* TRUTH */}
                    {gameState?.mode==='question' && isMyTurn() && (
                        <div className="text-xl font-bold text-center mb-4 text-green-400 animate-pulse">YOUR TURN<br/><span className="text-sm text-white">Answer aloud!</span></div>
                    )}
                    {gameState?.mode==='question' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>submitVote('like')} className="bg-green-600 p-4 rounded-xl flex justify-center"><ThumbsUp className="mr-2"/>Like</button>
                            <button onClick={()=>submitVote('no like')} className="bg-red-600 p-4 rounded-xl flex justify-center"><ThumbsDown className="mr-2"/>No Like</button>
                        </div>
                    )}
                    {gameState?.mode==='question' && !isMyTurn() && gameState?.votes?.[user?.uid || ''] && (
                        <div className="text-center text-slate-400">Waiting for next turn...</div>
                    )}

                    {/* DARE */}
                    {gameState?.mode==='dare' && isMyTurn() && (
                        <div className="text-center text-xl font-bold text-pink-400 animate-pulse">YOUR TURN: Do the Dare!</div>
                    )}
                    {gameState?.mode==='dare' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (
                         <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>submitVote('yes')} className="bg-green-600 p-4 rounded-xl">Passed</button>
                            <button onClick={()=>submitVote('no')} className="bg-red-600 p-4 rounded-xl">Failed</button>
                        </div>
                    )}
                    {gameState?.mode==='dare' && !isMyTurn() && gameState?.votes?.[user?.uid || ''] && (
                        <div className="text-center text-slate-400">Waiting for next turn...</div>
                    )}

                    {/* Y/N */}
                    {gameState?.mode==='yn' && !playerAnswered && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>submitAnswer('yes')} className="bg-green-600 p-4 rounded-xl">YES</button>
                            <button onClick={()=>submitAnswer('no')} className="bg-red-600 p-4 rounded-xl">NO</button>
                        </div>
                    )}
                    {gameState?.mode==='yn' && playerAnswered && !allYNAnswered && (
                        <div className="text-center text-slate-400">Waiting for results...</div>
                    )}
                    {gameState?.mode==='yn' && allYNAnswered && (
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-xl border border-slate-600">
                            <div className="mb-4 text-lg">Partner was: <span className="font-bold text-yellow-400">{myPartnerName}</span></div>
                            {ynMatch === true ? (
                                <>
                                    <Smile className="w-20 h-20 text-green-500 mb-2"/>
                                    <h3 className="text-3xl font-bold text-green-500">MATCH!</h3>
                                </>
                            ) : (
                                <>
                                    <Frown className="w-20 h-20 text-red-500 mb-2"/>
                                    <h3 className="text-3xl font-bold text-red-500">MISMATCH</h3>
                                </>
                            )}
                             <PairsStats/>
                             <div className="text-slate-400 mt-4 text-sm animate-pulse">Next round in 4s...</div>
                        </div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  ); 
}