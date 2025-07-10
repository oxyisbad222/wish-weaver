import React, { useState } from 'react';
import { doc, updateDoc } from "firebase/firestore";
import { motion } from 'framer-motion';

const API_ENDPOINTS = {
    avatar: (seed) => `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=f0e7f7,e0f0e9,d1d4f9`
};

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, type = 'button' }) => {
  const baseClasses = 'font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30',
    secondary: 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
    ghost: 'hover:bg-primary/10 text-primary',
  };
  return <button type={type} onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const AccountSetup = ({ user, db, onSetupComplete }) => {
    const [preferredName, setPreferredName] = useState('');
    const [pronouns, setPronouns] = useState('');
    const [zodiac, setZodiac] = useState('Aries');
    const [avatarSeed, setAvatarSeed] = useState(user.uid);
    const [error, setError] = useState('');

    const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!preferredName) {
            setError('Please enter your preferred name.');
            return;
        }
        setError('');

        const userDocRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userDocRef, {
                preferredName,
                pronouns,
                zodiac,
                avatarSeed,
                needsSetup: false,
            });
            if (onSetupComplete) {
                onSetupComplete();
            }
        } catch (err) {
            console.error("Error updating user data: ", err);
            setError("Failed to save your profile. Please try again.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-card p-8 rounded-2xl shadow-2xl border border-border"
            >
                <h1 className="text-3xl font-serif text-center mb-2 text-primary">Welcome to Wish Weaver</h1>
                <p className="text-center text-foreground/70 mb-8">Let's set up your profile.</p>

                <div className="flex justify-center mb-6">
                    <img src={API_ENDPOINTS.avatar(avatarSeed)} alt="Your Avatar" className="w-24 h-24 rounded-full border-4 border-primary/40"/>
                </div>

                {error && <p className="text-red-500 text-center mb-4">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-6">
                     <div>
                        <label htmlFor="preferredName" className="text-foreground/80 mb-2 block">Preferred Name *</label>
                        <input id="preferredName" type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" required/>
                    </div>
                     <div>
                        <label htmlFor="pronouns" className="text-foreground/80 mb-2 block">Pronouns</label>
                        <input id="pronouns" type="text" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="e.g., she/her, they/them" className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"/>
                    </div>
                    <div>
                         <label htmlFor="avatarSeed" className="text-foreground/80 mb-2 block">Avatar Seed</label>
                        <input id="avatarSeed" type="text" value={avatarSeed} onChange={(e) => setAvatarSeed(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"/>
                    </div>
                    <div>
                         <label htmlFor="zodiac" className="text-foreground/80 mb-2 block">Zodiac Sign</label>
                        <select id="zodiac" value={zodiac} onChange={(e) => setZodiac(e.target.value)} className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors appearance-none">
                            {zodiacSigns.map(sign => <option key={sign} value={sign}>{sign}</option>)}
                        </select>
                    </div>
                    <Button type="submit" className="w-full !mt-8">Complete Setup</Button>
                </form>
            </motion.div>
        </div>
    );
};

export default AccountSetup;
