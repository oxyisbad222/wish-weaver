import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, LogOut, User, Star, Menu, X, Key, Feather, BookOpen, Search, ArrowLeft } from 'lucide-react';

// --- Firebase & API Configuration ---
const firebaseConfig = {
    apiKey: process.env.REACT_APP_APIKEY,
    authDomain: process.env.REACT_APP_AUTHDOMAIN,
    projectId: process.env.REACT_APP_PROJECTID,
    storageBucket: process.env.REACT_APP_STORAGEBUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGINGSENDERID,
    appId: process.env.REACT_APP_APPID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const API_ENDPOINTS = {
    horoscope: (sign, day) => `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign.toLowerCase()}&day=${day}`,
    horoscopeWeekly: (sign) => `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/weekly?sign=${sign.toLowerCase()}`,
    horoscopeMonthly: (sign) => `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/monthly?sign=${sign.toLowerCase()}`,
    tarot: (count) => `https://tarot-api.onrender.com/api/v1/cards/random?n=${count}`,
    tarotImage: (imgId) => `https://www.sacred-texts.com/tarot/pkt/img/${imgId}`,
    avatar: (seed) => `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=f0e7f7,e0f0e9,d1d4f9`
};


// --- Navigation Hook ---
const useNavigation = (initialView = 'dashboard') => {
    const [history, setHistory] = useState([initialView]);
    const direction = useRef(1); // 1 for forward, -1 for back

    const navigate = (newView) => {
        direction.current = 1;
        setHistory(prev => [...prev, newView]);
    };

    const back = () => {
        direction.current = -1;
        if (history.length > 1) {
            setHistory(prev => prev.slice(0, -1));
        }
    };

    const navigateToRoot = () => {
        direction.current = -1;
        setHistory(['dashboard']);
    };

    const currentView = history[history.length - 1];
    const canGoBack = history.length > 1;

    return { navigate, back, navigateToRoot, currentView, canGoBack, direction: direction.current };
};


// --- Tarot Logic (Unchanged) ---
const getInsightfulMeaning = (card, position, isReversed) => {
    const baseMeaning = isReversed ? card.meaning_rev : card.meaning_up;
    const positionMeanings = {
        1: "The Heart of the Matter: This card represents the core of your situation, the central issue you are facing.",
        2: "The Obstacle: This card crosses you, representing the immediate challenge or block you must overcome.",
        3: "The Foundation: This is the basis of the situation, the events and influences from the past that have led you here.",
        4: "The Recent Past: This card represents events that have just occurred and are still influencing your present.",
        5: "The Crown/Potential Outcome: This represents the best possible outcome you can achieve, your conscious goal.",
        6: "The Near Future: This card shows what is likely to happen in the very near future, the next step on your path.",
        7: "Your Attitude: This reflects your own feelings and perspective on the situation.",
        8: "External Influences: This card represents the people, energies, or events around you that are affecting the situation.",
        9: "Hopes and Fears: This reveals your deepest hopes and anxieties concerning the outcome.",
        10: "The Final Outcome: This card represents the culmination of the situation, the result if you continue on your current path.",
        'Past': "The Past: This card represents past events and influences that have shaped your current situation.",
        'Present': "The Present: This card reflects your current circumstances and challenges.",
        'Future': "The Future: This card offers a glimpse into the potential outcome and direction you are heading.",
        'Situation': "The Card's Message: This card offers direct insight or advice regarding your current situation."
    };

    return {
        title: `${card.name} ${isReversed ? '(Reversed)' : ''}`,
        positionContext: position && positionMeanings[position] ? positionMeanings[position] : '',
        meaning: baseMeaning,
        description: card.desc
    };
};


// --- UI Components ---
const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen w-full bg-background">
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-t-primary border-border rounded-full"
        />
    </div>
);

const Notification = ({ message, type = 'success' }) => (
    <AnimatePresence>
        {message && (
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full shadow-lg z-50 text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            >
                {message}
            </motion.div>
        )}
    </AnimatePresence>
);

const Modal = ({ children, onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4 backdrop-blur-sm"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </motion.div>
    </motion.div>
);

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => {
  const baseClasses = 'font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30',
    secondary: 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
    ghost: 'hover:bg-primary/10 text-primary',
  };
  return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

// --- Page/View Components ---

const Login = () => {
    // (Logic unchanged)
    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    avatarSeed: user.displayName,
                    zodiac: 'Aries',
                    readings: []
                });
            }
        } catch (error) {
            console.error("Authentication Error:", error);
        }
    };

    const handleGuestLogin = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Anonymous Authentication Error:", error);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-foreground p-4 text-center bg-background">
            <motion.h1
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, type: 'spring' }}
                className="text-6xl md:text-8xl font-serif mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400"
            >
                Wish Weaver
            </motion.h1>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="text-xl mb-12 text-foreground/70"
            >
                Your modern guide to the cosmos.
            </motion.p>
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: 'spring' }}
                className="flex flex-col space-y-4 w-full max-w-xs"
            >
                <Button onClick={handleGoogleLogin} variant="primary">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56,12.25C22.56,11.47 22.49,10.72 22.36,10H12.27V14.1H18.1C17.84,15.55 17.03,16.8 15.84,17.64V20.25H19.45C21.45,18.44 22.56,15.63 22.56,12.25Z" /><path d="M12.27,23C15.05,23 17.4,22.04 19.03,20.59L15.42,17.98C14.49,18.63 13.46,19 12.27,19C9.86,19 7.8,17.43 7,15.21H3.29V17.9C4.93,20.99 8.3,23 12.27,23Z" /><path d="M7,15.21C6.75,14.46 6.6,13.65 6.6,12.8C6.6,11.95 6.75,11.14 7,10.39V7.69H3.29C2.48,9.22 2,10.95 2,12.8C2,14.65 2.48,16.38 3.29,17.9L7,15.21Z" /><path d="M12.27,6.6C13.55,6.6 14.63,7.03 15.53,7.86L18.51,4.88C16.88,3.38 14.78,2.5 12.27,2.5C8.3,2.5 4.93,4.51 3.29,7.69L7,10.39C7.8,8.17 9.86,6.6 12.27,6.6Z" /></svg>
                    <span>Sign in with Google</span>
                </Button>
                <Button onClick={handleGuestLogin} variant="secondary">
                    <Key size={18}/>
                    <span>Continue as Guest</span>
                </Button>
            </motion.div>
        </div>
    );
};

const Header = ({ userData, onLogout, onLogoClick, onAvatarClick, onBack, canGoBack }) => (
    <header className="bg-card/80 backdrop-blur-sm p-4 flex justify-between items-center sticky top-0 z-40 border-b border-border">
        <div className="flex items-center space-x-4">
            {canGoBack && (
                <button onClick={onBack} className="p-2 rounded-full hover:bg-foreground/10 transition-colors">
                    <ArrowLeft className="text-foreground/70" size={20}/>
                </button>
            )}
            <h1 onClick={onLogoClick} className="text-xl font-bold font-serif text-primary cursor-pointer">
                Wish Weaver
            </h1>
        </div>
        <div className="flex items-center space-x-4">
            <img
                src={API_ENDPOINTS.avatar(userData?.avatarSeed || userData?.displayName || 'guest')}
                alt="avatar"
                onClick={onAvatarClick}
                className="w-10 h-10 rounded-full border-2 border-primary/50 cursor-pointer hover:border-primary transition-colors"
            />
             <button onClick={onLogout} className="p-2 rounded-full hover:bg-foreground/10 transition-colors">
                <LogOut className="text-foreground/70" size={20}/>
            </button>
        </div>
    </header>
);

const Dashboard = ({ navigate, userData }) => {
    const items = [
        { view: 'horoscope', title: 'Horoscope', desc: 'Daily, weekly, and monthly forecasts.', icon: <Star/> },
        { view: 'tarot', title: 'Tarot Reading', desc: 'Gain insight with a powerful card spread.', icon: <Feather/> },
        { view: 'past_readings', title: 'Reading Journal', desc: 'Review your saved tarot readings.', icon: <BookOpen/> },
    ];

    return (
        <div className="p-4 sm:p-6">
            <h2 className="text-3xl sm:text-4xl font-serif text-center mb-8 text-foreground">Welcome, {userData?.displayName ? userData.displayName.split(' ')[0] : 'Seeker'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {items.map((item, i) => (
                    <motion.div
                        key={item.view}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                        onClick={() => navigate(item.view)}
                        className="bg-card p-6 rounded-2xl shadow-lg cursor-pointer hover:bg-foreground/5 transition-all duration-300 border border-border hover:border-primary/50 transform hover:-translate-y-1 flex items-center space-x-4"
                    >
                        <div className="bg-primary/10 text-primary p-3 rounded-full">{item.icon}</div>
                        <div>
                            <h3 className="text-xl font-semibold mb-1 text-card-foreground">{item.title}</h3>
                            <p className="text-card-foreground/70">{item.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// --- HOROSCOPE: REFACTORED FOR MULTIPLE TIMEFRAMES ---
const Horoscope = ({ zodiac }) => {
    const [horoscope, setHoroscope] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('daily'); // 'daily', 'weekly', 'monthly'

    const fetchHoroscope = useCallback(async () => {
        if (!zodiac) return;
        setLoading(true);
        setHoroscope(null);
        let url;
        switch(timeframe) {
            case 'monthly':
                url = API_ENDPOINTS.horoscopeMonthly(zodiac);
                break;
            case 'weekly':
                url = API_ENDPOINTS.horoscopeWeekly(zodiac);
                break;
            case 'daily':
            default:
                 url = API_ENDPOINTS.horoscope(zodiac, 'TODAY');
                break;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setHoroscope(data.data);
            } else {
                throw new Error("API request was not successful");
            }
        } catch (error) {
            console.error(`Error fetching ${timeframe} horoscope:`, error);
            setHoroscope({ horoscope_data: `Could not retrieve ${timeframe} horoscope. Please try again later.` });
        } finally {
            setLoading(false);
        }
    }, [zodiac, timeframe]);

    useEffect(() => {
        fetchHoroscope();
    }, [fetchHoroscope]);

    const TimeframeButton = ({ value, label }) => (
        <button
            onClick={() => setTimeframe(value)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${timeframe === value ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/20'}`}
        >
            {label}
        </button>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6">
            <div className="bg-card p-6 rounded-2xl shadow-lg border border-border max-w-3xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-serif text-primary capitalize">{timeframe} Horoscope</h2>
                        <h3 className="text-xl font-semibold text-foreground/80">{zodiac}</h3>
                    </div>
                    <div className="flex space-x-2 mt-4 sm:mt-0">
                       <TimeframeButton value="daily" label="Daily" />
                       <TimeframeButton value="weekly" label="Weekly" />
                       <TimeframeButton value="monthly" label="Monthly" />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <div className="h-4 bg-foreground/10 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-foreground/10 rounded w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-foreground/10 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-foreground/10 rounded w-4/6 animate-pulse"></div>
                    </div>
                ) : (
                    <p className="text-lg text-foreground/90 leading-relaxed font-serif whitespace-pre-line">
                        {horoscope?.horoscope_data}
                    </p>
                )}
            </div>
        </motion.div>
    );
};


// --- TarotReading Component (Unchanged) ---
const TarotReading = ({ user, fetchUserData, navigate }) => {
    // (Logic and minor style changes)
    const [spreadType, setSpreadType] = useState(null);
    const [cards, setCards] = useState([]);
    const [revealed, setRevealed] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [notification, setNotification] = useState('');

    const drawCards = async (num, type) => {
        setLoading(true);
        setSpreadType(type);
        setCards([]);
        setRevealed(new Set());
        setSelectedCard(null);
        try {
            const response = await fetch(API_ENDPOINTS.tarot(num));
            const data = await response.json();
            const drawnCards = data.cards.map(card => ({ ...card, isReversed: Math.random() > 0.7, id: crypto.randomUUID() }));
            setCards(drawnCards);
        } catch (error) {
            console.error("Error fetching tarot cards:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReading = async () => {
        // (Logic unchanged)
        if (user.isAnonymous) {
             setNotification('Guests cannot save readings.');
             setTimeout(() => setNotification(''), 3000);
             return;
        }
        if (revealed.size !== cards.length) {
            setNotification('Reveal all cards to save.');
            setTimeout(() => setNotification(''), 3000);
            return;
        }
        setNotification('Saving...');
        const userDocRef = doc(db, "users", user.uid);
        const readingToSave = {
            spreadType,
            date: new Date().toISOString(),
            cards: cards.map((card, i) => {
                let position;
                if (spreadType === 'single') position = 'Situation';
                else if (spreadType === 'three-card') position = ['Past', 'Present', 'Future'][i];
                else if (spreadType === 'celtic-cross') position = i + 1;
                return {
                    name: card.name,
                    img: card.img,
                    isReversed: card.isReversed,
                    interpretation: getInsightfulMeaning(card, position, card.isReversed)
                };
            })
        };
        try {
            await updateDoc(userDocRef, { readings: arrayUnion(readingToSave) });
            setNotification("Reading saved successfully!");
            await fetchUserData(user.uid);
        } catch (error) {
            console.error("Error saving reading:", error);
            setNotification("Error: Could not save reading.");
        } finally {
            setTimeout(() => setNotification(''), 3000);
        }
    };

    const handleCardClick = (card, index) => {
        if (!revealed.has(index)) {
            setRevealed(prev => new Set(prev).add(index));
        } else {
            let position;
            if (spreadType === 'single') position = 'Situation';
            else if (spreadType === 'three-card') position = ['Past', 'Present', 'Future'][index];
            else if (spreadType === 'celtic-cross') position = index + 1;
            setSelectedCard({ card, position });
        }
    };

    const Card = ({ card, index }) => {
        const isRevealed = revealed.has(index);
        return (
            <div className="perspective-1000 w-full h-full">
                <motion.div
                    className="relative w-full h-full cursor-pointer"
                    style={{ transformStyle: 'preserve-3d' }}
                    animate={{ rotateY: isRevealed ? 180 : 0 }}
                    transition={{ duration: 0.6 }}
                    onClick={() => handleCardClick(card, index)}
                >
                    <div className="absolute w-full h-full backface-hidden rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 border-2 border-purple-400/50 flex items-center justify-center p-2 shadow-lg">
                        <div className="w-full h-full border-2 border-purple-400/50 rounded-md flex items-center justify-center">
                            <Feather className="w-1/2 h-1/2 text-white/50" />
                        </div>
                    </div>
                    <div className="absolute w-full h-full backface-hidden [transform:rotateY(180deg)] rounded-xl shadow-2xl shadow-glow-primary overflow-hidden">
                        <img
                            src={API_ENDPOINTS.tarotImage(card.img)}
                            alt={card.name}
                            className={`w-full h-full object-cover rounded-xl ${card.isReversed ? 'rotate-180' : ''}`}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x350/1f2937/9333ea?text=Card+Art'; }}
                        />
                    </div>
                </motion.div>
            </div>
        );
    };

    if (!spreadType) {
        return (
            <div className="text-center max-w-md mx-auto p-4">
                <h2 className="text-3xl font-serif mb-8 text-foreground">Choose a Tarot Spread</h2>
                <div className="space-y-5">
                    {[['single', 'Simple Reading (1 Card)', 1], ['three-card', 'Three-Card Spread', 3], ['celtic-cross', 'Celtic Cross', 10]].map(([type, label, count], i) => (
                        <motion.button
                            key={type}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.15 }}
                            onClick={() => drawCards(count, type)}
                            className="w-full bg-card border border-border p-4 rounded-xl hover:border-primary text-card-foreground font-semibold transition-all hover:bg-foreground/5"
                        >
                            {label}
                        </motion.button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <Notification message={notification} />
            <AnimatePresence>
                {selectedCard && (
                    <Modal onClose={() => setSelectedCard(null)}>
                        <h2 className="text-3xl font-serif text-primary mb-2">{selectedCard.card.name} {selectedCard.card.isReversed && '(Reversed)'}</h2>
                        <p className="text-foreground/70 italic mb-4 font-sans">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed).positionContext}</p>
                        <p className="text-lg text-foreground/90 leading-relaxed font-serif">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed).meaning}</p>
                        <p className="text-md text-foreground/60 mt-4 font-sans">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed).description}</p>
                    </Modal>
                )}
            </AnimatePresence>

            <div className="flex justify-center mb-6 space-x-4">
                 <Button onClick={() => setSpreadType(null)} variant="secondary">New Spread</Button>
                 <Button onClick={handleSaveReading} variant="primary" disabled={user.isAnonymous}>Save Reading</Button>
            </div>
            {loading ? <LoadingSpinner /> : (
                <div className="max-w-5xl mx-auto">
                    {spreadType === 'single' && <div className="w-48 h-80 mx-auto"><Card card={cards[0]} index={0} /></div>}
                    {spreadType === 'three-card' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-12">
                            {cards.map((card, i) => (
                                <div key={card.id}>
                                    <h3 className="text-center text-xl font-serif text-foreground mb-3">{['Past', 'Present', 'Future'][i]}</h3>
                                    <div className="w-48 h-80 mx-auto"><Card card={card} index={i} /></div>
                                </div>
                            ))}
                        </div>
                    )}
                     {spreadType === 'celtic-cross' && cards.length === 10 && (
                        <div className="w-full max-w-xl mx-auto aspect-[3/4] grid grid-cols-4 grid-rows-6 gap-2">
                             <div className="col-start-1 row-start-3"><Card card={cards[3]} index={3} /></div>
                             <div className="col-start-2 row-start-4"><Card card={cards[2]} index={2} /></div>
                             <div className="col-start-2 row-start-2"><Card card={cards[4]} index={4} /></div>
                             <div className="col-start-3 row-start-3"><Card card={cards[5]} index={5} /></div>
                             <div className="col-start-2 row-start-3 relative flex items-center justify-center">
                                <div className="w-full h-full"><Card card={cards[0]} index={0} /></div>
                                <div className="absolute w-full h-full transform rotate-90"><Card card={cards[1]} index={1} /></div>
                             </div>
                             <div className="col-start-4 row-start-6"><Card card={cards[6]} index={6} /></div>
                             <div className="col-start-4 row-start-4"><Card card={cards[7]} index={7} /></div>
                             <div className="col-start-4 row-start-2"><Card card={cards[8]} index={8} /></div>
                             <div className="col-start-4 row-start-0"><Card card={cards[9]} index={9} /></div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// --- Profile and PastReadings Components (Unchanged) ---
const Profile = ({ user, userData, fetchUserData, navigate }) => {
    const [avatarSeed, setAvatarSeed] = useState(userData?.avatarSeed || user.displayName);
    const [zodiac, setZodiac] = useState(userData?.zodiac || 'Aries');
    const [notification, setNotification] = useState('');

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const handleSave = async () => {
        if (user.isAnonymous) {
            setNotification("Guests can't save profiles.");
            setTimeout(() => setNotification(''), 3000);
            return;
        }
        setNotification('Saving...');
        const userDocRef = doc(db, "users", user.uid);
        try {
            await setDoc(userDocRef, { avatarSeed, zodiac }, { merge: true });
            await fetchUserData(user.uid);
            setNotification('Profile saved successfully!');
        } catch (error) {
            console.error("Error saving profile:", error);
            setNotification('Failed to save profile.');
        } finally {
            setTimeout(() => setNotification(''), 3000);
        }
    };

    return (
        <div className="bg-card p-6 rounded-2xl shadow-lg max-w-lg mx-auto border border-border">
            <Notification message={notification} />
            <h2 className="text-3xl font-serif mb-6 text-foreground text-center">Profile & Settings</h2>

            <div className="flex flex-col items-center mb-6">
                <img src={API_ENDPOINTS.avatar(avatarSeed)} alt="avatar" className="w-32 h-32 rounded-full border-4 border-primary/40 mb-4" />
                <label htmlFor="avatarSeed" className="text-foreground/80 mb-2">Avatar Customization</label>
                <input
                    id="avatarSeed"
                    type="text"
                    value={avatarSeed}
                    onChange={(e) => setAvatarSeed(e.target.value)}
                    className="bg-input text-foreground p-3 rounded-lg w-full text-center border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    placeholder="Enter a name or phrase"
                    disabled={user.isAnonymous}
                />
            </div>

            <div className="mb-8">
                <label htmlFor="zodiac" className="text-foreground/80 mb-2 block text-center">Zodiac Sign</label>
                <select
                    id="zodiac"
                    value={zodiac}
                    onChange={(e) => setZodiac(e.target.value)}
                    className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none text-center"
                    disabled={user.isAnonymous}
                >
                    {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                </select>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={user.isAnonymous}>Save Changes</Button>
            {!user.isAnonymous &&
                <Button onClick={() => navigate('past_readings')} variant="ghost" className="w-full mt-2">View Reading Journal</Button>
            }
        </div>
    );
};

const PastReadings = ({ readings }) => {
    const [expanded, setExpanded] = useState(null);
    return (
        <div className="p-4 sm:p-6">
            <h2 className="text-3xl font-serif mb-8 text-foreground text-center">Reading Journal</h2>
            <div className="space-y-4 max-w-4xl mx-auto">
                {readings.length === 0 ? (
                    <p className="text-center text-foreground/60 mt-10">You have no saved readings yet.</p>
                ) : (
                    readings.slice().reverse().map((reading, index) => (
                        <motion.div key={reading.date} layout className="bg-card p-4 rounded-xl shadow-md border border-border overflow-hidden">
                            <motion.div layout className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(expanded === index ? null : index)}>
                                <h3 className="text-lg font-semibold text-card-foreground capitalize">
                                    {reading.spreadType.replace('-', ' ')} Spread
                                </h3>
                                <div className="flex items-center space-x-4">
                                  <span className="text-sm text-card-foreground/60">{new Date(reading.date).toLocaleDateString()}</span>
                                  <motion.div animate={{ rotate: expanded === index ? 90 : 0 }}>
                                    <Feather size={16} className="text-card-foreground/60"/>
                                  </motion.div>
                                </div>
                            </motion.div>
                            <AnimatePresence>
                                {expanded === index && (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                        animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    >
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {reading.cards.map((cardData, cardIndex) => (
                                                <div key={cardIndex}>
                                                    <img
                                                        src={API_ENDPOINTS.tarotImage(cardData.img)}
                                                        alt={cardData.name}
                                                        className="rounded-lg shadow-sm"
                                                    />
                                                    <div className="mt-2 text-xs">
                                                        <h4 className="font-bold text-card-foreground">{cardData.interpretation.title}</h4>
                                                        <p className="text-card-foreground/70">{cardData.interpretation.meaning}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- Footer Component ---
const Footer = ({ navigate, activeView }) => {
    const navItems = [
        { name: 'Home', view: 'dashboard', icon: <Menu /> },
        { name: 'Horoscope', view: 'horoscope', icon: <Star /> },
        { name: 'Tarot', view: 'tarot', icon: <Feather /> },
        { name: 'Profile', view: 'profile', icon: <User /> }
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border z-30 md:hidden">
            <nav className="flex justify-around p-1">
                {navItems.map(item => (
                    <button
                        key={item.name}
                        onClick={() => navigate(item.view)}
                        className={`flex flex-col items-center justify-center w-full py-2 px-1 rounded-lg transition-all duration-300 relative text-sm ${activeView === item.view ? 'text-primary' : 'text-foreground/60 hover:text-primary'}`}
                    >
                        {React.cloneElement(item.icon, { size: 20 })}
                        <span className="text-xs mt-1">{item.name}</span>
                        {activeView === item.view && (
                            <motion.div
                                layoutId="active-pill"
                                className="absolute bottom-0 h-1 w-8 bg-primary rounded-full"
                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            ></motion.div>
                        )}
                    </button>
                ))}
            </nav>
        </footer>
    );
};


// --- Main App Component ---
const App = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const { navigate, back, navigateToRoot, currentView, canGoBack, direction } = useNavigation('dashboard');

    const fetchUserData = useCallback(async (uid) => {
        if (!uid) return;
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            setUserData(userDoc.data());
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (!currentUser.isAnonymous) {
                    await fetchUserData(currentUser.uid);
                } else {
                    setUserData({
                        uid: currentUser.uid,
                        displayName: 'Guest',
                        avatarSeed: 'guest-user-seed',
                        zodiac: 'Aries',
                        readings: []
                    })
                }
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, [fetchUserData]);

    const handleLogout = async () => {
        await signOut(auth);
        navigateToRoot();
    };

    const pageVariants = {
        initial: {
            opacity: 0,
            x: `${10 * direction}%`
        },
        in: {
            opacity: 1,
            x: "0%"
        },
        out: {
            opacity: 0,
            x: `${-10 * direction}%`
        }
    };

    const pageTransition = {
        type: "tween",
        ease: "anticipate",
        duration: 0.4
    };

    const CurrentView = () => {
        switch (currentView) {
            case 'dashboard': return <Dashboard navigate={navigate} userData={userData}/>;
            case 'horoscope': return <Horoscope zodiac={userData?.zodiac} />;
            case 'tarot': return <TarotReading user={user} fetchUserData={fetchUserData} navigate={navigate} />;
            case 'profile': return <Profile user={user} userData={userData} fetchUserData={fetchUserData} navigate={navigate} />;
            case 'past_readings': return <PastReadings readings={userData?.readings || []} />;
            default: return <Dashboard navigate={navigate} userData={userData}/>;
        }
    };

    if (loadingAuth) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="bg-background text-foreground font-sans min-h-screen">
            <Header
                userData={userData}
                onLogout={handleLogout}
                onLogoClick={navigateToRoot}
                onAvatarClick={() => navigate('profile')}
                onBack={back}
                canGoBack={canGoBack}
            />
            <main className="pb-24 md:pb-4">
                <AnimatePresence initial={false} mode="wait">
                    <motion.div
                        key={currentView}
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                    >
                        <CurrentView />
                    </motion.div>
                </AnimatePresence>
            </main>
            <Footer navigate={navigate} activeView={currentView} />
        </div>
    );
};

export default App;