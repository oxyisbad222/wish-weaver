import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

// --- Helper Functions & Initial Config ---

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

const createAvatar = (seed) => `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

// --- Enhanced Tarot Interpretations ---
const getInsightfulMeaning = (card, position, isReversed) => {
    const baseMeaning = isReversed ? card.meaning_rev : card.meaning_up;
    const positionMeanings = {
        // Celtic Cross
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
        // Three Card Spread
        'Past': "The Past: This card represents past events and influences that have shaped your current situation.",
        'Present': "The Present: This card reflects your current circumstances and challenges.",
        'Future': "The Future: This card offers a glimpse into the potential outcome and direction you are heading.",
        // Single Card
        'Situation': "The Card's Message: This card offers direct insight or advice regarding your current situation."
    };

    let interpretation = `**${card.name} ${isReversed ? '(Reversed)' : ''}**\n\n`;
    if (position && positionMeanings[position]) {
        interpretation += `*${positionMeanings[position]}*\n\n`;
    }
    interpretation += `**Meaning:** ${baseMeaning}\n\n`;
    interpretation += `**Insight:** ${card.desc}`;

    return interpretation;
};


// --- React Components ---

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen bg-gray-900 bg-opacity-50">
        <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-purple-400"></div>
    </div>
);

const Login = ({ setUser }) => {
    const handleLogin = async () => {
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
            setUser(user);
        } catch (error) {
            console.error("Authentication Error:", error);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900 text-white p-4">
            <h1 className="text-6xl font-bold mb-4 font-serif text-shadow-lg">Wish Weaver</h1>
            <p className="text-xl mb-8 text-center text-purple-200">Your cosmic guide awaits.</p>
            <button
                onClick={handleLogin}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
                <span className="flex items-center">
                    <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56,12.25C22.56,11.47 22.49,10.72 22.36,10H12.27V14.1H18.1C17.84,15.55 17.03,16.8 15.84,17.64V20.25H19.45C21.45,18.44 22.56,15.63 22.56,12.25Z" /><path d="M12.27,23C15.05,23 17.4,22.04 19.03,20.59L15.42,17.98C14.49,18.63 13.46,19 12.27,19C9.86,19 7.8,17.43 7,15.21H3.29V17.9C4.93,20.99 8.3,23 12.27,23Z" /><path d="M7,15.21C6.75,14.46 6.6,13.65 6.6,12.8C6.6,11.95 6.75,11.14 7,10.39V7.69H3.29C2.48,9.22 2,10.95 2,12.8C2,14.65 2.48,16.38 3.29,17.9L7,15.21Z" /><path d="M12.27,6.6C13.55,6.6 14.63,7.03 15.53,7.86L18.51,4.88C16.88,3.38 14.78,2.5 12.27,2.5C8.3,2.5 4.93,4.51 3.29,7.69L7,10.39C7.8,8.17 9.86,6.6 12.27,6.6Z" /></svg>
                    Sign in with Google
                </span>
            </button>
        </div>
    );
};


const App = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
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
            setLoading(false);
        });
        return () => unsubscribe();
    }, [fetchUserData]);
    
    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        setUserData(null);
        setView('dashboard');
    };

    if (loading) return <LoadingSpinner />;
    if (!user) return <Login setUser={setUser} />;

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans">
            <Header userData={userData} setView={setView} handleLogout={handleLogout} />
            <main className="p-4 pb-24">
                {view === 'dashboard' && <Dashboard setView={setView} />}
                {view === 'horoscope' && <Horoscope zodiac={userData?.zodiac || 'Aries'} />}
                {view === 'tarot' && <TarotReading user={user} fetchUserData={fetchUserData} />}
                {view === 'profile' && <Profile user={user} userData={userData} fetchUserData={fetchUserData} setView={setView}/>}
                {view === 'past_readings' && <PastReadings readings={userData?.readings || []} />}
            </main>
            <Footer setView={setView} activeView={view} />
        </div>
    );
};

const Header = ({ userData, setView, handleLogout }) => (
    <header className="bg-gray-800 p-4 flex justify-between items-center shadow-md sticky top-0 z-20">
        <h1 className="text-2xl font-bold font-serif text-purple-300">Wish Weaver</h1>
        <div className="flex items-center">
            <button onClick={() => setView('profile')} className="mr-4">
                <img src={createAvatar(userData?.avatarSeed || userData?.displayName)} alt="avatar" className="w-12 h-12 rounded-full border-2 border-purple-400" />
            </button>
            <button onClick={handleLogout} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full text-sm">
                Logout
            </button>
        </div>
    </header>
);

const Dashboard = ({ setView }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
        <div onClick={() => setView('horoscope')} className="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition duration-300 transform hover:-translate-y-1">
            <h2 className="text-2xl font-bold mb-2 text-purple-300">Daily Horoscope</h2>
            <p className="text-purple-100">Get your personalized astrological forecast.</p>
        </div>
        <div onClick={() => setView('tarot')} className="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition duration-300 transform hover:-translate-y-1">
            <h2 className="text-2xl font-bold mb-2 text-purple-300">Tarot Reading</h2>
            <p className="text-purple-100">Gain insight with a single card, 3-card, or Celtic Cross spread.</p>
        </div>
        <div onClick={() => setView('past_readings')} className="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition duration-300 transform hover:-translate-y-1">
            <h2 className="text-2xl font-bold mb-2 text-purple-300">Past Readings</h2>
            <p className="text-purple-100">Review your saved tarot readings.</p>
        </div>
         <div onClick={() => setView('profile')} className="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition duration-300 transform hover:-translate-y-1">
            <h2 className="text-2xl font-bold mb-2 text-purple-300">Customize Profile</h2>
            <p className="text-purple-100">Personalize your avatar and zodiac sign.</p>
        </div>
    </div>
);

const Horoscope = ({ zodiac }) => {
    const [horoscope, setHoroscope] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHoroscope = async () => {
            setLoading(true);
            try {
                const response = await fetch(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${zodiac.toLowerCase()}&day=TODAY`);
                const data = await response.json();
                setHoroscope(data.data);
            } catch (error) {
                console.error("Error fetching horoscope:", error);
                setHoroscope({horoscope_data: "Could not retrieve horoscope. Please try again later."});
            } finally {
                setLoading(false);
            }
        };
        fetchHoroscope();
    }, [zodiac]);

    if (loading) return <div className="text-center p-8">Loading your cosmic forecast...</div>;
    
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg animate-fade-in">
            <h2 className="text-3xl font-bold mb-4 text-purple-300">{zodiac} - Daily Horoscope</h2>
            <p className="text-lg text-purple-100">{horoscope?.horoscope_data}</p>
        </div>
    );
};

const TarotReading = ({ user, fetchUserData }) => {
    const [spreadType, setSpreadType] = useState(null);
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [reading, setReading] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [notification, setNotification] = useState('');

    const drawCards = async (num, type) => {
        setLoading(true);
        setSpreadType(type);
        setCards([]);
        setReading(null);
        setSelectedCard(null);
        try {
            const response = await fetch(`https://tarot-api-3hv5.onrender.com/api/v1/cards/random?n=${num}`);
            const data = await response.json();
            const drawnCards = data.cards.map(card => ({...card, isReversed: Math.random() > 0.7}));
            setCards(drawnCards);

            const readingToSave = {
                spreadType: type,
                cards: drawnCards.map((card, i) => {
                    let position;
                    if (type === 'single') position = 'Situation';
                    if (type === 'three-card') position = ['Past', 'Present', 'Future'][i];
                    if (type === 'celtic-cross') position = i + 1;
                    return {
                        name: card.name,
                        img: card.img,
                        interpretation: getInsightfulMeaning(card, position, card.isReversed)
                    };
                })
            };
            setReading(readingToSave);

        } catch (error) {
            console.error("Error fetching tarot cards:", error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleSaveReading = async () => {
        if (!reading) return;
        setNotification('Saving...');
        const userDocRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userDocRef, {
                readings: arrayUnion({ ...reading, date: new Date().toISOString() })
            });
            setNotification("Reading saved successfully!");
            await fetchUserData(user.uid);
        } catch (error) {
            console.error("Error saving reading:", error);
            setNotification("Error: Could not save reading.");
        } finally {
            setTimeout(() => setNotification(''), 3000);
        }
    };
    
    const renderCard = (card, index, position) => (
        <div key={index} onClick={() => setSelectedCard({card, position})} className="cursor-pointer transition-transform transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50">
            <img 
                src={`https://www.sacred-texts.com/tarot/pkt/img/${card.img}`} 
                alt={card.name} 
                className={`rounded-lg shadow-lg w-full ${card.isReversed ? 'rotate-180' : ''}`}
                onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/200x350/1f2937/9333ea?text=Card+Art'; }}
            />
        </div>
    );

    const renderSpread = () => {
        if (loading) return <LoadingSpinner />;
        if (cards.length === 0) return null;

        switch (spreadType) {
            case 'single':
                return <div className="max-w-xs mx-auto">{renderCard(cards[0], 0, 'Situation')}</div>;
            case 'three-card':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {cards.map((card, i) => (
                            <div key={i}>
                                <h3 className="text-center text-xl font-bold text-purple-300 mb-2">{['Past', 'Present', 'Future'][i]}</h3>
                                {renderCard(card, i, ['Past', 'Present', 'Future'][i])}
                            </div>
                        ))}
                    </div>
                );
            case 'celtic-cross':
                return (
                    <div className="grid grid-cols-6 grid-rows-4 gap-2 md:gap-4 max-w-5xl mx-auto items-center justify-center p-4">
                        <div className="col-start-6 row-span-4 flex flex-col justify-between h-full">
                            {renderCard(cards[9], 9, 10)}
                            {renderCard(cards[8], 8, 9)}
                            {renderCard(cards[7], 7, 8)}
                            {renderCard(cards[6], 6, 7)}
                        </div>
                        <div className="col-start-4 row-start-2 row-span-2">{renderCard(cards[5], 5, 6)}</div>
                        <div className="col-start-3 row-start-1 col-span-2">{renderCard(cards[4], 4, 5)}</div>
                        <div className="col-start-2 row-start-2 row-span-2">{renderCard(cards[3], 3, 4)}</div>
                        <div className="col-start-3 row-start-4 col-span-2">{renderCard(cards[2], 2, 3)}</div>
                        <div className="col-start-3 row-start-2 col-span-2 row-span-2 relative flex justify-center items-center">
                            {renderCard(cards[0], 0, 1)}
                            <div className="absolute transform rotate-90 scale-90">{renderCard(cards[1], 1, 2)}</div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };
    
    if (!spreadType) {
        return (
            <div className="text-center max-w-md mx-auto">
                <h2 className="text-3xl font-bold mb-6 text-purple-300">Choose a Tarot Spread</h2>
                <div className="space-y-4">
                    <button onClick={() => drawCards(1, 'single')} className="w-full bg-purple-600 p-4 rounded-lg hover:bg-purple-700 transition">Simple Reading (1 Card)</button>
                    <button onClick={() => drawCards(3, 'three-card')} className="w-full bg-purple-600 p-4 rounded-lg hover:bg-purple-700 transition">Three-Card Spread</button>
                    <button onClick={() => drawCards(10, 'celtic-cross')} className="w-full bg-purple-600 p-4 rounded-lg hover:bg-purple-700 transition">Celtic Cross (10 Cards)</button>
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <div className="flex justify-center mb-4 space-x-4">
                <button onClick={() => setSpreadType(null)} className="bg-gray-600 p-2 rounded">New Spread</button>
                <button onClick={handleSaveReading} disabled={!reading || notification !== ''} className="bg-green-600 p-2 rounded disabled:bg-gray-500">{notification || 'Save Reading'}</button>
            </div>
            {renderSpread()}
            {selectedCard && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-30 p-4" onClick={() => setSelectedCard(null)}>
                    <div className="bg-gray-800 p-6 rounded-lg max-w-lg w-full text-white overflow-y-auto max-h-full" onClick={(e) => e.stopPropagation()}>
                        <pre className="whitespace-pre-wrap font-sans">{getInsightfulMeaning(selectedCard.card, selectedCard.position, selectedCard.card.isReversed)}</pre>
                        <button onClick={() => setSelectedCard(null)} className="mt-4 bg-purple-600 p-2 rounded w-full">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Profile = ({ user, userData, fetchUserData, setView }) => {
    const [avatarSeed, setAvatarSeed] = useState(userData?.avatarSeed || user.displayName);
    const [zodiac, setZodiac] = useState(userData?.zodiac || 'Aries');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        const userDocRef = doc(db, "users", user.uid);
        try {
            await setDoc(userDocRef, { avatarSeed, zodiac }, { merge: true });
            await fetchUserData(user.uid);
            setMessage('Profile saved successfully!');
        } catch (error) {
            console.error("Error saving profile:", error);
            setMessage('Failed to save profile.');
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-purple-300 text-center">Profile & Settings</h2>
            <div className="flex flex-col items-center mb-6">
                 <img src={createAvatar(avatarSeed)} alt="avatar" className="w-32 h-32 rounded-full border-4 border-purple-400 mb-4" />
                <label htmlFor="avatarSeed" className="text-purple-200 mb-2">Avatar Customization Seed</label>
                <input
                    id="avatarSeed"
                    type="text"
                    value={avatarSeed}
                    onChange={(e) => setAvatarSeed(e.target.value)}
                    className="bg-gray-700 text-white p-2 rounded-lg w-full text-center"
                />
            </div>
            <div className="mb-6">
                <label htmlFor="zodiac" className="text-purple-200 mb-2 block text-center">Zodiac Sign</label>
                <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-gray-700 text-white p-2 rounded-lg w-full">
                    {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                </select>
            </div>
            <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full w-full shadow-lg disabled:bg-gray-500">
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {message && <p className="text-center mt-4 text-green-400">{message}</p>}
            <button onClick={() => setView('past_readings')} className="mt-4 bg-blue-500 hover:bg-blue-600 p-3 rounded w-full">View Past Readings</button>
        </div>
    );
};

const PastReadings = ({ readings }) => (
    <div className="bg-gray-800 p-6 rounded-lg max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-purple-300">Past Readings</h2>
        <div className="space-y-6">
            {readings.length === 0 ? (
                <p className="text-center text-purple-200">You have no saved readings.</p>
            ) : (
                readings.slice().reverse().map((reading, index) => (
                    <div key={index} className="bg-gray-700 p-4 rounded-lg shadow-inner">
                        <h3 className="text-xl font-bold text-purple-300 capitalize">
                            {reading.spreadType.replace('-', ' ')} Spread - {new Date(reading.date).toLocaleDateString()}
                        </h3>
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {reading.cards.map((cardData, cardIndex) => (
                                <div key={cardIndex}>
                                    <details>
                                        <summary className="cursor-pointer list-none">
                                            <img 
                                                src={`https://www.sacred-texts.com/tarot/pkt/img/${cardData.img}`} 
                                                alt={cardData.name} 
                                                className="rounded-lg shadow-md"
                                                onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/200x350/1f2937/9333ea?text=Card+Art'; }}
                                            />
                                        </summary>
                                        <div className="mt-2 bg-gray-800 p-2 rounded">
                                            <pre className="whitespace-pre-wrap font-sans text-sm">{cardData.interpretation}</pre>
                                        </div>
                                    </details>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);

const Footer = ({ setView, activeView }) => {
    const navItems = [
        { name: 'Home', view: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { name: 'Horoscope', view: 'horoscope', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        { name: 'Tarot', view: 'tarot', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14' },
        { name: 'Profile', view: 'profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 shadow-t-lg z-10">
            <nav className="flex justify-around p-2">
                {navItems.map(item => (
                    <button
                        key={item.name}
                        onClick={() => setView(item.view)}
                        className={`flex flex-col items-center justify-center w-full p-2 rounded-lg transition duration-300 ${activeView === item.view ? 'text-purple-400 bg-gray-700' : 'text-gray-400 hover:bg-gray-700 hover:text-purple-300'}`}
                    >
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
                        <span className="text-xs">{item.name}</span>
                    </button>
                ))}
            </nav>
        </footer>
    );
};

export default App;
