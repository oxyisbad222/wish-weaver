import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, updateDoc, arrayUnion, collection, query, where, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, LogOut, Crown, Ghost } from 'lucide-react';
import { API_ENDPOINTS } from './App';

const spiritResponses = [
    "YES", "NO", "PERHAPS", "THE SPIRITS ARE UNCLEAR", "ASK AGAIN LATER", "IT IS CERTAIN",
    "WITHOUT A DOUBT", "YOU MAY RELY ON IT", "MOST LIKELY", "OUTLOOK GOOD", "SIGNS POINT TO YES",
    "DON'T COUNT ON IT", "MY SOURCES SAY NO", "VERY DOUBTFUL", "THE STARS ARE NOT ALIGNED",
    "THE VEIL IS TOO THICK", "A MESSAGE IS TRYING TO COME THROUGH", "BEWARE OF TRICKSTER SPIRITS",
    "GOODBYE", "FOCUS AND ASK AGAIN", "THE ENERGY IS WEAK", "AN UNSEEN PRESENCE IS NEAR",
    "LOOK FOR A SIGN", "THE ANSWER IS WITHIN YOU", "ANOTHER TIME"
];

const OuijaBoard = ({ room, user, db }) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split('');
    const planchetteRef = useRef(null);
    const boardRef = useRef(null);

    useEffect(() => {
        if (!db || room.gamePhase !== 'session' || !room.guidingMessage) {
            if (planchetteRef.current) {
                planchetteRef.current.style.transition = 'transform 1s ease-in-out';
            }
            return;
        };

        const targetChar = room.guidingMessage[room.guidingMessageIndex || 0];
        if (!targetChar) return;

        let targetElement;
        if (targetChar === ' ') {
            // For spaces, we can target a neutral element like the board itself for a pause
            targetElement = boardRef.current; 
        } else {
            targetElement = document.getElementById(`char-${targetChar.toUpperCase()}`);
        }

        if (!targetElement || !boardRef.current || !planchetteRef.current) return;

        const boardRect = boardRef.current.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        let targetX, targetY;

        if (targetChar === ' ') {
            // Pause in the center for a space
            targetX = boardRect.width / 2 - (planchetteRef.current.offsetWidth / 2);
            targetY = boardRect.height / 2 - (planchetteRef.current.offsetHeight / 2);
        } else {
            targetX = targetRect.left + targetRect.width / 2 - boardRect.left - (planchetteRef.current.offsetWidth / 2);
            targetY = targetRect.top + targetRect.height / 2 - boardRect.top - (planchetteRef.current.offsetHeight / 2);
        }

        planchetteRef.current.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)';
        planchetteRef.current.style.transform = `translate(${targetX}px, ${targetY}px)`;

        if (room.host.uid === user.uid) {
            const timeoutId = setTimeout(async () => {
                const roomRef = doc(db, 'ouijaRooms', room.id);
                const nextIndex = (room.guidingMessageIndex || 0) + 1;

                if (nextIndex >= room.guidingMessage.length) {
                    await updateDoc(roomRef, {
                        gamePhase: 'idle',
                        currentMessage: room.guidingMessage,
                        guidingMessage: '',
                        guidingMessageIndex: 0,
                        focusMessages: [],
                        votes: {},
                        ready: {}
                    });
                } else {
                    await updateDoc(roomRef, { guidingMessageIndex: nextIndex });
                }
            }, 1200); // 1s travel time + 200ms hover/pause
            return () => clearTimeout(timeoutId);
        }

    }, [room.gamePhase, room.guidingMessage, room.guidingMessageIndex, room.host.uid, user.uid, room.id, db]);


    return (
        <div ref={boardRef} className="relative w-full max-w-3xl mx-auto bg-slate-900/50 p-4 sm:p-8 rounded-3xl shadow-2xl border-2 border-purple-500/30 select-none aspect-[16/10] flex flex-col justify-center">
            <div className="absolute top-4 sm:top-8 left-6 sm:left-12 text-xl sm:text-2xl font-serif text-primary" id="char-YES">YES</div>
            <div className="absolute top-4 sm:top-8 right-6 sm:right-12 text-xl sm:text-2xl font-serif text-primary" id="char-NO">NO</div>

            <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-2 px-4 sm:px-16">
                {characters.map(char => (
                    <span key={char} id={`char-${char}`} className="text-lg sm:text-2xl font-serif text-purple-200/90 transition-colors">{char}</span>
                ))}
            </div>

            <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 text-xl sm:text-2xl font-serif text-primary" id="char-GOODBYE">GOODBYE</div>

            <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-4/5 h-12 sm:h-16 bg-black/30 rounded-lg p-2 text-center text-white font-serif text-base sm:text-xl overflow-y-auto flex items-center justify-center">
                <AnimatePresence>
                {room.guidingMessage.substring(0, room.guidingMessageIndex || 0).split('').map((char, i) => (
                    <motion.span
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        {char}
                    </motion.span>
                ))}
                </AnimatePresence>
                {room.gamePhase !== 'session' && <p>{room.currentMessage}</p>}
            </div>

            <motion.div
                ref={planchetteRef}
                className="absolute"
                style={{ top: '50%', left: '50%', x: '-50%', y: '-50%' }}
                animate={{
                    filter: room.gamePhase === 'session' ? ['brightness(1)', 'brightness(1.8)', 'brightness(1)'] : 'brightness(1)',
                    scale: room.gamePhase === 'session' ? [1, 1.1, 1] : 1,
                }}
                transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                 <Ghost className="w-14 h-14 sm:w-16 sm:h-16 text-white drop-shadow-lg" />
            </motion.div>
        </div>
    );
};

const RoomLobby = ({ onJoinRoom, db, user, userData, setNotification }) => {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'ouijaRooms'), where('isPublic', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRooms(roomsData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching public rooms:", error);
            setNotification("Could not fetch public rooms.", "error");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, setNotification]);

    const handleCreateRoom = async (name, isPublic) => {
        if (!db || !userData?.username) {
            setNotification("User data is still loading. Please try again in a moment.", "error");
            return;
        }

        const newRoomRef = doc(collection(db, 'ouijaRooms'));
        const roomData = {
            id: newRoomRef.id, name, isPublic,
            host: { uid: user.uid, username: userData.username, avatarSeed: userData.avatarSeed },
            participants: [{ uid: user.uid, username: userData.username, avatarSeed: userData.avatarSeed }],
            participantUids: [user.uid],
            createdAt: serverTimestamp(),
            currentMessage: 'The veil is thin...',
            gamePhase: 'idle',
            focusMessages: [],
            votes: {},
            ready: {},
            guidingMessage: '',
            guidingMessageIndex: 0,
        };
        await setDoc(newRoomRef, roomData);
        setShowCreateModal(false);
        onJoinRoom(newRoomRef.id);
    };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <AnimatePresence>
                {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateRoom} />}
            </AnimatePresence>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-serif text-foreground">Ouija Rooms</h2>
                <button onClick={() => setShowCreateModal(true)} className="flex items-center space-x-2 bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors">
                    <Plus size={20} />
                    <span>Create Room</span>
                </button>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border">
                <h3 className="text-xl font-semibold text-card-foreground mb-4">Public Rooms</h3>
                {isLoading ? (
                    <p className="text-card-foreground/70">Searching for spirits...</p>
                ) : rooms.length > 0 ? (
                    <div className="space-y-3">
                        {rooms.map(room => (
                            <div key={room.id} className="bg-background p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-foreground">{room.name}</p>
                                    <p className="text-sm text-foreground/60">Hosted by @{room.host.username}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-1 text-foreground/70">
                                        <Users size={16} />
                                        <span>{room.participants?.length || 0}</span>
                                    </div>
                                    <button onClick={() => onJoinRoom(room.id)} className="bg-primary/20 text-primary font-semibold py-1 px-3 rounded-md hover:bg-primary/30 transition-colors">
                                        Join
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-card-foreground/70 text-center py-4">No public rooms are active. Create one!</p>
                )}
            </div>
        </div>
    );
};
const CreateRoomModal = ({ onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onCreate(name.trim(), isPublic);
        }
    };

    return (
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
                className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-serif text-primary mb-4">Create a New Room</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Room Name"
                        className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors mb-4"
                    />
                    <div className="flex items-center justify-between mb-6">
                        <label className="text-foreground/80">Make room public?</label>
                        <button type="button" onClick={() => setIsPublic(!isPublic)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-primary' : 'bg-input'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`}/>
                        </button>
                    </div>
                    <button type="submit" disabled={!name.trim()} className="w-full bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-colors hover:bg-primary/90 disabled:opacity-50">
                        Create
                    </button>
                </form>
            </motion.div>
        </motion.div>
    );
};
const FocusPhase = ({ user, room, setNotification, db }) => {
    const [message, setMessage] = useState('');
    const hasSubmitted = room.focusMessages?.some(m => m.uid === user.uid);

    const handleSubmit = async () => {
        if (!message.trim() || hasSubmitted || !db) return;
        const roomRef = doc(db, 'ouijaRooms', room.id);
        try {
            await updateDoc(roomRef, {
                focusMessages: arrayUnion({
                    id: `msg_${user.uid}_${Date.now()}`,
                    uid: user.uid,
                    username: user.displayName,
                    message: message.trim()
                })
            });
            setMessage('');
            setNotification('Your question has been submitted to the spirits.');
        } catch (error) {
            console.error(error);
            setNotification('Failed to submit question.', 'error');
        }
    };

    return (
        <div className="text-center p-6 bg-card rounded-xl border border-border">
            <h3 className="text-2xl font-serif text-primary mb-4">Focus Your Energy</h3>
            <p className="text-foreground/70 mb-6">Submit a question or topic for the oracle to consider. All participants will vote on which question to ask.</p>
            {hasSubmitted ? (
                <p className="text-green-400 font-semibold">You have submitted your question. Waiting for others...</p>
            ) : (
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What do you wish to know?"
                        className="bg-input text-foreground p-3 rounded-lg w-full border border-border focus:border-primary"
                    />
                    <button onClick={handleSubmit} disabled={!message.trim()} className="bg-primary text-primary-foreground px-4 rounded-lg disabled:opacity-50">Submit</button>
                </div>
            )}
        </div>
    );
};
const VotingPhase = ({ user, room, setNotification, db }) => {
    const hasVoted = Object.values(room.votes || {}).flat().includes(user.uid);

    const handleVote = async (messageId) => {
        if (hasVoted || !db) {
            if(hasVoted) setNotification("You have already voted.", "error");
            return;
        }
        const roomRef = doc(db, 'ouijaRooms', room.id);
        const votePath = `votes.${messageId}`;
        try {
            await updateDoc(roomRef, {
                [votePath]: arrayUnion(user.uid)
            });
            setNotification("Your vote has been cast.");
        } catch (error) {
            console.error(error);
            setNotification("Failed to cast vote.", "error");
        }
    };

    return (
        <div className="p-6 bg-card rounded-xl border border-border">
            <h3 className="text-2xl font-serif text-primary mb-4 text-center">Vote on the Question</h3>
            <div className="space-y-3">
                {room.focusMessages?.map(msg => {
                    const votes = room.votes?.[msg.id]?.length || 0;
                    return (
                        <div key={msg.id} className="bg-background p-3 rounded-lg">
                            <p className="text-foreground/60 text-sm">@{msg.username} asks:</p>
                            <p className="text-foreground text-lg mb-2">"{msg.message}"</p>
                            <div className="flex justify-between items-center">
                                <span className="text-primary font-bold">{votes} Vote(s)</span>
                                <button onClick={() => handleVote(msg.id)} disabled={hasVoted} className="bg-primary/20 text-primary px-3 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                                    Vote
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
const OuijaRoom = ({ user, userData, onBack, db }) => {
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: 'success' });

    const showNotification = useCallback((message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: 'success' }), 4000);
    }, []);

    useEffect(() => {
        if (!currentRoomId || !db) return;

        setIsLoading(true);
        const roomRef = doc(db, 'ouijaRooms', currentRoomId);
        const unsubscribe = onSnapshot(roomRef, (doc) => {
            if (doc.exists()) {
                const roomData = { id: doc.id, ...doc.data() };
                setCurrentRoom(roomData);
                const isParticipant = roomData.participantUids?.includes(user.uid);
                if (!isParticipant) {
                    updateDoc(roomRef, {
                        participants: arrayUnion({ uid: user.uid, username: userData.username, avatarSeed: userData.avatarSeed }),
                        participantUids: arrayUnion(user.uid)
                    });
                }
            } else {
                showNotification("The room no longer exists.", "error");
                setCurrentRoom(null);
                setCurrentRoomId(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to room:", error);
            showNotification("Connection to the spirit world was lost.", "error");
            setCurrentRoomId(null);
        });

        return () => unsubscribe();
    }, [currentRoomId, user.uid, userData, db, showNotification]);

    useEffect(() => {
        if (!currentRoom || currentRoom.host.uid !== user.uid || !db) return;

        const roomRef = doc(db, 'ouijaRooms', currentRoom.id);
        const participantsCount = currentRoom.participants?.length || 0;

        if (currentRoom.gamePhase === 'idle' && Object.keys(currentRoom.ready || {}).length === participantsCount && participantsCount > 0) {
            const spiritResponse = spiritResponses[Math.floor(Math.random() * spiritResponses.length)];
            updateDoc(roomRef, {
                gamePhase: 'session',
                guidingMessage: spiritResponse.toUpperCase(),
                guidingMessageIndex: 0
            });
        }

        if (currentRoom.gamePhase === 'focus' && currentRoom.focusMessages?.length === participantsCount && participantsCount > 0) {
            updateDoc(roomRef, { gamePhase: 'voting' });
        }

        if (currentRoom.gamePhase === 'voting') {
            const totalVotes = Object.values(currentRoom.votes || {}).flat().length;
            if (totalVotes === participantsCount && participantsCount > 0) {
                 const winningMessageId = Object.entries(currentRoom.votes).sort((a, b) => b[1].length - a[1].length)[0][0];
                 const winningMessage = currentRoom.focusMessages.find(m => m.id === winningMessageId)?.message;
                 if (winningMessage) {
                    let spiritResponse;
                    do {
                        spiritResponse = spiritResponses[Math.floor(Math.random() * spiritResponses.length)];
                    } while (spiritResponse === currentRoom.currentMessage);

                    updateDoc(roomRef, { gamePhase: 'session', guidingMessage: spiritResponse.toUpperCase(), guidingMessageIndex: 0 });
                 }
            }
        }

    }, [currentRoom, user.uid, db]);
    
    const handleReady = async () => {
        if (!currentRoomId || !db) return;
        const roomRef = doc(db, 'ouijaRooms', currentRoomId);
        await updateDoc(roomRef, {
            [`ready.${user.uid}`]: true
        });
    };

    const handleJoinRoom = (roomId) => {
        setCurrentRoomId(roomId);
    };

    const handleLeaveRoom = async () => {
        if (!currentRoomId || !db) return;
        const roomRef = doc(db, 'ouijaRooms', currentRoomId);

        try {
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) return;
                const roomData = roomDoc.data();

                const remainingParticipants = roomData.participants.filter(p => p.uid !== user.uid);
                const remainingUids = roomData.participantUids.filter(uid => uid !== user.uid);

                if (remainingUids.length === 0) {
                    transaction.delete(roomRef);
                } else {
                    let newHost = roomData.host;
                    if (roomData.host.uid === user.uid && remainingParticipants.length > 0) {
                        newHost = { uid: remainingParticipants[0].uid, username: remainingParticipants[0].username, avatarSeed: remainingParticipants[0].avatarSeed };
                    }
                    transaction.update(roomRef, {
                        participants: remainingParticipants,
                        participantUids: remainingUids,
                        host: newHost
                    });
                }
            });
        } catch (error) {
            console.error("Error leaving room: ", error);
        } finally {
            setCurrentRoom(null);
            setCurrentRoomId(null);
        }
    };

    const startFocusPhase = async () => {
        if (currentRoom.host.uid !== user.uid || !db) return;
        const roomRef = doc(db, 'ouijaRooms', currentRoom.id);
        await updateDoc(roomRef, { gamePhase: 'focus', currentMessage: '', focusMessages: [], votes: {}, ready: {} });
    };

    const renderGamePhaseContent = () => {
        switch (currentRoom.gamePhase) {
            case 'focus':
                return <FocusPhase user={user} room={currentRoom} setNotification={showNotification} db={db} />;
            case 'voting':
                return <VotingPhase user={user} room={currentRoom} setNotification={showNotification} db={db} />;
            case 'session':
            case 'idle':
            default:
                const isReady = currentRoom.ready && currentRoom.ready[user.uid];
                return (
                    <div className="text-center flex flex-col items-center justify-center w-full h-full">
                        <OuijaBoard room={currentRoom} user={user} db={db} />
                        {currentRoom.gamePhase === 'idle' && (
                            <button onClick={handleReady} disabled={isReady} className="mt-6 bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                                {isReady ? "Waiting for others..." : "Ready..."}
                            </button>
                        )}
                        {currentRoom.host.uid === user.uid && currentRoom.gamePhase === 'idle' && (
                            <button onClick={startFocusPhase} className="mt-4 text-sm text-primary hover:underline">
                                Ask a question instead?
                            </button>
                        )}
                    </div>
                );
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><p>Entering the spirit world...</p></div>;
    }

    if (!currentRoomId || !currentRoom) {
        return <RoomLobby onJoinRoom={handleJoinRoom} db={db} user={user} userData={userData} setNotification={showNotification} />;
    }

    return (
        <div className="p-2 sm:p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-serif text-primary">{currentRoom.name}</h2>
                    <p className="text-foreground/60">Hosted by @{currentRoom.host.username}</p>
                </div>
                <button onClick={handleLeaveRoom} className="flex items-center space-x-2 bg-red-500/20 text-red-400 font-semibold py-2 px-4 rounded-lg hover:bg-red-500/30 transition-colors">
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Leave</span>
                </button>
            </div>

            <div className="flex-grow flex flex-col md:flex-row gap-6">
                <div className="flex-grow flex items-center justify-center">
                    {renderGamePhaseContent()}
                </div>
                <div className="w-full md:w-64 lg:w-72 flex-shrink-0 bg-card p-4 rounded-xl border border-border self-start">
                    <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center"><Users size={18} className="mr-2"/>Participants</h3>
                    <div className="space-y-3">
                        {currentRoom.participants?.map(p => (
                            <div key={p.uid} className="flex items-center space-x-3">
                                <img src={API_ENDPOINTS.avatar(p.avatarSeed)} alt="avatar" className="w-10 h-10 rounded-full flex-shrink-0" />
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-semibold text-foreground truncate">{p.username}</p>
                                </div>
                                {p.uid === currentRoom.host.uid && <Crown size={16} className="text-amber-400 flex-shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default OuijaRoom;