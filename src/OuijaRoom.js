import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Wand2 } from 'lucide-react';

const spiritResponses = [
    "YES", "NO", "PERHAPS", "THE SPIRITS ARE UNCLEAR", "ASK AGAIN LATER", "IT IS CERTAIN",
    "WITHOUT A DOUBT", "YOU MAY RELY ON IT", "MOST LIKELY", "OUTLOOK GOOD", "SIGNS POINT TO YES",
    "DON'T COUNT ON IT", "MY SOURCES SAY NO", "VERY DOUBTFUL", "THE STARS ARE NOT ALIGNED",
    "THE VEIL IS TOO THICK", "A MESSAGE IS TRYING TO COME THROUGH", "BEWARE OF TRICKSTER SPIRITS",
    "GOODBYE", "FOCUS AND ASK AGAIN", "THE ENERGY IS WEAK", "AN UNSEEN PRESENCE IS NEAR",
    "LOOK FOR A SIGN", "THE ANSWER IS WITHIN YOU", "ANOTHER TIME", "WE ARE ALWAYS WATCHING", "NOT ALONE",
    "IT'S BEHIND YOU", "THE ANSWER LIES IN THE EAST", "A FRIEND IS NOT WHO THEY SEEM", "TRUST YOUR GUT",
    "A FULL MOON WILL BRING CLARITY", "THE PATH IS DARK", "EXPECT THE UNEXPECTED", "SOON",
    "NEVER", "WHY DO YOU ASK?", "THEY ARE LISTENING", "DO NOT PROCEED", "A WISE CHOICE",
    "THEY LAUGH AT YOUR QUESTION", "SILENCE IS THE ANSWER", "A SECRET WILL BE REVEALED",
    "IT IS LISTENING FROM BELOW", "HE RISES", "LEAVE THIS PLACE", "A SOUL FOR A SECRET",
    "THE NAMELESS ONE APPROVES", "YOU ARE NOT WELCOME HERE", "DARKNESS FALLS", "THREE DAYS",
    "THE MAN WITH NO FACE WATCHES", "IT IS TRAPPED IN THE MIRROR", "YOUR FEAR FEEDS IT", "THE SIXTH SEAL",
    "FORSAKEN", "IT KNOWS YOUR NAME", "ASH AND BONE", "IT HUNGERS", "MORS VINCIT OMNIA",
    "THE SPIDER SPINS ITS WEB", "HE IS THE FATHER OF LIES", "IT WEARS A MASK OF LIGHT"
];

const OuijaBoard = ({ guidingMessage }) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split('');
    const [animatedMessage, setAnimatedMessage] = useState('');

    useEffect(() => {
        setAnimatedMessage(''); 
        if (guidingMessage) {
            const interval = setInterval(() => {
                setAnimatedMessage(prev => {
                    if (prev.length < guidingMessage.length) {
                        return guidingMessage.substring(0, prev.length + 1);
                    }
                    clearInterval(interval);
                    return prev;
                });
            }, 120);
        }
    }, [guidingMessage]);

    const lastAnimatedChar = animatedMessage[animatedMessage.length - 1];

    return (
        <div className="relative w-full max-w-xl mx-auto bg-slate-900/50 p-4 sm:p-6 rounded-3xl shadow-glow-primary border-2 border-primary/30 select-none aspect-[16/10] flex flex-col justify-center">
            <div className="absolute top-4 sm:top-6 left-6 sm:left-10 text-xl sm:text-2xl font-serif text-primary/80">YES</div>
            <div className="absolute top-4 sm:top-6 right-6 sm:right-10 text-xl sm:text-2xl font-serif text-primary/80">NO</div>

            <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-2 px-4 sm:px-12">
                {characters.map(char => (
                    <motion.span
                        key={char}
                        className="text-lg sm:text-2xl font-serif text-purple-200/80 transition-colors"
                        animate={{
                            color: lastAnimatedChar === char ? '#fff' : '#c4b5fd',
                            scale: lastAnimatedChar === char ? [1, 1.5, 1] : 1,
                            textShadow: lastAnimatedChar === char ? '0 0 20px #a78bfa' : 'none'
                        }}
                        transition={{ duration: 0.4, ease: 'circOut' }}
                    >
                        {char}
                    </motion.span>
                ))}
            </div>

            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 text-xl sm:text-2xl font-serif text-primary/80">GOODBYE</div>
        </div>
    );
};

const OuijaRoom = () => {
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState('');
    const [isAsking, setIsAsking] = useState(false);

    const handleAskQuestion = (e) => {
        e.preventDefault();
        if (!question.trim() || isAsking) return;

        setIsAsking(true);
        setResponse('');

        const randomResponse = spiritResponses[Math.floor(Math.random() * spiritResponses.length)];

        setTimeout(() => {
            setResponse(randomResponse);
            setIsAsking(false);
            setQuestion('');
        }, 500);
    };

    return (
        <div className="p-4 sm:p-6 min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
            <div className="w-full max-w-2xl text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-4xl sm:text-5xl font-serif text-primary mb-2">The Spirit Board</h2>
                    <p className="text-foreground/70 mb-8">Ask a question and await a response from the other side.</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                    <OuijaBoard guidingMessage={response} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 w-full">
                    <div className="h-16 bg-black/30 rounded-lg p-2 text-center text-white font-serif text-xl sm:text-2xl flex items-center justify-center shadow-inner-glow-primary">
                        <AnimatePresence>
                            {response.split('').map((char, i) => (
                                <motion.span
                                    key={i}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5, delay: i * 0.12 }}
                                >
                                    {char === ' ' ? '\u00A0' : char}
                                </motion.span>
                            ))}
                        </AnimatePresence>
                    </div>

                    <form onSubmit={handleAskQuestion} className="flex space-x-2 mt-6">
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask the spirits a question..."
                            disabled={isAsking}
                            className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!question.trim() || isAsking}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
                        >
                            {isAsking ? <Wand2 className="animate-pulse" size={20}/> : <Send size={20}/>}
                            <span>Ask</span>
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
};

export default OuijaRoom;