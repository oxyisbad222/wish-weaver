import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, deleteUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, orderBy, limit, addDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Star, Menu, Key, Feather, BookOpen, ArrowLeft, AlertTriangle, Info, Users, MessageSquare, Sparkles, UserPlus, Send, Check, X, Trash2, Flag, Bell, Edit, Save, XCircle } from 'lucide-react';
import AccountSetup from './AccountSetup';
import OuijaRoom from './OuijaRoom';

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

export const API_ENDPOINTS = {
    horoscope: (sign, type) => `/api/horoscope?sign=${sign.toLowerCase()}&type=${type}`,
    tarotImageBase: './cards/',
    avatar: (seed, style = 'notionists') => `https://api.dicebear.com/8.x/${style}/svg?seed=${seed}&backgroundColor=f0e7f7,e0f0e9,d1d4f9`
};

const useNavigation = (initialView = 'dashboard') => {
    const [history, setHistory] = useState([{ view: initialView, data: null }]);
    const direction = useRef(1);

    const navigate = (view, data = null) => {
        if (view === history[history.length - 1].view) return;
        direction.current = 1;
        setHistory(prev => [...prev, { view, data }]);
    };

    const back = () => {
        direction.current = -1;
        if (history.length > 1) {
            setHistory(prev => prev.slice(0, -1));
        }
    };
    
    const navigateToRoot = () => {
        if (history.length <= 1) return;
        direction.current = -1;
        setHistory([{ view: 'dashboard', data: null }]);
    };

    const currentRoute = history[history.length - 1];
    const canGoBack = history.length > 1;

    return { navigate, back, navigateToRoot, currentRoute, canGoBack, direction: direction.current };
};

const getInsightfulMeaning = (card, position, isReversed) => {
    const baseMeanings = isReversed ? card.meanings.shadow : card.meanings.light;
    
    const positionMeanings = {
        1: "The Heart of the Matter", 2: "The Obstacle", 3: "The Foundation",
        4: "The Recent Past", 5: "The Crown/Potential", 6: "The Near Future",
        7: "Your Attitude", 8: "External Influences", 9: "Hopes and Fears",
        10: "The Final Outcome", 'Past': "The Past", 'Present': "The Present",
        'Future': "The Future", 'Situation': "The Card's Message"
    };

    return {
        title: `${card.name} ${isReversed ? '(Reversed)' : ''}`,
        positionContext: position && positionMeanings[position] ? positionMeanings[position] : '',
        meaning: baseMeanings,
        description: `Keywords: ${card.keywords.join(', ')}.`
    };
};

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
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg z-50 text-white font-semibold ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            >
                {message}
            </motion.div>
        )}
    </AnimatePresence>
);

const ErrorDisplay = ({ message }) => (
    <div className="flex flex-col items-center justify-center text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <AlertTriangle className="text-red-400 w-8 h-8 mb-2" />
        <p className="text-red-300 font-semibold">An error occurred</p>
        <p className="text-foreground/70 text-sm">{message}</p>
    </div>
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
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20',
  };
  return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const Login = ({ setNotification }) => {
    const handleGoogleSignUp = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    photoURL: user.photoURL,
                    googleDisplayName: user.displayName,
                    needsSetup: true,
                    createdAt: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error("Authentication Error:", error);
            setNotification('Sign up failed. Please try again.', 'error');
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Authentication Error:", error);
            setNotification('Sign in failed. Please try again.', 'error');
        }
    };

    const handleGuestLogin = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Anonymous Authentication Error:", error);
            setNotification('Guest login failed. Please try again.', 'error');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-foreground p-4 text-center bg-background">
            <motion.h1
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, type: 'spring' }}
                className="text-6xl md:text-8xl font-serif mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400"
            >
                Wish Weaver
            </motion.h1>
             <p className="text-md mb-1 text-foreground/50 font-serif">by Skye &lt;3</p>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="text-xl mb-12 text-foreground/70 mt-8"
            >
                Your modern guide to the cosmos.
            </motion.p>
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: 'spring' }}
                className="flex flex-col space-y-4 w-full max-w-xs"
            >
                <Button onClick={handleGoogleSignUp} variant="primary">
                    <UserPlus size={18}/>
                    <span>Sign Up with Google</span>
                </Button>
                 <Button onClick={handleGoogleSignIn} variant="secondary">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56,12.25C22.56,11.47 22.49,10.72 22.36,10H12.27V14.1H18.1C17.84,15.55 17.03,16.8 15.84,17.64V20.25H19.45C21.45,18.44 22.56,15.63 22.56,12.25Z" /><path d="M12.27,23C15.05,23 17.4,22.04 19.03,20.59L15.42,17.98C14.49,18.63 13.46,19 12.27,19C9.86,19 7.8,17.43 7,15.21H3.29V17.9C4.93,20.99 8.3,23 12.27,23Z" /><path d="M7,15.21C6.75,14.46 6.6,13.65 6.6,12.8C6.6,11.95 6.75,11.14 7,10.39V7.69H3.29C2.48,9.22 2,10.95 2,12.8C2,14.65 2.48,16.38 3.29,17.9L7,15.21Z" /><path d="M12.27,6.6C13.55,6.6 14.63,7.03 15.53,7.86L18.51,4.88C16.88,3.38 14.78,2.5 12.27,2.5C8.3,2.5 4.93,4.51 3.29,7.69L7,10.39C7.8,8.17 9.86,6.6 12.27,6.6Z" /></svg>
                    <span>Sign In with Google</span>
                </Button>
                <Button onClick={handleGuestLogin} variant="ghost" className="text-foreground/60">
                    <Key size={18}/>
                    <span>Continue as Guest</span>
                </Button>
            </motion.div>
        </div>
    );
};

const Header = ({ userData, onLogout, onLogoClick, onAvatarClick, onBack, canGoBack }) => (
    <header className="bg-card/80 backdrop-blur-sm p-4 flex justify-between items-center sticky top-0 z-40 border-b border-border">
        <div className="flex items-center space-x-2 sm:space-x-4">
            {canGoBack && (
                <button onClick={onBack} className="p-2 rounded-full hover:bg-foreground/10 transition-colors">
                    <ArrowLeft className="text-foreground/70" size={20}/>
                </button>
            )}
            <div className="flex flex-col cursor-pointer" onClick={onLogoClick}>
                <h1 className="text-xl font-bold font-serif text-primary leading-none">Wish Weaver</h1>
                <p className="text-xs text-foreground/50 font-serif leading-none">by Skye &lt;3</p>
            </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
            <img
                src={API_ENDPOINTS.avatar(userData?.avatarSeed || 'guest', userData?.avatarStyle)}
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
        { view: 'past_readings', title: 'Reading Journal', desc: 'Review your saved tarot readings.', icon: <BookOpen />, guestDisabled: true },
        { view: 'community', title: 'Community', desc: 'Connect with friends & share affirmations.', icon: <Users/>, guestDisabled: true },
        { view: 'ouija', title: 'Ouija Room', desc: 'Communicate with the other side.', icon: <Sparkles/>, guestDisabled: true },
    ];

    return (
        <div className="p-4 sm:p-6">
            <h2 className="text-3xl sm:text-4xl font-serif text-center mb-8 text-foreground">Welcome, {userData?.preferredName || 'Seeker'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto">
                {items.map((item, i) => {
                    const isDisabled = item.guestDisabled && userData?.isAnonymous;
                    return (
                        <motion.div
                            key={item.view}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                            onClick={() => !isDisabled && navigate(item.view)}
                            className={`bg-card p-4 sm:p-6 rounded-2xl shadow-lg border border-border flex items-center space-x-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-foreground/5 transition-all duration-300 transform hover:-translate-y-1 hover:border-primary/50'}`}
                        >
                            <div className="bg-primary/10 text-primary p-3 rounded-full">{item.icon}</div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-semibold mb-1 text-card-foreground">{item.title}</h3>
                                <p className="text-sm text-card-foreground/70">{item.desc}</p>
                                {isDisabled && <p className="text-xs text-amber-500 mt-1">Sign in to access this feature.</p>}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

const Horoscope = ({ zodiac }) => {
    const [horoscope, setHoroscope] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeframe, setTimeframe] = useState('daily');

    const fetchHoroscope = useCallback(async () => {
        if (!zodiac) return;
        setLoading(true);
        setError(null);
        setHoroscope(null);
        
        const url = API_ENDPOINTS.horoscope(zodiac, timeframe);

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to retrieve horoscope.");
            }
            
            setHoroscope(data.data);

        } catch (err) {
            console.error(`Error fetching ${timeframe} horoscope:`, err);
            setError(err.message || `Could not retrieve ${timeframe} horoscope. Please try again later.`);
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
            <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-lg border border-border max-w-3xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-serif text-primary capitalize">{timeframe} Horoscope</h2>
                        <h3 className="text-xl font-semibold text-foreground/80">{zodiac}</h3>
                    </div>
                    <div className="flex space-x-2 mt-4 sm:mt-0">
                       <TimeframeButton value="daily" label="Daily" />
                       <TimeframeButton value="weekly" label="Weekly" />
                       <TimeframeButton value="monthly" label="Monthly" />
                    </div>
                </div>
                
                {loading && (
                    <div className="space-y-4">
                        <div className="h-4 bg-foreground/10 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-foreground/10 rounded w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-foreground/10 rounded w-full animate-pulse"></div>
                    </div>
                )}

                {error && <ErrorDisplay message={error} />}

                {horoscope && (
                    <div className="text-base sm:text-lg text-foreground/90 leading-relaxed font-serif">
                        {horoscope.horoscope_data.split(/(?<=[.!?])\s*(?=[A-Z])/g).map((paragraph, index) => (
                            <p key={index} className="mb-4" style={{ textIndent: '2em' }}>
                                {paragraph.trim()}
                            </p>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const CardDisplay = ({ card, positionLabel, onCardClick }) => {
    return (
        <div className="flex flex-col items-center text-center cursor-pointer" onClick={() => onCardClick(card)}>
            <motion.div 
              className="relative w-full aspect-[2/3.5] bg-gray-700 rounded-xl overflow-hidden"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
               <img
                    src={`${API_ENDPOINTS.tarotImageBase}${card.img}`}
                    alt={card.name}
                    className={`w-full h-full object-cover ${card.isReversed ? 'rotate-180' : ''}`}
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x350/1f2937/9333ea?text=Card+Art'; }}
                />
            </motion.div>
             <div className="mt-2">
                <p className="font-semibold text-sm sm:text-base text-foreground">{card.name}</p>
                {positionLabel && <p className="text-xs sm:text-sm text-foreground/60">{positionLabel}</p>}
             </div>
        </div>
    );
};

const CelticCrossLayout = ({ cards, onCardClick }) => {
    const positions = [
        "1. Heart of the Matter", "2. The Obstacle", "3. The Foundation", "4. The Recent Past",
        "5. The Crown", "6. The Near Future", "7. Your Attitude", "8. External Influences",
        "9. Hopes and Fears", "10. The Outcome"
    ];

    return (
        <div className="w-full max-w-md mx-auto p-2 grid grid-cols-4 gap-2">
            <div className="col-start-2 row-start-2"><CardDisplay card={cards[0]} positionLabel={positions[0]} onCardClick={onCardClick} /></div>
            <div className="col-start-2 row-start-2 -rotate-90"><CardDisplay card={cards[1]} positionLabel={positions[1]} onCardClick={onCardClick} /></div>
            
            <div className="col-start-3 row-start-2"><CardDisplay card={cards[4]} positionLabel={positions[4]} onCardClick={onCardClick} /></div>
            <div className="col-start-1 row-start-2"><CardDisplay card={cards[3]} positionLabel={positions[3]} onCardClick={onCardClick} /></div>
            <div className="col-start-2 row-start-3"><CardDisplay card={cards[2]} positionLabel={positions[2]} onCardClick={onCardClick} /></div>
            <div className="col-start-2 row-start-1"><CardDisplay card={cards[5]} positionLabel={positions[5]} onCardClick={onCardClick} /></div>

            <div className="col-start-4 row-start-4"><CardDisplay card={cards[6]} positionLabel={positions[6]} onCardClick={onCardClick} /></div>
            <div className="col-start-4 row-start-3"><CardDisplay card={cards[7]} positionLabel={positions[7]} onCardClick={onCardClick} /></div>
            <div className="col-start-4 row-start-2"><CardDisplay card={cards[8]} positionLabel={positions[8]} onCardClick={onCardClick} /></div>
            <div className="col-start-4 row-start-1"><CardDisplay card={cards[9]} positionLabel={positions[9]} onCardClick={onCardClick} /></div>
        </div>
    );
};

const TarotReading = ({ user, showNotification }) => {
    const [fullDeck, setFullDeck] = useState([]);
    const [spreadType, setSpreadType] = useState(null);
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [readingTitle, setReadingTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    useEffect(() => {
        const fetchDeck = async () => {
            try {
                const response = await fetch('/tarot-cards.json');
                const data = await response.json();
                if (data && data.cards) {
                    setFullDeck(data.cards);
                } else {
                    throw new Error("Invalid JSON structure.");
                }
            } catch (err) {
                console.error("Error fetching local tarot deck:", err);
                setError("Could not load the deck of cards.");
            } finally {
                setLoading(false);
            }
        };
        fetchDeck();
    }, []);

    const drawCards = (num, type) => {
        if (fullDeck.length === 0) {
            setError("The deck is not available to draw from.");
            return;
        }
        setLoading(true);
        setError(null);
        setSpreadType(type);
        setCards([]);
        setSelectedCard(null);

        const shuffled = [...fullDeck].sort(() => 0.5 - Math.random());
        const drawnCards = shuffled.slice(0, num).map(card => ({ ...card, isReversed: Math.random() > 0.5, id: crypto.randomUUID() }));
        setCards(drawnCards);
        setLoading(false);
    };
    
    const handleSaveReading = async () => {
        if (!readingTitle) {
            showNotification("Please enter a title for your reading.", "error");
            return;
        }
        showNotification('Saving...');
        const userDocRef = doc(db, "users", user.uid);
        const readingToSave = {
            title: readingTitle,
            spreadType,
            date: new Date().toISOString(),
            notes: "", 
            cards: cards.map((card, i) => {
                let position;
                if (spreadType === 'single') position = 'Situation';
                else if (spreadType === 'three-card') position = ['Past', 'Present', 'Future'][i];
                else if (spreadType === 'celtic-cross') position = i + 1;
                return { name: card.name, img: card.img, isReversed: card.isReversed, interpretation: getInsightfulMeaning(card, position, card.isReversed) };
            })
        };
        try {
            await updateDoc(userDocRef, { readings: arrayUnion(readingToSave) });
            showNotification("Reading saved successfully!");
            setIsSaving(false);
            setReadingTitle("");
        } catch (err) {
            console.error("Error saving reading:", err);
            showNotification("Error: Could not save reading.", "error");
        }
    };
    
    const openSaveModal = () => {
        if (user.isAnonymous) {
            showNotification('Guests cannot save readings.', 'error');
            return;
        }
        setIsSaving(true);
    };

    if (!spreadType) {
        return (
            <div className="text-center max-w-md mx-auto p-4">
                <h2 className="text-3xl font-serif mb-8 text-foreground">Choose a Tarot Spread</h2>
                {error && <div className="mb-4"><ErrorDisplay message={error}/></div>}
                {loading && <div className="flex justify-center"><LoadingSpinner/></div>}
                <div className="space-y-4">
                    {[['single', 'Simple Reading (1 Card)', 1], ['three-card', 'Three-Card Spread', 3], ['celtic-cross', 'Celtic Cross', 10]].map(([type, label, count], i) => (
                        <motion.button 
                            key={type} 
                            initial={{ opacity: 0, x: -20 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => drawCards(count, type)} 
                            disabled={loading || fullDeck.length === 0} 
                            className="w-full bg-card border border-border p-4 rounded-xl hover:border-primary text-card-foreground font-semibold transition-all hover:bg-foreground/5 disabled:opacity-50"
                        >
                            {label}
                        </motion.button>
                    ))}
                </div>
            </div>
        );
    }
    
    const interpretation = selectedCard ? getInsightfulMeaning(selectedCard, null, selectedCard.isReversed) : null;

    return (
        <div className="p-4">
            <AnimatePresence>
                {selectedCard && interpretation && (
                    <Modal onClose={() => setSelectedCard(null)}>
                        <div className="relative">
                            <button onClick={() => setSelectedCard(null)} className="absolute -top-2 -right-2 p-2 rounded-full hover:bg-foreground/10 z-10"><X size={20}/></button>
                            <h2 className="text-3xl font-serif text-primary mb-2">{interpretation.title}</h2>
                            <div className="text-lg text-foreground/90 leading-relaxed font-serif space-y-3">
                                {interpretation.meaning.map((p, i) => <p key={i}>{p}</p>)}
                            </div>
                            <p className="text-md text-foreground/60 mt-4 font-sans">{interpretation.description}</p>
                        </div>
                    </Modal>
                )}
                {isSaving && (
                     <Modal onClose={() => setIsSaving(false)}>
                        <h2 className="text-2xl font-serif text-primary mb-4">Save Your Reading</h2>
                        <input type="text" value={readingTitle} onChange={(e) => setReadingTitle(e.target.value)} placeholder="Enter a title for this reading..." className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors mb-4"/>
                        <Button onClick={handleSaveReading} className="w-full">Save</Button>
                     </Modal>
                )}
                {showInfoModal && (
                    <Modal onClose={() => setShowInfoModal(false)}>
                        <h2 className="text-2xl font-serif text-primary mb-4">How to Read the Celtic Cross</h2>
                        <div className="space-y-2 text-foreground/90 text-sm">
                            <p><strong>1. The Heart of the Matter:</strong> Represents the core of the situation.</p>
                            <p><strong>2. The Obstacle:</strong> This card is placed sideways, crossing over the first card, to represent the immediate challenge.</p>
                            <p><strong>3. The Foundation:</strong> The subconscious influences and past events.</p>
                            <p><strong>4. The Recent Past:</strong> Events that have just occurred.</p>
                            <p><strong>5. The Crown:</strong> The best possible outcome or potential.</p>
                            <p><strong>6. The Near Future:</strong> What is likely to happen next.</p>
                            <p><strong>7. Your Attitude:</strong> Your own feelings and perspective.</p>
                            <p><strong>8. External Influences:</strong> The people and environment around you.</p>
                            <p><strong>9. Hopes and Fears:</strong> Your deepest desires and anxieties.</p>
                            <p><strong>10. The Final Outcome:</strong> The likely result if things continue on their current path.</p>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <div className="flex justify-center mb-6 space-x-4">
                 <Button onClick={() => setSpreadType(null)} variant="secondary">New Spread</Button>
                 <Button onClick={openSaveModal} variant="primary" disabled={user.isAnonymous || cards.length === 0}>Save Reading</Button>
            </div>
            
            {loading && <div className="flex justify-center"><LoadingSpinner/></div>}
            {error && <div className="max-w-md mx-auto"><ErrorDisplay message={error}/></div>}

            {cards && cards.length > 0 && (
                <div className="max-w-5xl mx-auto">
                     {spreadType === 'celtic-cross' && (
                        <div className="flex justify-center items-center mb-4">
                            <button onClick={() => setShowInfoModal(true)} className="flex items-center space-x-2 text-sm text-primary hover:underline">
                                <Info size={16}/>
                                <span>How to Read the Spread</span>
                            </button>
                        </div>
                    )}
                    {spreadType === 'single' && <div className="w-40 sm:w-48 mx-auto"><CardDisplay card={cards[0]} onCardClick={setSelectedCard}/></div>}
                    {spreadType === 'three-card' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-8">
                            {cards.map((card, i) => (
                                <div key={card.id}>
                                    <h3 className="text-center text-lg sm:text-xl font-serif text-foreground mb-3">{['Past', 'Present', 'Future'][i]}</h3>
                                    <div className="w-40 sm:w-48 mx-auto"><CardDisplay card={card} onCardClick={setSelectedCard}/></div>
                                </div>
                            ))}
                        </div>
                    )}
                     {spreadType === 'celtic-cross' && cards.length === 10 && (
                         <CelticCrossLayout cards={cards} onCardClick={setSelectedCard} />
                    )}
                </div>
            )}
             <p className="text-center text-foreground/60 mt-8 text-sm">Tap any card to reveal its meaning.</p>
        </div>
    );
};

const Profile = ({ user, userData, showNotification }) => {
    const [preferredName, setPreferredName] = useState(userData?.preferredName || '');
    const [pronouns, setPronouns] = useState(userData?.pronouns || '');
    const [bio, setBio] = useState(userData?.bio || '');
    const [avatarSeed, setAvatarSeed] = useState(userData?.avatarSeed || '');
    const [avatarStyle, setAvatarStyle] = useState(userData?.avatarStyle || 'notionists');
    const [zodiac, setZodiac] = useState(userData?.zodiac || 'Aries');
    const [isNamePublic, setIsNamePublic] = useState(userData?.isNamePublic ?? true);
    const [isPronounsPublic, setIsPronounsPublic] = useState(userData?.isPronounsPublic ?? true);
    const [isBioPublic, setIsBioPublic] = useState(userData?.isBioPublic ?? true);
    const [isZodiacPublic, setIsZodiacPublic] = useState(userData?.isZodiacPublic ?? true);
    const [showInfo, setShowInfo] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [showUsernameChange, setShowUsernameChange] = useState(false);
    const [newUsername, setNewUsername] = useState(userData?.username || '');
    const [isChangingUsername, setIsChangingUsername] = useState(false);

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const avatarStyles = ['notionists', 'open-peeps'];

    const handleSave = async () => {
        if (user.isAnonymous) {
            showNotification("Guests can't save profiles.", "error");
            return;
        }
        showNotification('Saving...');
        const userDocRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userDocRef, { 
                preferredName, 
                pronouns, 
                bio,
                avatarSeed, 
                avatarStyle, 
                zodiac,
                isNamePublic,
                isPronounsPublic,
                isBioPublic,
                isZodiacPublic
            });
            showNotification('Profile saved successfully!');
        } catch (error) {
            console.error("Error saving profile:", error);
            showNotification('Failed to save profile.', 'error');
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmationText !== 'delete my account') {
            showNotification("Please type the confirmation phrase correctly.", "error");
            return;
        }

        if (!userData?.username) {
            showNotification("Cannot delete account: User data is not fully loaded.", "error");
            return;
        }

        try {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", user.uid);
            const usernameDocRef = doc(db, "usernames", userData.username);
            
            batch.delete(userDocRef);
            batch.delete(usernameDocRef);
            
            await batch.commit();
            await deleteUser(auth.currentUser);

            showNotification('Account deleted successfully.');
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting account:", error);
            showNotification(`Failed to delete account. Error: ${error.message}`, 'error');
        }
    };
    
    const handleUsernameChange = async () => {
        setIsChangingUsername(true);
        const newUsernameLower = newUsername.trim().toLowerCase();
        
        if (newUsernameLower.length < 3 || newUsernameLower.length > 15) {
            showNotification("Username must be between 3 and 15 characters.", "error");
            setIsChangingUsername(false);
            return;
        }
        if (!/^[a-z0-9_]+$/.test(newUsernameLower)) {
            showNotification("Username can only contain lowercase letters, numbers, and underscores.", "error");
            setIsChangingUsername(false);
            return;
        }
        if (newUsernameLower === userData.username) {
            showNotification("This is already your username.", "error");
            setIsChangingUsername(false);
            return;
        }

        try {
            const newUsernameRef = doc(db, "usernames", newUsernameLower);
            const newUsernameDoc = await getDoc(newUsernameRef);
            if (newUsernameDoc.exists()) {
                showNotification("This username is already taken.", "error");
                setIsChangingUsername(false);
                return;
            }

            const batch = writeBatch(db);
            const oldUsernameRef = doc(db, "usernames", userData.username);
            const userRef = doc(db, "users", user.uid);

            batch.delete(oldUsernameRef);
            batch.set(newUsernameRef, { uid: user.uid, username: newUsernameLower });
            batch.update(userRef, { username: newUsernameLower, usernameLastChanged: serverTimestamp() });

            await batch.commit();
            showNotification("Username changed successfully!");
            setShowUsernameChange(false);
        } catch (error) {
            console.error("Error changing username:", error);
            showNotification("Failed to change username.", "error");
        } finally {
            setIsChangingUsername(false);
        }
    };

    const lastChangedDate = userData.usernameLastChanged?.toDate();
    const canChangeUsername = !lastChangedDate || (new Date().getTime() - lastChangedDate.getTime()) > 7 * 24 * 60 * 60 * 1000;


    return (
        <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-lg max-w-lg mx-auto border border-border">
            <AnimatePresence>
                {showInfo && (
                    <Modal onClose={() => setShowInfo(false)}>
                        <h2 className="text-2xl font-serif text-primary mb-4">About Avatar Seeds</h2>
                        <p className="text-foreground/90 mb-2">Your avatar is generated from a unique "seed" string. Any text can be a seed: your name, a favorite word, or just random characters.</p>
                        <p className="text-foreground/90 mb-4">Changing the seed will create a completely new avatar. Explore different styles for even more variety!</p>
                        <Button onClick={() => setShowInfo(false)} className="w-full">Got it</Button>
                    </Modal>
                )}
                {showDeleteModal && (
                    <Modal onClose={() => setShowDeleteModal(false)}>
                        <h2 className="text-2xl font-serif text-red-500 mb-4">Delete Account</h2>
                        <p className="text-foreground/90 mb-2">This action is irreversible. All your data, including readings and connections, will be permanently deleted.</p>
                        <p className="text-foreground/80 mb-4">To confirm, please type "<strong className="text-red-400">delete my account</strong>" in the box below.</p>
                        <input
                            type="text"
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors mb-4"
                        />
                        <div className="flex space-x-4">
                            <Button onClick={() => setShowDeleteModal(false)} variant="secondary" className="w-full">Cancel</Button>
                            <Button onClick={handleDeleteAccount} variant="danger" className="w-full" disabled={deleteConfirmationText !== 'delete my account'}>Delete My Account</Button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <h2 className="text-3xl font-serif mb-6 text-foreground text-center">Profile & Settings</h2>

            <div className="flex flex-col items-center mb-6">
                <img src={API_ENDPOINTS.avatar(avatarSeed, avatarStyle)} alt="avatar" className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-primary/40 mb-4" />
                <div className="w-full space-y-4">
                    <div>
                        <label className="text-foreground/80 mb-2 block text-sm">Username</label>
                        <div className="flex items-center space-x-2">
                             <input type="text" value={`@${userData?.username || ''}`} className="bg-input/50 text-foreground/70 p-3 rounded-lg w-full border border-border" disabled/>
                             {!user.isAnonymous && <button onClick={() => setShowUsernameChange(true)} className="p-3 bg-primary/20 text-primary rounded-lg hover:bg-primary/30"><Edit size={18}/></button>}
                        </div>
                        {showUsernameChange && (
                             <div className="mt-2 p-4 bg-background rounded-lg border border-border">
                                <h4 className="font-semibold mb-2">Change Username</h4>
                                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary" />
                                {!canChangeUsername && lastChangedDate && <p className="text-xs text-amber-500 mt-1">You can change your username again on {new Date(lastChangedDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}.</p>}
                                <div className="flex space-x-2 mt-2">
                                    <Button onClick={handleUsernameChange} className="w-full" disabled={!canChangeUsername || isChangingUsername}>Confirm</Button>
                                    <Button onClick={() => setShowUsernameChange(false)} variant="ghost" className="w-full">Cancel</Button>
                                </div>
                             </div>
                        )}
                    </div>
                     <div>
                        <label htmlFor="preferredName" className="text-foreground/80 mb-2 block text-sm">Preferred Name</label>
                        <input id="preferredName" type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" disabled={user.isAnonymous}/>
                    </div>
                     <div>
                        <label htmlFor="pronouns" className="text-foreground/80 mb-2 block text-sm">Pronouns</label>
                        <input id="pronouns" type="text" value={pronouns} onChange={(e) => setPronouns(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" disabled={user.isAnonymous}/>
                    </div>
                    <div>
                         <label htmlFor="avatarSeed" className="text-foreground/80 mb-2 flex items-center text-sm">Avatar Seed <Info size={14} className="ml-2 cursor-pointer" onClick={() => setShowInfo(true)}/></label>
                        <input id="avatarSeed" type="text" value={avatarSeed} onChange={(e) => setAvatarSeed(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" placeholder="Enter anything here" disabled={user.isAnonymous}/>
                    </div>
                    <div>
                         <label htmlFor="avatarStyle" className="text-foreground/80 mb-2 block text-sm">Avatar Style</label>
                        <select id="avatarStyle" value={avatarStyle} onChange={(e) => setAvatarStyle(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none" disabled={user.isAnonymous}>
                            {avatarStyles.map(style => <option key={style} value={style}>{style}</option>)}
                        </select>
                    </div>
                    <div>
                         <label htmlFor="zodiac" className="text-foreground/80 mb-2 block text-sm">Zodiac Sign</label>
                        <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none" disabled={user.isAnonymous}>
                            {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            
            <Button onClick={handleSave} className="w-full" disabled={user.isAnonymous}>Save Profile Changes</Button>
            {!user.isAnonymous && <Button onClick={() => setShowDeleteModal(true)} variant="ghost" className="w-full mt-4 text-red-500 hover:bg-red-500/10">Delete Account</Button>}
        </div>
    );
};

const PastReadings = ({ user, userData, showNotification, onCardClick }) => {
    const [expandedReading, setExpandedReading] = useState(null);
    const [editingNote, setEditingNote] = useState('');

    const handleDeleteReading = async (readingToDelete) => {
        if (!window.confirm("Are you sure you want to delete this reading? This cannot be undone.")) return;
        
        const userDocRef = doc(db, "users", user.uid);
        const newReadings = userData.readings.filter(r => r.date !== readingToDelete.date);
        try {
            await updateDoc(userDocRef, { readings: newReadings });
            showNotification("Reading deleted.");
        } catch (error) {
            console.error("Error deleting reading:", error);
            showNotification("Failed to delete reading.", "error");
        }
    };

    const handleSaveNote = async () => {
        const userDocRef = doc(db, "users", user.uid);
        const newReadings = userData.readings.map(r => {
            if (r.date === expandedReading.date) {
                return { ...r, notes: editingNote };
            }
            return r;
        });
        try {
            await updateDoc(userDocRef, { readings: newReadings });
            showNotification("Note saved.");
            setExpandedReading(prev => ({...prev, notes: editingNote}));
        } catch (error) {
            console.error("Error saving note:", error);
            showNotification("Failed to save note.", "error");
        }
    };

    const handleExpand = (reading) => {
        if (expandedReading?.date === reading.date) {
            setExpandedReading(null);
            setEditingNote('');
        } else {
            setExpandedReading(reading);
            setEditingNote(reading.notes || '');
        }
    };

    return (
        <div className="p-4 sm:p-6">
            <h2 className="text-3xl font-serif mb-8 text-foreground text-center">Reading Journal</h2>
            <div className="space-y-4 max-w-4xl mx-auto">
                {!userData.readings || userData.readings.length === 0 ? (
                    <p className="text-center text-foreground/60 mt-10">You have no saved readings yet.</p>
                ) : (
                    userData.readings.slice().reverse().map((reading, index) => (
                        <motion.div key={reading.date} layout className="bg-card p-4 rounded-xl shadow-md border border-border overflow-hidden">
                            <motion.div layout className="flex justify-between items-center cursor-pointer" onClick={() => handleExpand(reading)}>
                                <div>
                                    <h3 className="text-lg font-semibold text-card-foreground capitalize">{reading.title || `${reading.spreadType.replace('-', ' ')} Spread`}</h3>
                                    <span className="text-sm text-card-foreground/60">{new Date(reading.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteReading(reading); }} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={16}/></button>
                                    <motion.div animate={{ rotate: expandedReading?.date === reading.date ? 180 : 0 }}><Feather size={16} className="text-card-foreground/60"/></motion.div>
                                </div>
                            </motion.div>
                            <AnimatePresence>
                                {expandedReading?.date === reading.date && (
                                    <motion.div layout initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }} exit={{ opacity: 0, height: 0, marginTop: 0 }}>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                                            {reading.cards.map((cardData, cardIndex) => (
                                                <div key={cardIndex}>
                                                    <CardDisplay card={cardData} onCardClick={onCardClick}/>
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-card-foreground mb-2">Notes & Reflections</h4>
                                            <textarea value={editingNote} onChange={(e) => setEditingNote(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary h-24" placeholder="Your thoughts on this reading..."></textarea>
                                            <Button onClick={handleSaveNote} className="mt-2 w-full sm:w-auto" variant="secondary">Save Note</Button>
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

const CommunityHub = ({ user, userData, setChattingWith, showNotification, onProfileClick }) => {
    const [activeTab, setActiveTab] = useState('affirmations');

    const TabButton = ({ tabName, label, count }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors relative ${activeTab === tabName ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/20'}`}
        >
            {label}
            {count > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{count}</span>}
        </button>
    );
    
    const communitySections = [
        {name: 'affirmations', label: "Affirmations"},
        {name: 'friends', label: "Friends"},
        {name: 'notifications', label: "Notifications", count: userData?.friendRequestsReceived?.length || 0},
        {name: 'find', label: "Find Friends"}
    ]

    return (
        <div className="p-2 sm:p-6 max-w-4xl mx-auto">
            <h2 className="text-3xl font-serif mb-6 text-center text-foreground">Community Hub</h2>
            
            <div className="sm:hidden mb-6">
                <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)} className="w-full bg-input text-foreground p-3 rounded-lg border border-border focus:border-primary">
                    {communitySections.map(section => (
                         <option key={section.name} value={section.name}>{section.label} {section.count > 0 ? `(${section.count})` : ''}</option>
                    ))}
                </select>
            </div>
            
            <div className="hidden sm:flex justify-center space-x-2 mb-6">
                {communitySections.map(section => (
                     <TabButton key={section.name} tabName={section.name} label={section.label} count={section.count} />
                ))}
            </div>
            
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'affirmations' && <AffirmationWall user={user} userData={userData} setNotification={showNotification} onProfileClick={onProfileClick} />}
                    {activeTab === 'friends' && <FriendsList user={user} userData={userData} setNotification={showNotification} setChattingWith={setChattingWith} onProfileClick={onProfileClick}/>}
                    {activeTab === 'notifications' && <Notifications user={user} userData={userData} setNotification={showNotification} onProfileClick={onProfileClick}/>}
                    {activeTab === 'find' && <FindFriends user={user} userData={userData} setNotification={showNotification} onProfileClick={onProfileClick}/>}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

const AffirmationWall = ({ user, userData, setNotification, onProfileClick }) => {
    const [affirmations, setAffirmations] = useState([]);
    const [newAffirmation, setNewAffirmation] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "affirmations"), orderBy("timestamp", "desc"), limit(50));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const affirmationsData = [];
            querySnapshot.forEach((doc) => {
                affirmationsData.push({ id: doc.id, ...doc.data() });
            });
            setAffirmations(affirmationsData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handlePostAffirmation = async (e) => {
        e.preventDefault();
        if (newAffirmation.trim() === '' || user.isAnonymous) return;
        
        const affirmationData = {
            text: newAffirmation,
            authorId: user.uid,
            authorUsername: userData.username,
            authorAvatarSeed: userData.avatarSeed,
            authorAvatarStyle: userData.avatarStyle,
            timestamp: serverTimestamp(),
            reports: []
        };

        try {
            await addDoc(collection(db, "affirmations"), affirmationData);
            setNewAffirmation('');
        } catch (error) {
            console.error("Error posting affirmation: ", error);
            setNotification("Failed to post affirmation.", "error");
        }
    };
    
    const handleDeleteAffirmation = async (affirmationId) => {
        const affirmationRef = doc(db, 'affirmations', affirmationId);
        try {
            await deleteDoc(affirmationRef);
            setNotification("Affirmation deleted.");
        } catch (error) {
            console.error("Error deleting affirmation:", error);
            setNotification("Failed to delete affirmation.", "error");
        }
    };

    const handleReportAffirmation = async (affirmationId) => {
        const affirmationRef = doc(db, 'affirmations', affirmationId);
        try {
            await runTransaction(db, async (transaction) => {
                const affDoc = await transaction.get(affirmationRef);
                if (!affDoc.exists()) {
                    throw new Error("Affirmation no longer exists.");
                }

                const data = affDoc.data();
                const reports = data.reports || [];

                if (reports.includes(user.uid)) {
                    setNotification("You have already reported this post.");
                    return;
                }

                if (reports.length >= 2) {
                    transaction.delete(affirmationRef);
                    setNotification("Post removed due to multiple reports.");
                } else {
                    transaction.update(affirmationRef, { reports: arrayUnion(user.uid) });
                    setNotification("Post reported. Thank you for your feedback.");
                }
            });
        } catch (error) {
            console.error("Error reporting affirmation:", error);
            setNotification(error.message || "Failed to report affirmation.", "error");
        }
    };

    return (
        <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-lg border border-border">
            <h3 className="text-2xl font-serif text-primary mb-4">Affirmation Wall</h3>
            {!user.isAnonymous && (
                <form onSubmit={handlePostAffirmation} className="flex space-x-2 mb-6">
                    <input 
                        type="text"
                        value={newAffirmation}
                        onChange={(e) => setNewAffirmation(e.target.value)}
                        placeholder="Share a positive thought..."
                        className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    />
                    <Button type="submit" variant="primary" className="px-4" disabled={!newAffirmation.trim()}><Send size={18}/></Button>
                </form>
            )}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {isLoading && <p>Loading affirmations...</p>}
                {affirmations.map(aff => (
                    <div key={aff.id} className="bg-background p-4 rounded-lg flex items-start space-x-4">
                        <img onClick={() => onProfileClick(aff.authorId)} src={API_ENDPOINTS.avatar(aff.authorAvatarSeed, aff.authorAvatarStyle)} alt="avatar" className="w-10 h-10 rounded-full border-2 border-primary/30 cursor-pointer"/>
                        <div className="flex-grow">
                            <p onClick={() => onProfileClick(aff.authorId)} className="font-semibold text-foreground cursor-pointer">@{aff.authorUsername}</p>
                            <p className="text-foreground/90">{aff.text}</p>
                        </div>
                        <div className="flex-shrink-0">
                            {user.uid === aff.authorId ? (
                                <button onClick={() => handleDeleteAffirmation(aff.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={16}/></button>
                            ) : (
                                <button onClick={() => handleReportAffirmation(aff.id)} className="p-2 text-foreground/50 hover:bg-foreground/10 rounded-full"><Flag size={16}/></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FriendsList = ({ user, userData, setNotification, setChattingWith, onProfileClick }) => {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchFriendsAndRequests = useCallback(async () => {
        if (!userData || !userData.friends) {
            setLoading(false);
            return;
        };
        setLoading(true);
        try {
            if (userData.friends && userData.friends.length > 0) {
                const friendsQuery = query(collection(db, 'users'), where('uid', 'in', userData.friends));
                const friendsSnapshot = await getDocs(friendsQuery);
                setFriends(friendsSnapshot.docs.map(doc => doc.data()));
            } else {
                setFriends([]);
            }
        } catch (error) {
            console.error("Error fetching friends data:", error);
            setNotification("Could not load friends list.", "error");
        } finally {
            setLoading(false);
        }
    }, [userData, setNotification]);

    useEffect(() => {
        fetchFriendsAndRequests();
    }, [userData, fetchFriendsAndRequests]);
    
    const handleRemoveFriend = async (friendUid) => {
        if (!window.confirm("Are you sure you want to remove this friend?")) return;
        
        const batch = writeBatch(db);
        const currentUserRef = doc(db, "users", user.uid);
        const friendUserRef = doc(db, "users", friendUid);

        batch.update(currentUserRef, { friends: arrayRemove(friendUid) });
        batch.update(friendUserRef, { friends: arrayRemove(user.uid) });
        
        try {
            await batch.commit();
            setNotification("Friend removed successfully.");
        } catch (error) {
            console.error("Error removing friend:", error);
            setNotification("Failed to remove friend.", "error");
        }
    };

    const UserCard = ({ profile, children, onRemove }) => (
        <div className="bg-background p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer"  onClick={() => onProfileClick(profile.uid)}>
                <img src={API_ENDPOINTS.avatar(profile.avatarSeed, profile.avatarStyle)} alt="avatar" className="w-10 h-10 rounded-full" />
                <div>
                    <p className="font-semibold text-foreground">{profile.preferredName}</p>
                    <p className="text-sm text-foreground/60">@{profile.username}</p>
                </div>
            </div>
            <div className="flex space-x-2">
                 {children}
                 <button onClick={() => onRemove(profile.uid)} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40"><X size={16}/></button>
            </div>
        </div>
    );

    return (
        <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-lg border border-border">
            <h3 className="text-xl font-serif text-primary mb-3">Your Friends</h3>
            {loading && <p>Loading...</p>}
            {!loading && (
                <>
                    {friends.length > 0 ? (
                        <div className="space-y-2">
                            {friends.map(friend => (
                                <UserCard key={friend.uid} profile={friend} onRemove={handleRemoveFriend}>
                                    <button onClick={() => setChattingWith(friend)} className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/40"><MessageSquare size={16}/></button>
                                </UserCard>
                            ))}
                        </div>
                    ) : (
                        <p className="text-foreground/60 text-center py-4">You haven't added any friends yet.</p>
                    )}
                </>
            )}
        </div>
    );
};

const Notifications = ({ user, userData, setNotification, onProfileClick }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        if (!userData || !userData.friendRequestsReceived) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            if (userData.friendRequestsReceived.length > 0) {
                const requestsQuery = query(collection(db, 'users'), where('uid', 'in', userData.friendRequestsReceived));
                const requestsSnapshot = await getDocs(requestsQuery);
                setRequests(requestsSnapshot.docs.map(doc => doc.data()));
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("Error fetching friend requests:", error);
            setNotification("Could not load friend requests.", "error");
        } finally {
            setLoading(false);
        }
    }, [userData, setNotification]);

    useEffect(() => {
        fetchRequests();
    }, [userData, fetchRequests]);

    const handleRequest = async (senderProfile, accept) => {
        const senderUid = senderProfile.uid;
        const batch = writeBatch(db);
        const currentUserRef = doc(db, "users", user.uid);
        const senderUserRef = doc(db, "users", senderUid);

        batch.update(currentUserRef, { friendRequestsReceived: arrayRemove(senderUid) });
        batch.update(senderUserRef, { friendRequestsSent: arrayRemove(user.uid) });

        if (accept) {
            batch.update(currentUserRef, { friends: arrayUnion(senderUid) });
            batch.update(senderUserRef, { friends: arrayUnion(user.uid) });
        }
        
        try {
            await batch.commit();
            setNotification(accept ? `You and @${senderProfile.username} are now friends!` : "Request declined.");
        } catch (error) {
            console.error("Error handling friend request:", error);
            setNotification("Failed to process request.", "error");
        }
    };
    
    return (
        <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-lg border border-border">
            <h3 className="text-2xl font-serif text-primary mb-4">Notifications</h3>
            {loading && <p>Loading...</p>}
            {!loading && (
                <>
                    {requests.length > 0 ? (
                        <div className="space-y-2">
                            {requests.map(req => (
                                <div key={req.uid} className="bg-background p-3 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onProfileClick(req.uid)}>
                                        <img src={API_ENDPOINTS.avatar(req.avatarSeed, req.avatarStyle)} alt="avatar" className="w-10 h-10 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-foreground">{req.preferredName}</p>
                                            <p className="text-sm text-foreground/60">@{req.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleRequest(req, true)} className="p-2 bg-green-500/20 text-green-400 rounded-full hover:bg-green-500/40"><Check size={16}/></button>
                                        <button onClick={() => handleRequest(req, false)} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40"><X size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-foreground/60 text-center py-4">You have no new notifications.</p>
                    )}
                </>
            )}
        </div>
    );
};

const FindFriends = ({ user, userData, setNotification, onProfileClick }) => {
    const [searchUsername, setSearchUsername] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        const searchTerm = searchUsername.trim().toLowerCase();
        if (searchTerm === '' || searchTerm === userData.username) {
            setSearchResult(null);
            return;
        }
        setIsSearching(true);
        setSearchResult(null);
        setSearchMessage('');

        try {
            const usernamesRef = collection(db, 'usernames');
            const q = query(usernamesRef, where("username", "==", searchTerm));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setSearchMessage('User not found.');
            } else {
                const foundUsernameDoc = querySnapshot.docs[0].data();
                const userDocRef = doc(db, 'users', foundUsernameDoc.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setSearchResult(userDoc.data());
                } else {
                    setSearchMessage('User not found.');
                }
            }
        } catch (error) {
            console.error("Error searching for user:", error);
            setSearchMessage('An error occurred during search.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendRequest = async (targetUid) => {
        const batch = writeBatch(db);
        const currentUserRef = doc(db, "users", user.uid);
        const targetUserRef = doc(db, "users", targetUid);

        batch.update(currentUserRef, { friendRequestsSent: arrayUnion(targetUid) });
        batch.update(targetUserRef, { friendRequestsReceived: arrayUnion(user.uid) });

        try {
            await batch.commit();
            setNotification(`Friend request sent to @${searchResult.username}!`);
            setSearchResult(null);
            setSearchUsername('');
        } catch (error) {
            console.error("Error sending friend request:", error);
            setNotification("Failed to send request.", "error");
        }
    };

    const isAlreadyFriend = searchResult && userData.friends?.includes(searchResult.uid);
    const isRequestSent = searchResult && userData.friendRequestsSent?.includes(searchResult.uid);
    const isRequestReceived = searchResult && userData.friendRequestsReceived?.includes(searchResult.uid);

    return (
        <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-lg border border-border">
            <h3 className="text-2xl font-serif text-primary mb-4">Find Friends</h3>
            <form onSubmit={handleSearch} className="flex space-x-2 mb-4">
                <input 
                    type="text"
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    placeholder="Search by username..."
                    className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                />
                <Button type="submit" variant="primary" className="px-4" disabled={isSearching}>Search</Button>
            </form>

            {isSearching && <p>Searching...</p>}
            {searchMessage && <p className="text-center text-foreground/60 py-4">{searchMessage}</p>}
            
            {searchResult && (
                <div className="bg-background p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onProfileClick(searchResult.uid)}>
                        <img src={API_ENDPOINTS.avatar(searchResult.avatarSeed, searchResult.avatarStyle)} alt="avatar" className="w-10 h-10 rounded-full" />
                        <div>
                            <p className="font-semibold text-foreground">{searchResult.preferredName}</p>
                            <p className="text-sm text-foreground/60">@{searchResult.username}</p>
                        </div>
                    </div>
                    <div>
                        {isAlreadyFriend ? (
                            <span className="text-sm text-green-400 font-semibold">Friend</span>
                        ) : isRequestSent ? (
                            <span className="text-sm text-foreground/60">Request Sent</span>
                        ) : isRequestReceived ? (
                             <span className="text-sm text-primary">Check Requests</span>
                        ) : (
                            <button onClick={() => handleSendRequest(searchResult.uid)} className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/40"><UserPlus size={16}/></button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ChatView = ({ user, friend, onBack }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

    useEffect(() => {
        const chatId = getChatId(user.uid, friend.uid);
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [user.uid, friend.uid]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;

        const chatId = getChatId(user.uid, friend.uid);
        const messagesRef = collection(db, 'chats', chatId, 'messages');

        await addDoc(messagesRef, {
            text: newMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
        });

        setNewMessage('');
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                        {msg.senderId !== user.uid && <img src={API_ENDPOINTS.avatar(friend.avatarSeed, friend.avatarStyle)} className="w-6 h-6 rounded-full" alt="friend avatar"/>}
                        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.senderId === user.uid ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-background rounded-bl-none'}`}>
                            <p>{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 bg-card border-t border-border flex space-x-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                />
                <Button type="submit" variant="primary" className="px-4" disabled={!newMessage.trim()}><Send size={18}/></Button>
            </form>
        </div>
    );
};

const Footer = ({ navigate, activeView, userData }) => {
    const navItems = [
        { name: 'Home', view: 'dashboard', icon: <Menu /> },
        { name: 'Community', view: 'community', icon: <Users />, guestDisabled: true, notificationCount: userData?.friendRequestsReceived?.length || 0 },
        { name: 'Tarot', view: 'tarot', icon: <Feather /> },
        { name: 'Profile', view: 'profile', icon: <User />, guestDisabled: true }
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border z-30 md:hidden">
            <nav className="flex justify-around p-1">
                {navItems.map(item => {
                    const isDisabled = item.guestDisabled && userData?.isAnonymous;
                    return (
                        <button 
                            key={item.name} 
                            onClick={() => !isDisabled && navigate(item.view)} 
                            disabled={isDisabled}
                            className={`flex flex-col items-center justify-center w-full py-2 px-1 rounded-lg transition-all duration-300 relative text-sm ${activeView === item.view ? 'text-primary' : 'text-foreground/60'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-primary'}`}
                        >
                            {item.notificationCount > 0 && (
                                <span className="absolute top-1 right-3 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{item.notificationCount}</span>
                            )}
                            {React.cloneElement(item.icon, { size: 20 })}
                            <span className="text-xs mt-1">{item.name}</span>
                            {activeView === item.view && !isDisabled && (
                                <motion.div layoutId="active-pill" className="absolute bottom-0 h-1 w-8 bg-primary rounded-full" transition={{ type: 'spring', stiffness: 300, damping: 25 }}></motion.div>
                            )}
                        </button>
                    );
                })}
            </nav>
        </footer>
    );
};

const App = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [chattingWith, setChattingWith] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: 'success' });
    const { navigate, back, navigateToRoot, currentRoute, canGoBack, direction } = useNavigation('dashboard');
    const { view: currentView, data: currentData } = currentRoute;

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: 'success' }), 4000);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setLoadingAuth(true);
            if (currentUser) {
                setUser(currentUser);
                if (!currentUser.isAnonymous) {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const unsubSnapshot = onSnapshot(userDocRef, (doc) => {
                        if (doc.exists()) {
                            setUserData(doc.data());
                        }
                        setLoadingAuth(false);
                    });
                    return () => unsubSnapshot();
                } else {
                    setUserData({ 
                        uid: currentUser.uid, 
                        preferredName: 'Guest', 
                        avatarSeed: 'guest-user-seed',
                        avatarStyle: 'notionists',
                        zodiac: 'Aries', 
                        readings: [], 
                        isAnonymous: true 
                    });
                    setLoadingAuth(false);
                }
            } else {
                setUser(null);
                setUserData(null);
                setLoadingAuth(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        setChattingWith(null);
        navigateToRoot();
    };

    const pageVariants = {
        initial: { opacity: 0, x: `${10 * direction}%` },
        in: { opacity: 1, x: "0%" },
        out: { opacity: 0, x: `${-10 * direction}%` }
    };

    const pageTransition = { type: "tween", ease: "anticipate", duration: 0.4 };
    
    const ChatWrapper = ({ user, friend, onBack }) => {
        return (
            <div className="h-screen flex flex-col">
                <Header userData={friend} onLogout={() => {}} onLogoClick={() => {}} onAvatarClick={() => {}} onBack={onBack} canGoBack={true} />
                <ChatView user={user} friend={friend} onBack={onBack} />
            </div>
        )
    };
    
    const PublicProfileView = ({ profileUid, onBack }) => {
        const [profileData, setProfileData] = useState(null);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            const fetchProfile = async () => {
                setIsLoading(true);
                const userDocRef = doc(db, 'users', profileUid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setProfileData(userDoc.data());
                } else {
                    showNotification("User profile not found.", "error");
                    onBack();
                }
                setIsLoading(false);
            };
            fetchProfile();
        }, [profileUid, onBack]);

        if (isLoading) return <LoadingSpinner />;
        if (!profileData) return null;

        return (
            <div className="p-4">
                 <button onClick={onBack} className="flex items-center space-x-2 text-primary mb-4"><ArrowLeft size={16}/><span>Back</span></button>
                <div className="bg-card p-6 rounded-2xl shadow-lg max-w-md mx-auto text-center border border-border">
                    <img src={API_ENDPOINTS.avatar(profileData.avatarSeed, profileData.avatarStyle)} alt="avatar" className="w-32 h-32 rounded-full mx-auto border-4 border-primary/40 mb-4" />
                    <h2 className="text-2xl font-bold text-foreground">@{profileData.username}</h2>
                    {profileData.isNamePublic && <p className="text-xl text-foreground/80">{profileData.preferredName}</p>}
                    {profileData.isPronounsPublic && <p className="text-sm text-foreground/60">{profileData.pronouns}</p>}
                    {profileData.isZodiacPublic && <p className="text-sm text-foreground/60">{profileData.zodiac}</p>}
                    {profileData.isBioPublic && <p className="mt-4 text-foreground/90">{profileData.bio}</p>}
                </div>
            </div>
        );
    };

    const CurrentView = () => {
        if (user && userData && userData.needsSetup) {
            return <AccountSetup user={user} db={db} onSetupComplete={() => navigate('dashboard')} />;
        }
        
        if (chattingWith) {
            return <ChatWrapper user={user} friend={chattingWith} onBack={() => setChattingWith(null)} />;
        }

        if (userData?.isAnonymous && (currentView === 'community' || currentView === 'ouija' || currentView === 'past_readings' || currentView === 'profile' || currentView === 'public_profile')) {
            return <Dashboard navigate={navigate} userData={userData}/>;
        }

        switch (currentView) {
            case 'dashboard': return <Dashboard navigate={navigate} userData={userData}/>;
            case 'horoscope': return <Horoscope zodiac={userData?.zodiac} />;
            case 'tarot': return <TarotReading user={user} showNotification={showNotification} />;
            case 'profile': return <Profile user={user} userData={userData} showNotification={showNotification} />;
            case 'public_profile': return <PublicProfileView profileUid={currentData.uid} onBack={back} />;
            case 'past_readings': return <PastReadings user={user} userData={userData} showNotification={showNotification} onCardClick={(card) => { console.log("Card clicked:", card)}} />;
            case 'community': return <CommunityHub user={user} userData={userData} setChattingWith={setChattingWith} showNotification={showNotification} onProfileClick={(uid) => navigate('public_profile', { uid })}/>;
            case 'ouija': return <OuijaRoom user={user} userData={userData} onBack={back} db={db} />;
            default: return <Dashboard navigate={navigate} userData={userData}/>;
        }
    };

    if (loadingAuth || (user && !user.isAnonymous && !userData)) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return (
            <>
                <Notification message={notification.message} type={notification.type} />
                <Login setNotification={showNotification} />
            </>
        );
    }

    return (
        <div className="bg-background text-foreground font-sans min-h-screen overscroll-none">
            <Notification message={notification.message} type={notification.type} />
            {!(userData && userData.needsSetup) && !chattingWith && <Header userData={userData} onLogout={handleLogout} onLogoClick={navigateToRoot} onAvatarClick={() => navigate('profile')} onBack={back} canGoBack={canGoBack} />}
            <main className={chattingWith ? "h-screen" : "pb-24 md:pb-4"}>
                <AnimatePresence mode="wait">
                    <motion.div key={currentView + (userData?.needsSetup ? 'setup' : '') + (chattingWith ? chattingWith.uid : '') + currentData?.uid} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className={chattingWith ? "h-full" : ""}>
                        <CurrentView />
                    </motion.div>
                </AnimatePresence>
            </main>
            {!(userData && userData.needsSetup) && !chattingWith && <Footer navigate={navigate} activeView={currentView} userData={userData} />}
        </div>
    );
};
export default App;