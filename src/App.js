import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, deleteUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, orderBy, limit, addDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Star, Menu, Key, Feather, BookOpen, ArrowLeft, AlertTriangle, Info, Users, MessageSquare, Sparkles, UserPlus, Send, Check, X, Trash2, Flag } from 'lucide-react';
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
    tarotImageBase: '/cards/',
    avatar: (seed) => `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=f0e7f7,e0f0e9,d1d4f9`
};

const useNavigation = (initialView = 'dashboard') => {
    const [history, setHistory] = useState([initialView]);
    const direction = useRef(1);

    const navigate = (newView) => {
        if (newView === history[history.length - 1]) return;
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
        if (history.length <= 1) return;
        direction.current = -1;
        setHistory(['dashboard']);
    };

    const currentView = history[history.length - 1];
    const canGoBack = history.length > 1;

    return { navigate, back, navigateToRoot, currentView, canGoBack, direction: direction.current };
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

const Login = () => {
    const handleGoogleLogin = async (isSignUp) => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            // If it's a new user (document doesn't exist), create it with needsSetup: true
            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    photoURL: user.photoURL,
                    googleDisplayName: user.displayName,
                    needsSetup: true, // This triggers the AccountSetup component
                    createdAt: new Date().toISOString(),
                });
            }
            // If it's an existing user signing in, we just let the onAuthStateChanged handle it.
            // The needsSetup flag will be read from their existing document.
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
                <Button onClick={() => handleGoogleLogin(true)} variant="primary">
                    <UserPlus size={18}/>
                    <span>Sign Up with Google</span>
                </Button>
                 <Button onClick={() => handleGoogleLogin(false)} variant="secondary">
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
                src={API_ENDPOINTS.avatar(userData?.avatarSeed || 'guest')}
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
        { view: 'past_readings', title: 'Reading Journal', desc: 'Review your saved tarot readings.', icon: <BookOpen/>, guestDisabled: true },
        { view: 'community', title: 'Community', desc: 'Connect with friends & share affirmations.', icon: <Users/>, guestDisabled: true },
        { view: 'ouija', title: 'Ouija Room', desc: 'Communicate with the other side.', icon: <Sparkles/>, guestDisabled: true },
    ];

    return (
        <div className="p-4 sm:p-6">
            <h2 className="text-3xl sm:text-4xl font-serif text-center mb-8 text-foreground">Welcome, {userData?.preferredName || 'Seeker'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {items.map((item, i) => {
                    const isDisabled = item.guestDisabled && userData?.isAnonymous;
                    return (
                        <motion.div
                            key={item.view}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                            onClick={() => !isDisabled && navigate(item.view)}
                            className={`bg-card p-6 rounded-2xl shadow-lg border border-border flex items-center space-x-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-foreground/5 transition-all duration-300 transform hover:-translate-y-1 hover:border-primary/50'}`}
                        >
                            <div className="bg-primary/10 text-primary p-3 rounded-full">{item.icon}</div>
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-card-foreground">{item.title}</h3>
                                <p className="text-card-foreground/70">{item.desc}</p>
                                {isDisabled && <p className="text-xs text-amber-500 mt-1">Sign in to access this feature.</p>}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

const TarotReading = ({ user, fetchUserData }) => {
    const [fullDeck, setFullDeck] = useState([]);
    const [spreadType, setSpreadType] = useState(null);
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [readingTitle, setReadingTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState('');

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
            setNotification("Please enter a title for your reading.");
            setTimeout(() => setNotification(''), 3000);
            return;
        }
        setNotification('Saving...');
        const userDocRef = doc(db, "users", user.uid);
        const readingToSave = {
            title: readingTitle,
            spreadType,
            date: new Date().toISOString(),
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
            setNotification("Reading saved successfully!");
            if (fetchUserData) await fetchUserData(user.uid);
            setIsSaving(false);
            setReadingTitle("");
        } catch (err) {
            console.error("Error saving reading:", err);
            setNotification("Error: Could not save reading.");
        } finally {
            setTimeout(() => setNotification(''), 3000);
        }
    };
    
    const openSaveModal = () => {
        if (user.isAnonymous) {
            setNotification('Guests cannot save readings.');
            setTimeout(() => setNotification(''), 3000);
            return;
        }
        setIsSaving(true);
    };

    const CardDisplay = ({ card }) => {
        return (
            <div className="flex flex-col items-center">
                <div className="relative w-full aspect-[2/3.5] bg-gray-700 rounded-xl overflow-hidden">
                   <img
                        src={`${API_ENDPOINTS.tarotImageBase}${card.img}`}
                        alt={card.name}
                        className={`w-full h-full object-cover ${card.isReversed ? 'rotate-180' : ''}`}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x350/1f2937/9333ea?text=Card+Art'; }}
                    />
                </div>
                 <button onClick={() => setSelectedCard(card)} className="mt-2 text-sm text-primary hover:underline">View Meaning</button>
            </div>
        );
    };

    if (!spreadType) {
        return (
            <div className="text-center max-w-md mx-auto p-4">
                <h2 className="text-3xl font-serif mb-8 text-foreground">Choose a Tarot Spread</h2>
                {error && <div className="mb-4"><ErrorDisplay message={error}/></div>}
                {loading && <div className="flex justify-center"><LoadingSpinner/></div>}
                <div className="space-y-5">
                    {[['single', 'Simple Reading (1 Card)', 1], ['three-card', 'Three-Card Spread', 3], ['celtic-cross', 'Celtic Cross', 10]].map(([type, label, count], i) => (
                        <motion.button key={type} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} onClick={() => drawCards(count, type)} disabled={loading || fullDeck.length === 0} className="w-full bg-card border border-border p-4 rounded-xl hover:border-primary text-card-foreground font-semibold transition-all hover:bg-foreground/5 disabled:opacity-50">
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
            <Notification message={notification} />
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
            </AnimatePresence>

            <div className="flex justify-center mb-6 space-x-4">
                 <Button onClick={() => setSpreadType(null)} variant="secondary">New Spread</Button>
                 <Button onClick={openSaveModal} variant="primary" disabled={user.isAnonymous || cards.length === 0}>Save Reading</Button>
            </div>
            
            {loading && <div className="flex justify-center"><LoadingSpinner/></div>}
            {error && <div className="max-w-md mx-auto"><ErrorDisplay message={error}/></div>}

            {cards && cards.length > 0 && (
                <div className="max-w-5xl mx-auto">
                    {spreadType === 'single' && <div className="w-48 mx-auto"><CardDisplay card={cards[0]}/></div>}
                    {spreadType === 'three-card' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
                            {cards.map((card, i) => (
                                <div key={card.id}>
                                    <h3 className="text-center text-xl font-serif text-foreground mb-3">{['Past', 'Present', 'Future'][i]}</h3>
                                    <div className="w-48 mx-auto"><CardDisplay card={card}/></div>
                                </div>
                            ))}
                        </div>
                    )}
                     {spreadType === 'celtic-cross' && cards.length === 10 && (
                         <div className="w-full max-w-lg mx-auto p-2 flex space-x-2">
                             <div className="flex-1 grid grid-cols-3 grid-rows-4 gap-2">
                                <div className="col-start-2 row-start-1"><CardDisplay card={cards[4]}/></div>
                                <div className="col-start-1 row-start-2"><CardDisplay card={cards[3]}/></div>
                                <div className="col-start-2 row-start-2"><CardDisplay card={cards[0]}/></div>
                                <div className="col-start-3 row-start-2"><CardDisplay card={cards[5]}/></div>
                                <div className="col-start-2 row-start-3"><CardDisplay card={cards[2]}/></div>
                                <div className="col-start-2 row-start-4"><CardDisplay card={cards[1]}/></div>
                             </div>
                             <div className="flex-shrink-0 w-1/4 border-l-2 border-primary/50 pl-2">
                                <div className="space-y-2">
                                    <CardDisplay card={cards[9]}/>
                                    <CardDisplay card={cards[8]}/>
                                    <CardDisplay card={cards[7]}/>
                                    <CardDisplay card={cards[6]}/>
                                </div>
                             </div>
                         </div>
                    )}
                </div>
            )}
        </div>
    );
};

const Profile = ({ user, userData, fetchUserData, navigate }) => {
    const [preferredName, setPreferredName] = useState(userData?.preferredName || '');
    const [pronouns, setPronouns] = useState(userData?.pronouns || '');
    const [avatarSeed, setAvatarSeed] = useState(userData?.avatarSeed || '');
    const [zodiac, setZodiac] = useState(userData?.zodiac || 'Aries');
    const [notification, setNotification] = useState('');
    const [showInfo, setShowInfo] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

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
            await updateDoc(userDocRef, { preferredName, pronouns, avatarSeed, zodiac });
            setNotification('Profile saved successfully!');
        } catch (error) {
            console.error("Error saving profile:", error);
            setNotification('Failed to save profile.');
        } finally {
            setTimeout(() => setNotification(''), 3000);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmationText !== 'delete my account') {
            setNotification("Please type the confirmation phrase correctly.");
            setTimeout(() => setNotification(''), 3000);
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

            setNotification('Account deleted successfully.');
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting account:", error);
            setNotification(`Failed to delete account. Please log out and log back in to try again. Error: ${error.message}`);
        }
    };

    return (
        <div className="bg-card p-6 rounded-2xl shadow-lg max-w-lg mx-auto border border-border">
            <Notification message={notification} />
            <AnimatePresence>
                {showInfo && (
                    <Modal onClose={() => setShowInfo(false)}>
                        <h2 className="text-2xl font-serif text-primary mb-4">About Avatar Seeds</h2>
                        <p className="text-foreground/90 mb-2">Your avatar is generated from a unique "seed" string. Any text can be a seed: your name, a favorite word, or just random characters.</p>
                        <p className="text-foreground/90 mb-4">Changing the seed will create a completely new avatar. The DiceBear 'Notionists' style allows for an almost limitless number of unique combinations, so your avatar can be truly unique!</p>
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
                <img src={API_ENDPOINTS.avatar(avatarSeed)} alt="avatar" className="w-32 h-32 rounded-full border-4 border-primary/40 mb-4" />
                <div className="w-full space-y-4">
                    <div>
                        <label className="text-foreground/80 mb-2 block">Username</label>
                        <input type="text" value={userData?.isAnonymous ? 'N/A' : `@${userData?.username || ''}`} className="bg-input/50 text-foreground/70 p-3 rounded-lg w-full border border-border" disabled/>
                    </div>
                     <div>
                        <label htmlFor="preferredName" className="text-foreground/80 mb-2 block">Preferred Name</label>
                        <input id="preferredName" type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" disabled={user.isAnonymous}/>
                    </div>
                     <div>
                        <label htmlFor="pronouns" className="text-foreground/80 mb-2 block">Pronouns</label>
                        <input id="pronouns" type="text" value={pronouns} onChange={(e) => setPronouns(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" disabled={user.isAnonymous}/>
                    </div>
                    <div>
                         <label htmlFor="avatarSeed" className="text-foreground/80 mb-2 flex items-center">Avatar Seed <Info size={14} className="ml-2 cursor-pointer" onClick={() => setShowInfo(true)}/></label>
                        <input id="avatarSeed" type="text" value={avatarSeed} onChange={(e) => setAvatarSeed(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" placeholder="Enter anything here" disabled={user.isAnonymous}/>
                    </div>
                    <div>
                         <label htmlFor="zodiac" className="text-foreground/80 mb-2 block">Zodiac Sign</label>
                        <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none" disabled={user.isAnonymous}>
                            {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            
            <Button onClick={handleSave} className="w-full" disabled={user.isAnonymous}>Save Changes</Button>
            {!user.isAnonymous && <Button onClick={() => setShowDeleteModal(true)} variant="ghost" className="w-full mt-4 text-red-500 hover:bg-red-500/10">Delete Account</Button>}
        </div>
    );
};

const PastReadings = ({ readings }) => {
    const [expanded, setExpanded] = useState(null);
    return (
        <div className="p-4 sm:p-6">
            <h2 className="text-3xl font-serif mb-8 text-foreground text-center">Reading Journal</h2>
            <div className="space-y-4 max-w-4xl mx-auto">
                {!readings || readings.length === 0 ? (
                    <p className="text-center text-foreground/60 mt-10">You have no saved readings yet.</p>
                ) : (
                    readings.slice().reverse().map((reading, index) => (
                        <motion.div key={reading.date} layout className="bg-card p-4 rounded-xl shadow-md border border-border overflow-hidden">
                            <motion.div layout className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(expanded === index ? null : index)}>
                                <div>
                                    <h3 className="text-lg font-semibold text-card-foreground capitalize">{reading.title || `${reading.spreadType.replace('-', ' ')} Spread`}</h3>
                                    <span className="text-sm text-card-foreground/60">{new Date(reading.date).toLocaleDateString()}</span>
                                </div>
                                <motion.div animate={{ rotate: expanded === index ? 180 : 0 }}><Feather size={16} className="text-card-foreground/60"/></motion.div>
                            </motion.div>
                            <AnimatePresence>
                                {expanded === index && (
                                    <motion.div layout initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }} exit={{ opacity: 0, height: 0, marginTop: 0 }}>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {reading.cards.map((cardData, cardIndex) => (
                                                <div key={cardIndex}>
                                                    <img src={`${API_ENDPOINTS.tarotImageBase}${cardData.img}`} alt={cardData.name} className="rounded-lg shadow-sm" />
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

const CommunityHub = ({ user, userData, fetchUserData, setChattingWith }) => {
    const [activeTab, setActiveTab] = useState('affirmations');
    const [notification, setNotification] = useState('');

    const TabButton = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === tabName ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/20'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <Notification message={notification} />
            <h2 className="text-3xl font-serif mb-6 text-center text-foreground">Community Hub</h2>
            <div className="flex justify-center space-x-2 mb-6">
                <TabButton tabName="affirmations" label="Affirmations" />
                <TabButton tabName="friends" label="Friends" />
                <TabButton tabName="find" label="Find Friends" />
            </div>
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'affirmations' && <AffirmationWall user={user} userData={userData} setNotification={setNotification} />}
                    {activeTab === 'friends' && <FriendsList user={user} userData={userData} fetchUserData={fetchUserData} setNotification={setNotification} setChattingWith={setChattingWith} />}
                    {activeTab === 'find' && <FindFriends user={user} userData={userData} setNotification={setNotification} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

const AffirmationWall = ({ user, userData, setNotification }) => {
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
            timestamp: serverTimestamp(),
            reports: []
        };

        try {
            await addDoc(collection(db, "affirmations"), affirmationData);
            setNewAffirmation('');
        } catch (error) {
            console.error("Error posting affirmation: ", error);
            setNotification("Failed to post affirmation.");
        }
    };
    
    const handleDeleteAffirmation = async (affirmationId) => {
        const affirmationRef = doc(db, 'affirmations', affirmationId);
        try {
            await deleteDoc(affirmationRef);
            setNotification("Affirmation deleted.");
        } catch (error) {
            console.error("Error deleting affirmation:", error);
            setNotification("Failed to delete affirmation.");
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
            setNotification(error.message || "Failed to report affirmation.");
        }
    };

    return (
        <div className="bg-card p-6 rounded-2xl shadow-lg border border-border">
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
                        <img src={API_ENDPOINTS.avatar(aff.authorAvatarSeed)} alt="avatar" className="w-10 h-10 rounded-full border-2 border-primary/30" />
                        <div className="flex-grow">
                            <p className="font-semibold text-foreground">@{aff.authorUsername}</p>
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

const FriendsList = ({ user, userData, fetchUserData, setNotification, setChattingWith }) => {
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchFriendsAndRequests = useCallback(async () => {
        if (!userData) return;
        setLoading(true);
        try {
            if (userData.friends && userData.friends.length > 0) {
                const friendsQuery = query(collection(db, 'users'), where('uid', 'in', userData.friends));
                const friendsSnapshot = await getDocs(friendsQuery);
                setFriends(friendsSnapshot.docs.map(doc => doc.data()));
            } else {
                setFriends([]);
            }
            if (userData.friendRequestsReceived && userData.friendRequestsReceived.length > 0) {
                const requestsQuery = query(collection(db, 'users'), where('uid', 'in', userData.friendRequestsReceived));
                const requestsSnapshot = await getDocs(requestsQuery);
                setRequests(requestsSnapshot.docs.map(doc => doc.data()));
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("Error fetching friends data:", error);
            setNotification("Could not load friends list.");
        } finally {
            setLoading(false);
        }
    }, [userData, setNotification]);

    useEffect(() => {
        fetchFriendsAndRequests();
    }, [userData, fetchFriendsAndRequests]);

    const handleRequest = async (targetUid, accept) => {
        const batch = writeBatch(db);
        const currentUserRef = doc(db, "users", user.uid);
        const targetUserRef = doc(db, "users", targetUid);

        batch.update(currentUserRef, { friendRequestsReceived: arrayRemove(targetUid) });
        if (accept) {
            batch.update(currentUserRef, { friends: arrayUnion(targetUid) });
            batch.update(targetUserRef, { friends: arrayUnion(user.uid) });
        }
        
        try {
            await batch.commit();
            setNotification(accept ? "Friend added!" : "Request declined.");
        } catch (error) {
            console.error("Error handling friend request:", error);
            setNotification("Failed to process request.");
        }
    };

    const UserCard = ({ profile, children }) => (
        <div className="bg-background p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <img src={API_ENDPOINTS.avatar(profile.avatarSeed)} alt="avatar" className="w-10 h-10 rounded-full" />
                <div>
                    <p className="font-semibold text-foreground">{profile.preferredName}</p>
                    <p className="text-sm text-foreground/60">@{profile.username}</p>
                </div>
            </div>
            <div>{children}</div>
        </div>
    );

    return (
        <div className="bg-card p-6 rounded-2xl shadow-lg border border-border">
            {loading && <p>Loading...</p>}
            {!loading && (
                <>
                    {requests.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-xl font-serif text-primary mb-3">Friend Requests</h3>
                            <div className="space-y-2">
                                {requests.map(req => (
                                    <UserCard key={req.uid} profile={req}>
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleRequest(req.uid, true)} className="p-2 bg-green-500/20 text-green-400 rounded-full hover:bg-green-500/40"><Check size={16}/></button>
                                            <button onClick={() => handleRequest(req.uid, false)} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40"><X size={16}/></button>
                                        </div>
                                    </UserCard>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <h3 className="text-xl font-serif text-primary mb-3">Your Friends</h3>
                        {friends.length > 0 ? (
                            <div className="space-y-2">
                                {friends.map(friend => (
                                    <UserCard key={friend.uid} profile={friend}>
                                        <button onClick={() => setChattingWith(friend)} className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/40"><MessageSquare size={16}/></button>
                                    </UserCard>
                                ))}
                            </div>
                        ) : (
                            <p className="text-foreground/60 text-center py-4">You haven't added any friends yet.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const FindFriends = ({ user, userData, setNotification }) => {
    const [searchUsername, setSearchUsername] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (searchUsername.trim() === '' || searchUsername.trim() === userData.username) {
            setSearchResult(null);
            return;
        }
        setIsSearching(true);
        setSearchResult(null);
        setSearchMessage('');

        try {
            const usernamesRef = collection(db, 'usernames');
            const q = query(usernamesRef, where("username", "==", searchUsername.toLowerCase()));
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
            setNotification(`Friend request sent to @${searchUsername}!`);
            setSearchResult(null);
            setSearchUsername('');
        } catch (error) {
            console.error("Error sending friend request:", error);
            setNotification("Failed to send request.");
        }
    };

    const isAlreadyFriend = searchResult && userData.friends?.includes(searchResult.uid);
    const isRequestSent = searchResult && userData.friendRequestsSent?.includes(searchResult.uid);
    const isRequestReceived = searchResult && userData.friendRequestsReceived?.includes(searchResult.uid);

    return (
        <div className="bg-card p-6 rounded-2xl shadow-lg border border-border">
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
                    <div className="flex items-center space-x-3">
                        <img src={API_ENDPOINTS.avatar(searchResult.avatarSeed)} alt="avatar" className="w-10 h-10 rounded-full" />
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
        <div className="p-4 sm:p-6 max-w-4xl mx-auto h-[calc(100vh-150px)] flex flex-col">
            <div className="flex items-center mb-4">
                <button onClick={onBack} className="p-2 mr-2 rounded-full hover:bg-foreground/10 transition-colors">
                    <ArrowLeft className="text-foreground/70" size={20}/>
                </button>
                <img src={API_ENDPOINTS.avatar(friend.avatarSeed)} alt="avatar" className="w-10 h-10 rounded-full mr-3" />
                <div>
                    <h2 className="text-xl font-bold text-foreground">{friend.preferredName}</h2>
                    <p className="text-sm text-foreground/60">@{friend.username}</p>
                </div>
            </div>

            <div className="flex-grow bg-card border border-border rounded-2xl p-4 overflow-y-auto mb-4 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                        {msg.senderId !== user.uid && <img src={API_ENDPOINTS.avatar(friend.avatarSeed)} className="w-6 h-6 rounded-full" alt="friend avatar"/>}
                        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.senderId === user.uid ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-background rounded-bl-none'}`}>
                            <p>{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex space-x-2">
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
        { name: 'Community', view: 'community', icon: <Users />, guestDisabled: true },
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
    const { navigate, back, navigateToRoot, currentView, canGoBack, direction } = useNavigation('dashboard');

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
                        // If doc doesn't exist, it means user just signed up,
                        // needsSetup will be true from the Login component's logic.
                        // The snapshot will update once the doc is created.
                        setLoadingAuth(false);
                    });
                    return () => unsubSnapshot();
                } else {
                    // Guest user data
                    setUserData({ 
                        uid: currentUser.uid, 
                        preferredName: 'Guest', 
                        avatarSeed: 'guest-user-seed', 
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

    const CurrentView = () => {
        // Force user to setup account if needed
        if (user && !user.isAnonymous && userData && userData.needsSetup) {
            return <AccountSetup user={user} db={db} onSetupComplete={() => { /* onSnapshot handles data refresh */ }} />;
        }
        
        // Handle chat view separately
        if (chattingWith) {
            return <ChatView user={user} friend={chattingWith} onBack={() => setChattingWith(null)} />;
        }

        // Guest user restrictions
        if (userData?.isAnonymous) {
            if (currentView === 'community' || currentView === 'ouija' || currentView === 'past_readings' || currentView === 'profile') {
                return <Dashboard navigate={navigate} userData={userData}/>;
            }
        }

        switch (currentView) {
            case 'dashboard': return <Dashboard navigate={navigate} userData={userData}/>;
            case 'horoscope': return <Horoscope zodiac={userData?.zodiac} />;
            case 'tarot': return <TarotReading user={user} fetchUserData={() => {}} />;
            case 'profile': return <Profile user={user} userData={userData} fetchUserData={() => {}} navigate={navigate} />;
            case 'past_readings': return <PastReadings readings={userData?.readings || []} />;
            case 'community': return <CommunityHub user={user} userData={userData} fetchUserData={() => {}} setChattingWith={setChattingWith} />;
            case 'ouija': return <OuijaRoom user={user} userData={userData} onBack={back} />;
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
            {!(userData && userData.needsSetup) && !chattingWith && <Header userData={userData} onLogout={handleLogout} onLogoClick={navigateToRoot} onAvatarClick={() => navigate('profile')} onBack={back} canGoBack={canGoBack} />}
            <main className="pb-24 md:pb-4">
                <AnimatePresence initial={false} mode="wait">
                    <motion.div key={currentView + (userData?.needsSetup ? 'setup' : '') + (chattingWith ? chattingWith.uid : '')} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}>
                        <CurrentView />
                    </motion.div>
                </AnimatePresence>
            </main>
            {!(userData && userData.needsSetup) && !chattingWith && <Footer navigate={navigate} activeView={currentView} userData={userData} />}
        </div>
    );
};
export default App;
