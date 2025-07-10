import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

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
    horoscope: (sign) => `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign.toLowerCase()}&day=TODAY`,
    tarot: (count) => `https://tarot-api-3hv5.onrender.com/api/v1/cards/random?n=${count}`,
    tarotImage: (imgId) => `https://www.sacred-texts.com/tarot/pkt/img/${imgId}`,
    avatar: (seed) => `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`
};

// --- Tarot Logic & Interpretation ---
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

const StarryBackground = () => (
    <div className="absolute top-0 left-0 w-full h-full bg-gray-900 overflow-hidden z-[-1]">
        <div className="absolute w-full h-full bg-gradient-to-b from-gray-900 to-indigo-900 opacity-80"></div>
        <div id="stars" className="absolute w-[1px] h-[1px] bg-white rounded-full shadow-[0_0_#fff,150vw_50vh_#fff,50vw_80vh_#fff,20vw_20vh_#fff,80vw_10vh_#fff] animate-[animStar_50s_linear_infinite]"></div>
        <div id="stars2" className="absolute w-[2px] h-[2px] bg-white rounded-full shadow-[0_0_#fff,100vw_80vh_#fff,30vw_90vh_#fff,70vw_30vh_#fff,90vw_60vh_#fff] animate-[animStar_100s_linear_infinite]"></div>
    </div>
);

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen w-full">
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-t-purple-400 border-gray-600 rounded-full"
        />
    </div>
);

const Notification = ({ message }) => (
    <AnimatePresence>
        {message && (
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-2 rounded-full shadow-lg z-50"
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
        className="fixed inset-0 bg-black/70 flex justify-center items-center z-40 p-4"
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 border border-purple-500/20"
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </motion.div>
    </motion.div>
);

// --- Page/View Components ---

const Login = () => {
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
        <div className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
            <StarryBackground />
            <motion.h1
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, type: 'spring' }}
                className="text-6xl md:text-8xl font-serif mb-4"
                style={{ textShadow: '0 0 15px rgba(192, 132, 252, 0.5)' }}
            >
                Wish Weaver
            </motion.h1>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="text-xl mb-10 text-purple-200"
            >
                Your cosmic guide awaits.
            </motion.p>
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: 'spring' }}
                className="flex flex-col space-y-4 w-full max-w-xs"
            >
                <button
                    onClick={handleGoogleLogin}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-purple-500/30 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center space-x-3"
                >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56,12.25C22.56,11.47 22.49,10.72 22.36,10H12.27V14.1H18.1C17.84,15.55 17.03,16.8 15.84,17.64V20.25H19.45C21.45,18.44 22.56,15.63 22.56,12.25Z" /><path d="M12.27,23C15.05,23 17.4,22.04 19.03,20.59L15.42,17.98C14.49,18.63 13.46,19 12.27,19C9.86,19 7.8,17.43 7,15.21H3.29V17.9C4.93,20.99 8.3,23 12.27,23Z" /><path d="M7,15.21C6.75,14.46 6.6,13.65 6.6,12.8C6.6,11.95 6.75,11.14 7,10.39V7.69H3.29C2.48,9.22 2,10.95 2,12.8C2,14.65 2.48,16.38 3.29,17.9L7,15.21Z" /><path d="M12.27,6.6C13.55,6.6 14.63,7.03 15.53,7.86L18.51,4.88C16.88,3.38 14.78,2.5 12.27,2.5C8.3,2.5 4.93,4.51 3.29,7.69L7,10.39C7.8,8.17 9.86,6.6 12.27,6.6Z" /></svg>
                    <span>Sign in with Google</span>
                </button>
                <button
                    onClick={handleGuestLogin}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105"
                >
                    Continue as Guest
                </button>
            </motion.div>
        </div>
    );
};
const Header = ({ userData, onLogout }) => (
    <header className="bg-gray-900/50 backdrop-blur-sm p-4 flex justify-between items-center sticky top-0 z-30 border-b border-white/10">
        <h1 className="text-2xl font-bold font-serif text-purple-300">Wish Weaver</h1>
        <div className="flex items-center space-x-4">
            <img src={API_ENDPOINTS.avatar(userData?.avatarSeed || userData?.displayName || 'guest')} alt="avatar" className="w-12 h-12 rounded-full border-2 border-purple-400 bg-purple-200" />
            <button onClick={onLogout} className="bg-purple-600/50 hover:bg-purple-600 border border-purple-500 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors">
                Logout
            </button>
        </div>
    </header>
);

const Dashboard = ({ setView }) => {
    const items = [
        { view: 'horoscope', title: 'Daily Horoscope', desc: 'Get your personalized astrological forecast.' },
        { view: 'tarot', title: 'Tarot Reading', desc: 'Gain insight with a powerful card spread.' },
        { view: 'past_readings', title: 'Reading Journal', desc: 'Review your saved tarot readings.' },
        { view: 'profile', title: 'Customize Profile', desc: 'Personalize your avatar and zodiac sign.' }
    ];

    return (
        <div className="p-4">
            <h2 className="text-4xl font-bold text-center mb-8 text-purple-200">Welcome, Seeker</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {items.map((item, i) => (
                    <motion.div
                        key={item.view}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setView(item.view)}
                        className="bg-gray-800/50 p-6 rounded-2xl shadow-lg cursor-pointer hover:bg-gray-800/80 transition-all duration-300 border border-white/10 hover:border-purple-500/50 transform hover:-translate-y-1"
                    >
                        <h3 className="text-2xl font-bold mb-2 text-purple-300">{item.title}</h3>
                        <p className="text-purple-100">{item.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

const Horoscope = ({ zodiac }) => {
    const [horoscope, setHoroscope] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!zodiac) return;
        const fetchHoroscope = async () => {
            setLoading(true);
            try {
                const response = await fetch(API_ENDPOINTS.horoscope(zodiac));
                const data = await response.json();
                setHoroscope(data.data);
            } catch (error) {
                console.error("Error fetching horoscope:", error);
                setHoroscope({ horoscope_data: "Could not retrieve horoscope. Please try again later." });
            } finally {
                setLoading(false);
            }
        };
        fetchHoroscope();
    }, [zodiac]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
            <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-white/10">
                <h2 className="text-4xl font-bold mb-4 text-purple-300">{zodiac}</h2>
                <h3 className="text-2xl font-semibold mb-6 text-purple-200">Daily Horoscope</h3>
                {loading ? (
                    <div className="space-y-4">
                        <div className="h-4 bg-gray-700 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-gray-700 rounded w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-gray-700 rounded w-full animate-pulse"></div>
                    </div>
                ) : (
                    <p className="text-lg text-purple-100 leading-relaxed">{horoscope?.horoscope_data}</p>
                )}
            </div>
        </motion.div>
    );
};

const TarotReading = ({ user, fetchUserData }) => {
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
                    <div className="absolute w-full h-full backface-hidden rounded-xl bg-indigo-500 border-2 border-indigo-300 flex items-center justify-center p-2 shadow-lg">
                        <div className="w-full h-full border-2 border-indigo-300 rounded-md flex items-center justify-center">
                            <svg className="w-1/2 h-1/2 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 12l4.293 4.293a1 1 0 010 1.414L12 20M21 12h-9"></path></svg>
                        </div>
                    </div>
                    <div className="absolute w-full h-full backface-hidden [transform:rotateY(180deg)] rounded-xl shadow-2xl shadow-purple-500/30">
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
                <h2 className="text-4xl font-bold mb-8 text-purple-200">Choose a Tarot Spread</h2>
                <div className="space-y-5">
                    {[['single', 'Simple Reading (1 Card)', 1], ['three-card', 'Three-Card Spread', 3], ['celtic-cross', 'Celtic Cross', 10]].map(([type, label, count], i) => (
                        <motion.button
                            key={type}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.15 }}
                            onClick={() => drawCards(count, type)}
                            className="w-full bg-purple-600/50 p-4 rounded-xl hover:bg-purple-600 border border-purple-500 text-white font-semibold transition-all"
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
                        <h2 className="text-3xl font-bold text-purple-300 mb-2">{selectedCard.card.name} {selectedCard.card.isReversed && '(Reversed)'}</h2>
                        <p className="text-purple-200 italic mb-4">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed).positionContext}</p>
                        <p className="text-lg text-white leading-relaxed">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed).meaning}</p>
                        <p className="text-md text-gray-400 mt-4">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed).description}</p>
                    </Modal>
                )}
            </AnimatePresence>

            <div className="flex justify-center mb-6 space-x-4">
                <button onClick={() => setSpreadType(null)} className="bg-gray-600 p-3 rounded-lg hover:bg-gray-500 transition">New Spread</button>
                <button onClick={handleSaveReading} className="bg-green-600 p-3 rounded-lg hover:bg-green-500 transition">Save Reading</button>
            </div>
            {loading ? <LoadingSpinner /> : (
                <div className="max-w-5xl mx-auto">
                    {spreadType === 'single' && <div className="w-48 h-72 mx-auto"><Card card={cards[0]} index={0} /></div>}
                    {spreadType === 'three-card' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-12">
                            {cards.map((card, i) => (
                                <div key={card.id}>
                                    <h3 className="text-center text-xl font-bold text-purple-300 mb-3">{['Past', 'Present', 'Future'][i]}</h3>
                                    <div className="w-48 h-72 mx-auto"><Card card={card} index={i} /></div>
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

const Profile = ({ user, userData, fetchUserData, setView }) => {
    const [avatarSeed, setAvatarSeed] = useState(userData?.avatarSeed || user.displayName);
    const [zodiac, setZodiac] = useState(userData?.zodiac || 'Aries');
    const [notification, setNotification] = useState('');

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const handleSave = async () => {
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
        <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg max-w-lg mx-auto border border-white/10">
            <Notification message={notification} />
            <h2 className="text-3xl font-bold mb-6 text-purple-300 text-center">Profile & Settings</h2>
            <div className="flex flex-col items-center mb-6">
                <img src={API_ENDPOINTS.avatar(avatarSeed)} alt="avatar" className="w-32 h-32 rounded-full border-4 border-purple-400 mb-4 bg-purple-200" />
                <label htmlFor="avatarSeed" className="text-purple-200 mb-2">Avatar Customization Seed</label>
                <input
                    id="avatarSeed"
                    type="text"
                    value={avatarSeed}
                    onChange={(e) => setAvatarSeed(e.target.value)}
                    className="bg-gray-700 text-white p-3 rounded-lg w-full text-center border border-transparent focus:border-purple-500 focus:ring-0 outline-none"
                />
            </div>
            <div className="mb-8">
                <label htmlFor="zodiac" className="text-purple-200 mb-2 block text-center">Zodiac Sign</label>
                <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-gray-700 text-white p-3 rounded-lg w-full border border-transparent focus:border-purple-500 focus:ring-0 outline-none">
                    {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                </select>
            </div>
            <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full w-full shadow-lg transition-colors">
                Save Changes
            </button>
            <button onClick={() => setView('past_readings')} className="mt-4 bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full w-full shadow-lg transition-colors">
                View Reading Journal
            </button>
        </div>
    );
};

const PastReadings = ({ readings }) => {
    const [expanded, setExpanded] = useState(null);
    return (
        <div className="p-4">
            <h2 className="text-4xl font-bold mb-8 text-purple-200 text-center">Reading Journal</h2>
            <div className="space-y-6 max-w-4xl mx-auto">
                {readings.length === 0 ? (
                    <p className="text-center text-purple-200">You have no saved readings.</p>
                ) : (
                    readings.slice().reverse().map((reading, index) => (
                        <motion.div key={reading.date} layout className="bg-gray-800/50 p-4 rounded-2xl shadow-lg border border-white/10 overflow-hidden">
                            <motion.div layout className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(expanded === index ? null : index)}>
                                <h3 className="text-xl font-bold text-purple-300 capitalize">
                                    {reading.spreadType.replace('-', ' ')} Spread
                                </h3>
                                <span className="text-purple-200">{new Date(reading.date).toLocaleDateString()}</span>
                            </motion.div>
                            <AnimatePresence>
                                {expanded === index && (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-4"
                                    >
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {reading.cards.map((cardData, cardIndex) => (
                                                <details key={cardIndex} className="group">
                                                    <summary className="list-none cursor-pointer">
                                                        <img
                                                            src={API_ENDPOINTS.tarotImage(cardData.img)}
                                                            alt={cardData.name}
                                                            className="rounded-lg shadow-md group-hover:shadow-purple-500/50 transition-shadow"
                                                        />
                                                    </summary>
                                                    <div className="mt-2 bg-gray-900/50 p-3 rounded-lg border border-white/10">
                                                        <h4 className="font-bold text-purple-300">{cardData.interpretation.title}</h4>
                                                        <p className="text-sm italic text-purple-200 my-1">{cardData.interpretation.positionContext}</p>
                                                        <p className="text-sm text-white">{cardData.interpretation.meaning}</p>
                                                    </div>
                                                </details>
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

const Footer = ({ setView, activeView }) => {
    const navItems = [
        { name: 'Home', view: 'dashboard', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
        { name: 'Horoscope', view: 'horoscope', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /> },
        { name: 'Tarot', view: 'tarot', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14" /> },
        { name: 'Profile', view: 'profile', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> }
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/50 backdrop-blur-sm border-t border-white/10 z-30">
            <nav className="flex justify-around p-2">
                {navItems.map(item => (
                    <button
                        key={item.name}
                        onClick={() => setView(item.view)}
                        className={`flex flex-col items-center justify-center w-full p-2 rounded-lg transition-all duration-300 relative ${activeView === item.view ? 'text-purple-400' : 'text-gray-400 hover:text-purple-300'}`}
                    >
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">{item.icon}</svg>
                        <span className="text-xs">{item.name}</span>
                        {activeView === item.view && (
                            <motion.div layoutId="active-pill" className="absolute bottom-0 h-1 w-10 bg-purple-400 rounded-full"></motion.div>
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
    const [view, setView] = useState('dashboard');

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
                await fetchUserData(currentUser.uid);
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
        setView('dashboard');
    };

    const CurrentView = () => {
        switch (view) {
            case 'dashboard': return <Dashboard setView={setView} />;
            case 'horoscope': return <Horoscope zodiac={userData?.zodiac} />;
            case 'tarot': return <TarotReading user={user} fetchUserData={fetchUserData} />;
            case 'profile': return <Profile user={user} userData={userData} fetchUserData={fetchUserData} setView={setView} />;
            case 'past_readings': return <PastReadings readings={userData?.readings || []} />;
            default: return <Dashboard setView={setView} />;
        }
    };

    if (loadingAuth) {
        return (
            <div className="bg-gray-900 min-h-screen">
                <StarryBackground />
                <LoadingSpinner />
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="bg-gray-900 min-h-screen">
            <StarryBackground />
            <Header userData={userData} onLogout={handleLogout} />
            <main className="pb-24">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <CurrentView />
                    </motion.div>
                </AnimatePresence>
            </main>
            <Footer setView={setView} activeView={view} />
        </div>
    );
};

export default App;