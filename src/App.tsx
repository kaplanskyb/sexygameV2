import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  query, serverTimestamp, updateDoc, getDocs, deleteDoc, addDoc, where, writeBatch
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  Flame, Zap, Trophy, Upload, ThumbsUp, ThumbsDown, Smile, Frown, 
  Settings, CheckSquare, Square, Filter, ArrowUpDown, AlertTriangle, UserPlus
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

  // MANAGER STATES
  const [isManaging, setIsManaging] = useState(false);
  const [managerTab, setManagerTab] = useState<'td' | 'mm'>('td');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  
  // Bulk Edit
  const [bulkLevel, setBulkLevel] = useState('');
  const [bulkType, setBulkType] = useState('');
  const [bulkGender, setBulkGender] = useState('');

  // 0. FORZAR FONDO OSCURO
  useEffect(() => {
    document.documentElement.style.backgroundColor = '#0f172a';
    document.body.style.backgroundColor = '#0f172a';
    document.body.style.color = 'white';
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
  }, []);

  // 1. Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Auth Error:", error); }
    };
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

  // 2. Sincronización
  useEffect(() => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data() as GameState);
      } else {
        setDoc(gameRef, {
          mode: 'lobby',
          currentTurnIndex: 0,
          answers: {}, votes: {}, points: {}, code: '',
          timestamp: serverTimestamp()
        });
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

  // 3. Unificar Niveles (Solo de preguntas listas)
  useEffect(() => {
    if(challenges.length > 0 || pairChallenges.length > 0){
        const availableChallenges = [...challenges, ...pairChallenges].filter(c => !c.answered && c.level);
        const levels = availableChallenges.map(c => c.level?.toString());
        const allLevels = [...new Set(levels)].filter(l => l && l !== 'undefined'); 
        setUniqueLevels(allLevels.sort((a,b) => a.localeCompare(b, undefined, {numeric: true})));
    }
  }, [challenges, pairChallenges]);

  // 4. AUTO-AVANCE
  useEffect(() => {
    if (!isAdmin || !gameState || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') return;
    
    let shouldAdvance = false;
    if (gameState.mode === 'yn') {
        const totalAnswers = Object.keys(gameState.answers).length;
        if (totalAnswers >= players.length) shouldAdvance = true;
    } else {
        const totalVotes = Object.keys(gameState.votes).length;
        // Restar bots del conteo de votos necesarios si fuera necesario, pero bots no votan en T/D.
        // Asumimos que los bots no juegan T/D, solo Y/N.
        // Si el bot juega T/D, habría que hacer skip. Por ahora, bot es solo para Y/N.
        const realPlayers = players.filter(p => !p.isBot);
        const neededVotes = realPlayers.length - 1; // El que juega no vota
        if (totalVotes >= neededVotes) shouldAdvance = true;
    }

    if (shouldAdvance) {
        const timer = setTimeout(() => { nextTurn(); }, 3000); 
        return () => clearTimeout(timer);
    }
  }, [gameState, isAdmin, players.length]);


  // --- MANAGER LOGIC ---
  const updateSingleField = async (collectionName: string, id: string, field: string, value: string) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id), { [field]: value });
  };

  const applyBulkEdit = async () => {
      if (selectedIds.size === 0) return;
      const collectionName = managerTab === 'td' ? 'challenges' : 'pairChallenges';
      if (!confirm(`Update ${selectedIds.size} items in ${collectionName}?`)) return;
      
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', collectionName, id);
          const updates: any = {};
          if (bulkLevel) updates.level = bulkLevel;
          if (managerTab === 'td') {
              if (bulkType) updates.type = bulkType;
              if (bulkGender) updates.sexo = bulkGender;
          }
          batch.update(ref, updates);
      });
      await batch.commit();
      alert('Updated!');
      setBulkLevel(''); setBulkType(''); setBulkGender(''); setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
      const newSet = new Set(selectedIds);
      if(newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedIds(newSet);
  };

  const checkPendingSettings = () => {
      const pendingTD = challenges.filter(c => !c.level || !c.type || !c.sexo).length;
      const pendingMM = pairChallenges.filter(c => !c.level).length;
      return { pendingTD, pendingMM, total: pendingTD + pendingMM };
  };

  // --- GAME LOGIC ---

  const joinGame = async () => {
    if (!userName.trim() || !user) return;
    localStorage.setItem('td_username', userName);
    if (userName.toLowerCase() === 'admin') { setIsAdmin(true); return; }
    if (!gender || !code || !coupleNumber) return;
    if (code !== gameState?.code) { alert('Invalid code'); return; }

    const existingPartner = players.find(p => p.coupleNumber === coupleNumber && p.gender === gender && p.uid !== user.uid);
    if (existingPartner) {
        alert(`Error: A ${gender} is already registered for Couple ID ${coupleNumber}.`);
        return;
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
      uid: user.uid, name: userName, gender, coupleNumber, joinedAt: serverTimestamp(), isActive: true, isBot: false
    });
  };

  const setGameCode = async () => {
    if (!code.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { code: code });
  };

  const startGame = async () => {
    // 1. CHEQUEO DE PREGUNTAS
    const { total } = checkPendingSettings();
    if (total > 0) {
        alert(`Cannot start! There are ${total} questions without Level/Type/Gender set. Please use "Manage Questions".`);
        return;
    }

    // 2. CHEQUEO DE JUGADORES IMPARES (BOT CREATION)
    const realPlayers = players.filter(p => !p.isBot);
    if (realPlayers.length % 2 !== 0) {
        const males = realPlayers.filter(p => p.gender === 'male').length;
        const females = realPlayers.filter(p => p.gender === 'female').length;
        
        let botName = "Brad Pitt";
        let botGender = "male";
        
        if (males > females) {
            botName = "Scarlett Johansson";
            botGender = "female";
        }
        
        // Crear Bot
        const botUid = 'bot_' + Date.now();
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', botUid), {
            uid: botUid,
            name: botName,
            gender: botGender,
            coupleNumber: '999', // Pareja comodín
            joinedAt: serverTimestamp(),
            isActive: true,
            isBot: true
        });
        alert(`Odd number of players detected. Added bot: ${botName} to balance the game!`);
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
    let typeCode = selectedType === 'yn' ? 'YN' : selectedType === 'truth' ? 'T' : 'D';
    const nextChallenge = await findNextAvailableChallenge(typeCode, selectedLevel);
    if (!nextChallenge) { alert('No challenges found for this selection.'); return; }

    let mode = 'dare';
    if (selectedType === 'yn') mode = 'yn';
    else if (selectedType === 'truth' || selectedType === 'question') mode = 'question';

    // AUTO ANSWER FOR BOTS if Y/N
    let initialAnswers: Record<string, string> = {};
    if (mode === 'yn') {
        const bots = players.filter(p => p.isBot);
        bots.forEach(b => {
            initialAnswers[b.uid] = Math.random() > 0.5 ? 'yes' : 'no';
        });
    }

    let updates: any = {
      mode: mode,
      currentTurnIndex: 0, 
      answers: initialAnswers, 
      votes: {},
      adminUid: players[0].uid, 
      currentChallengeId: nextChallenge.id,
      roundLevel: selectedLevel
    };
    
    if (selectedType === 'yn') updates.pairs = computePairs();
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), updates);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', selectedType === 'yn' ? 'pairChallenges' : 'challenges', nextChallenge.id!), { answered: true });
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
          if (!snapshot.empty) {
              found = snapshot.docs[Math.floor(Math.random() * snapshot.size)];
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
        if (ans1 && ans2 && ans1 === ans2) {
            points[uid1] = (points[uid1] || 0) + 1;
            points[uid2] = (points[uid2] || 0) + 1;
        }
      });
    }
    updates.points = points;

    if (gameState.mode === 'yn') {
        updates.mode = 'admin_setup';
        updates.currentTurnIndex = 0;
        updates.answers = {};
        updates.votes = {};
    } else {
        // En T/D, saltar bots si los hay (aunque la logica de turno actual es index based)
        let nextIdx = gameState.currentTurnIndex + 1;
        // Si el siguiente es bot, saltarlo (loop simple)
        while(nextIdx < players.length && players[nextIdx].isBot) {
            nextIdx++;
        }

        if (nextIdx < players.length) {
            updates.currentTurnIndex = nextIdx;
            updates.answers = {};
            updates.votes = {};
            const typeChar = gameState.mode === 'question' ? 'T' : 'D';
            const nextChallenge = await findNextAvailableChallenge(typeChar, gameState.roundLevel || '1');
            if (nextChallenge) {
                updates.currentChallengeId = nextChallenge.id;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'challenges', nextChallenge.id!), { answered: true });
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

  // --- UPLOADERS ---
  const handleUploadTD = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if(!file) return;
      const text = await file.text();
      const lines = text.split('\n').slice(1);
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
      const batch = writeBatch(db); // Use batch for speed
      let count = 0;
      
      // Limpiar previo (opcional, pero pedido)
      const snap = await getDocs(ref); snap.forEach(d => deleteDoc(d.ref));

      lines.forEach(line => {
          if(!line.trim()) return;
          // Asumimos 1 columna de texto.
          // Si tiene comas, las unimos.
          const cleanText = line.trim().replace(/^"|"$/g, ''); 
          const docRef = doc(ref);
          batch.set(docRef, { text: cleanText, level: '', type: '', sexo: '', answered: false });
          count++;
      });
      await batch.commit();
      alert(`Uploaded ${count} Truth/Dare questions. Go to Manager to set Level/Type/Gender.`);
  };

  const handleUploadMM = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if(!file) return;
      const text = await file.text();
      const lines = text.split('\n').slice(1);
      const ref = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
      const batch = writeBatch(db);
      let count = 0;

      // Limpiar previo
      const snap = await getDocs(ref); snap.forEach(d => deleteDoc(d.ref));

      lines.forEach(line => {
          if(!line.trim()) return;
          // Esperamos 2 columnas: Male, Female
          // Split simple por coma. Si texto tiene comas, usará la primera.
          const parts = line.split(',');
          if (parts.length >= 2) {
              const male = parts[0].trim();
              const female = parts.slice(1).join(',').trim(); // El resto es female
              const docRef = doc(ref);
              batch.set(docRef, { male, female, level: '', answered: false });
              count++;
          }
      });
      await batch.commit();
      alert(`Uploaded ${count} Match/Mismatch pairs. Go to Manager to set Levels.`);
  };
  
  const handleEndGame = async () => {
    if(confirm('End game?')) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'ended' });
  };
  const handleRestart = async () => {
    if(confirm('Restart?')) {
        const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
        const pSnap = await getDocs(pRef); pSnap.forEach(d => deleteDoc(d.ref));
        const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'challenges');
        const cSnap = await getDocs(cRef); cSnap.forEach(d => updateDoc(d.ref, {answered:false}));
        const pcRef = collection(db, 'artifacts', appId, 'public', 'data', 'pairChallenges');
        const pcSnap = await getDocs(pcRef); pcSnap.forEach(d => updateDoc(d.ref, {answered:false}));
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), {
             mode: 'lobby', currentTurnIndex: 0, answers: {}, votes: {}, points: {}, code: '', adminUid: null
        });
    }
  };

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
        if (!myPlayer) return 'Waiting for player data...'; 
        return myPlayer.gender === 'female' ? c.female : c.male;
    }
    return c.text || 'No text found';
  };

  const isJoined = players.some(p => p.uid === user?.uid) || isAdmin;
  const isMyTurn = () => gameState && players[gameState?.currentTurnIndex]?.uid === user?.uid;
  
  const ScoreBoard = () => (
      <div className="w-full bg-slate-800 p-2 mb-4 rounded-lg flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-slate-700">
          <div className="w-full text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider flex justify-between">
              <span>Scoreboard</span>
              <span>Players: {players.length}</span>
          </div>
          {players.map(p => (
              <div key={p.uid} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${p.isBot ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-700/50'}`}>
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="text-gray-400 text-[10px]">({p.gender === 'male'?'M':'F'}/#{p.coupleNumber})</span>
                  <span className="text-yellow-400 font-bold ml-auto">{gameState?.points?.[p.uid] || 0}</span>
              </div>
          ))}
      </div>
  );

  // --- RENDERIZADO ---

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;

  // LOGIN
  if (!isJoined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-purple-500/30 text-center">
          <Flame className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">SEXY GAME v11</h1>
          <p className="text-slate-400 mb-4 text-sm">Hollywood Edition</p>
          <input type="text" placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={userName} onChange={e=>setUserName(e.target.value)} />
          <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white">
            <option value="male">Male</option><option value="female">Female</option>
          </select>
          <input type="number" placeholder="Male's Phone (Last 4 digits)" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={coupleNumber} onChange={e=>setCoupleNumber(e.target.value)} />
          {userName.toLowerCase()!=='admin' && <input type="text" placeholder="Ask code to admin" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={code} onChange={e=>setCode(e.target.value)} />}
          <button onClick={joinGame} disabled={!userName.trim()} className="w-full bg-purple-600 p-3 rounded-lg font-bold">Enter</button>
        </div>
      </div>
    );
  }

  // --- ADMIN MANAGER ---
  if (isAdmin && isManaging) {
      const data = managerTab === 'td' ? challenges : pairChallenges;
      const pendingData = managerTab === 'td' 
        ? data.filter(c => !c.level || !c.type || !c.sexo)
        : data.filter(c => !c.level);
      
      const displayedData = showPendingOnly ? pendingData : data;

      return (
        <div className="min-h-screen p-4 text-white bg-slate-900 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Settings/> Content Manager</h2>
                <button onClick={()=>setIsManaging(false)} className="bg-red-600 px-3 py-1 rounded text-sm">Back</button>
            </div>
            
            <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
                <button onClick={()=>setManagerTab('td')} className={`px-4 py-2 rounded ${managerTab==='td' ? 'bg-blue-600' : 'bg-slate-700'}`}>Truth/Dare</button>
                <button onClick={()=>setManagerTab('mm')} className={`px-4 py-2 rounded ${managerTab==='mm' ? 'bg-pink-600' : 'bg-slate-700'}`}>Match/Mismatch</button>
            </div>

            <div className="bg-slate-800 p-3 rounded-xl mb-4 flex flex-wrap gap-3 items-end text-sm">
                <div className="flex flex-col">
                    <label className="text-xs text-slate-400">Set Level</label>
                    <select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkLevel} onChange={e=>setBulkLevel(e.target.value)}>
                        <option value="">-</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
                    </select>
                </div>
                {managerTab === 'td' && (
                    <>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-400">Set Type</label>
                        <select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkType} onChange={e=>setBulkType(e.target.value)}>
                            <option value="">-</option><option value="T">Truth</option><option value="D">Dare</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-400">Set Gender</label>
                        <select className="bg-slate-900 border border-slate-600 p-1 rounded" value={bulkGender} onChange={e=>setBulkGender(e.target.value)}>
                            <option value="">-</option><option value="M">Male</option><option value="F">Female</option><option value="B">Both</option>
                        </select>
                    </div>
                    </>
                )}
                <button onClick={applyBulkEdit} disabled={selectedIds.size === 0} className="bg-green-600 px-3 py-1 rounded font-bold disabled:opacity-50">
                    Apply ({selectedIds.size})
                </button>
                <button onClick={()=>setShowPendingOnly(!showPendingOnly)} className={`ml-auto px-3 py-1 rounded flex items-center gap-1 ${showPendingOnly ? 'bg-yellow-600' : 'bg-slate-600'}`}>
                    <Filter size={14}/> Needs Setup ({managerTab==='td' ? checkPendingSettings().pendingTD : checkPendingSettings().pendingMM})
                </button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                        <tr>
                            <th className="p-2 w-8"><Square size={14}/></th>
                            <th className="p-2">Level</th>
                            {managerTab === 'td' && <th className="p-2">Type</th>}
                            {managerTab === 'td' && <th className="p-2">Gen</th>}
                            {managerTab === 'td' ? <th className="p-2">Text</th> : <><th className="p-2">Male Question</th><th className="p-2">Female Question</th></>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {displayedData.map(c => (
                            <tr key={c.id} className={selectedIds.has(c.id!) ? 'bg-blue-900/20' : ''}>
                                <td className="p-2"><button onClick={()=>toggleSelect(c.id!)}>{selectedIds.has(c.id!) ? <CheckSquare size={14} className="text-blue-400"/> : <Square size={14}/>}</button></td>
                                <td className="p-2">{c.level || <span className="text-red-500">?</span>}</td>
                                {managerTab === 'td' && <td className="p-2">{c.type || <span className="text-red-500">?</span>}</td>}
                                {managerTab === 'td' && <td className="p-2">{c.sexo || <span className="text-red-500">?</span>}</td>}
                                {managerTab === 'td' ? <td className="p-2">{c.text}</td> : <><td className="p-2">{c.male}</td><td className="p-2">{c.female}</td></>}
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
              <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              <h2 className="text-2xl font-bold mb-4">Lobby ({players.length})</h2>
              <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm mb-6">
                {players.map(p=><div key={p.uid} className={p.isBot?'text-purple-400':''}>{p.name} {p.isBot && '(Bot)'}</div>)}
              </div>
              <input type="text" placeholder="Set Code" className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={code} onChange={e=>setCode(e.target.value)} />
              <button onClick={setGameCode} className="w-full max-w-sm bg-blue-600 p-3 rounded-lg font-bold mb-4">Set Code</button>
              
              <div className="flex gap-2 w-full max-w-sm mb-2">
                  <label className="flex-1 bg-gray-700 p-3 rounded text-center text-xs cursor-pointer hover:bg-gray-600 transition"><Upload size={14} className="inline mr-1"/> Upload Truth/Dare (1 Col) <input type="file" className="hidden" onChange={handleUploadTD}/></label>
                  <label className="flex-1 bg-gray-700 p-3 rounded text-center text-xs cursor-pointer hover:bg-gray-600 transition"><Upload size={14} className="inline mr-1"/> Upload Match/Mismatch (2 Col) <input type="file" className="hidden" onChange={handleUploadMM}/></label>
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
                <select value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Type</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Match/Mismatch</option></select>
                <select value={selectedLevel} onChange={e=>setSelectedLevel(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Level</option>{uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}</select>
                <button onClick={startRound} disabled={!selectedType || !selectedLevel} className="w-full max-w-md bg-green-600 p-3 rounded-lg font-bold">Start Round</button>
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
          <div className="text-center text-sm text-gray-500 mb-4 animate-pulse">Auto-advancing...</div>
          <button onClick={handleEndGame} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">End Game</button>
          <button onClick={handleRestart} className="w-full max-w-md bg-red-600 p-3 rounded-lg font-bold mt-4">Reset</button>
        </div>
      </div>
    );
  }

  // --- VISTA DE JUGADOR ---

  if (!gameState || !gameState.mode || gameState.mode === 'lobby' || gameState.mode === 'admin_setup') {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900">
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
                             <div className="text-slate-400 mt-4 text-sm">Waiting for next round...</div>
                        </div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
}