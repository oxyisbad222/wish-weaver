import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getFirestore, doc, collection, addDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, runTransaction, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { ArrowLeft, Send, Check, Copy, Users, Play, Crown } from 'lucide-react';
import { API_ENDPOINTS } from './App'; 

// --- Helper Components ---

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => {
  const baseClasses = 'font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out transform flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30',
    secondary: 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
    ghost: 'hover:bg-primary/10 text-primary',
  };
  return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const Notification = ({ message }) => (
    <AnimatePresence>
        {message && (
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed top-20 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full shadow-lg z-50 bg-purple-600 text-white"
            >
                {message}
            </motion.div>
        )}
    </AnimatePresence>
);


// --- Ouija Board Component ---

const OuijaBoard = ({ planchettePosition, setPlanchettePosition, isAnswering, answerPath }) => {
    const boardRef = useRef(null);
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    const numbers = "1234567890".split('');

    // This effect handles the automated movement during the 'answering' phase
    useEffect(() => {
        if (isAnswering && answerPath && answerPath.length > 0) {
            // This is a simplified animation. A real implementation would be more complex.
            // For now, let's just move it to a final position.
            const finalPosition = answerPath[answerPath.length - 1];
            setPlanchettePosition(finalPosition);
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // Vibrate pattern
            }
        }
    }, [isAnswering, answerPath, setPlanchettePosition]);

    return (
        <div ref={boardRef} className="relative w-full aspect-[1.6] bg-board-texture bg-cover bg-center rounded-2xl shadow-inner-strong border-4 border-black p-4 select-none">
            {/* Decorative Elements */}
            <div className="absolute top-4 left-4 text-4xl font-serif text-white/80 opacity-50">YES</div>
            <div className="absolute top-4 right-4 text-4xl font-serif text-white/80 opacity-50">NO</div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-2xl font-serif text-white/80 opacity-50">GOODBYE</div>
            
            {/* Alphabet */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[90%] flex justify-center space-x-2">
                {characters.slice(0, 13).map(char => <span key={char} className="text-2xl font-serif text-white/70">{char}</span>)}
            </div>
             <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full flex justify-center space-x-2">
                {characters.slice(13).map(char => <span key={char} className="text-2xl font-serif text-white/70">{char}</span>)}
            </div>
            {/* Numbers */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[80%] flex justify-center space-x-2">
                {numbers.map(num => <span key={num} className="text-2xl font-serif text-white/70">{num}</span>)}
            </div>

            {/* Planchette */}
            <motion.div
                drag
                dragMomentum={false}
                animate={planchettePosition}
                className="absolute w-24 h-24 cursor-grab active:cursor-grabbing z-10"
                style={{
                    backgroundImage: `url('/planchette.png')`, // Assumes a planchette image is in public folder
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                }}
                whileTap={{ scale: 1.1 }}
                onDragStart={() => { if(navigator.vibrate) navigator.vibrate(50); }}
                onDragEnd={(event, info) => setPlanchettePosition({ x: info.point.x, y: info.point.y })}
            />
        </div>
    );
};


// --- Main OuijaRoom Component ---

const OuijaRoom = ({ user, userData, onBack }) => {
    // FIX: Initialize Firestore inside the component to ensure Firebase app is ready.
    const db = getFirestore();

    const [roomId, setRoomId] = useState(null);
    const [roomData, setRoomData] = useState(null);
    const [focusMessage, setFocusMessage] = useState('');
    const [planchettePosition, setPlanchettePosition] = useState({ x: '45%', y: '40%' });
    const [notification, setNotification] = useState('');
    const [joinId, setJoinId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isHost = roomData?.hostId === user.uid;

    // --- Room Management ---
    const createRoom = async () => {
        setIsLoading(true);
        try {
            const roomRef = await addDoc(collection(db, 'ouijaRooms'), {
                hostId: user.uid,
                players: [{ uid: user.uid, username: userData.username, avatarSeed: userData.avatarSeed }],
                createdAt: serverTimestamp(),
                status: 'waiting', // waiting, focusing, voting, answering, finished
                focusMessages: [],
                votes: {},
                currentMessage: null,
                answerPath: [],
            });
            setRoomId(roomRef.id);
        } catch (error) {
            setNotification("Error creating room.");
        } finally {
            setIsLoading(false);
        }
    };

    const joinRoom = async (id) => {
        if (!id) return;
        setIsLoading(true);
        const roomRef = doc(db, 'ouijaRooms', id);
        try {
            const roomDoc = await getDoc(roomRef);
            if (!roomDoc.exists()) {
                setNotification("Room not found.");
                setIsLoading(false);
                return;
            }
            // Add player if not already in the room
            if (!roomDoc.data().players.some(p => p.uid === user.uid)) {
                 await updateDoc(roomRef, {
                    players: arrayUnion({ uid: user.uid, username: userData.username, avatarSeed: userData.avatarSeed })
                });
            }
            setRoomId(id);
        } catch (error) {
            setNotification("Error joining room.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Real-time Room Subscription ---
    useEffect(() => {
        if (!roomId) return;
        const unsub = onSnapshot(doc(db, 'ouijaRooms', roomId), (doc) => {
            if (doc.exists()) {
                setRoomData(doc.data());
            } else {
                setNotification("Room closed.");
                setRoomId(null);
                setRoomData(null);
            }
        });
        return () => unsub();
    }, [roomId, db]); // Added db to dependency array

    // --- Game State Logic ---
    const handleStartGame = async () => {
        if (!isHost) return;
        await updateDoc(doc(db, 'ouijaRooms', roomId), { status: 'focusing' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (focusMessage.trim() === '' || roomData.status !== 'focusing') return;
        const roomRef = doc(db, 'ouijaRooms', roomId);
        await updateDoc(roomRef, {
            focusMessages: arrayUnion({
                text: focusMessage,
                author: userData.username,
                uid: user.uid
            })
        });
        setFocusMessage('');
    };

    const handleStartVoting = async () => {
        if (!isHost) return;
        await updateDoc(doc(db, 'ouijaRooms', roomId), { status: 'voting' });
    };

    const handleVote = async (messageText) => {
        if (roomData?.votes?.[user.uid]) {
            setNotification("You have already voted.");
            return;
        }
        const roomRef = doc(db, 'ouijaRooms', roomId);
        await updateDoc(roomRef, {
            [`votes.${user.uid}`]: messageText
        });
    };
    
    const handleTallyVotes = async () => {
        if (!isHost) return;
        const votes = roomData.votes || {};
        const voteCounts = Object.values(votes).reduce((acc, vote) => {
            acc[vote] = (acc[vote] || 0) + 1;
            return acc;
        }, {});
        
        const winningMessage = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b, "No message selected");

        // Simplified path generation for the answer
        const answer = "YES"; // This should be dynamically generated in a real app
        const answerPath = answer.split('').map((char, i) => ({
            x: `${20 + i * 10}%`,
            y: `${60}%`,
        }));

        await updateDoc(doc(db, 'ouijaRooms', roomId), {
            status: 'answering',
            currentMessage: winningMessage,
            answerPath: answerPath
        });
    };
    
    const handlePlayAgain = async () => {
        if (!isHost) return;
        await updateDoc(doc(db, 'ouijaRooms', roomId), {
            status: 'waiting',
            focusMessages: [],
            votes: {},
            currentMessage: null,
            answerPath: [],
        });
    };

    // --- UI Components ---
    const Lobby = () => (
        <div className="p-4 sm:p-6 max-w-md mx-auto text-center">
            <h2 className="text-4xl font-serif mb-8 text-primary">The Ouija Room</h2>
            <p className="text-foreground/70 mb-8">Gather your friends, focus your energy, and see what the spirits have to say.</p>
            <div className="space-y-4">
                <Button onClick={createRoom} disabled={isLoading} className="w-full">
                    {isLoading ? 'Creating...' : 'Create a New Room'}
                </Button>
                <div className="flex items-center space-x-2">
                    <input type="text" value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Enter Room ID" className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" />
                    <Button onClick={() => joinRoom(joinId)} disabled={isLoading || !joinId} variant="secondary" className="px-4">Join</Button>
                </div>
            </div>
        </div>
    );

    const RoomView = () => (
        <div className="p-4">
            <Notification message={notification} />
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <button onClick={onBack} className="p-2 mr-2 rounded-full hover:bg-foreground/10 transition-colors"><ArrowLeft size={20}/></button>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Room ID:</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-foreground/70 font-mono">{roomId}</span>
                            <button onClick={() => { navigator.clipboard.writeText(roomId); setNotification('Room ID copied!'); }} className="p-1 text-primary hover:bg-primary/10 rounded-md"><Copy size={14}/></button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border border-border">
                    <Users size={16} className="text-primary"/>
                    <span className="font-semibold">{roomData?.players?.length || 0}</span>
                </div>
            </div>
            
            <div className="bg-card p-4 rounded-2xl shadow-lg border border-border">
                {/* Player Avatars */}
                <div className="flex -space-x-3 overflow-hidden mb-4 justify-center p-2 bg-background rounded-lg">
                    {roomData?.players.map(p => (
                        <div key={p.uid} className="relative">
                            <img className="inline-block h-10 w-10 rounded-full ring-2 ring-background" src={API_ENDPOINTS.avatar(p.avatarSeed)} alt={p.username}/>
                            {roomData.hostId === p.uid && <Crown size={12} className="absolute -top-1 -right-1 text-amber-400 bg-black/50 rounded-full p-0.5"/>}
                        </div>
                    ))}
                </div>

                {/* Game State UI */}
                <div className="text-center mb-4 min-h-[80px] bg-background p-3 rounded-lg flex flex-col justify-center items-center">
                    <AnimatePresence mode="wait">
                        <motion.div key={roomData.status} initial={{opacity: 0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}>
                            {roomData.status === 'waiting' && (
                                <>
                                    <p className="font-semibold text-lg">Waiting for players...</p>
                                    <p className="text-sm text-foreground/60">The host will start the session.</p>
                                    {isHost && <Button onClick={handleStartGame} className="mt-2 py-2 px-4">Start Session</Button>}
                                </>
                            )}
                             {roomData.status === 'focusing' && (
                                <>
                                    <p className="font-semibold text-lg">Focus your energy.</p>
                                    <p className="text-sm text-foreground/60">Submit a question for the spirits.</p>
                                </>
                            )}
                             {roomData.status === 'voting' && (
                                <>
                                    <p className="font-semibold text-lg">Vote for a question.</p>
                                    <p className="text-sm text-foreground/60">The spirits will answer the chosen query.</p>
                                </>
                             )}
                              {roomData.status === 'answering' && (
                                <>
                                    <p className="font-semibold text-lg">The spirits are responding...</p>
                                    <p className="text-sm text-foreground/60 italic">"{roomData.currentMessage}"</p>
                                </>
                             )}
                             {roomData.status === 'finished' && (
                                <>
                                    <p className="font-semibold text-lg">The session has ended.</p>
                                    <p className="text-sm text-foreground/60">The spirits say GOODBYE.</p>
                                    {isHost && <Button onClick={handlePlayAgain} className="mt-2 py-2 px-4">Play Again</Button>}
                                </>
                             )}
                        </motion.div>
                    </AnimatePresence>
                </div>
                
                <OuijaBoard planchettePosition={planchettePosition} setPlanchettePosition={setPlanchettePosition} isAnswering={roomData.status === 'answering'} answerPath={roomData.answerPath} />

                {/* Action Area */}
                <div className="mt-4">
                    {roomData.status === 'focusing' && (
                        <>
                        <form onSubmit={handleSendMessage} className="flex space-x-2">
                            <input type="text" value={focusMessage} onChange={(e) => setFocusMessage(e.target.value)} placeholder="Type your question..." className="bg-input text-foreground p-3 rounded-lg w-full border border-border"/>
                            <Button type="submit" variant="primary" className="px-4"><Send size={18}/></Button>
                        </form>
                        {isHost && <Button onClick={handleStartVoting} variant="secondary" className="w-full mt-2">Start Voting</Button>}
                        </>
                    )}
                    {roomData.status === 'voting' && roomData.focusMessages && (
                        <div className="space-y-2">
                            {roomData.focusMessages.map((msg, i) => (
                                <button key={i} onClick={() => handleVote(msg.text)} disabled={!!roomData.votes?.[user.uid]} className="w-full text-left p-3 bg-input rounded-lg flex justify-between items-center transition-colors hover:bg-foreground/10 disabled:bg-primary/20 disabled:cursor-not-allowed">
                                    <span>"{msg.text}" - <span className="text-foreground/60">{msg.author}</span></span>
                                    {roomData.votes?.[user.uid] === msg.text && <Check size={16} className="text-primary"/>}
                                </button>
                            ))}
                             {isHost && <Button onClick={handleTallyVotes} variant="secondary" className="w-full mt-2">Reveal Answer</Button>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return roomId ? <RoomView /> : <Lobby />;
};

export default OuijaRoom;
