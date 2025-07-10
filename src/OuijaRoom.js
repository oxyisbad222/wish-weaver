import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot, runTransaction, collection, updateDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogOut, Send, Crown, Ghost, Sparkles, MessageSquare, Link as LinkIcon } from 'lucide-react';
import { API_ENDPOINTS } from './App';

// --- Reusable Components ---

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, ...props }) => {
  const baseClasses = 'font-semibold py-2 px-5 rounded-lg transition-all duration-300 ease-in-out transform flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shadow-lg';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20',
    secondary: 'bg-foreground/10 text-foreground/80 hover:bg-foreground/20',
    ghost: 'hover:bg-primary/10 text-primary shadow-none',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20',
  };
  return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

// --- Ouija Board Components ---

const OuijaPlanchette = ({ room, boardRef }) => {
    const { participants = [] } = room;
    const planchetteX = useSpring(0, { stiffness: 20, damping: 15, mass: 0.5 });
    const planchetteY = useSpring(0, { stiffness: 20, damping: 15, mass: 0.5 });
    const planchetteRotate = useSpring(0, { stiffness: 100, damping: 20 });
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!boardRef.current) return;
        const activeParticipants = participants.filter(p => p.cursor);
        
        let targetX = boardRef.current.clientWidth / 2 - 30; // Center of planchette
        let targetY = boardRef.current.clientHeight / 2 - 40; // Center of planchette

        if (activeParticipants.length > 0) {
            targetX = activeParticipants.reduce((sum, p) => sum + p.cursor.x, 0) / activeParticipants.length;
            targetY = activeParticipants.reduce((sum, p) => sum + p.cursor.y, 0) / activeParticipants.length;
        }

        planchetteX.set(targetX);
        planchetteY.set(targetY);
        
        const dx = targetX - lastPos.current.x;
        const dy = targetY - lastPos.current.y;
        if(Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
            planchetteRotate.set(angle);
        }
        lastPos.current = {x: targetX, y: targetY};

    }, [participants, planchetteX, planchetteY, planchetteRotate, boardRef]);

    return (
        <motion.div
            style={{ 
                x: planchetteX, 
                y: planchetteY, 
                rotate: planchetteRotate, 
                originX: '50%',
                originY: '50%',
             }}
            className="absolute top-0 left-0 w-16 h-20 pointer-events-none"
        >
            <Ghost className="w-full h-full text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
        </motion.div>
    );
};


const OuijaBoard = ({ room, user, db }) => {
    const boardRef = useRef(null);
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split('');

    const handleMouseMove = useCallback((e) => {
        if (!db || !boardRef.current || !room?.id) return;

        const boardRect = boardRef.current.getBoundingClientRect();
        const x = e.clientX - boardRect.left;
        const y = e.clientY - boardRect.top;
        
        const participantRef = doc(db, 'ouijaRooms', room.id, 'participants', user.uid);
        
        // Use a lightweight update, `setDoc` with merge is also fine here.
        updateDoc(participantRef, { cursor: { x, y } }).catch(err => {
            // This might fail if the doc doesn't exist yet, which is fine.
            // A more robust solution might use a try/catch or check existence first.
        });
    }, [db, room, user]);

    return (
        <div 
            ref={boardRef} 
            onMouseMove={handleMouseMove}
            className="relative w-full max-w-3xl mx-auto bg-slate-900/60 p-4 sm:p-6 rounded-3xl shadow-glow-primary border-2 border-primary/30 select-none aspect-[1.8] overflow-hidden"
        >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10"></div>
            <div className="flex justify-between items-center px-4 sm:px-8">
                <span className="text-3xl font-serif text-primary/80">YES</span>
                <Sparkles className="text-primary/70 animate-pulse"/>
                <span className="text-3xl font-serif text-primary/80">NO</span>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-x-3 sm:gap-x-4 gap-y-1 sm:gap-y-2 px-4 sm:px-12 mt-4">
                {characters.map(char => (
                    <span key={char} className="text-2xl sm:text-3xl font-serif text-purple-200/80 hover:text-white transition-colors duration-300">{char}</span>
                ))}
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-3xl font-serif text-primary/80">GOODBYE</div>
            
            <OuijaPlanchette room={room} boardRef={boardRef} />
        </div>
    );
};


// --- Room Components ---

const OuijaRoom = ({ user, userData, onBack, db }) => {
    const [room, setRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [notification, setNotification] = useState({ message: '', type: 'success' });
    const messagesEndRef = useRef(null);
    
    // Using a fixed room ID for a shared experience.
    const roomId = 'shared_ouija_room_1'; 

    const showNotification = useCallback((message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: 'success' }), 3000);
    }, []);

    // Subscribe to room, participants, and chat data
    useEffect(() => {
        // Guard against missing db or user data
        if (!db || !user?.uid || !userData?.username) {
            console.log("DB or user data not ready yet.");
            return;
        }

        const roomRef = doc(db, 'ouijaRooms', roomId);
        const participantsRef = collection(roomRef, 'participants');
        const participantRef = doc(participantsRef, user.uid);

        // Join the room: Create the room if it doesn't exist, and add the user as a participant.
        const joinRoom = async () => {
            try {
                await runTransaction(db, async (transaction) => {
                    const roomDoc = await transaction.get(roomRef);
                    if (!roomDoc.exists()) {
                        transaction.set(roomRef, { 
                            name: 'The Spirit Circle', 
                            createdAt: serverTimestamp(),
                            host: { uid: user.uid, username: userData.username }
                        });
                    }
                    transaction.set(participantRef, { 
                        uid: user.uid, 
                        username: userData.username, 
                        avatarSeed: userData.avatarSeed,
                        joinedAt: serverTimestamp()
                    });
                });
            } catch (error) {
                console.error("Error joining Ouija room:", error);
                showNotification("Could not connect to the spirit realm.", "error");
            }
        };

        joinRoom();

        const unsubRoom = onSnapshot(roomRef, (docSnap) => {
            setRoom(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
        }, (error) => {
            console.error("Error listening to room:", error);
            showNotification("Lost connection to the room.", "error");
        });

        const unsubParticipants = onSnapshot(participantsRef, (snapshot) => {
            const participantsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRoom(prevRoom => prevRoom ? ({ ...prevRoom, participants: participantsData }) : null);
        });

        const chatRef = collection(roomRef, 'messages');
        const q = query(chatRef, orderBy('timestamp', 'asc'), limit(50));
        const unsubMessages = onSnapshot(q, (snapshot) => {
             setMessages(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
        });

        // Cleanup on unmount
        return () => {
            unsubRoom();
            unsubParticipants();
            unsubMessages();
            // Remove participant on leave
            runTransaction(db, async (transaction) => {
                 transaction.delete(participantRef);
            }).catch(console.error);
        };

    }, [db, user, userData, roomId, showNotification]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !db || !userData) return;

        const chatRef = collection(db, 'ouijaRooms', roomId, 'messages');
        try {
            await addDoc(chatRef, {
                text: newMessage,
                uid: user.uid,
                username: userData.username,
                avatarSeed: userData.avatarSeed,
                timestamp: serverTimestamp(),
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            showNotification("Could not send message.", "error");
        }
    };
    
    const handleInvite = () => {
        navigator.clipboard.writeText(window.location.href);
        showNotification("Invite link copied to clipboard!");
    };

    if (!room) {
        return <div className="flex justify-center items-center h-screen"><p className="text-xl font-serif text-primary">Connecting to the spirit realm...</p></div>;
    }

    return (
        <div className="p-2 sm:p-4 min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
            <AnimatePresence>
                {notification.message && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-20 left-1/2 -translate-x-1/2 ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-4 py-2 rounded-lg shadow-lg z-50`}
                    >
                        {notification.message}
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="flex-grow flex flex-col lg:flex-row gap-4">
                {/* Left Panel - Participants & Chat */}
                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                    {/* Participants List */}
                    <div className="bg-card/70 p-4 rounded-xl border border-border backdrop-blur-sm">
                        <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center"><Users size={18} className="mr-2"/>Participants ({room.participants?.length || 0})</h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                            {room.participants?.map(p => (
                                <div key={p.uid} className="flex items-center space-x-3">
                                    <img src={API_ENDPOINTS.avatar(p.avatarSeed || 'default')} alt="avatar" className="w-9 h-9 rounded-full"/>
                                    <p className="font-medium text-foreground/90 truncate">{p.username}</p>
                                    {p.uid === room.host?.uid && <Crown size={16} className="text-amber-400 flex-shrink-0" title="Host"/>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chat Box */}
                    <div className="bg-card/70 p-4 rounded-xl border border-border backdrop-blur-sm flex-grow flex flex-col">
                        <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center"><MessageSquare size={18} className="mr-2"/>Chatter</h3>
                        <div className="flex-grow space-y-3 overflow-y-auto mb-3 pr-2">
                             {messages.map(msg => (
                                <div key={msg.id} className="flex items-start space-x-2 text-sm">
                                    <img src={API_ENDPOINTS.avatar(msg.avatarSeed || 'default')} className="w-6 h-6 rounded-full mt-1" alt="avatar"/>
                                    <div>
                                        <p className="font-semibold text-primary/80">{msg.username}</p>
                                        <p className="text-foreground/80 break-words">{msg.text}</p>
                                    </div>
                                </div>
                             ))}
                             <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="flex space-x-2">
                             <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Whisper..." className="bg-input text-foreground p-2 rounded-lg w-full border border-border focus:border-primary"/>
                             <Button type="submit" disabled={!newMessage.trim()} className="px-3"><Send size={18}/></Button>
                        </form>
                    </div>
                </div>

                {/* Main Content - Ouija Board */}
                <div className="flex-grow flex flex-col items-center justify-center">
                    <h1 className="text-4xl sm:text-5xl font-serif text-primary text-center mb-2">{room.name}</h1>
                    <p className="text-foreground/60 text-center mb-4">Focus your energy with your friends to reveal a message.</p>
                    <OuijaBoard room={room} user={user} db={db} />
                    <div className="flex space-x-4 mt-6">
                        <Button onClick={onBack} variant="secondary"><LogOut size={16}/> Leave Room</Button>
                        <Button onClick={handleInvite} variant="primary"><LinkIcon size={16}/> Invite Friends</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OuijaRoom;