import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, deleteDoc, updateDoc
} from './firebase';
import { UserProfile, Contact, Message, SOSAlert, PendingInvite, UserRole } from './types';
import { cn } from './utils';
import { 
  MessageCircle, Shield, Phone, Camera, Send, AlertTriangle, 
  UserPlus, Check, X, LogOut, Settings, User, MapPin, Clock,
  ChevronLeft, Image as ImageIcon, Smile, Trash2, Video, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isValid } from 'date-fns';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

// Error handling as per instructions
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const NICK_PINK = '#F48FB1';
const NICK_BLUE = '#81D4FA';
const NICK_PURPLE = '#CE93D8';
const NICK_GRADIENT = 'linear-gradient(135deg, #81D4FA 0%, #F48FB1 50%, #CE93D8 100%)';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Ops! Algo deu errado.</h2>
          <p className="text-slate-600 mb-6">Ocorreu um erro inesperado. Por favor, tente recarregar a página.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#F48FB1] text-white rounded-full font-bold shadow-lg"
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'role-select' | 'main' | 'chat' | 'sos'>('login');
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'calls' | 'family' | 'settings'>('chats');
  const [modal, setModal] = useState<{ type: 'confirm' | 'alert', title: string, message: string, onConfirm?: () => void } | null>(null);
  const [showMoodPrompt, setShowMoodPrompt] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendEmailInput, setFriendEmailInput] = useState('');

  const MOODS = [
    { label: 'Feliz', emoji: '😊' },
    { label: 'Ansioso', emoji: '😰' },
    { label: 'Nervoso', emoji: '😠' },
    { label: 'Com raiva', emoji: '😡' },
    { label: 'Chateado', emoji: '😞' },
    { label: 'Triste', emoji: '😢' },
    { label: 'Quieto', emoji: '😶' },
    { label: 'Normal', emoji: '😐' },
  ];

  const AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily',
  ];

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Real-time listener for user profile
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
          if (userDoc.exists()) {
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            console.log("👤 User profile loaded:", userData);
            setUser(userData);
            
            // Show mood prompt if not set today
            const today = new Date().toDateString();
            const moodDate = userData.moodUpdatedAt?.toDate ? userData.moodUpdatedAt.toDate().toDateString() : null;
            if (moodDate !== today) {
              setShowMoodPrompt(true);
            }

            if (view === 'login' || view === 'role-select') setView('main');
          } else {
            setView('role-select');
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        setUser(null);
        setView('login');
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Separate effect for invites and accepted sent invites
  useEffect(() => {
    if (!user) return;

    // Real-time listener for incoming pending invites
    const qInvites = query(collection(db, 'pending_contacts'), where('targetEmail', '==', user.email));
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      setPendingInvites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingInvite)));
    });

    // Real-time listener for sent invites that were accepted
    const qSent = query(collection(db, 'pending_contacts'), where('fromUid', '==', user.uid), where('accepted', '==', true));
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      snapshot.docs.forEach(async (inviteDoc) => {
        const invite = inviteDoc.data() as PendingInvite;
        // Find the user profile for the target email
        const qUser = query(collection(db, 'users'), where('email', '==', invite.targetEmail));
        const userSnapshot = await getDocs(qUser);
        if (!userSnapshot.empty) {
          const targetUser = userSnapshot.docs[0].data() as UserProfile;
          // Add to current user's contacts
          await setDoc(doc(db, 'users', user.uid, 'contacts', targetUser.uid), {
            uid: targetUser.uid,
            name: targetUser.name,
            photoURL: targetUser.photoURL || '',
            approved: true,
            childId: user.uid,
            meetAuthorized: false,
            lastMessageAt: serverTimestamp()
          });
        }
        // Delete the invite
        await deleteDoc(doc(db, 'pending_contacts', inviteDoc.id));
      });
    });

    return () => {
      unsubInvites();
      unsubSent();
    };
  }, [user?.uid]);

  const updateMood = async (mood: string, emoji: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { 
        mood, 
        moodEmoji: emoji, 
        moodUpdatedAt: serverTimestamp() 
      }, { merge: true });
      
      // Update this user's mood in everyone's contact list who has them
      const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
      const updatePromises = contactsSnap.docs.map(async (contactDoc) => {
        const contactId = contactDoc.id;
        return setDoc(doc(db, 'users', contactId, 'contacts', user.uid), {
          mood,
          moodEmoji: emoji
        }, { merge: true }).catch(() => {});
      });
      
      await Promise.all(updatePromises);
      setShowMoodPrompt(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const updateProfilePhoto = async (photoURL: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { photoURL }, { merge: true });
      
      // Update this user's photo in everyone's contact list who has them
      const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
      const updatePromises = contactsSnap.docs.map(async (contactDoc) => {
        const contactId = contactDoc.id;
        return setDoc(doc(db, 'users', contactId, 'contacts', user.uid), {
          photoURL
        }, { merge: true }).catch(() => {});
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (!auth.currentUser) return;
    const profile: UserProfile = {
      uid: auth.currentUser.uid,
      name: auth.currentUser.displayName || 'Usuário',
      email: auth.currentUser.email || '',
      role,
      photoURL: auth.currentUser.photoURL || ''
    };
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile);
      setUser(profile);
      setView('main');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    }
  };

  const sendInvite = async (email: string) => {
    if (!user || !email) return;
    if (email.toLowerCase() === user.email.toLowerCase()) {
      setModal({ title: 'Ops!', message: 'Você não pode enviar um convite para si mesmo.', type: 'alert' });
      return;
    }
    try {
      // Check if already invited
      const q = query(collection(db, 'pending_contacts'), where('targetEmail', '==', email), where('fromUid', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setModal({ title: 'Aviso', message: 'Convite já enviado para este email.', type: 'alert' });
        return;
      }

      await addDoc(collection(db, 'pending_contacts'), {
        targetEmail: email,
        fromUid: user.uid,
        fromName: user.name,
        fromPhoto: user.photoURL || '',
        timestamp: serverTimestamp(),
        accepted: false
      });
      setFriendEmailInput('');
      setShowAddFriendModal(false);
      setModal({ title: 'Sucesso!', message: 'Convite enviado! Assim que a pessoa aceitar, vocês poderão conversar.', type: 'alert' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'pending_contacts');
    }
  };

  const acceptInvite = async (invite: PendingInvite) => {
    if (!user) return;
    try {
      // 1. Add sender to my contacts
      await setDoc(doc(db, 'users', user.uid, 'contacts', invite.fromUid), {
        uid: invite.fromUid,
        name: invite.fromName,
        photoURL: invite.fromPhoto || '',
        approved: true,
        childId: user.uid,
        meetAuthorized: false,
        lastMessageAt: serverTimestamp()
      }, { merge: true });

      // 2. Add me to sender's contacts (Reciprocal)
      // This works because the rules allow self-creation in someone else's list
      await setDoc(doc(db, 'users', invite.fromUid, 'contacts', user.uid), {
        uid: user.uid,
        name: user.name,
        photoURL: user.photoURL || '',
        approved: true,
        childId: invite.fromUid,
        meetAuthorized: false,
        lastMessageAt: serverTimestamp()
      }, { merge: true });

      // 3. Mark invite as accepted
      await updateDoc(doc(db, 'pending_contacts', invite.id), {
        accepted: true
      });

      setModal({ title: 'Sucesso!', message: `Agora você e ${invite.fromName} são amigos!`, type: 'alert' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
      setModal({ 
        title: 'Erro ao aceitar', 
        message: 'Não foi possível aceitar o convite. Tente novamente mais tarde.', 
        type: 'alert' 
      });
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'pending_contacts', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pending_contacts/${inviteId}`);
    }
  };

  const clearAllContacts = async () => {
    if (!user) return;
    setModal({
      type: 'confirm',
      title: 'Limpar Contatos',
      message: 'Tem certeza que deseja remover TODOS os seus contatos? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const contactsSnap = await getDocs(collection(db, 'users', user.uid, 'contacts'));
          const deletePromises = contactsSnap.docs.map(async (contactDoc) => {
            return deleteDoc(doc(db, 'users', user.uid, 'contacts', contactDoc.id));
          });
          await Promise.all(deletePromises);
          setModal({ type: 'alert', title: 'Sucesso', message: 'Todos os contatos foram removidos.' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'contacts');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex flex-col items-center mb-12"
        >
          <div className="w-24 h-24 mb-6 rounded-[32px] flex items-center justify-center shadow-xl relative overflow-hidden" style={{ background: NICK_GRADIENT }}>
            <div className="absolute inset-0 bg-white/20 blur-xl" />
            <div className="relative bg-white/90 p-4 rounded-full shadow-inner">
              <Phone className="w-10 h-10 text-[#F48FB1]" />
            </div>
          </div>
          <p className="text-[#F48FB1] font-bold text-xl tracking-tight">WhatsNick...</p>
        </motion.div>
        
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-slate-600 transition-colors font-medium"
        >
          <LogOut className="w-5 h-5" />
          Sair da conta
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full max-w-7xl mx-auto h-[100dvh] bg-white shadow-xl relative overflow-hidden flex flex-col font-sans md:flex-row">
        {/* Mood Prompt Modal */}
        <AnimatePresence>
          {showMoodPrompt && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">Como você está hoje?</h3>
                <p className="text-slate-500 text-sm text-center mb-6">Conte para os seus amigos como está o seu humor hoje!</p>
                
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {MOODS.map((m) => (
                    <button
                      key={m.label}
                      onClick={() => updateMood(m.label, m.emoji)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <span className="text-3xl">{m.emoji}</span>
                      <span className="text-[10px] text-slate-500 font-medium text-center leading-tight">{m.label}</span>
                    </button>
                  ))}
                </div>
                
                <button 
                  onClick={() => setShowMoodPrompt(false)}
                  className="w-full py-3 text-slate-400 font-medium text-sm"
                >
                  Pular por enquanto
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
        {view === 'login' && <LoginView onLogin={handleLogin} />}
        {view === 'role-select' && <RoleSelectView onSelect={handleRoleSelect} />}
        {(view === 'main' || view === 'chat') && user && (
          <div className="flex flex-1 h-full overflow-hidden relative">
            <div className={cn(
              "flex-col w-full md:w-80 lg:w-96 border-r border-slate-100 bg-white z-20 h-full",
              activeChat && view === 'chat' ? "hidden md:flex" : "flex"
            )}>
              <MainLayout 
                user={user} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                setView={setView} 
                setActiveChat={setActiveChat}
                setModal={setModal}
                moods={MOODS}
                avatars={AVATARS}
                updateMood={updateMood}
                updateProfilePhoto={updateProfilePhoto}
                pendingInvites={pendingInvites}
                acceptInvite={acceptInvite}
                declineInvite={declineInvite}
                setShowAddFriendModal={setShowAddFriendModal}
                onClearContacts={clearAllContacts}
              />
            </div>
            <div className={cn(
              "flex-1 bg-slate-50 relative h-full overflow-hidden",
              !activeChat || view !== 'chat' ? "hidden md:flex items-center justify-center" : "flex"
            )}>
              {activeChat && view === 'chat' ? (
                <ChatView 
                  user={user} 
                  contact={activeChat} 
                  setModal={setModal}
                  onBack={() => {
                    setActiveChat(null);
                    if (window.innerWidth < 768) setView('main');
                  }} 
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-24 h-24 bg-[#F48FB1]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-12 h-12 text-[#F48FB1]" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Bem-vindo ao WhatsNick</h2>
                  <p className="text-slate-500">Selecione uma conversa para começar a digitar.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {view === 'sos' && user && <SOSView user={user} onBack={() => setView('main')} setModal={setModal} />}
      </AnimatePresence>

      {/* Custom Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-2">{modal.title}</h3>
              <p className="text-slate-600 mb-6">{modal.message}</p>
              <div className="flex justify-end gap-3">
                {modal.type === 'confirm' && (
                  <button 
                    onClick={() => setModal(null)}
                    className="px-4 py-2 text-slate-500 font-bold"
                  >
                    Cancelar
                  </button>
                )}
                <button 
                  onClick={async () => {
                    if (modal.onConfirm) {
                      await modal.onConfirm();
                    } else {
                      setModal(null);
                    }
                  }}
                  className="px-4 py-2 bg-[#F48FB1] text-white rounded-xl font-bold"
                >
                  {modal.type === 'confirm' ? 'Confirmar' : 'OK'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Friend Modal */}
      <AnimatePresence>
        {showAddFriendModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-2">Adicionar Amigo</h3>
              <p className="text-slate-600 mb-4 text-sm">Digite o email do seu amigo para enviar um convite.</p>
              <input 
                type="email" 
                value={friendEmailInput}
                onChange={(e) => setFriendEmailInput(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full p-3 bg-slate-50 rounded-xl mb-6 outline-none border-2 border-transparent focus:border-[#F48FB1]"
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowAddFriendModal(false)}
                  className="px-4 py-2 text-slate-500 font-bold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => sendInvite(friendEmailInput)}
                  className="px-4 py-2 bg-[#F48FB1] text-white rounded-xl font-bold"
                >
                  Enviar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

function MainLayout({ user, activeTab, setActiveTab, setView, setActiveChat, setModal, moods, avatars, updateMood, updateProfilePhoto, pendingInvites, acceptInvite, declineInvite, setShowAddFriendModal, onClearContacts }: any) {
  return (
    <div className="flex flex-col md:flex-row h-full bg-white w-full">
      {/* Sidebar Navigation (Desktop) / Bottom Navigation (Mobile) */}
      <div className="order-2 md:order-1 bg-white border-t md:border-t-0 md:border-r border-slate-100 flex md:flex-col justify-around md:justify-start items-center py-2 md:py-6 px-4 md:px-2 z-50 md:w-20 lg:w-24 shrink-0 h-16 md:h-full">
        <div className="flex md:flex-col justify-around md:justify-center items-center w-full gap-4 md:gap-8">
          <NavButton 
            active={activeTab === 'chats'} 
            onClick={() => setActiveTab('chats')} 
            icon={<MessageCircle className="w-6 h-6" />} 
            label="Conversas" 
            badge={true}
            user={user}
            inviteBadge={pendingInvites.length > 0}
          />
          <NavButton 
            active={activeTab === 'calls'} 
            onClick={() => setActiveTab('calls')} 
            icon={<Phone className="w-6 h-6" />} 
            label="Ligações" 
          />
          <NavButton 
            active={activeTab === 'family'} 
            onClick={() => setActiveTab('family')} 
            icon={<Users className="w-6 h-6" />} 
            label="Família" 
          />
          {user.role === 'parent' && (
            <NavButton 
              active={activeTab === 'alerts'} 
              onClick={() => setActiveTab('alerts')} 
              icon={<AlertTriangle className="w-6 h-6" />} 
              label="Alertas" 
              sosBadge={true}
              user={user}
            />
          )}
          <div className="md:mt-auto">
            <NavButton 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={<Settings className="w-6 h-6" />} 
              label="Ajustes" 
            />
          </div>
        </div>
      </div>

      <div className="order-1 md:order-2 flex-1 overflow-hidden relative flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            user.role === 'parent' 
              ? <ParentDashboard user={user} setView={setView} setActiveChat={setActiveChat} setModal={setModal} pendingInvites={pendingInvites} acceptInvite={acceptInvite} declineInvite={declineInvite} setShowAddFriendModal={setShowAddFriendModal} />
              : <ChildDashboard user={user} setView={setView} setActiveChat={setActiveChat} setModal={setModal} pendingInvites={pendingInvites} acceptInvite={acceptInvite} declineInvite={declineInvite} setShowAddFriendModal={setShowAddFriendModal} />
          )}
          {activeTab === 'calls' && <CallsView user={user} setActiveChat={setActiveChat} setView={setView} setModal={setModal} />}
          {activeTab === 'family' && <FamilyView user={user} setModal={setModal} setView={setView} setActiveChat={setActiveChat} />}
          {activeTab === 'alerts' && <AlertsView user={user} setModal={setModal} />}
          {activeTab === 'settings' && (
            <SettingsView 
              user={user} 
              onLogout={() => signOut(auth)} 
              setModal={setModal}
              moods={moods}
              avatars={avatars}
              updateMood={updateMood}
              updateProfilePhoto={updateProfilePhoto}
              onClearContacts={onClearContacts}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AlertsView({ user, setModal }: { user: UserProfile, setModal: (m: any) => void }) {
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);

  useEffect(() => {
    if (user.role !== 'parent') return;
    const q = query(collection(db, 'users'), where('parentId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChildren(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, [user.uid, user.role]);

  useEffect(() => {
    if (children.length === 0) return;
    const childIds = children.map(c => c.uid);
    const q = query(collection(db, 'sos_alerts'), where('childId', 'in', childIds), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSosAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SOSAlert)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sos_alerts'));
    return () => unsubscribe();
  }, [children]);

  const dismissSOS = async (id: string) => {
    setModal({
      title: 'Dispensar Alerta',
      message: 'Tem certeza que deseja dispensar este alerta?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'sos_alerts', id));
          setModal({
            title: 'Sucesso',
            message: 'Alerta dispensado com sucesso.',
            type: 'alert'
          });
        } catch (error) {
          console.error("Error deleting SOS alert:", error);
          setModal({
            title: 'Erro',
            message: 'Não foi possível dispensar o alerta. Verifique sua conexão ou permissões.',
            type: 'alert'
          });
          // Still call handleFirestoreError for logging
          try {
            handleFirestoreError(error, OperationType.DELETE, `sos_alerts/${id}`);
          } catch (e) {
            // handleFirestoreError throws, we just want the log
          }
        }
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-full">
      <header className="p-6 bg-[#CE93D8] text-white">
        <h1 className="text-2xl font-bold">Alertas SOS</h1>
      </header>
      
      <main className="flex-1 p-6">
        {user.role !== 'parent' ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 text-center">
            <Shield className="w-16 h-16 opacity-20" />
            <p>Apenas pais podem ver alertas SOS.</p>
          </div>
        ) : sosAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 text-center">
            <Check className="w-16 h-16 opacity-20 text-[#F48FB1]" />
            <p>Tudo tranquilo! Nenhum alerta ativo.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sosAlerts.map(alert => {
              const child = children.find(c => c.uid === alert.childId);
              return (
                <div key={alert.id} className="bg-white border border-red-100 p-5 rounded-[32px] flex items-center gap-4 shadow-md">
                  <div className="w-14 h-14 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-lg">{child?.name || 'Seu filho'} precisa de ajuda!</p>
                    <p className="text-xs text-red-500 font-bold">
                      {alert.timestamp?.toDate && isValid(alert.timestamp.toDate()) ? format(alert.timestamp.toDate(), 'HH:mm - dd/MM') : 'Agora'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {alert.location && (
                      <button 
                        onClick={() => window.open(`https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`, '_blank')}
                        className="p-3 bg-slate-50 text-red-500 rounded-2xl shadow-sm border border-red-50 flex items-center justify-center"
                      >
                        <MapPin className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      onClick={() => dismissSOS(alert.id)}
                      className="p-3 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge, sosBadge, user, inviteBadge }: any) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [sosCount, setSosCount] = useState(0);

  useEffect(() => {
    if (badge && user) {
      const q = query(collection(db, 'users', user.uid, 'contacts'), where('hasUnread', '==', true));
      return onSnapshot(q, (snapshot) => {
        setUnreadCount(snapshot.size);
      });
    }
  }, [badge, user]);

  useEffect(() => {
    if (sosBadge && user && user.role === 'parent') {
      let unsubscribeSos: (() => void) | undefined;
      const qChildren = query(collection(db, 'users'), where('parentId', '==', user.uid));
      const unsubscribeChildren = onSnapshot(qChildren, (snapshot) => {
        if (unsubscribeSos) unsubscribeSos();
        const childIds = snapshot.docs.map(doc => doc.id);
        if (childIds.length > 0) {
          const qSos = query(collection(db, 'sos_alerts'), where('childId', 'in', childIds));
          unsubscribeSos = onSnapshot(qSos, (sosSnapshot) => {
            setSosCount(sosSnapshot.size);
          });
        } else {
          setSosCount(0);
        }
      });
      return () => {
        unsubscribeChildren();
        if (unsubscribeSos) unsubscribeSos();
      };
    }
  }, [sosBadge, user]);

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex flex-col items-center gap-1 relative group p-2 rounded-2xl transition-all",
        active ? "text-[#F48FB1]" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all",
        active ? "bg-[#F48FB1]/10" : "group-hover:bg-slate-50"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter md:hidden lg:block">{label}</span>
      {(badge && unreadCount > 0) || inviteBadge ? (
        <span className="absolute top-1 right-1 w-5 h-5 bg-[#F48FB1] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
          {unreadCount || '!'}
        </span>
      ) : null}
      {sosBadge && sosCount > 0 && (
        <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
          {sosCount}
        </span>
      )}
    </button>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-white"
    >
      <div className="w-32 h-32 mb-8 rounded-[40px] flex items-center justify-center shadow-2xl relative overflow-hidden group" style={{ background: NICK_GRADIENT }}>
        <div className="absolute inset-0 bg-white/20 blur-2xl group-hover:scale-150 transition-transform duration-700" />
        <div className="relative bg-white/95 p-6 rounded-full shadow-inner transform group-hover:scale-110 transition-transform">
          <Phone className="w-14 h-14 text-[#F48FB1]" />
        </div>
        {/* Stars decoration */}
        <div className="absolute top-4 right-4 text-yellow-300 animate-pulse">★</div>
        <div className="absolute bottom-6 left-4 text-white/60 text-xs">✦</div>
        <div className="absolute top-10 left-6 text-white/40 text-sm">✧</div>
      </div>
      <h1 className="text-5xl font-black mb-2 text-slate-800 tracking-tighter" style={{ color: '#4A4A4A' }}>
        Whats<span className="text-[#F48FB1]">Nick</span>
      </h1>
      <p className="text-slate-500 mb-12 font-medium">Seguro, Divertido e para Crianças!</p>
      
      <button 
        onClick={onLogin}
        className="w-full py-4 text-white rounded-3xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        style={{ background: NICK_GRADIENT }}
      >
        <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
        Entrar com Google
      </button>
      
      <div className="mt-12 flex items-center gap-2 text-slate-400 text-sm">
        <Shield className="w-4 h-4" />
        <span>Monitorado pelos pais</span>
      </div>
    </motion.div>
  );
}

function RoleSelectView({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <motion.div 
      initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
      className="flex flex-col items-center justify-center flex-1 p-8 bg-white"
    >
      <h2 className="text-2xl font-bold text-slate-800 mb-8">Quem está usando?</h2>
      
      <div className="grid grid-cols-1 gap-6 w-full">
        <button 
          onClick={() => onSelect('parent')}
          className="p-8 bg-slate-50 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-4 border-2 border-transparent hover:border-[#F48FB1]"
        >
          <div className="w-20 h-20 bg-[#F48FB1]/10 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-[#F48FB1]" />
          </div>
          <span className="text-xl font-bold text-slate-800">Eu sou o Responsável</span>
        </button>
        
        <button 
          onClick={() => onSelect('child')}
          className="p-8 bg-slate-50 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-4 border-2 border-transparent hover:border-[#F48FB1]"
        >
          <div className="w-20 h-20 bg-[#F48FB1]/10 rounded-full flex items-center justify-center">
            <Smile className="w-10 h-10 text-[#F48FB1]" />
          </div>
          <span className="text-xl font-bold text-slate-800">Eu sou a Criança</span>
        </button>
      </div>
    </motion.div>
  );
}

function ParentDashboard({ user, setView, setActiveChat, setModal, pendingInvites, acceptInvite, declineInvite, setShowAddFriendModal }: any) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Listen for parent's own contacts (friends/other parents)
  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'contacts'), 
      where('approved', '==', true),
      orderBy('lastMessageAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
      }));
    }, (error) => {
      // Fallback if index is not ready
      const fallbackQ = query(collection(db, 'users', user.uid, 'contacts'), where('approved', '==', true));
      onSnapshot(fallbackQ, (s) => {
        setContacts(s.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data } as Contact;
        }));
      });
      console.warn("Firestore index error (expected during setup):", error);
    });
    return () => unsubscribe();
  }, [user.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col flex-1 bg-slate-50 min-h-full"
    >
      <header className="p-6 bg-[#CE93D8] text-white border-b flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Conversas</h1>
          <p className="text-sm opacity-80">Olá, {user.name}</p>
        </div>
        <button onClick={() => setShowAddFriendModal(true)} className="p-2 bg-white/20 rounded-xl">
          <UserPlus className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Convites Pendentes</h3>
            <div className="space-y-3">
              {pendingInvites.map((invite: any) => (
                <div key={invite.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#F48FB1]/20 flex items-center gap-3">
                  <img src={invite.fromPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${invite.fromUid}`} className="w-10 h-10 rounded-full" alt="" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{invite.fromName}</p>
                    <p className="text-[10px] text-slate-400">Quer ser seu amigo</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptInvite(invite)} className="p-2 bg-green-500 text-white rounded-lg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => declineInvite(invite.id)} className="p-2 bg-red-500 text-white rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold text-slate-700 mb-6">Minhas Conversas</h2>

        {contacts.length === 0 ? (
          <div className="bg-white p-8 rounded-[32px] text-center border border-slate-100 mb-8 shadow-sm">
            <p className="text-slate-400 text-sm">Nenhuma conversa ainda.</p>
            <p className="text-xs text-slate-400 mt-2">Vá na aba "Família" para adicionar contatos.</p>
          </div>
        ) : (
          <div className="grid gap-3 mb-8">
            {contacts.map(contact => (
              <button 
                key={contact.id}
                onClick={() => { setActiveChat(contact); setView('chat'); }}
                className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="relative">
                  <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.id}`} className="w-14 h-14 rounded-full" alt="" />
                  {contact.moodEmoji && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center text-sm shadow-sm border border-slate-100">
                      {contact.moodEmoji}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800">{contact.name}</h4>
                    {contact.lastMessageAt && (
                      <span className="text-[10px] text-slate-400">
                        {typeof contact.lastMessageAt.toDate === 'function' && isValid(contact.lastMessageAt.toDate())
                          ? format(contact.lastMessageAt.toDate(), 'HH:mm') 
                          : (contact.lastMessageAt instanceof Date && isValid(contact.lastMessageAt))
                            ? format(contact.lastMessageAt, 'HH:mm')
                            : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">
                      {contact.lastMessageText || 'Toque para conversar'}
                    </p>
                    {contact.hasUnread && (
                      <span className="w-5 h-5 bg-[#F48FB1] text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                        1
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </motion.div>
  );
}

interface ChildCardProps {
  child: UserProfile;
  onChat?: () => void;
  onManage: () => void;
}

const ChildCard: React.FC<ChildCardProps> = ({ child, onChat, onManage }) => {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center gap-4">
        <div className="relative">
          <img src={child.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.uid}`} className="w-12 h-12 rounded-full bg-sky-100" alt="" />
          {child.moodEmoji && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs shadow-sm border border-slate-100">
              {child.moodEmoji}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-800">{child.name}</h4>
          <p className="text-xs text-slate-400">{child.mood || child.email}</p>
        </div>
        <div className="flex gap-2">
          {onChat && (
            <button onClick={onChat} className="p-2 bg-[#F48FB1]/10 text-[#F48FB1] rounded-xl">
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
          <button onClick={onManage} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

function ChildDashboard({ user, setView, setActiveChat, setModal, pendingInvites, acceptInvite, declineInvite, setShowAddFriendModal }: any) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'contacts'), 
      where('approved', '==', true),
      orderBy('lastMessageAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
      }));
    }, (error) => {
      // Fallback if index is not ready
      const fallbackQ = query(collection(db, 'users', user.uid, 'contacts'), where('approved', '==', true));
      onSnapshot(fallbackQ, (s) => {
        setContacts(s.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data } as Contact;
        }));
      });
      console.warn("Firestore index error (expected during setup):", error);
    });

    // Auto-add parent as contact if not present
    if (user.parentId) {
      const checkParent = async () => {
        const parentDoc = await getDoc(doc(db, 'users', user.parentId!));
        if (parentDoc.exists()) {
          const parentData = parentDoc.data() as UserProfile;
          const contactDoc = await getDoc(doc(db, 'users', user.uid, 'contacts', user.parentId!));
          if (!contactDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid, 'contacts', user.parentId!), {
              uid: user.parentId,
              name: `Pai/Mãe (${parentData.name})`,
              photoURL: parentData.photoURL || '',
              approved: true,
              childId: user.uid
            });
          }
        }
      };
      checkParent();
    }

    return () => unsubscribe();
  }, [user.uid, user.parentId]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col flex-1 bg-slate-50"
    >
      <header className="p-6 bg-[#CE93D8] text-white rounded-b-[40px] shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Smile className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Olá, {user.name}!</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddFriendModal(true)} className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center">
            <UserPlus className="w-6 h-6" />
          </button>
          <button onClick={() => setView('sos')} className="w-12 h-12 bg-red-500 text-white rounded-2xl shadow-lg flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Convites Pendentes</h3>
            <div className="space-y-3">
              {pendingInvites.map((invite: any) => (
                <div key={invite.id} className="bg-white p-4 rounded-3xl shadow-md border-2 border-[#F48FB1]/20 flex items-center gap-3">
                  <img src={invite.fromPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${invite.fromUid}`} className="w-12 h-12 rounded-full" alt="" />
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{invite.fromName}</p>
                    <p className="text-[10px] text-slate-500">Quer ser seu amigo!</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptInvite(invite)} className="p-3 bg-green-500 text-white rounded-2xl shadow-sm">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => declineInvite(invite.id)} className="p-3 bg-red-500 text-white rounded-2xl shadow-sm">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold text-slate-800 mb-4">Meus Amigos</h2>
        
        <div className="grid grid-cols-2 gap-4">
          {contacts.map(contact => (
            <button 
              key={contact.id}
              onClick={() => { setActiveChat(contact); setView('chat'); }}
              className="bg-white p-4 rounded-[32px] shadow-md flex flex-col items-center gap-3 border-2 border-transparent hover:border-[#F48FB1] transition-all relative"
            >
              <div className="relative">
                <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.id}`} className="w-20 h-20 rounded-full bg-slate-50" alt="" />
                {contact.moodEmoji && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-slate-100">
                    {contact.moodEmoji}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{contact.name}</span>
                {contact.hasUnread && (
                  <span className="w-3 h-3 bg-[#F48FB1] rounded-full border-2 border-white shadow-sm" />
                )}
              </div>
              <div className="flex gap-2">
                <div className="p-2 bg-[#F48FB1]/10 text-[#F48FB1] rounded-xl"><MessageCircle className="w-4 h-4" /></div>
                <div className="p-2 bg-[#F48FB1]/10 rounded-xl text-[#F48FB1]"><Phone className="w-4 h-4" /></div>
              </div>
            </button>
          ))}
          
          <div className="col-span-2 bg-white p-6 rounded-[32px] text-center border border-slate-100 shadow-sm mt-4">
            <p className="text-slate-400 text-sm">Para adicionar novos amigos, peça aos seus pais na aba "Família".</p>
          </div>
        </div>
      </main>
    </motion.div>
  );
}

function CallsView({ user, setActiveChat, setView, setModal }: { user: UserProfile, setActiveChat: (c: any) => void, setView: (v: any) => void, setModal: (m: any) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'contacts'), where('approved', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/contacts`));
    return () => unsubscribe();
  }, [user.uid]);

  return (
    <div className="flex flex-col flex-1 bg-white">
      <header className="p-6 border-b bg-[#CE93D8] text-white">
        <h1 className="text-2xl font-bold">Ligações</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
            <Phone className="w-16 h-16 opacity-20" />
            <p>Nenhum contato para ligar.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {contacts.map(contact => (
              <div key={contact.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.id}`} className="w-12 h-12 rounded-full" alt="" />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{contact.name}</h3>
                  <p className="text-xs text-slate-400">Videochamada</p>
                </div>
                <button 
                  onClick={() => {
                    if (contact.meetAuthorized || user.role === 'parent') {
                      window.open('https://meet.google.com/dkh-wqzr-ymg', '_blank');
                    } else {
                      setModal({
                        title: 'Acesso Negado',
                        message: 'Vídeo não autorizado pelos pais.',
                        type: 'alert'
                      });
                    }
                  }}
                  className={cn(
                    "p-3 rounded-xl transition-colors",
                    (contact.meetAuthorized || user.role === 'parent') ? "bg-[#F48FB1] text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <Video className="w-6 h-6" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FamilyView({ user, setModal, setView, setActiveChat }: { user: UserProfile, setModal: (m: any) => void, setView: (v: any) => void, setActiveChat: (c: any) => void }) {
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [selectedChild, setSelectedChild] = useState<UserProfile | null>(null);
  const [childContacts, setChildContacts] = useState<Contact[]>([]);
  const [friendEmail, setFriendEmail] = useState('');

  useEffect(() => {
    if (user.role === 'parent') {
      const q = query(collection(db, 'users'), where('parentId', '==', user.uid));
      const unsubFamily = onSnapshot(q, (snapshot) => {
        setFamilyMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });

      const qContacts = query(collection(db, 'users', user.uid, 'contacts'));
      const unsubContacts = onSnapshot(qContacts, (snapshot) => {
        setContacts(snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
        }));
      });

      return () => { unsubFamily(); unsubContacts(); };
    } else if (user.parentId) {
      const q = query(collection(db, 'users'), where('uid', '==', user.parentId));
      return onSnapshot(q, (snapshot) => {
        setFamilyMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });
    }
  }, [user.uid, user.role, user.parentId]);

  useEffect(() => {
    if (selectedChild) {
      const q = query(collection(db, 'users', selectedChild.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChildContacts(snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
        }));
      }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${selectedChild.uid}/contacts`));
      return () => unsubscribe();
    } else {
      setChildContacts([]);
    }
  }, [selectedChild]);

  const addChild = async () => {
    if (!emailInput) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', emailInput));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setModal({ title: 'Ops!', message: 'Este email não está cadastrado.', type: 'alert' });
        return;
      }

      const childDoc = snapshot.docs[0];
      const childData = childDoc.data() as UserProfile;
      
      if (childData.role !== 'child') {
        setModal({ title: 'Aviso', message: 'Este usuário não é uma conta de criança.', type: 'alert' });
        return;
      }

      // Link child to parent
      await setDoc(doc(db, 'users', childData.uid), { parentId: user.uid }, { merge: true });

      // Add parent to child's contacts
      await setDoc(doc(db, 'users', childData.uid, 'contacts', user.uid), {
        uid: user.uid,
        email: user.email,
        name: `Pai/Mãe (${user.name})`,
        photoURL: user.photoURL || '',
        approved: true,
        childId: childData.uid
      });

      // Add child to parent's contacts
      await setDoc(doc(db, 'users', user.uid, 'contacts', childData.uid), {
        uid: childData.uid,
        email: childData.email,
        name: childData.name,
        photoURL: childData.photoURL || '',
        approved: true,
        childId: user.uid,
        lastMessageAt: serverTimestamp()
      });

      setEmailInput('');
      setShowAddChild(false);
      setModal({ title: 'Sucesso!', message: `${childData.name} foi vinculado à sua família!`, type: 'alert' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const addContact = async () => {
    if (!emailInput) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', emailInput));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setModal({ title: 'Aviso', message: 'Email não cadastrado.', type: 'alert' });
        return;
      }

      const friendDoc = snapshot.docs[0];
      const friendData = friendDoc.data() as UserProfile;
      const friendUid = friendDoc.id;

      await setDoc(doc(db, 'users', user.uid, 'contacts', friendUid), {
        uid: friendUid,
        email: emailInput,
        name: friendData.name,
        photoURL: friendData.photoURL || '',
        mood: friendData.mood || '',
        moodEmoji: friendData.moodEmoji || '',
        approved: true,
        childId: user.uid,
        meetAuthorized: true,
        lastMessageAt: serverTimestamp()
      });

      await setDoc(doc(db, 'users', friendUid, 'contacts', user.uid), {
        uid: user.uid,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL || '',
        mood: user.mood || '',
        moodEmoji: user.moodEmoji || '',
        approved: true,
        childId: friendUid,
        meetAuthorized: true,
        lastMessageAt: serverTimestamp()
      });

      setEmailInput('');
      setShowAddContact(false);
      setModal({ title: 'Sucesso', message: `Contato ${friendData.name} adicionado!`, type: 'alert' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/contacts`);
    }
  };

  const deleteParentContact = async (id: string) => {
    setModal({
      title: 'Excluir Contato',
      message: 'Deseja excluir este contato?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
          setModal({ title: 'Sucesso', message: 'Contato excluído com sucesso.', type: 'alert' });
        } catch (error) {
          console.error("Error deleting contact:", error);
          setModal({ title: 'Erro', message: 'Não foi possível excluir o contato.', type: 'alert' });
          try { handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/contacts/${id}`); } catch (e) {}
        }
      }
    });
  };

  const toggleApproval = async (contact: Contact) => {
    if (!selectedChild) return;
    try {
      await setDoc(doc(db, 'users', selectedChild.uid, 'contacts', contact.id), { approved: !contact.approved }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedChild.uid}/contacts/${contact.id}`);
    }
  };

  const toggleMeet = async (contact: Contact) => {
    if (!selectedChild) return;
    try {
      await setDoc(doc(db, 'users', selectedChild.uid, 'contacts', contact.id), { meetAuthorized: !contact.meetAuthorized }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedChild.uid}/contacts/${contact.id}`);
    }
  };

  const toggleClearChatPermission = async (contact: Contact) => {
    if (!selectedChild) return;
    try {
      await setDoc(doc(db, 'users', selectedChild.uid, 'contacts', contact.id), { canClearChat: !contact.canClearChat }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedChild.uid}/contacts/${contact.id}`);
    }
  };

  const deleteChildContact = async (contactId: string) => {
    if (!selectedChild) return;
    setModal({
      title: 'Excluir Contato',
      message: 'Tem certeza que deseja excluir este contato do seu filho?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', selectedChild.uid, 'contacts', contactId));
          setModal({ title: 'Sucesso', message: 'Contato do filho excluído com sucesso.', type: 'alert' });
        } catch (error) {
          console.error("Error deleting child contact:", error);
          setModal({ title: 'Erro', message: 'Não foi possível excluir o contato do filho.', type: 'alert' });
          try { handleFirestoreError(error, OperationType.DELETE, `users/${selectedChild.uid}/contacts/${contactId}`); } catch (e) {}
        }
      }
    });
  };

  const addFriendForChild = async () => {
    if (!friendEmail || !selectedChild) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', friendEmail));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setModal({
          title: 'Ops!',
          message: 'Este email não está cadastrado no WhatsNick. Peça para a pessoa se cadastrar primeiro!',
          type: 'alert'
        });
        return;
      }

      const friendDoc = snapshot.docs[0];
      const friendData = friendDoc.data() as UserProfile;
      const friendUid = friendDoc.id;

      // Add friend to child's contacts
      await setDoc(doc(db, 'users', selectedChild.uid, 'contacts', friendUid), {
        uid: friendUid,
        email: friendEmail,
        name: friendData.name,
        photoURL: friendData.photoURL || '',
        mood: friendData.mood || '',
        moodEmoji: friendData.moodEmoji || '',
        approved: true,
        childId: selectedChild.uid,
        meetAuthorized: false,
        lastMessageAt: serverTimestamp()
      });
      
      // Reciprocal add
      await setDoc(doc(db, 'users', friendUid, 'contacts', selectedChild.uid), {
        uid: selectedChild.uid,
        email: selectedChild.email,
        name: selectedChild.name,
        photoURL: selectedChild.photoURL || '',
        mood: selectedChild.mood || '',
        moodEmoji: selectedChild.moodEmoji || '',
        approved: true,
        childId: friendUid,
        meetAuthorized: false,
        lastMessageAt: serverTimestamp()
      });

      setFriendEmail('');
      setModal({
        title: 'Sucesso!',
        message: `Amigo ${friendData.name} adicionado com sucesso!`,
        type: 'alert'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedChild.uid}/contacts`);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-full">
      <header className="p-6 border-b bg-[#CE93D8] text-white flex items-center gap-4">
        {selectedChild && (
          <button onClick={() => setSelectedChild(null)} className="p-1 hover:bg-white/10 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-2xl font-bold">
          {selectedChild ? `Gerenciar: ${selectedChild.name}` : 'Família e Contatos'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {user.role === 'child' ? (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-700">Meus Responsáveis</h2>
            {familyMembers.length === 0 ? (
              <p className="text-slate-400 italic">Nenhum responsável vinculado.</p>
            ) : (
              familyMembers.map(member => (
                <div key={member.uid} className="bg-white p-6 rounded-3xl flex items-center gap-4 shadow-sm">
                  <img src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} className="w-20 h-20 rounded-full" alt="" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{member.name}</h3>
                    <p className="text-slate-500">{member.email}</p>
                    <div className="mt-2 inline-block px-3 py-1 bg-[#F48FB1]/10 text-[#F48FB1] rounded-full text-xs font-bold">
                      Responsável
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : selectedChild ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Adicionar Amigo para {selectedChild.name}</h3>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  placeholder="Email do amigo"
                  className="flex-1 p-3 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#F48FB1]"
                />
                <button 
                  onClick={addFriendForChild}
                  className="px-6 py-3 bg-[#F48FB1] text-white rounded-2xl font-bold shadow-md"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-700">Contatos de {selectedChild.name}</h3>
              {childContacts.length === 0 ? (
                <p className="text-slate-400 italic text-center py-8">Nenhum contato cadastrado.</p>
              ) : (
                <div className="grid gap-3">
                  {childContacts.map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={c.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.uid}`} className="w-12 h-12 rounded-full" alt="" />
                          <div>
                            <p className="font-bold text-slate-800">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.email || 'Amigo'}</p>
                          </div>
                        </div>
                        <button onClick={() => deleteChildContact(c.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleApproval(c)}
                          className={cn(
                            "flex-1 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm",
                            c.approved ? "bg-[#F48FB1]/10 text-[#F48FB1] border border-[#F48FB1]/20" : "bg-red-100 text-red-600 border border-red-200"
                          )}
                        >
                          {c.approved ? "Conversa Liberada" : "Conversa Bloqueada"}
                        </button>
                        <button 
                          onClick={() => toggleMeet(c)}
                          className={cn(
                            "flex-1 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm",
                            c.meetAuthorized ? "bg-[#F48FB1]/10 text-[#F48FB1] border border-[#F48FB1]/20" : "bg-slate-100 text-slate-500 border border-slate-200"
                          )}
                        >
                          {c.meetAuthorized ? "Vídeo Liberado" : "Vídeo Bloqueado"}
                        </button>
                        <button 
                          onClick={() => toggleClearChatPermission(c)}
                          className={cn(
                            "flex-1 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm",
                            c.canClearChat ? "bg-[#F48FB1]/10 text-[#F48FB1] border border-[#F48FB1]/20" : "bg-slate-100 text-slate-500 border border-slate-200"
                          )}
                        >
                          {c.canClearChat ? "Limpar Liberado" : "Limpar Bloqueado"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Children Section */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-700">Meus Filhos</h2>
                <button 
                  onClick={() => setShowAddChild(true)}
                  className="flex items-center gap-2 text-[#F48FB1] font-bold text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Vincular Filho
                </button>
              </div>
              {familyMembers.length === 0 ? (
                <div className="bg-white p-6 rounded-3xl text-center border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm">Nenhum filho vinculado ainda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {familyMembers.map(child => (
                    <ChildCard 
                      key={child.uid} 
                      child={child} 
                      onManage={() => setSelectedChild(child)}
                      onChat={() => { setActiveChat(child); setView('chat'); }} 
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Parent's Own Contacts Section */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-700">Meus Contatos</h2>
                <button 
                  onClick={() => setShowAddContact(true)}
                  className="flex items-center gap-2 text-[#F48FB1] font-bold text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Novo Contato
                </button>
              </div>
              {contacts.filter(c => !familyMembers.some(f => f.uid === c.uid)).length === 0 ? (
                <div className="bg-white p-6 rounded-3xl text-center border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm">Nenhum contato pessoal.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {contacts.filter(c => !familyMembers.some(f => f.uid === c.uid)).map(contact => (
                    <div key={contact.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4">
                      <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.id}`} className="w-12 h-12 rounded-full" alt="" />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{contact.name}</h4>
                        <p className="text-xs text-slate-400">{contact.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setActiveChat(contact); setView('chat'); }} className="p-2 bg-[#F48FB1]/10 text-[#F48FB1] rounded-xl">
                          <MessageCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteParentContact(contact.id)} className="p-2 text-red-400">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Modals for adding child/contact */}
      {(showAddChild || showAddContact) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full rounded-[32px] p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">
              {showAddChild ? 'Vincular Filho' : 'Adicionar Contato'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {showAddChild 
                ? 'Digite o email da conta do seu filho para vinculá-la.' 
                : 'Digite o email da pessoa que você quer adicionar.'}
            </p>
            <input 
              type="email" 
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full p-4 bg-slate-50 rounded-2xl mb-8 outline-none border-2 border-transparent focus:border-[#F48FB1] text-lg"
            />
            <div className="flex gap-4">
              <button onClick={() => { setShowAddChild(false); setShowAddContact(false); setEmailInput(''); }} className="flex-1 py-4 text-slate-500 font-bold text-lg">Cancelar</button>
              <button onClick={showAddChild ? addChild : addContact} className="flex-1 py-4 bg-[#F48FB1] text-white rounded-2xl font-bold text-lg shadow-lg">
                {showAddChild ? 'Vincular' : 'Adicionar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SettingsView({ user, onLogout, setModal, moods, avatars, updateMood, updateProfilePhoto, onClearContacts }: { user: UserProfile, onLogout: () => void, setModal: (m: any) => void, moods: any[], avatars: string[], updateMood: (m: string, e: string) => void, updateProfilePhoto: (url: string) => Promise<void>, onClearContacts: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        await updateProfilePhoto(base64);
        setModal({ title: 'Sucesso', message: 'Foto de perfil atualizada!', type: 'alert' });
      } catch (error) {
        // Error handled in updateProfilePhoto
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const selectAvatar = async (url: string) => {
    try {
      await updateProfilePhoto(url);
      setModal({ title: 'Sucesso', message: 'Avatar atualizado!', type: 'alert' });
    } catch (error) {
      // Error handled in updateProfilePhoto
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-[#CE93D8] text-white shrink-0 shadow-md">
        <h2 className="text-2xl font-bold">Ajustes</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#81D4FA]/20 relative">
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                className="w-full h-full object-cover" 
                alt="" 
              />
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-3 bg-[#F48FB1] text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
          <p className="text-slate-500 text-sm mb-4">{user.email}</p>
          <div className="px-4 py-1 bg-[#81D4FA]/10 text-[#81D4FA] rounded-full text-xs font-bold uppercase tracking-wider">
            {user.role === 'parent' ? 'Responsável' : 'Criança'}
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Smile className="w-5 h-5 text-[#F48FB1]" />
            Como você está hoje?
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {moods.map((m) => (
              <button
                key={m.label}
                onClick={() => updateMood(m.label, m.emoji)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all",
                  user.mood === m.label ? "bg-[#F48FB1]/10 border-[#F48FB1]" : "bg-white border-slate-100 hover:border-[#F48FB1]/30"
                )}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] text-slate-500 font-medium text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-[#81D4FA]" />
            Escolha um personagem
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {avatars.map((url, i) => (
              <button
                key={i}
                onClick={() => selectAvatar(url)}
                className={cn(
                  "aspect-square rounded-2xl border overflow-hidden transition-all",
                  user.photoURL === url ? "border-[#81D4FA] border-4" : "border-slate-100 hover:border-[#81D4FA]/30"
                )}
              >
                <img src={url} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        </section>

        <button 
          onClick={onClearContacts}
          className="w-full p-4 bg-white text-orange-500 rounded-3xl font-bold shadow-sm border border-slate-100 flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
          Limpar Todos os Contatos
        </button>

        <button 
          onClick={onLogout}
          className="w-full p-4 bg-white text-red-500 rounded-3xl font-bold shadow-sm border border-slate-100 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair da Conta
        </button>
      </div>
    </div>
  );
}

function ChatView({ user, contact, onBack, setModal }: { user: UserProfile, contact: Contact, onBack: () => void, setModal: (m: any) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contactUid = contact.uid;
  if (!contactUid) {
    console.error("Contact UID is missing, cannot generate chatId");
  }
  const chatId = [user.uid, contactUid].sort().join('_');

  useEffect(() => {
    if (!chatId || !user.uid || !contactUid) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      try {
        const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(newMessages);
        
        // Update last message timestamp in contacts to clear notifications
        if (newMessages.length > 0) {
          const lastMsg = newMessages[newMessages.length - 1];
          // Only clear if the last message was from the other person
          if (lastMsg.senderId !== user.uid) {
            setDoc(doc(db, 'users', user.uid, 'contacts', contactUid), { 
              hasUnread: false 
            }, { merge: true }).catch(e => console.error("Error clearing unread:", e));
          }
        }

        // Auto scroll to bottom
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
          }
        }, 100);
      } catch (err) {
        console.error("Error processing messages snapshot:", err);
      }
    }, (error) => {
      console.error("Firestore onSnapshot error for messages:", error);
      // Fallback if index is not ready
      if (error instanceof Error && error.message.includes('index')) {
        const fallbackQ = query(collection(db, 'chats', chatId, 'messages'));
        const unsubFallback = onSnapshot(fallbackQ, (s) => {
          setMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages`);
        });
        return unsubFallback;
      }
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });
    return () => unsubscribe();
  }, [chatId, user.uid, contactUid]);

  const sendMessage = async () => {
    if (!inputText.trim() || !contactUid) return;
    if (!user || !user.uid) {
      console.error("Cannot send message: User is not authenticated or profile is missing", user);
      setModal({ title: 'Erro', message: 'Você precisa estar logado para enviar mensagens.', type: 'alert' });
      return;
    }
    
    const text = inputText;
    const currentInput = inputText;
    setInputText('');
    setShowEmoji(false);
    
    try {
      const messageData = {
        senderId: user.uid,
        receiverId: contactUid,
        text,
        mediaType: 'text',
        timestamp: serverTimestamp()
      };
      
      console.log("Attempting to send message to chatId:", chatId, messageData);
      
      // Add message
      const msgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      console.log("Message saved successfully with ID:", msgRef.id);
      
      // Update lastMessageAt and hasUnread for receiver
      // We use merge: true to avoid overwriting existing contact fields like 'approved'
      await setDoc(doc(db, 'users', contactUid, 'contacts', user.uid), {
        uid: user.uid,
        name: user.name,
        photoURL: user.photoURL || '',
        lastMessageAt: serverTimestamp(),
        hasUnread: true,
        lastMessageText: text
      }, { merge: true });

      // Update lastMessageAt for sender
      await setDoc(doc(db, 'users', user.uid, 'contacts', contactUid), {
        uid: contactUid,
        lastMessageAt: serverTimestamp(),
        hasUnread: false,
        lastMessageText: text
      }, { merge: true });

    } catch (error) {
      // Restore input text on error so user doesn't lose their message
      setInputText(currentInput);
      console.error("Error in sendMessage:", error);
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
      setModal({ 
        title: 'Erro ao enviar', 
        message: 'Não foi possível enviar sua mensagem. Verifique sua conexão ou tente novamente.', 
        type: 'alert' 
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressImage = (dataUrl: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension to keep it under 1MB base64
          const MAX_DIM = 1000;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Start with high quality and reduce if still too large
          let quality = 0.7;
          let result = canvas.toDataURL('image/jpeg', quality);
          
          // Firestore limit is 1MB. Base64 is ~33% larger than binary.
          // So we want the string to be < 1,000,000 chars.
          while (result.length > 1000000 && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(result);
        };
        img.src = dataUrl;
      });
    };

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      const compressedBase64 = await compressImage(rawBase64);
      
      try {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: user.uid,
          receiverId: contactUid,
          mediaUrl: compressedBase64,
          mediaType: 'image',
          timestamp: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
      }
    };
    reader.readAsDataURL(file);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const startVideoCall = async () => {
    const meetUrl = 'https://meet.google.com/dkh-wqzr-ymg';
    window.open(meetUrl, '_blank');
    
    setModal({
      title: 'Iniciar Chamada',
      message: 'Aguarde o contato entrar na chamada ou cole o link do Google Meet abaixo para enviar.',
      type: 'confirm',
      onConfirm: async () => {
        const url = prompt('Cole o link do Google Meet gerado (opcional):');
        try {
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: user.uid,
            receiverId: contactUid,
            mediaType: 'call',
            meetUrl: url || meetUrl,
            text: 'Iniciou uma videochamada',
            timestamp: serverTimestamp()
          });
          setModal(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
        }
      }
    });
  };

  const sendSOS = async () => {
    console.log("🚨 SOS: sendSOS function entered");
    setModal({
      title: 'Enviar SOS',
      message: 'Deseja enviar um alerta SOS para este contato e seus responsáveis?',
      type: 'confirm',
      onConfirm: async () => {
        console.log("🚨 SOS: sendSOS confirmed");
        try {
          const messageData = {
            senderId: user.uid,
            receiverId: contactUid,
            text: '🚨 ALERTA SOS! Preciso de ajuda!',
            mediaType: 'text',
            timestamp: serverTimestamp(),
            isSOS: true
          };
          
          await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
          console.log("🚨 SOS: Message added to chat");
          
          // Get location
          console.log("🚨 SOS: Requesting geolocation...");
          const pos: any = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
          });
          const location = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
          console.log("🚨 SOS: Location obtained:", location);
          
          if (user.role === 'child') {
            await addDoc(collection(db, 'sos_alerts'), {
              childId: user.uid,
              timestamp: serverTimestamp(),
              message: "SOS via Chat",
              location
            });
            console.log("🚨 SOS: Alert added to sos_alerts collection");
          }

          // Send email via backend to the person being chatted with
          let toEmail = contact.email;
          if (!toEmail) {
            console.log("🚨 SOS: Contact email missing in state, fetching from Firestore...");
            try {
              const contactDoc = await getDoc(doc(db, 'users', contactUid));
              if (contactDoc.exists()) {
                toEmail = (contactDoc.data() as UserProfile).email;
                console.log("🚨 SOS: Contact email fetched:", toEmail);
              }
            } catch (e) {
              console.error("🚨 SOS: Error fetching contact email for SOS:", e);
            }
          }

          if (toEmail && user.email) {
            console.log("API SOS chamada");
            console.log("🚨 SOS: Preparing to fetch /api/sos/email", { toEmail, fromEmail: user.email });
            fetch('/api/sos/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromEmail: user.email,
                toEmail: toEmail,
                senderName: user.name,
                location
              })
            })
            .then(async res => {
              console.log("🚨 SOS: API response status:", res.status);
              const data = await res.json();
              if (res.ok) {
                console.log("🚨 SOS: Email sent successfully via API", data);
              } else {
                console.error("🚨 SOS: API returned error", data);
              }
            })
            .catch(e => console.error("🚨 SOS: Error sending SOS email fetch:", e));
          } else {
            console.warn("🚨 SOS: Skipping email send - missing toEmail or user.email", { toEmail, userEmail: user.email });
          }

          setModal({
            title: 'SOS Enviado',
            message: 'Seu alerta foi enviado com sucesso para o contato e registrado no sistema.',
            type: 'alert'
          });
        } catch (error) {
          console.error("🚨 SOS: Error in sendSOS flow:", error);
          handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
        }
      }
    });
  };

  const clearChat = async () => {
    setModal({
      title: 'Limpar Conversa',
      message: 'Deseja apagar todas as mensagens desta conversa? Esta ação não pode ser desfeita.',
      type: 'confirm',
      onConfirm: async () => {
        try {
          const q = query(collection(db, 'chats', chatId, 'messages'));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'chats', chatId, 'messages', d.id)));
          await Promise.all(deletePromises);
          
          // Update last message in contacts
          await setDoc(doc(db, 'users', user.uid, 'contacts', contactUid), {
            lastMessageText: '',
            hasUnread: false
          }, { merge: true });

          setModal({
            title: 'Conversa Limpa',
            message: 'Todas as mensagens foram apagadas.',
            type: 'alert'
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}/messages`);
        }
      }
    });
  };

  const isMeetAllowed = contact.meetAuthorized || user.role === 'parent';
  const isClearAllowed = contact.canClearChat || user.role === 'parent';

  if (!user || !contact) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <p className="text-slate-500">Carregando conversa...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
      className="flex flex-col flex-1 bg-[#E5DDD5] h-full w-full overflow-hidden absolute inset-0 z-30 md:relative md:z-0"
    >
      <header className="p-4 bg-[#CE93D8] text-white flex items-center gap-4 shrink-0 shadow-md z-10">
        <button onClick={onBack} className="p-2 text-white md:hidden flex items-center gap-1">
          <ChevronLeft className="w-8 h-8" />
          <span className="font-bold text-sm">Sair</span>
        </button>
        <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.id}`} className="w-10 h-10 rounded-full border-2 border-white/20" alt="" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold truncate">{contact.name}</h3>
          <p className="text-[10px] text-[#F48FB1] font-bold uppercase tracking-wider">Online</p>
        </div>
        <div className="flex gap-2">
          {isClearAllowed ? (
            <button 
              onClick={clearChat}
              className="p-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-colors"
              title="Limpar Conversa"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          ) : (
            <button 
              onClick={() => setModal({
                title: 'Ação Restrita',
                message: 'Você não tem permissão para limpar esta conversa. Peça ao seu responsável para autorizar.',
                type: 'alert'
              })}
              className="p-3 bg-white/5 text-white/30 rounded-2xl cursor-not-allowed"
              title="Limpar Conversa (Bloqueado)"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          )}
          <button 
            onClick={sendSOS}
            className="p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors shadow-lg"
          >
            <AlertTriangle className="w-6 h-6" />
          </button>
          {isMeetAllowed ? (
            <button className="p-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-colors" onClick={startVideoCall}>
              <Video className="w-6 h-6" />
            </button>
          ) : (
            <div className="p-3 bg-white/5 text-white/30 rounded-2xl cursor-not-allowed">
              <Video className="w-6 h-6" />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50 relative">
        {messages.map((msg, index) => {
          const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : (msg.timestamp instanceof Date ? msg.timestamp : (msg.timestamp ? new Date(msg.timestamp) : new Date()));
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const prevMsgDate = prevMsg?.timestamp?.toDate ? prevMsg.timestamp.toDate() : (prevMsg?.timestamp instanceof Date ? prevMsg.timestamp : (prevMsg?.timestamp ? new Date(prevMsg.timestamp) : null));
          
          const showDate = isValid(msgDate) && (!prevMsgDate || !isValid(prevMsgDate) || msgDate.toDateString() !== prevMsgDate.toDateString());

          return (
            <React.Fragment key={msg.id}>
              {showDate && isValid(msgDate) && (
                <div className="flex justify-center my-4">
                  <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {format(msgDate, 'dd/MM/yyyy')}
                  </span>
                </div>
              )}
              <div className={cn(
                "max-w-[85%] p-3 rounded-2xl shadow-sm relative animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.senderId === user.uid 
                  ? "self-end bg-[#F48FB1] text-white rounded-tr-none" 
                  : "self-start bg-white text-slate-800 rounded-tl-none",
                (msg as any).isSOS && "border-2 border-red-500 bg-red-50"
              )}>
                {msg.mediaType === 'image' ? (
                  <img src={msg.mediaUrl} className="rounded-xl mb-1 max-w-full" alt="" />
                ) : msg.mediaType === 'call' ? (
                  <div className="flex flex-col gap-3">
                    <div className={cn("flex items-center gap-3", msg.senderId === user.uid ? "text-white/80" : "text-slate-600")}>
                      <Video className="w-5 h-5" />
                      <span className="text-sm font-medium">{msg.text}</span>
                    </div>
                    <button 
                      onClick={() => window.open(msg.meetUrl, '_blank')}
                      className={cn(
                        "w-full py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                        msg.senderId === user.uid ? "bg-white text-[#F48FB1]" : "bg-[#F48FB1] text-white"
                      )}
                    >
                      <Phone className="w-4 h-4" />
                      Atender / Entrar
                    </button>
                  </div>
                ) : (
                  <p className={cn("text-sm break-words", (msg as any).isSOS && "font-bold text-red-600")}>
                    {(msg.text || '').split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                      part.match(/^https?:\/\//) ? (
                        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-bold break-all">
                          {part}
                        </a>
                      ) : part
                    )}
                  </p>
                )}
                <p className={cn("text-[9px] mt-1 opacity-70", msg.senderId === user.uid ? "text-right" : "text-left")}>
                  {msg.timestamp && typeof msg.timestamp.toDate === 'function' 
                    ? format(msg.timestamp.toDate(), 'HH:mm') 
                    : (msg.timestamp instanceof Date && isValid(msg.timestamp))
                      ? format(msg.timestamp, 'HH:mm')
                      : (typeof msg.timestamp === 'string' && isValid(new Date(msg.timestamp)))
                        ? format(new Date(msg.timestamp), 'HH:mm')
                        : '...'}
                </p>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <div className="relative">
        {showEmoji && (
          <div className="absolute bottom-full left-0 right-0 z-50">
            <EmojiPicker onEmojiClick={onEmojiClick} width="100%" height={350} />
          </div>
        )}
        <div className="p-3 bg-[#F0F0F0] flex items-center gap-2">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
          />
          <div className="flex gap-1">
            <button 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
              className="p-2 text-slate-500 hover:text-[#F48FB1] transition-colors"
            >
              <Camera className="w-6 h-6" />
            </button>
            <button 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
              className="p-2 text-slate-500 hover:text-[#F48FB1] transition-colors"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Digite uma mensagem"
              className="w-full p-3 bg-white rounded-full outline-none text-sm pr-10"
            />
            <button 
              onClick={() => setShowEmoji(!showEmoji)}
              className={cn("absolute right-2 top-1/2 -translate-y-1/2 p-1", showEmoji ? "text-[#F48FB1]" : "text-slate-400")}
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={sendMessage} 
            disabled={!inputText.trim()}
            className="p-3 bg-[#CE93D8] text-white rounded-full shadow-md disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SOSView({ user, onBack, setModal }: { user: UserProfile, onBack: () => void, setModal: (m: any) => void }) {
  const [countdown, setCountdown] = useState(5);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (countdown > 0 && !triggered) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !triggered) {
      triggerSOS();
    }
  }, [countdown, triggered]);

  const triggerSOS = async () => {
    console.log("🚨 SOS: triggerSOS function entered");
    setTriggered(true);
    try {
      console.log("🚨 SOS: Requesting geolocation...");
      const pos: any = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });
      const location = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
      console.log("🚨 SOS: Location obtained:", location);

      await addDoc(collection(db, 'sos_alerts'), {
        childId: user.uid,
        timestamp: serverTimestamp(),
        message: "Preciso de ajuda!",
        location
      });
      console.log("🚨 SOS: Alert added to sos_alerts collection");
      
      // Notify parents via email
      console.log("🚨 SOS: Checking parent notification conditions...", { parentId: user.parentId, userEmail: user.email });
      if (user.parentId && user.email) {
        console.log("🚨 SOS: Fetching parent data for email notification...");
        const parentDoc = await getDoc(doc(db, 'users', user.parentId));
        if (parentDoc.exists()) {
          const parentData = parentDoc.data() as UserProfile;
          if (parentData.email) {
            console.log("API SOS chamada");
            console.log("🚨 SOS: Preparing to fetch /api/sos/email for parent", { parentEmail: parentData.email, fromEmail: user.email });
            fetch('/api/sos/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromEmail: user.email,
                toEmail: parentData.email,
                senderName: user.name,
                location
              })
            })
            .then(async res => {
              console.log("🚨 SOS: API response status (parent):", res.status);
              const data = await res.json();
              if (res.ok) {
                console.log("🚨 SOS: Parent email sent successfully via API", data);
              } else {
                console.error("🚨 SOS: Parent API returned error", data);
              }
            })
            .catch(e => console.error("🚨 SOS: Error sending SOS email to parent fetch:", e));
          } else {
            console.warn("🚨 SOS: Parent email missing in parent document");
          }
        } else {
          console.warn("🚨 SOS: Parent document not found in Firestore");
        }
      } else {
        console.warn("🚨 SOS: Skipping parent email - missing parentId or user.email", { parentId: user.parentId, userEmail: user.email });
      }

      console.log("SOS Triggered! Parents notified.");
    } catch (error) {
      console.error("🚨 SOS: Error in triggerSOS flow:", error);
      handleFirestoreError(error, OperationType.WRITE, 'sos_alerts');
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col flex-1 bg-red-600 text-white p-8 items-center justify-center text-center"
    >
      {!triggered ? (
        <>
          <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-ping">
            <AlertTriangle className="w-20 h-20" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Botão SOS</h2>
          <p className="text-xl mb-12 opacity-90">Avisando seus pais em...</p>
          <div className="text-9xl font-black mb-12">{countdown}</div>
          <button 
            onClick={onBack}
            className="w-full py-5 bg-white text-red-600 rounded-3xl font-bold text-2xl shadow-2xl"
          >
            CANCELAR
          </button>
        </>
      ) : (
        <>
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8">
            <Check className="w-20 h-20 text-[#F48FB1]" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Aviso Enviado!</h2>
          <p className="text-xl mb-4 opacity-90">Seus pais já sabem que você precisa de ajuda e estão vindo!</p>
          <div className="bg-white/20 p-4 rounded-2xl mb-8 flex items-center gap-3">
            <Check className="w-5 h-5" />
            <span className="text-sm">Email enviado para os responsáveis</span>
          </div>
          <div className="bg-white/10 p-6 rounded-3xl w-full text-left mb-12">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-5 h-5" />
              <span className="font-bold">Localização enviada</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5" />
              <span className="font-bold">{format(new Date(), 'HH:mm')}</span>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="w-full py-5 bg-white/20 border-2 border-white rounded-3xl font-bold text-2xl"
          >
            VOLTAR
          </button>
        </>
      )}
    </motion.div>
  );
}
