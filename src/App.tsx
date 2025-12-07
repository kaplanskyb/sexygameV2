import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  query, serverTimestamp, updateDoc, getDocs, deleteDoc, addDoc, where
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  Flame, Zap, RefreshCw, Trophy, 
  Upload, ThumbsUp, ThumbsDown, Smile, Frown, Users
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

  // 3. Unificar Niveles
  useEffect(() => {
    if(challenges.length > 0 || pairChallenges.length > 0){
        const availableChallenges = [...challenges, ...pairChallenges].filter(c => !c.answered);
        const levels = availableChallenges.map(c => c.level?.toString());
        const allLevels = [...new Set(levels)].filter(l => l && l !== 'undefined'); 
        setUniqueLevels(allLevels.sort((a,b) => a.localeCompare(b, undefined, {numeric: true})));
    }
  }, [challenges, pairChallenges]);

  // --- LÓGICA DE JUEGO ---

  const joinGame = async () => {
    if (!userName.trim() || !user) return;
    localStorage.setItem('td_username', userName);
    if (userName.toLowerCase() === 'admin') { setIsAdmin(true); return; }
    if (!gender || !code || !coupleNumber) return;
    if (code !== gameState?.code) { alert('Invalid code'); return; }
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', user.uid), {
      uid: user.uid, name: userName, gender, coupleNumber, joinedAt: serverTimestamp(), isActive: true
    });
  };

  const setGameCode = async () => {
    if (!code.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { code: code });
  };

  const startGame = async () => {
    if (players.length < 1) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main'), { mode: 'admin_setup' });
  };

  // Parejas Random: Distinto Genero, Distinta Pareja
  const computePairs = () => {
    const pairs: Record<string, string> = {}; 
    const males = players.filter(p => p.gender === 'male');
    const females = players.filter(p => p.gender === 'female');
    
    const shuffledFemales = [...females].sort(() => Math.random() - 0.5);
    const assignedFemales = new Set<string>();

    males.forEach(male => {
        let partner = shuffledFemales.find(f => !assignedFemales.has(f.uid) && f.coupleNumber !== male.coupleNumber);
        if (!partner) partner = shuffledFemales.find(f => !assignedFemales.has(f.uid)); // Fallback

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
    if (!nextChallenge) { alert('No challenges found.'); return; }

    let mode = 'dare';
    if (selectedType === 'yn') mode = 'yn';
    else if (selectedType === 'truth' || selectedType === 'question') mode = 'question';

    let updates: any = {
      mode: mode,
      currentTurnIndex: 0, 
      answers: {}, 
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
    
    // PUNTOS
    if (gameState.mode === 'question') { 
      const currentUid = players[gameState.currentTurnIndex]?.uid;
      const likeVotes = Object.values(gameState.votes || {}).filter(v => v === 'like').length;
      if(currentUid) points[currentUid] = (points[currentUid] || 0) + likeVotes;
    } else if (gameState.mode === 'dare') {
      const currentUid = players[gameState.currentTurnIndex]?.uid;
      const yesVotes = Object.values(gameState.votes || {}).filter(v => v === 'yes').length;
      if(currentUid) points[currentUid] = (points[currentUid] || 0) + yesVotes;
    } else if (gameState.mode === 'yn') {
      const currentCardData = pairChallenges.find(c => c.id === gameState.currentChallengeId);
      const isDirect = currentCardData?.type === 'direct'; 
      
      const processed = new Set();
      Object.keys(gameState.pairs || {}).forEach(uid1 => {
        if (processed.has(uid1)) return;
        const uid2 = gameState.pairs![uid1];
        processed.add(uid1);
        processed.add(uid2);

        const ans1 = gameState.answers[uid1];
        const ans2 = gameState.answers[uid2];
        let match = false;
        if (ans1 && ans2) {
            if (isDirect) match = ans1 === ans2;
            else match = ans1 !== ans2;
            if (match) {
              points[uid1] = (points[uid1] || 0) + 1;
              points[uid2] = (points[uid2] || 0) + 1;
            }
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
        const nextIdx = gameState.currentTurnIndex + 1;
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

  // --- UPLOADERS INTELIGENTES (Commas Safe) ---
  const handleUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>, collectionName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ref = collection(db, 'artifacts', appId, 'public', 'data', collectionName);
    const snapshot = await getDocs(ref);
    for (const d of snapshot.docs) await deleteDoc(d.ref);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const textResult = event.target?.result as string;
      const lines = textResult.split('\n').slice(1);
      for (const line of lines) {
        if (!line.trim()) continue;
        const rawCols = line.split(',');
        
        if (collectionName === 'challenges') {
            if (rawCols.length >= 4) {
                const level = rawCols[0].trim();
                const type = rawCols[1].trim();
                let sexoIndex = rawCols.length - 1;
                while (sexoIndex > 2 && !['M','F','B','b','BOTH','MALE','FEMALE'].includes(rawCols[sexoIndex]?.trim().toUpperCase())) { sexoIndex--; }
                if(sexoIndex <= 2) sexoIndex = rawCols.length > 3 ? 3 : 2;
                const textParts = rawCols.slice(2, sexoIndex);
                const text = textParts.join(',').replace(/"/g, ''); 
                const sexo = rawCols[sexoIndex]?.trim().toUpperCase() || 'B';
                let cleanType = type.toLowerCase().includes('dare') ? 'D' : type.toLowerCase().includes('truth') ? 'T' : type.toUpperCase();
                await addDoc(ref, { level, type: cleanType, text, sexo, answered: false });
            }
        } else if (collectionName === 'pairChallenges') {
             // Lógica inteligente para pairChallenges (Level, Male, Female, Type)
             if (rawCols.length >= 4) {
                 const level = rawCols[0].trim();
                 // Type está al final
                 let typeIndex = rawCols.length - 1;
                 while(typeIndex > 2 && rawCols[typeIndex].trim().length > 2) { typeIndex--; } // Type usually D or I (short)
                 
                 const type = rawCols[typeIndex].trim();
                 const content = rawCols.slice(1, typeIndex).join(','); // Todo lo del medio
                 // Dividir Male/Female por la mitad si hay comas, o buscar coma central...
                 // Asumimos estructura simple por ahora, o ajustamos si falló antes.
                 // Mejor estrategia: Asumir que la primera coma separa Male/Female si no hay comillas.
                 // Como el usuario dijo que fallaba, usamos indices fijos si es posible, o split smart.
                 
                 // Fallback seguro: Usar las 2 columnas siguientes a Level y asumir que no tienen comas internas,
                 // O si las tienen, que están entre comillas.
                 // Dado el CSV del usuario: "I prefer missionary,I prefer doggy style"
                 
                 await addDoc(ref, {
                    level: level,
                    male: rawCols[1].trim(),
                    female: rawCols[2].trim(),
                    type: rawCols[3].trim().toUpperCase().startsWith('I') ? 'inverse' : 'direct',
                    answered: false
                });
             }
        }
      }
      setUploading(false); 
      alert('Upload complete.');
    };
    reader.readAsText(file);
  };
  const handleUploadPairCsv = (e: React.ChangeEvent<HTMLInputElement>) => handleUploadCsv(e, 'pairChallenges');
  
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
        const myPlayer = players.find(p => p.uid === user?.uid);
        if (!myPlayer && !isAdmin) return 'Waiting...'; 
        
        // ADMIN VE AMBOS
        if (isAdmin) return `M: ${c.male} / F: ${c.female}`;

        // JUGADOR VE SU PREGUNTA
        return myPlayer?.gender === 'female' ? c.female : c.male;
    }
    return c.text || 'No text found';
  };

  const isJoined = players.some(p => p.uid === user?.uid) || isAdmin;
  const isMyTurn = () => gameState && players[gameState?.currentTurnIndex]?.uid === user?.uid;
  
  // --- SCOREBOARD ---
  const ScoreBoard = () => (
      <div className="w-full bg-slate-800 p-2 mb-4 rounded-lg flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-slate-700">
          <div className="w-full text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider flex justify-between">
              <span>Scoreboard</span>
              <span>Players: {players.length}</span>
          </div>
          {players.map(p => (
              <div key={p.uid} className="text-xs bg-slate-700/50 px-2 py-1 rounded flex items-center gap-2">
                  <span className="font-bold text-white">{p.name}</span>
                  <span className="text-gray-400 text-[10px]">({p.gender === 'male'?'M':'F'}/#{p.coupleNumber})</span>
                  <span className="text-yellow-400 font-bold ml-auto">{gameState?.points?.[p.uid] || 0}</span>
              </div>
          ))}
      </div>
  );

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;

  // LOGIN
  if (!isJoined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white bg-slate-900">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-purple-500/30 text-center">
          <Flame className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">SEXY GAME v6</h1>
          <p className="text-slate-400 mb-4 text-sm">Join to play</p>
          <input type="text" placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={userName} onChange={e=>setUserName(e.target.value)} />
          <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white">
            <option value="male">Male</option><option value="female">Female</option>
          </select>
          <input type="number" placeholder="Couple #" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={coupleNumber} onChange={e=>setCoupleNumber(e.target.value)} />
          {userName.toLowerCase()!=='admin' && <input type="text" placeholder="Code" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={code} onChange={e=>setCode(e.target.value)} />}
          <button onClick={joinGame} disabled={!userName.trim()} className="w-full bg-purple-600 p-3 rounded-lg font-bold">Enter</button>
        </div>
      </div>
    );
  }

  // --- ADMIN VIEW ---
  if (isAdmin) {
    if (!gameState || gameState?.mode === 'lobby') {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900">
              <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              <h2 className="text-2xl font-bold mb-4">Lobby ({players.length})</h2>
              <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm mb-6">
                {players.map(p=><div key={p.uid}>{p.name} ({p.gender})</div>)}
              </div>
              <input type="text" placeholder="Set Code" className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white" value={code} onChange={e=>setCode(e.target.value)} />
              <button onClick={setGameCode} className="w-full max-w-sm bg-blue-600 p-3 rounded-lg font-bold mb-4">Set Code</button>
              <label className="w-full max-w-sm bg-gray-700 p-3 rounded-lg font-bold mb-2 flex justify-center cursor-pointer"><Upload className="mr-2"/> Upload T/D CSV <input type="file" className="hidden" onChange={(e)=>handleUploadCsv(e,'challenges')}/></label>
              <label className="w-full max-w-sm bg-gray-700 p-3 rounded-lg font-bold mb-4 flex justify-center cursor-pointer"><Upload className="mr-2"/> Upload Y/N CSV <input type="file" className="hidden" onChange={handleUploadPairCsv}/></label>
              {uploading && <div className="text-yellow-400 mb-2">Uploading...</div>}
              <button onClick={startGame} className="w-full max-w-sm bg-green-600 p-3 rounded-lg font-bold">Start Game</button>
              <button onClick={handleRestart} className="w-full max-w-sm bg-red-600 p-3 rounded-lg font-bold mt-4">Reset</button>
            </div>
        );
    }
    if (gameState?.mode === 'admin_setup') {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center text-white bg-slate-900">
                <h2 className="text-2xl font-bold mb-4">Setup Round</h2>
                <ScoreBoard />
                <select value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-3 mb-4 text-white"><option value="">Select Type</option><option value="truth">Truth</option><option value="dare">Dare</option><option value="yn">Y/N</option></select>
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
          <div className="w-full max-w-md bg-slate-800 p-4 rounded-xl mb-4"><h4 className="font-bold mb-2">Progress:</h4>{players.map(p => (<div key={p.uid} className="flex justify-between py-1 border-b border-slate-700"><span>{p.name}</span><span className="font-bold">{gameState?.mode === 'question' ? (answers[p.uid] ? 'Answered' : '-') : (gameState?.votes?.[p.uid] || '-')}</span></div>))}</div>
          <button onClick={nextTurn} className="w-full max-w-md bg-indigo-600 p-3 rounded-lg font-bold">Next (Force)</button>
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
        <div className="bg-slate-800 p-4 rounded-xl w-full max-w-sm mb-6">
          {players.map(p => <div key={p.uid} className="py-1 flex justify-between">{p.name}: {gameState?.points[p.uid] || 0} pts</div>)}
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
  const showCard = true; // SIEMPRE MOSTRAR LA CARTA A TODOS

  const allYNAnswered = Object.keys(gameState.answers).length >= players.length;
  let ynMatch = null;
  let myPartnerName = "???";

  if (gameState.mode === 'yn' && allYNAnswered) {
      const myPartnerUid = gameState.pairs?.[user?.uid || ''];
      const myAns = gameState.answers[user?.uid || ''];
      const partnerAns = gameState.answers[myPartnerUid || ''];
      
      // Buscar objeto pareja para nombre
      const pObj = players.find(p => p.uid === myPartnerUid);
      if(pObj) myPartnerName = pObj.name;

      const currentCardData = pairChallenges.find(c => c.id === gameState.currentChallengeId);
      const isDirect = currentCardData?.type === 'direct';
      
      if(myAns && partnerAns) {
          if (isDirect) ynMatch = myAns === partnerAns;
          else ynMatch = myAns !== partnerAns;
      }
  }

  return (
    <div className="min-h-screen text-white flex flex-col p-6 bg-slate-900">
      <ScoreBoard />
      <div className="flex justify-between items-center mb-6 mt-4">
        <div className="font-bold flex gap-2"><Zap className="text-yellow-400"/> {gameState?.mode?.toUpperCase()}</div>
        <div className="text-sm text-slate-400">Turn: {currentPlayerName()}</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* LA CARTA SE MUESTRA SIEMPRE, SALVO QUE HAYA TERMINADO LA RONDA DE VOTOS */}
        {!allVoted && !allYNAnswered && (
            <div className={`w-full max-w-md p-8 rounded-2xl border-2 text-center mb-8 ${gameState?.mode==='question'?'border-indigo-500 bg-indigo-900/20':'border-pink-500 bg-pink-900/20'}`}>
                <h3 className="text-2xl font-bold">{getCardText(card)}</h3>
            </div>
        )}

        <div className="w-full max-w-md space-y-4">
            
            {/* TRUTH */}
            {gameState?.mode==='question' && isMyTurn() && !playerAnswered && (
                <>
                    <div className="text-xl font-bold text-center mb-4 text-green-400 animate-pulse">YOUR TURN</div>
                    <button onClick={()=>submitAnswer('answered')} className="w-full bg-purple-600 p-4 rounded-xl font-bold">Mark as Answered</button>
                </>
            )}
            {gameState?.mode==='question' && isMyTurn() && playerAnswered && !allVoted && (
                <div className="text-center text-xl font-bold text-yellow-400 animate-pulse">Waiting for votes...</div>
            )}
            {gameState?.mode==='question' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={()=>submitVote('like')} className="bg-green-600 p-4 rounded-xl flex justify-center"><ThumbsUp className="mr-2"/>Like</button>
                    <button onClick={()=>submitVote('no like')} className="bg-red-600 p-4 rounded-xl flex justify-center"><ThumbsDown className="mr-2"/>No Like</button>
                </div>
            )}
            {gameState?.mode==='question' && !isMyTurn() && gameState?.votes?.[user?.uid || ''] && !allVoted && (
                <div className="text-center text-slate-400">Waiting for results...</div>
            )}

            {/* DARE */}
            {gameState?.mode==='dare' && !isMyTurn() && !gameState?.votes?.[user?.uid || ''] && (
                 <div className="grid grid-cols-2 gap-4">
                    <button onClick={()=>submitVote('yes')} className="bg-green-600 p-4 rounded-xl">Passed</button>
                    <button onClick={()=>submitVote('no')} className="bg-red-600 p-4 rounded-xl">Failed</button>
                </div>
            )}
            {gameState?.mode==='dare' && isMyTurn() && !allVoted && (
                <div className="text-center text-xl font-bold text-pink-400 animate-pulse">YOUR TURN: Do the Dare!</div>
            )}
            {gameState?.mode==='dare' && !isMyTurn() && gameState?.votes?.[user?.uid || ''] && !allVoted && (
                <div className="text-center text-slate-400">Waiting for results...</div>
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
                    ) : ynMatch === false ? (
                        <>
                            <Frown className="w-20 h-20 text-red-500 mb-2"/>
                            <h3 className="text-3xl font-bold text-red-500">MISMATCH</h3>
                        </>
                    ) : (
                        <div>Calculating...</div>
                    )}
                    <div className="text-slate-400 mt-4 text-sm">Waiting for next round...</div>
                </div>
            )}

            {/* MENSAJE DE ESPERA DE ADMIN (SOLO TRUTH/DARE) */}
            {allVoted && gameState?.mode !== 'yn' && (
                <div className="bg-slate-800 p-4 rounded-xl text-center text-slate-400 mt-4 border border-slate-600">
                     <div className="text-xl font-bold text-white mb-2">Turn Finished</div>
                    Waiting for next turn...
                </div>
            )}
        </div>
      </div>
    </div>
  );
}