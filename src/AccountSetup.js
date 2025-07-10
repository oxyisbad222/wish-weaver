import React, { useState, useEffect } from 'react';
import { getFirestore, doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { API_ENDPOINTS } from './App';
import { Sparkles } from 'lucide-react';

const db = getFirestore();

const Button = ({ onClick, children, className = '', disabled = false }) => {
  const baseClasses = 'font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30';
  return <button onClick={onClick} className={`${baseClasses} ${variantClasses} ${className}`} disabled={disabled}>{children}</button>;
};

const AccountSetup = ({ user, onSetupComplete }) => {
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [preferredName, setPreferredName] = useState('');
    const [pronouns, setPronouns] = useState('');
    const [zodiac, setZodiac] = useState('Aries');
    const [avatarSeed, setAvatarSeed] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    useEffect(() => {
        if(user?.displayName) {
            setAvatarSeed(user.displayName);
        }
    }, [user]);
    
    const checkUsername = async () => {
        if (username.length < 3) {
            setUsernameError('Username must be at least 3 characters.');
            return false;
        }
        setIsLoading(true);
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);
        setIsLoading(false);
        if (!querySnapshot.empty) {
            setUsernameError('This username is already taken.');
            return false;
        }
        setUsernameError('');
        return true;
    };

    const handleNext = async () => {
        if (step === 1) {
            const isValid = await checkUsername();
            if (isValid) setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const handleFinish = async () => {
        setIsLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userDocRef, {
                username,
                preferredName: preferredName || user.displayName.split(' ')[0],
                pronouns,
                zodiac,
                avatarSeed,
                needsSetup: false
            });
            onSetupComplete();
        } catch (error) {
            console.error("Error finishing setup:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFeelingLucky = () => {
        const randomSeed = Math.random().toString(36).substring(7);
        setAvatarSeed(randomSeed);
    };

    const pageVariants = {
        initial: { opacity: 0, x: "50%" },
        in: { opacity: 1, x: "0%" },
        out: { opacity: 0, x: "-50%" }
    };
    
    const pageTransition = { type: "tween", ease: "anticipate", duration: 0.5 };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="w-full">
                        <h2 className="text-2xl font-serif text-primary mb-2">Create Your Username</h2>
                        <p className="text-foreground/70 mb-4">This will be your unique name in the Wish Weaver universe.</p>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="e.g., cosmicdreamer" className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary"/>
                        {usernameError && <p className="text-red-400 text-sm mt-2">{usernameError}</p>}
                    </div>
                );
            case 2:
                return (
                    <div className="w-full">
                        <h2 className="text-2xl font-serif text-primary mb-4">Tell Us About Yourself</h2>
                         <div className="space-y-4">
                             <div>
                                <label htmlFor="preferredName" className="text-foreground/80 mb-2 block">Preferred Name</label>
                                <input id="preferredName" type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="How you'd like to be called" className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary"/>
                            </div>
                             <div>
                                <label htmlFor="pronouns" className="text-foreground/80 mb-2 block">Pronouns</label>
                                <input id="pronouns" type="text" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g., they/them, she/her" className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary"/>
                            </div>
                             <div>
                                <label htmlFor="zodiac" className="text-foreground/80 mb-2 block">Your Zodiac Sign</label>
                                <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary appearance-none text-center">
                                    {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="w-full">
                        <h2 className="text-2xl font-serif text-primary mb-4">Choose Your Avatar</h2>
                        <div className="flex flex-col items-center mb-4">
                            <img src={API_ENDPOINTS.avatar(avatarSeed)} alt="avatar" className="w-32 h-32 rounded-full border-4 border-primary/40 mb-4" />
                            <label htmlFor="avatarSeed" className="text-foreground/80 mb-2">Avatar Seed</label>
                            <input id="avatarSeed" type="text" value={avatarSeed} onChange={(e) => setAvatarSeed(e.target.value)} placeholder="Enter anything..." className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary text-center"/>
                            <button onClick={handleFeelingLucky} className="mt-2 flex items-center text-primary text-sm hover:underline"><Sparkles size={16} className="mr-1"/>I'm Feeling Lucky</button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
            <div className="w-full max-w-md">
                <AnimatePresence mode="wait">
                    <motion.div key={step} variants={pageVariants} initial="initial" animate="in" exit="out" transition={pageTransition} className="w-full">
                        {renderStep()}
                    </motion.div>
                </AnimatePresence>
                <div className="mt-6 flex justify-between items-center">
                    <button onClick={() => setStep(step - 1)} disabled={step === 1} className="text-sm text-foreground/70 hover:underline disabled:opacity-0">Back</button>
                    <div className="flex-grow"></div>
                    {step < 3 && <Button onClick={handleNext} disabled={isLoading || (step === 1 && !username)}>{isLoading ? 'Checking...' : 'Next'}</Button>}
                    {step === 3 && <Button onClick={handleFinish} disabled={isLoading}>{isLoading ? 'Finishing...' : 'Finish'}</Button>}
                </div>
            </div>
        </div>
    );
};

export default AccountSetup;