import React, { useState, useCallback } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Loader, Shuffle } from 'lucide-react';
import { API_ENDPOINTS } from './App';

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, type = 'button' }) => {
  const baseClasses = 'font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30',
    secondary: 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
  };
  return <button type={type} onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

const AccountSetup = ({ user, db, onSetupComplete }) => {
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [isUsernameValid, setIsUsernameValid] = useState(null);
    const [usernameError, setUsernameError] = useState('');
    
    const [preferredName, setPreferredName] = useState('');
    const [pronouns, setPronouns] = useState('');
    const [zodiac, setZodiac] = useState('Aries');
    const [avatarSeed, setAvatarSeed] = useState(user.uid);
    const [avatarStyle] = useState('notionists'); // Default style
    const [error, setError] = useState('');

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const checkUsernameAvailability = useCallback(async (name) => {
        if (!name || name.length < 3) {
            setIsUsernameValid(null);
            setUsernameError(name.length > 0 ? 'Username must be at least 3 characters.' : '');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            setIsUsernameValid(false);
            setUsernameError('Only letters, numbers, and underscores allowed.');
            return;
        }

        setIsCheckingUsername(true);
        setUsernameError('');
        try {
            const usernamesRef = collection(db, 'usernames');
            const q = query(usernamesRef, where("username", "==", name));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setIsUsernameValid(true);
            } else {
                setIsUsernameValid(false);
                setUsernameError('This username is already taken.');
            }
        } catch (err) {
            console.error(err);
            setUsernameError('Error checking username.');
            setIsUsernameValid(false);
        } finally {
            setIsCheckingUsername(false);
        }
    }, [db]);

    const debouncedCheck = useCallback(debounce(checkUsernameAvailability, 500), [checkUsernameAvailability]);

    const handleUsernameChange = (e) => {
        const newUsername = e.target.value.toLowerCase();
        setUsername(newUsername);
        setIsUsernameValid(null);
        setIsCheckingUsername(true);
        debouncedCheck(newUsername);
    };
    
    const handleFeelingLucky = () => {
        setAvatarSeed(Math.random().toString(36).substring(2, 15));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!preferredName) {
            setError('Please enter your preferred name.');
            return;
        }
        if (!isUsernameValid) {
            setError('Please choose a valid username.');
            return;
        }
        setError('');

        try {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", user.uid);
            const usernameDocRef = doc(db, "usernames", username);

            batch.set(usernameDocRef, { uid: user.uid });
            batch.update(userDocRef, {
                username,
                preferredName,
                pronouns,
                zodiac,
                avatarSeed,
                avatarStyle,
                friends: [],
                friendRequestsSent: [],
                friendRequestsReceived: [],
                readings: [],
                needsSetup: false,
            });

            await batch.commit();
            
            if (onSetupComplete) {
                onSetupComplete();
            }
        } catch (err) {
            console.error("Error updating user data: ", err);
            setError("Failed to save your profile. Please try again.");
        }
    };
    
    const renderStep = () => {
        switch(step) {
            case 1:
                return (
                    <motion.div key={1} initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -50}}>
                        <h2 className="text-2xl font-serif text-center mb-4 text-foreground">Choose a Username</h2>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">@</span>
                            <input id="username" type="text" value={username} onChange={handleUsernameChange} className="bg-input text-foreground p-3 pl-7 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" required/>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isCheckingUsername && <Loader className="animate-spin text-foreground/50" size={20}/>}
                                {!isCheckingUsername && isUsernameValid === true && <CheckCircle className="text-green-500" size={20}/>}
                                {!isCheckingUsername && isUsernameValid === false && <XCircle className="text-red-500" size={20}/>}
                            </div>
                        </div>
                        {usernameError && <p className="text-red-500 text-xs mt-2">{usernameError}</p>}
                        <Button onClick={() => setStep(2)} className="w-full !mt-8" disabled={!isUsernameValid || isCheckingUsername}>Next</Button>
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div key={2} initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -50}}>
                         <h2 className="text-2xl font-serif text-center mb-4 text-foreground">Tell Us About Yourself</h2>
                         <div className="space-y-4">
                            <div>
                                <label htmlFor="preferredName" className="text-foreground/80 mb-1 block text-sm">Preferred Name *</label>
                                <input id="preferredName" type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" required/>
                            </div>
                            <div>
                                <label htmlFor="pronouns" className="text-foreground/80 mb-1 block text-sm">Pronouns</label>
                                <input id="pronouns" type="text" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g., she/her, they/them" className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"/>
                            </div>
                            <div>
                                <label htmlFor="zodiac" className="text-foreground/80 mb-1 block text-sm">Zodiac Sign</label>
                                <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none">
                                    {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex space-x-4 mt-8">
                            <Button onClick={() => setStep(1)} className="w-full" variant="secondary">Back</Button>
                            <Button onClick={() => setStep(3)} className="w-full" disabled={!preferredName}>Next</Button>
                        </div>
                    </motion.div>
                );
            case 3:
                 return (
                    <motion.div key={3} initial={{opacity: 0, x: 50}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: -50}}>
                         <h2 className="text-2xl font-serif text-center mb-4 text-foreground">Customize Your Avatar</h2>
                         <div className="flex justify-center mb-4">
                            <img src={API_ENDPOINTS.avatar(avatarSeed, avatarStyle)} alt="Your Avatar" className="w-24 h-24 rounded-full border-4 border-primary/40"/>
                        </div>
                        <div>
                            <label htmlFor="avatarSeed" className="text-foreground/80 mb-1 block text-sm">Avatar Seed</label>
                            <div className="flex space-x-2">
                                <input id="avatarSeed" type="text" value={avatarSeed} onChange={(e) => setAvatarSeed(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"/>
                                <Button onClick={handleFeelingLucky} variant="secondary" className="px-3"><Shuffle size={18}/></Button>
                            </div>
                        </div>
                         <div className="flex space-x-4 mt-8">
                            <Button onClick={() => setStep(2)} className="w-full" variant="secondary">Back</Button>
                            <Button type="submit" className="w-full">Complete Setup</Button>
                        </div>
                    </motion.div>
                );
            default: return null;
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-card p-8 rounded-2xl shadow-2xl border border-border"
            >
                <h1 className="text-3xl font-serif text-center mb-2 text-primary">Welcome!</h1>
                <p className="text-center text-foreground/70 mb-8">Let's set up your profile.</p>

                {error && <p className="text-red-500 text-center mb-4">{error}</p>}

                <form onSubmit={handleSubmit}>
                    <AnimatePresence mode="wait">
                        {renderStep()}
                    </AnimatePresence>
                </form>
            </motion.div>
        </div>
    );
};

export default AccountSetup;