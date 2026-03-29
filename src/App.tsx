import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, deleteDoc, updateDoc, deleteField,
  enableNetwork, getDocFromServer, limit
} from './firebase';
import { UserProfile, Contact, Message, PendingInvite, UserRole, MascotType, StatusType } from './types';
import { cn } from './utils';
import { 
  MessageCircle, Shield, Phone, Camera, Send, AlertTriangle, 
  UserPlus, Check, X, LogOut, Settings, User, MapPin, Clock,
  ChevronLeft, Image as ImageIcon, Smile, Trash2, Video, Users, Bell,
  Star, Cat, Dog, Gamepad2, Music, Palette, Utensils, Activity, Heart,
  Gamepad, Coffee, Book, Home, MessageSquare, Briefcase, Wifi, WifiOff
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

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxWidth = 800;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const uploadToCloudinary = async (base64: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', base64);
  formData.append('upload_preset', 'fotos_nicky');

  const response = await fetch('https://api.cloudinary.com/v1_1/ddabm9rcs/image/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url;
};

export default function App() {
  console.log("App component loading. Firestore initialized:", !!db);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSelectingRole, setIsSelectingRole] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingSOS, setIsSendingSOS] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const retryConnection = async () => {
    if (!auth.currentUser) return;
    try {
      await enableNetwork(db);
      // Try to read the user's own doc from server
      await getDocFromServer(doc(db, 'users_v3', auth.currentUser.uid));
      setIsOnline(true);
      setConnectionError(null);
    } catch (err: any) {
      console.error("Retry connection failed:", err);
      setIsOnline(false);
      setConnectionError("Falha ao reconectar. Verifique sua internet.");
    }
  };

  // Monitor connection status
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!auth.currentUser) return;
      try {
        // Try to read the user's own doc from server
        await getDocFromServer(doc(db, 'users_v3', auth.currentUser.uid));
        setIsOnline(true);
        setConnectionError(null);
      } catch (err: any) {
        console.error("Connection check failed:", err);
        // Always set offline if getDocFromServer fails, as it means we can't reach the server
        setIsOnline(false);
        setConnectionError(err.message || "Sem conexão com o servidor do Firebase.");
      }
    }, 300000); // 5 minutes (300,000 ms) as requested to save quota

    return () => clearInterval(interval);
  }, []);
  const [isAdding, setIsAdding] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMoodLabel, setSelectedMoodLabel] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'role-select' | 'main' | 'chat'>('login');
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
    
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Loading taking too long, forcing load state...");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid);
      if (firebaseUser) {
        // Real-time listener for user profile
        unsubProfile = onSnapshot(doc(db, 'users_v3', firebaseUser.uid), async (userDoc) => {
          console.log("User profile snapshot received:", userDoc.exists());
          setIsOnline(true);
          setConnectionError(null);
          if (userDoc.exists()) {
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            setUser(userData);
            
            // Show mood prompt if not set today
            const today = new Date().toDateString();
            const moodDate = userData.moodUpdatedAt?.toDate ? userData.moodUpdatedAt.toDate().toDateString() : null;
            if (moodDate !== today) {
              setShowMoodPrompt(true);
            }

            if (view === 'login' || view === 'role-select') {
              console.log("Setting view to main");
              setView('main');
            }
          } else {
            console.log("User profile not found, setting view to role-select");
            setView('role-select');
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          setLoading(false);
        });
      } else {
        console.log("No firebase user, setting view to login");
        if (unsubProfile) unsubProfile();
        setUser(null);
        setView('login');
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
      clearTimeout(loadingTimeout);
    };
  }, []);

  // Global listener for contacts and unread count
  useEffect(() => {
    if (!user) {
      setContacts([]);
      document.title = 'WhatsNicky';
      return;
    }

    const q = query(
      collection(db, 'users_v3', user.uid, 'contacts'), 
      where('approved', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
      }).sort((a, b) => {
        const timeA = a.lastMessageAt?.toDate ? a.lastMessageAt.toDate().getTime() : 0;
        const timeB = b.lastMessageAt?.toDate ? b.lastMessageAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      
      setContacts(contactsList);

      // Update activeChat if it exists in the new contacts list to keep data fresh
      // Using functional update to avoid stale closure and unnecessary re-renders if possible
      setActiveChat(prev => {
        if (!prev) return null;
        const updated = contactsList.find(c => c.uid === prev.uid);
        if (!updated) return prev;
        // Only update if something actually changed to avoid unnecessary re-renders
        if (updated.lastMessageAt?.toMillis?.() === prev.lastMessageAt?.toMillis?.() && 
            updated.hasUnread === prev.hasUnread &&
            updated.lastMessageText === prev.lastMessageText) {
          return prev;
        }
        return updated;
      });
      
      const unreadCount = contactsList.filter(c => c.hasUnread).length;
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) WhatsNicky`;
      } else {
        document.title = 'WhatsNicky';
      }
    }, (error) => {
      console.error("Error listening to contacts:", error);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Separate effect for invites and accepted sent invites
  useEffect(() => {
    if (!user) return;

    // Real-time listener for incoming pending invites
    const qInvites = query(collection(db, 'pending_contacts_v3'), where('targetEmail', '==', user.email));
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      setPendingInvites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingInvite)));
    });

    // Real-time listener for sent invites that were accepted
    const qSent = query(collection(db, 'pending_contacts_v3'), where('fromUid', '==', user.uid), where('accepted', '==', true));
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      snapshot.docs.forEach(async (inviteDoc) => {
        const invite = inviteDoc.data() as PendingInvite;
        // Find the user profile for the target email
        const qUser = query(collection(db, 'users_v3'), where('email', '==', invite.targetEmail));
        const userSnapshot = await getDocs(qUser);
        if (!userSnapshot.empty) {
          const targetUser = userSnapshot.docs[0].data() as UserProfile;
          // Add to current user's contacts
          await setDoc(doc(db, 'users_v3', user.uid, 'contacts', targetUser.uid), {
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
        await deleteDoc(doc(db, 'pending_contacts_v3', inviteDoc.id));
      });
    });

    return () => {
      unsubInvites();
      unsubSent();
    };
  }, [user?.uid]);

  const updateMood = async (mood: string, emoji: string) => {
    if (!user || isUpdating) return;
    setSelectedMoodLabel(mood);
    setIsUpdating(true);
    
    // Close prompt immediately for better UX
    setShowMoodPrompt(false);
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
      setSelectedMoodLabel(null);
    }, 10000);

    try {
      await setDoc(doc(db, 'users_v3', user.uid), { 
        mood, 
        moodEmoji: emoji, 
        moodUpdatedAt: serverTimestamp() 
      }, { merge: true });
      
      // Update this user's mood in everyone's contact list who has them (background/non-blocking)
      getDocs(collection(db, 'users_v3', user.uid, 'contacts')).then(contactsSnap => {
        contactsSnap.docs.forEach((contactDoc) => {
          const contactId = contactDoc.id;
          setDoc(doc(db, 'users_v3', contactId, 'contacts', user.uid), {
            mood,
            moodEmoji: emoji
          }, { merge: true }).catch(() => {});
        });
      }).catch(err => console.warn("Failed to fetch contacts for mood update:", err));

    } catch (error) {
      console.error("Error updating mood:", error);
    } finally {
      clearTimeout(timeoutId);
      setSelectedMoodLabel(null);
      setTimeout(() => setIsUpdating(false), 500); // Prevent double click
    }
  };

  const updateProfilePhoto = async (photoURL: string) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);

    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
    }, 10000);

    try {
      await setDoc(doc(db, 'users_v3', user.uid), { photoURL }, { merge: true });
      
      // Update this user's photo in everyone's contact list who has them (background/non-blocking)
      getDocs(collection(db, 'users_v3', user.uid, 'contacts')).then(contactsSnap => {
        contactsSnap.docs.forEach((contactDoc) => {
          const contactId = contactDoc.id;
          setDoc(doc(db, 'users_v3', contactId, 'contacts', user.uid), {
            photoURL
          }, { merge: true }).catch(() => {});
        });
      }).catch(err => console.warn("Failed to fetch contacts for photo update:", err));

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${user.uid}`);
    } finally {
      clearTimeout(timeoutId);
      setIsUpdating(false);
    }
  };

  const updateTrustedSOSContact = async (email: string) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);
    
    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
    }, 10000);

    try {
      await setDoc(doc(db, 'users_v3', user.uid), { 
        trustedSOSContactEmail: email 
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${user.uid}`);
    } finally {
      clearTimeout(timeoutId);
      setIsUpdating(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);
    
    // Set a safety timeout to reset isUpdating
    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
    }, 10000);

    try {
      // Primary update: User's own profile
      await setDoc(doc(db, 'users_v3', user.uid), { 
        currentStatus: status 
      }, { merge: true });
      
      // Update this user's status in everyone's contact list who has them (background/non-blocking)
      getDocs(collection(db, 'users_v3', user.uid, 'contacts')).then(contactsSnap => {
        contactsSnap.docs.forEach((contactDoc) => {
          const contactId = contactDoc.id;
          setDoc(doc(db, 'users_v3', contactId, 'contacts', user.uid), {
            currentStatus: status
          }, { merge: true }).catch(() => {});
        });
      }).catch(err => console.warn("Failed to fetch contacts for status update:", err));

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${user.uid}`);
    } finally {
      clearTimeout(timeoutId);
      setIsUpdating(false);
    }
  };

  const updateMascot = async (mascot: string) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);
    
    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
    }, 10000);

    try {
      await setDoc(doc(db, 'users_v3', user.uid), { 
        mascot: mascot 
      }, { merge: true });
      
      // Update this user's mascot in everyone's contact list who has them (background/non-blocking)
      getDocs(collection(db, 'users_v3', user.uid, 'contacts')).then(contactsSnap => {
        contactsSnap.docs.forEach((contactDoc) => {
          const contactId = contactDoc.id;
          setDoc(doc(db, 'users_v3', contactId, 'contacts', user.uid), {
            mascot: mascot
          }, { merge: true }).catch(() => {});
        });
      }).catch(err => console.warn("Failed to fetch contacts for mascot update:", err));

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${user.uid}`);
    } finally {
      clearTimeout(timeoutId);
      setIsUpdating(false);
    }
  };

  const updateFavorites = async (favorites: any) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);

    const timeoutId = setTimeout(() => {
      setIsUpdating(false);
    }, 10000);

    try {
      await setDoc(doc(db, 'users_v3', user.uid), { 
        favorites: favorites 
      }, { merge: true });
      
      // Update this user's favorites in everyone's contact list who has them (background/non-blocking)
      getDocs(collection(db, 'users_v3', user.uid, 'contacts')).then(contactsSnap => {
        contactsSnap.docs.forEach((contactDoc) => {
          const contactId = contactDoc.id;
          setDoc(doc(db, 'users_v3', contactId, 'contacts', user.uid), {
            favorites: favorites
          }, { merge: true }).catch(() => {});
        });
      }).catch(err => console.warn("Failed to fetch contacts for favorites update:", err));

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${user.uid}`);
    } finally {
      clearTimeout(timeoutId);
      setIsUpdating(false);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (!auth.currentUser || isSelectingRole) return;
    setIsSelectingRole(true);
    const profile: UserProfile = {
      uid: auth.currentUser.uid,
      name: auth.currentUser.displayName || 'Usuário',
      email: (auth.currentUser.email || '').toLowerCase(),
      role,
      photoURL: auth.currentUser.photoURL || ''
    };
    try {
      await setDoc(doc(db, 'users_v3', auth.currentUser.uid), profile);
      setUser(profile);
      setView('main');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${auth.currentUser.uid}`);
    } finally {
      setIsSelectingRole(false);
    }
  };

  const sendInvite = async (email: string) => {
    if (!user || !email) return;
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail === user.email.toLowerCase()) {
      setModal({ title: 'Ops!', message: 'Você não pode enviar um convite para si mesmo.', type: 'alert' });
      return;
    }
    try {
      // Check if already invited
      const q = query(collection(db, 'pending_contacts_v3'), where('targetEmail', '==', normalizedEmail), where('fromUid', '==', user.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setModal({ title: 'Aviso', message: 'Convite já enviado para este email.', type: 'alert' });
        return;
      }

      await addDoc(collection(db, 'pending_contacts_v3'), {
        targetEmail: normalizedEmail,
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
      handleFirestoreError(error, OperationType.WRITE, 'pending_contacts_v3');
    }
  };

  const acceptInvite = async (invite: PendingInvite) => {
    if (!user) return;
    try {
      // 1. Add sender to my contacts
      await setDoc(doc(db, 'users_v3', user.uid, 'contacts', invite.fromUid), {
        uid: invite.fromUid,
        name: invite.fromName,
        photoURL: invite.fromPhoto || '',
        approved: true,
        childId: user.uid,
        meetAuthorized: false,
        lastMessageAt: serverTimestamp()
      });

      // 2. Add me to sender's contacts (Reciprocal)
      await setDoc(doc(db, 'users_v3', invite.fromUid, 'contacts', user.uid), {
        uid: user.uid,
        name: user.name,
        photoURL: user.photoURL || '',
        approved: true,
        childId: invite.fromUid,
        meetAuthorized: false,
        lastMessageAt: serverTimestamp()
      });

      // 3. Mark invite as accepted
      await updateDoc(doc(db, 'pending_contacts_v3', invite.id), {
        accepted: true
      });

      setModal({ title: 'Sucesso!', message: `Agora você e ${invite.fromName} são amigos!`, type: 'alert' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'pending_contacts_v3', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pending_contacts_v3/${inviteId}`);
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
          const contactsSnap = await getDocs(collection(db, 'users_v3', user.uid, 'contacts'));
          const deletePromises = contactsSnap.docs.map(async (contactDoc) => {
            return deleteDoc(doc(db, 'users_v3', user.uid, 'contacts', contactDoc.id));
          });
          await Promise.all(deletePromises);
          setModal({ type: 'alert', title: 'Sucesso', message: 'Todos os contatos foram removidos.' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'contacts');
        }
      }
    });
  };

  const handleSOS = async () => {
    if (!user || isSendingSOS) return;

    setModal({
      title: 'Acionar SOS?',
      message: 'Isso enviará um alerta imediato com sua localização para seus responsáveis.',
      type: 'confirm',
      onConfirm: async () => {
        setIsSendingSOS(true);
        try {
          // Get location with 10s timeout
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const location = { lat: latitude, lng: longitude };

            // Find target email - optimized with cache
            let targetEmail = user.trustedSOSContactEmail || user.email; // Use trusted contact if set, otherwise self
            
            if (!user.trustedSOSContactEmail && user.role === 'child' && user.parentId) {
              // Try to find parent in existing contacts first to avoid extra getDoc
              const parentInContacts = contacts.find(c => c.uid === user.parentId);
              if (parentInContacts && parentInContacts.email) {
                targetEmail = parentInContacts.email;
              } else {
                const parentDoc = await getDoc(doc(db, 'users_v3', user.parentId));
                if (parentDoc.exists()) {
                  targetEmail = parentDoc.data().email;
                }
              }
            }

            // Send email
            const response = await fetch('/api/sos/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromEmail: user.email,
                toEmail: targetEmail,
                senderName: user.name,
                location: location
              })
            });

            if (response.ok) {
              setModal({
                title: 'SOS Enviado!',
                message: 'Seus responsáveis foram notificados com sua localização.',
                type: 'alert'
              });
            } else {
              throw new Error('Falha ao enviar e-mail de SOS');
            }
            setIsSendingSOS(false);
          }, (error) => {
            console.error("Erro ao obter localização:", error);
            setModal({
              title: 'Erro de Localização',
              message: 'Não foi possível obter sua localização. Verifique as permissões do navegador.',
              type: 'alert'
            });
            setIsSendingSOS(false);
          }, { timeout: 10000 });
        } catch (error) {
          console.error("Erro no SOS:", error);
          setModal({
            title: 'Erro no SOS',
            message: 'Ocorreu um erro ao processar o alerta SOS.',
            type: 'alert'
          });
          setIsSendingSOS(false);
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
          <p className="text-[#F48FB1] font-bold text-xl tracking-tight">WhatsNicky...</p>
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
                      disabled={isUpdating}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                        selectedMoodLabel === m.label ? "bg-[#F48FB1]/20 scale-110 ring-2 ring-[#F48FB1]" : "hover:bg-slate-100",
                        isUpdating && selectedMoodLabel !== m.label ? "opacity-50" : ""
                      )}
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
        {view === 'login' && <LoginView onLogin={handleLogin} isLoggingIn={isLoggingIn} />}
        {view === 'role-select' && <RoleSelectView onSelect={handleRoleSelect} isSelectingRole={isSelectingRole} />}
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
                isUpdating={isUpdating}
                isAdding={isAdding}
                setIsAdding={setIsAdding}
                isProcessingInvite={isProcessingInvite}
                contacts={contacts}
                 onSOS={handleSOS}
                 isSendingSOS={isSendingSOS}
                updateTrustedSOSContact={updateTrustedSOSContact}
                updateStatus={updateStatus}
                updateMascot={updateMascot}
                updateFavorites={updateFavorites}
                isOnline={isOnline}
                connectionError={connectionError}
                retryConnection={retryConnection}
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
                  isOnline={isOnline}
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
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Bem-vindo ao WhatsNicky</h2>
                  <p className="text-slate-500">Selecione uma conversa para começar a digitar.</p>
                </div>
              )}
            </div>
          </div>
        )}
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

function MainLayout({ user, activeTab, setActiveTab, setView, setActiveChat, setModal, moods, avatars, updateMood, updateProfilePhoto, pendingInvites, acceptInvite, declineInvite, setShowAddFriendModal, onClearContacts, isUpdating, isAdding, setIsAdding, isProcessingInvite, contacts, onSOS, isSendingSOS, updateTrustedSOSContact, updateStatus, updateMascot, updateFavorites, isOnline, connectionError, retryConnection }: any) {
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
            badge={contacts.some((c: any) => c.hasUnread)}
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
            active={activeTab === 'status'} 
            onClick={() => setActiveTab('status')} 
            icon={<Activity className="w-6 h-6" />} 
            label="Status" 
          />
          <NavButton 
            active={activeTab === 'family'} 
            onClick={() => setActiveTab('family')} 
            icon={<Users className="w-6 h-6" />} 
            label="Família" 
          />
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
        {/* Connection Status Banner */}
        {!isOnline && (
          <div className="bg-red-500 text-white text-[10px] py-1 px-4 flex items-center justify-between animate-pulse shrink-0">
            <div className="flex items-center gap-2">
              <WifiOff size={12} />
              <span>{connectionError || "Você está offline. As mensagens podem não ser enviadas."}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={retryConnection}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-medium transition-colors"
              >
                Tentar Reconectar
              </button>
              <button 
                onClick={() => setModal({ title: "Erro de Conexão", message: connectionError || "Erro desconhecido", type: 'alert' })}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-medium transition-colors"
              >
                Ver Erro
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-medium transition-colors"
              >
                Atualizar Página
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            user.role === 'parent' 
              ? <ParentDashboard 
                  user={user} 
                  setView={setView} 
                  setActiveChat={setActiveChat} 
                  setModal={setModal} 
                  pendingInvites={pendingInvites} 
                  acceptInvite={acceptInvite} 
                  declineInvite={declineInvite} 
                  setShowAddFriendModal={setShowAddFriendModal}
                  isProcessingInvite={isProcessingInvite}
                  contacts={contacts}
                /> 
              : <ChildDashboard 
                  user={user} 
                  setView={setView} 
                  setActiveChat={setActiveChat} 
                  setModal={setModal} 
                  pendingInvites={pendingInvites} 
                  acceptInvite={acceptInvite} 
                  declineInvite={declineInvite} 
                  setShowAddFriendModal={setShowAddFriendModal}
                  isProcessingInvite={isProcessingInvite}
                  contacts={contacts}
                />
          )}
          {activeTab === 'calls' && <CallsView user={user} setActiveChat={setActiveChat} setView={setView} setModal={setModal} onSOS={onSOS} isSendingSOS={isSendingSOS} />}
          {activeTab === 'status' && (
            <StatusView 
              user={user} 
              setModal={setModal} 
              isUpdating={isUpdating} 
              updateStatus={updateStatus} 
            />
          )}
          {activeTab === 'family' && <FamilyView user={user} setModal={setModal} setView={setView} setActiveChat={setActiveChat} isAdding={isAdding} setIsAdding={setIsAdding} />}
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
              isUpdating={isUpdating}
              updateTrustedSOSContact={updateTrustedSOSContact}
              updateMascot={updateMascot}
              updateFavorites={updateFavorites}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge, user, inviteBadge }: any) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (badge && user) {
      const q = query(collection(db, 'users_v3', user.uid, 'contacts'), where('hasUnread', '==', true));
      return onSnapshot(q, (snapshot) => {
        setUnreadCount(snapshot.size);
      });
    }
  }, [badge, user]);

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
    </button>
  );
}

function LoginView({ onLogin, isLoggingIn }: { onLogin: () => void, isLoggingIn: boolean }) {
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
        <div className="absolute top-4 right-4 text-yellow-300 animate-pulse">★</div>
        <div className="absolute bottom-6 left-4 text-white/60 text-xs">✦</div>
        <div className="absolute top-10 left-6 text-white/40 text-sm">✧</div>
      </div>
      <h1 className="text-5xl font-black mb-2 text-slate-800 tracking-tighter" style={{ color: '#4A4A4A' }}>
        Whats<span className="text-[#F48FB1]">Nicky</span>
      </h1>
      <p className="text-slate-500 mb-12 font-medium">Seguro, Divertido e para Crianças!</p>
      
      <button 
        onClick={onLogin}
        disabled={isLoggingIn}
        className="w-full py-4 text-white rounded-3xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
        style={{ background: NICK_GRADIENT }}
      >
        {isLoggingIn ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
            Entrar com Google
          </>
        )}
      </button>
      
      <div className="mt-12 flex items-center gap-2 text-slate-400 text-sm">
        <Shield className="w-4 h-4" />
        <span>Monitorado pelos pais</span>
      </div>
    </motion.div>
  );
}

function RoleSelectView({ onSelect, isSelectingRole }: { onSelect: (role: UserRole) => void, isSelectingRole: boolean }) {
  return (
    <motion.div 
      initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
      className="flex flex-col items-center justify-center flex-1 p-8 bg-white"
    >
      <h2 className="text-2xl font-bold text-slate-800 mb-8">Quem está usando?</h2>
      
      <div className="grid grid-cols-1 gap-6 w-full">
        <button 
          onClick={() => onSelect('parent')}
          disabled={isSelectingRole}
          className="p-8 bg-slate-50 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-4 border-2 border-transparent hover:border-[#F48FB1] disabled:opacity-70"
        >
          <div className="w-20 h-20 bg-[#F48FB1]/10 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-[#F48FB1]" />
          </div>
          <span className="text-xl font-bold text-slate-800">Eu sou o Responsável</span>
        </button>
        
        <button 
          onClick={() => onSelect('child')}
          disabled={isSelectingRole}
          className="p-8 bg-slate-50 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-4 border-2 border-transparent hover:border-[#F48FB1] disabled:opacity-70"
        >
          <div className="w-20 h-20 bg-[#F48FB1]/10 rounded-full flex items-center justify-center">
            <Smile className="w-10 h-10 text-[#F48FB1]" />
          </div>
          <span className="text-xl font-bold text-slate-800">Eu sou a Criança</span>
        </button>
      </div>
      {isSelectingRole && (
        <div className="mt-8 flex items-center gap-2 text-[#F48FB1] font-bold animate-pulse">
          <div className="w-4 h-4 border-2 border-[#F48FB1] border-t-transparent rounded-full animate-spin" />
          <span>Configurando seu perfil...</span>
        </div>
      )}
    </motion.div>
  );
}

function ParentDashboard({ user, setView, setActiveChat, setModal, pendingInvites, acceptInvite, declineInvite, setShowAddFriendModal, isProcessingInvite, contacts }: any) {
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
                    <button 
                      disabled={isProcessingInvite}
                      onClick={() => acceptInvite(invite)} 
                      className="p-2 bg-green-500 text-white rounded-lg disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      disabled={isProcessingInvite}
                      onClick={() => declineInvite(invite.id)} 
                      className="p-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
                    >
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
  onUnlink?: () => void;
}

const ChildCard: React.FC<ChildCardProps> = ({ child, onChat, onManage, onUnlink }) => {
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
          {onUnlink && (
            <button onClick={onUnlink} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function ChildDashboard({ user, setView, setActiveChat, setModal, pendingInvites, acceptInvite, declineInvite, setShowAddFriendModal, isProcessingInvite, contacts }: any) {
  useEffect(() => {
    // Auto-add parent as contact if not present
    if (user.parentId) {
      const checkParent = async () => {
        const parentDoc = await getDoc(doc(db, 'users_v3', user.parentId!));
        if (parentDoc.exists()) {
          const parentData = parentDoc.data() as UserProfile;
          const contactDoc = await getDoc(doc(db, 'users_v3', user.uid, 'contacts', user.parentId!));
          if (!contactDoc.exists()) {
            await setDoc(doc(db, 'users_v3', user.uid, 'contacts', user.parentId!), {
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
                    <button 
                      disabled={isProcessingInvite}
                      onClick={() => acceptInvite(invite)} 
                      className="p-3 bg-green-500 text-white rounded-2xl shadow-sm disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      disabled={isProcessingInvite}
                      onClick={() => declineInvite(invite.id)} 
                      className="p-3 bg-red-500 text-white rounded-2xl shadow-sm disabled:opacity-50"
                    >
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

function CallsView({ user, setActiveChat, setView, setModal, onSOS, isSendingSOS }: { user: UserProfile, setActiveChat: (c: any) => void, setView: (v: any) => void, setModal: (m: any) => void, onSOS: () => void, isSendingSOS: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users_v3', user.uid, 'contacts'), where('approved', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users_v3/${user.uid}/contacts`));
    return () => unsubscribe();
  }, [user.uid]);

  const copyLink = () => {
    const link = 'https://meet.google.com/dkh-wqzr-ymg';
    navigator.clipboard.writeText(link).then(() => {
      setModal({
        title: 'Link Copiado!',
        message: 'O link da reunião foi copiado para sua área de transferência.',
        type: 'alert'
      });
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-white">
      <header className="p-6 border-b bg-[#F48FB1] text-white">
        <h1 className="text-2xl font-bold">Ligações</h1>
        <div className="mt-4 flex gap-2">
          <button 
            onClick={copyLink}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
          >
            Ver o link
          </button>
          <button 
            onClick={onSOS}
            disabled={isSendingSOS}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg",
              isSendingSOS ? "bg-slate-400 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 text-white"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            {isSendingSOS ? 'Enviando...' : 'SOS'}
          </button>
        </div>
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
                  onClick={async () => {
                    if (contact.meetAuthorized || user.role === 'parent') {
                      const meetUrl = 'https://meet.google.com/dkh-wqzr-ymg';
                      window.open(meetUrl, '_blank');
                      
                      // Send message to chat
                      const chatId = [user.uid, contact.uid].sort().join('_');
                      try {
                        await addDoc(collection(db, 'chats_v3', chatId, 'messages'), {
                          senderId: user.uid,
                          receiverId: contact.uid,
                          mediaType: 'call',
                          meetUrl: meetUrl,
                          text: 'iniciar chamada',
                          timestamp: serverTimestamp()
                        });

                        // Update lastMessageAt and hasUnread for receiver
                        await setDoc(doc(db, 'users_v3', contact.uid, 'contacts', user.uid), {
                          lastMessageAt: serverTimestamp(),
                          lastMessageText: 'iniciar chamada',
                          hasUnread: true,
                        }, { merge: true });

                        // Update for sender
                        await setDoc(doc(db, 'users_v3', user.uid, 'contacts', contact.uid), {
                          lastMessageAt: serverTimestamp(),
                          lastMessageText: 'iniciar chamada',
                          hasUnread: false,
                        }, { merge: true });
                      } catch (error) {
                        console.error("Error sending call message from CallsView:", error);
                      }
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

function FamilyView({ user, setModal, setView, setActiveChat, isAdding, setIsAdding }: { user: UserProfile, setModal: (m: any) => void, setView: (v: any) => void, setActiveChat: (c: any) => void, isAdding: boolean, setIsAdding: (v: boolean) => void }) {
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
      const q = query(collection(db, 'users_v3'), where('parentId', '==', user.uid));
      const unsubFamily = onSnapshot(q, (snapshot) => {
        setFamilyMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });

      const qContacts = query(collection(db, 'users_v3', user.uid, 'contacts'));
      const unsubContacts = onSnapshot(qContacts, (snapshot) => {
        setContacts(snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
        }));
      });

      return () => { unsubFamily(); unsubContacts(); };
    } else if (user.parentId) {
      const q = query(collection(db, 'users_v3'), where('uid', '==', user.parentId));
      return onSnapshot(q, (snapshot) => {
        setFamilyMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });
    }
  }, [user.uid, user.role, user.parentId]);

  useEffect(() => {
    if (selectedChild) {
      const q = query(collection(db, 'users_v3', selectedChild.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChildContacts(snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, uid: data.uid || doc.id, ...data } as Contact;
        }));
      }, (error) => handleFirestoreError(error, OperationType.LIST, `users_v3/${selectedChild.uid}/contacts`));
      return () => unsubscribe();
    } else {
      setChildContacts([]);
    }
  }, [selectedChild]);

  const addChild = async () => {
    if (!emailInput || isAdding) return;
    setIsAdding(true);
    try {
      const q = query(collection(db, 'users_v3'), where('email', '==', emailInput));
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
      await setDoc(doc(db, 'users_v3', childData.uid), { parentId: user.uid }, { merge: true });

      // Add parent to child's contacts
      await setDoc(doc(db, 'users_v3', childData.uid, 'contacts', user.uid), {
        uid: user.uid,
        email: user.email,
        name: `Pai/Mãe (${user.name})`,
        photoURL: user.photoURL || '',
        approved: true,
        childId: childData.uid
      });

      // Add child to parent's contacts
      await setDoc(doc(db, 'users_v3', user.uid, 'contacts', childData.uid), {
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
      handleFirestoreError(error, OperationType.WRITE, 'users_v3');
    } finally {
      setIsAdding(false);
    }
  };

  const unlinkChild = async (childUid: string, childName: string) => {
    setModal({
      title: 'Desvincular Filho',
      message: `Tem certeza que deseja desvincular ${childName}? Esta ação removerá o vínculo familiar.`,
      type: 'confirm',
      onConfirm: async () => {
        try {
          // 1. Remove parentId from child document
          await updateDoc(doc(db, 'users_v3', childUid), { parentId: deleteField() });

          // 2. Remove parent from child's contacts
          await deleteDoc(doc(db, 'users_v3', childUid, 'contacts', user.uid));

          // 3. Remove child from parent's contacts
          await deleteDoc(doc(db, 'users_v3', user.uid, 'contacts', childUid));

          setModal({ title: 'Sucesso', message: `${childName} foi desvinculado com sucesso.`, type: 'alert' });
          if (selectedChild?.uid === childUid) setSelectedChild(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users_v3/${childUid}`);
        }
      }
    });
  };

  const addContact = async () => {
    if (!emailInput || isAdding) return;
    setIsAdding(true);
    const normalizedEmail = emailInput.toLowerCase().trim();
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      setIsAdding(false);
    }, 15000);

    try {
      const q = query(collection(db, 'users_v3'), where('email', '==', normalizedEmail));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setModal({ title: 'Aviso', message: 'Email não cadastrado.', type: 'alert' });
        return;
      }

      const friendDoc = snapshot.docs[0];
      const friendData = friendDoc.data() as UserProfile;
      const friendUid = friendDoc.id;

      await setDoc(doc(db, 'users_v3', user.uid, 'contacts', friendUid), {
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

      await setDoc(doc(db, 'users_v3', friendUid, 'contacts', user.uid), {
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
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${user.uid}/contacts`);
    } finally {
      clearTimeout(timeoutId);
      setIsAdding(false);
    }
  };

  const deleteParentContact = async (id: string) => {
    setModal({
      title: 'Excluir Contato',
      message: 'Deseja excluir este contato?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users_v3', user.uid, 'contacts', id));
          setModal({ title: 'Sucesso', message: 'Contato excluído com sucesso.', type: 'alert' });
        } catch (error) {
          console.error("Error deleting contact:", error);
          setModal({ title: 'Erro', message: 'Não foi possível excluir o contato.', type: 'alert' });
          try { handleFirestoreError(error, OperationType.DELETE, `users_v3/${user.uid}/contacts/${id}`); } catch (e) {}
        }
      }
    });
  };

  const toggleApproval = async (contact: Contact) => {
    if (!selectedChild) return;
    try {
      await setDoc(doc(db, 'users_v3', selectedChild.uid, 'contacts', contact.id), { approved: !contact.approved }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${selectedChild.uid}/contacts/${contact.id}`);
    }
  };

  const toggleMeet = async (contact: Contact) => {
    if (!selectedChild) return;
    try {
      await setDoc(doc(db, 'users_v3', selectedChild.uid, 'contacts', contact.id), { meetAuthorized: !contact.meetAuthorized }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${selectedChild.uid}/contacts/${contact.id}`);
    }
  };

  const toggleClearChatPermission = async (contact: Contact) => {
    if (!selectedChild) return;
    try {
      await setDoc(doc(db, 'users_v3', selectedChild.uid, 'contacts', contact.id), { canClearChat: !contact.canClearChat }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${selectedChild.uid}/contacts/${contact.id}`);
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
          await deleteDoc(doc(db, 'users_v3', selectedChild.uid, 'contacts', contactId));
          setModal({ title: 'Sucesso', message: 'Contato do filho excluído com sucesso.', type: 'alert' });
        } catch (error) {
          console.error("Error deleting child contact:", error);
          setModal({ title: 'Erro', message: 'Não foi possível excluir o contato do filho.', type: 'alert' });
          try { handleFirestoreError(error, OperationType.DELETE, `users_v3/${selectedChild.uid}/contacts/${contactId}`); } catch (e) {}
        }
      }
    });
  };

  const addFriendForChild = async () => {
    if (!friendEmail || !selectedChild) return;
    try {
      const q = query(collection(db, 'users_v3'), where('email', '==', friendEmail));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setModal({
          title: 'Ops!',
          message: 'Este email não está cadastrado no WhatsNicky. Peça para a pessoa se cadastrar primeiro!',
          type: 'alert'
        });
        return;
      }

      const friendDoc = snapshot.docs[0];
      const friendData = friendDoc.data() as UserProfile;
      const friendUid = friendDoc.id;

      // Add friend to child's contacts
      await setDoc(doc(db, 'users_v3', selectedChild.uid, 'contacts', friendUid), {
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
      await setDoc(doc(db, 'users_v3', friendUid, 'contacts', selectedChild.uid), {
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
      handleFirestoreError(error, OperationType.WRITE, `users_v3/${selectedChild.uid}/contacts`);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-full">
      <header className="p-6 border-b bg-[#FFCC80] text-white flex items-center gap-4">
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
                  disabled={isAdding}
                  onClick={addFriendForChild}
                  className="px-6 py-3 bg-[#F48FB1] text-white rounded-2xl font-bold shadow-md disabled:opacity-50"
                >
                  {isAdding ? '...' : 'Adicionar'}
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
                      onUnlink={() => unlinkChild(child.uid, child.name)}
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
              <button 
                disabled={isAdding}
                onClick={showAddChild ? addChild : addContact} 
                className="flex-1 py-4 bg-[#F48FB1] text-white rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50"
              >
                {isAdding ? '...' : (showAddChild ? 'Vincular' : 'Adicionar')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SettingsView({ user, onLogout, setModal, moods, avatars, updateMood, updateProfilePhoto, onClearContacts, isUpdating, updateTrustedSOSContact, updateMascot, updateFavorites }: { user: UserProfile, onLogout: () => void, setModal: (m: any) => void, moods: any[], avatars: string[], updateMood: (m: string, e: string) => void, updateProfilePhoto: (url: string) => Promise<void>, onClearContacts: () => void, isUpdating: boolean, updateTrustedSOSContact: (email: string) => Promise<void>, updateMascot: (m: string) => Promise<void>, updateFavorites: (f: any) => Promise<void> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sosEmail, setSosEmail] = useState(user.trustedSOSContactEmail || '');
  const [favs, setFavs] = useState(user.favorites || { music: '', game: '', color: '', food: '' });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const optimizedBase64 = await resizeImage(file);
      const cloudinaryUrl = await uploadToCloudinary(optimizedBase64);
      await updateProfilePhoto(cloudinaryUrl);
      setModal({ title: 'Sucesso', message: 'Foto de perfil atualizada!', type: 'alert' });
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      setModal({ title: 'Erro', message: 'Falha ao atualizar foto de perfil.', type: 'alert' });
    } finally {
      setUploading(false);
    }
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
      <header className="p-6 bg-[#A5D6A7] text-white shrink-0 shadow-md">
        <h2 className="text-2xl font-bold">Ajustes</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center">
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
            <Heart className="w-5 h-5 text-[#F48FB1]" />
            Escolha seu Mascote
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {MASCOT_OPTIONS.map((m) => (
              <button
                key={m.type}
                disabled={isUpdating}
                onClick={() => updateMascot(m.type)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                  user.mascot === m.type ? "bg-[#F48FB1]/10 border-[#F48FB1] shadow-sm" : "bg-white border-slate-100 hover:border-[#F48FB1]/30"
                )}
              >
                <span className="text-4xl">{m.emoji}</span>
                <span className="text-xs font-bold text-slate-600">{m.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Mural de Favoritos
          </h4>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={favs.music}
                  onChange={(e) => setFavs({...favs, music: e.target.value})}
                  placeholder="Música favorita"
                  className="flex-1 bg-slate-50 p-3 rounded-xl outline-none text-sm border-2 border-transparent focus:border-purple-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Gamepad className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={favs.game}
                  onChange={(e) => setFavs({...favs, game: e.target.value})}
                  placeholder="Jogo favorito"
                  className="flex-1 bg-slate-50 p-3 rounded-xl outline-none text-sm border-2 border-transparent focus:border-blue-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center shrink-0">
                  <Palette className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={favs.color}
                  onChange={(e) => setFavs({...favs, color: e.target.value})}
                  placeholder="Cor favorita"
                  className="flex-1 bg-slate-50 p-3 rounded-xl outline-none text-sm border-2 border-transparent focus:border-pink-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
                  <Utensils className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={favs.food}
                  onChange={(e) => setFavs({...favs, food: e.target.value})}
                  placeholder="Comida favorita"
                  className="flex-1 bg-slate-50 p-3 rounded-xl outline-none text-sm border-2 border-transparent focus:border-orange-300"
                />
              </div>
            </div>
            <button 
              disabled={isUpdating}
              onClick={() => updateFavorites(favs)}
              className="w-full py-3 bg-[#CE93D8] text-white rounded-xl font-bold shadow-md hover:bg-[#BA68C8] transition-colors disabled:opacity-50"
            >
              Salvar Mural
            </button>
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
                disabled={isUpdating}
                onClick={() => updateMood(m.label, m.emoji)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all disabled:opacity-50",
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
                disabled={isUpdating}
                onClick={() => selectAvatar(url)}
                className={cn(
                  "aspect-square rounded-2xl border overflow-hidden transition-all disabled:opacity-50",
                  user.photoURL === url ? "border-[#81D4FA] border-4" : "border-slate-100 hover:border-[#81D4FA]/30"
                )}
              >
                <img src={url} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            Contato de Emergência (SOS)
          </h4>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
            <p className="text-xs text-slate-500">Este e-mail receberá seus alertas de SOS com sua localização.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                value={sosEmail}
                onChange={(e) => setSosEmail(e.target.value)}
                placeholder="email@confianca.com"
                className="flex-1 p-3 bg-slate-50 rounded-xl outline-none border-2 border-transparent focus:border-[#F48FB1] text-sm"
              />
              <button 
                disabled={isUpdating || sosEmail === user.trustedSOSContactEmail}
                onClick={() => updateTrustedSOSContact(sosEmail)}
                className="px-4 py-2 bg-[#F48FB1] text-white rounded-xl font-bold text-sm disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
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

const STATUS_OPTIONS: { label: StatusType, icon: any, color: string, description: string }[] = [
  { label: 'brincando', icon: <Gamepad2 className="w-5 h-5" />, color: '#F48FB1', description: 'Estou me divertindo!' },
  { label: 'estudando', icon: <Book className="w-5 h-5" />, color: '#81D4FA', description: 'Focado nos livros.' },
  { label: 'dormindo', icon: <Clock className="w-5 h-5" />, color: '#CE93D8', description: 'Zzz... Sonhando.' },
  { label: 'conversando', icon: <MessageSquare className="w-5 h-5" />, color: '#81D4FA', description: 'Batendo um papo.' },
  { label: 'trabalhando', icon: <Briefcase className="w-5 h-5" />, color: '#F48FB1', description: 'Em reunião ou tarefa.' },
  { label: 'comendo', icon: <Utensils className="w-5 h-5" />, color: '#CE93D8', description: 'Hora do lanche!' },
  { label: 'academia', icon: <Home className="w-5 h-5" />, color: '#81D4FA', description: 'Organizando tudo.' },
];

const MASCOT_OPTIONS: { type: MascotType, emoji: string, label: string }[] = [
  { type: 'none', emoji: '🚫', label: 'Nenhum' },
  { type: 'cat', emoji: '🐱', label: 'Gatinho' },
  { type: 'bear', emoji: '🐻', label: 'Ursinho' },
  { type: 'dog', emoji: '🐶', label: 'Cachorrinho' },
];

function StatusView({ user, setModal, isUpdating, updateStatus }: { user: UserProfile, setModal: (m: any) => void, isUpdating: boolean, updateStatus: (s: string) => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="p-6 bg-[#81D4FA] text-white shrink-0 shadow-md">
        <h2 className="text-2xl font-bold">Meu Status</h2>
        <p className="text-white/80 text-sm">O que você está fazendo agora?</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-4 shadow-inner">
            {user.mascot === 'cat' ? '🐱' : user.mascot === 'bear' ? '🐻' : user.mascot === 'dog' ? '🐶' : '👤'}
          </div>
          <h3 className="text-xl font-bold text-slate-800">
            {user.currentStatus ? `Estou ${user.currentStatus}!` : 'Como você está?'}
          </h3>
          <p className="text-slate-500 text-sm">Seus amigos verão seu mascote fazendo isso!</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              disabled={isUpdating}
              onClick={() => updateStatus(opt.label)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                user.currentStatus === opt.label 
                  ? "bg-white border-2 border-[#81D4FA] shadow-md" 
                  : "bg-white border-slate-100 hover:border-[#81D4FA]/30"
              )}
            >
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${opt.color}20`, color: opt.color }}>
                {opt.icon}
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 capitalize">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.description}</p>
              </div>
              {user.currentStatus === opt.label && (
                <div className="w-6 h-6 bg-[#81D4FA] text-white rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatView({ user, contact, onBack, setModal, isOnline }: { user: UserProfile, contact: Contact, onBack: () => void, setModal: (m: any) => void, isOnline: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMural, setShowMural] = useState(false);
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contactUid = contact.uid;
  const chatId = [user.uid, contactUid].sort().join('_');
  const contactRef = useRef(contact);

  useEffect(() => {
    contactRef.current = contact;
  }, [contact]);

  // Listen to contact's real profile for fresh favorites and status
  useEffect(() => {
    if (!contactUid) return;
    const unsub = onSnapshot(doc(db, 'users_v3', contactUid), (docSnap) => {
      if (docSnap.exists()) {
        setContactProfile(docSnap.data() as UserProfile);
      }
    }, (error) => {
      console.error("Error listening to contact profile:", error);
    });
    return () => unsub();
  }, [contactUid]);

  useEffect(() => {
    if (!chatId || !user.uid || !contactUid) return;
    
    const unsubscribeRef = { current: null as any };

    const setupListener = (useIndex: boolean) => {
      const q = useIndex 
        ? query(collection(db, 'chats_v3', chatId, 'messages'), orderBy('timestamp', 'desc'), limit(20))
        : query(collection(db, 'chats_v3', chatId, 'messages'), limit(20));

      return onSnapshot(q, (snapshot) => {
        try {
          let newMessages = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            isPending: doc.metadata.hasPendingWrites 
          } as Message & { isPending: boolean }));
          
          // Client-side sort to ensure correct order after limiting
          newMessages.sort((a, b) => {
            const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : Date.now());
            const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : Date.now());
            return tA - tB;
          });
          
          setMessages(newMessages);
          
          // Update last message timestamp in contacts to clear notifications
          if (newMessages.length > 0) {
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg.senderId !== user.uid && contactRef.current.hasUnread) {
              updateDoc(doc(db, 'users_v3', user.uid, 'contacts', contactUid), { 
                hasUnread: false 
              }).catch(() => {});
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
        console.error("Messages listener error:", error);
        if (error.code === 'failed-precondition' && useIndex) {
          console.warn("Index missing, falling back to client-side sort");
          if (unsubscribeRef.current) unsubscribeRef.current();
          unsubscribeRef.current = setupListener(false);
        } else {
          handleFirestoreError(error, OperationType.LIST, `chats_v3/${chatId}/messages`);
        }
      });
    };

    unsubscribeRef.current = setupListener(true);

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [chatId, user.uid, contactUid]); // Removed contact.hasUnread to prevent churn

  const sendMessage = async (mediaUrl?: string, mediaType: 'text' | 'image' | 'call' = 'text', meetUrl?: string) => {
    if ((!inputText.trim() && !mediaUrl) || isSending || !contactUid) return;
    
    if (!isOnline) {
      setModal({
        title: "Você está offline",
        message: "Não é possível enviar mensagens enquanto estiver offline. Verifique sua conexão e tente novamente.",
        type: 'alert'
      });
      return;
    }

    setIsSending(true);
    const text = inputText.trim();
    const currentInput = inputText;
    
    // Optimistically clear input for better UX, but keep track to restore on failure
    setInputText('');
    setShowEmoji(false);

    // Safety timeout to reset isSending if it hangs
    const timeoutId = setTimeout(() => {
      setIsSending(false);
    }, 15000);

    try {
      console.log("Attempting to send message:", {
        chatId,
        senderId: user.uid,
        receiverId: contactUid,
        mediaType,
        textLength: text.length
      });
      
      // Add message to chat
      await addDoc(collection(db, 'chats_v3', chatId, 'messages'), {
        senderId: user.uid,
        receiverId: contactUid,
        text: mediaType === 'text' ? text : '',
        mediaUrl: mediaUrl || '',
        mediaType,
        meetUrl: meetUrl || '',
        timestamp: serverTimestamp()
      });
      console.log("Message write successful");

      const lastMsgUpdate = {
        lastMessageAt: serverTimestamp(),
        lastMessageText: mediaType === 'text' ? text : (mediaType === 'image' ? '📷 Foto' : '📞 Chamada'),
      };

      // Update contact lists - NON-BLOCKING to avoid hanging the UI
      setDoc(doc(db, 'users_v3', user.uid, 'contacts', contactUid), lastMsgUpdate, { merge: true }).catch(() => {});
      setDoc(doc(db, 'users_v3', contactUid, 'contacts', user.uid), { ...lastMsgUpdate, hasUnread: true }, { merge: true }).catch(() => {});

    } catch (error) {
      // Restore input on failure
      setInputText(currentInput);
      console.error("Failed to send message:", error);
      
      const errInfo = handleFirestoreError(error, OperationType.WRITE, `chats_v3/${chatId}/messages`);
      
      setModal({
        title: "Erro ao enviar mensagem",
        message: `Não foi possível enviar sua mensagem. Detalhes: ${error instanceof Error ? error.message : String(error)}`,
        type: 'alert'
      });
    } finally {
      clearTimeout(timeoutId);
      setIsSending(false);
    }
  };

  const startCall = () => {
    const meetId = Math.random().toString(36).substring(7);
    const meetUrl = `https://meet.jit.si/${meetId}`;
    sendMessage(undefined, 'call', meetUrl);
    window.open(meetUrl, '_blank');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimizedBase64 = await resizeImage(file);
      const cloudinaryUrl = await uploadToCloudinary(optimizedBase64);
      sendMessage(cloudinaryUrl, 'image');
    } catch (error) {
      console.error("Error uploading image:", error);
      setModal({ title: 'Erro', message: 'Falha ao enviar imagem.', type: 'alert' });
    }
  };

  const mascotEmoji = (contactProfile?.mascot || contact.mascot) === 'cat' ? '🐱' : (contactProfile?.mascot || contact.mascot) === 'bear' ? '🐻' : (contactProfile?.mascot || contact.mascot) === 'dog' ? '🐶' : null;
  const statusInfo = STATUS_OPTIONS.find(s => s.label === (contactProfile?.currentStatus || contact.currentStatus));

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const callAttention = async () => {
    try {
      await addDoc(collection(db, 'chats_v3', chatId, 'messages'), {
        senderId: user.uid,
        receiverId: contactUid,
        text: '🔔 Chamou sua atenção!',
        mediaType: 'text',
        timestamp: serverTimestamp()
      });

      const lastMsgUpdate = {
        lastMessageAt: serverTimestamp(),
        lastMessageText: '🔔 Chamou sua atenção!',
      };

      await setDoc(doc(db, 'users_v3', user.uid, 'contacts', contactUid), lastMsgUpdate, { merge: true });
      await setDoc(doc(db, 'users_v3', contactUid, 'contacts', user.uid), { ...lastMsgUpdate, hasUnread: true }, { merge: true });

      const response = await fetch('/api/attention/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromName: user.name,
          toEmail: contact.email,
          toName: contact.name
        })
      });

      if (response.ok) {
        setModal({
          title: 'Atenção Chamada!',
          message: `Um aviso foi enviado para o e-mail de ${contact.name}.`,
          type: 'alert'
        });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error("Error calling attention:", error);
      setModal({
        title: 'Atenção Chamada!',
        message: 'Atenção registrada no chat, mas houve um erro ao enviar o e-mail.',
        type: 'alert'
      });
    }
  };

  const clearChat = async () => {
    setModal({
      title: 'Limpar Conversa',
      message: 'Deseja apagar todas as mensagens desta conversa? Esta ação não pode ser desfeita.',
      type: 'confirm',
      onConfirm: async () => {
        try {
          const q = query(collection(db, 'chats_v3', chatId, 'messages'));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'chats_v3', chatId, 'messages', d.id)));
          await Promise.all(deletePromises);
          
          await setDoc(doc(db, 'users_v3', user.uid, 'contacts', contactUid), {
            lastMessageText: '',
            hasUnread: false
          }, { merge: true });

          setModal({
            title: 'Conversa Limpa',
            message: 'Todas as mensagens foram apagadas.',
            type: 'alert'
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `chats_v3/${chatId}/messages`);
        }
      }
    });
  };

  const isMeetAllowed = contact.meetAuthorized || user.role === 'parent';
  const isClearAllowed = contact.canClearChat || user.role === 'parent';

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
        <div className="relative">
          <img src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.uid}`} className="w-10 h-10 rounded-full border-2 border-white/20" alt="" />
          {mascotEmoji && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs shadow-sm border border-slate-100">
              {mascotEmoji}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold truncate">{contactProfile?.name || contact.name}</h3>
          <p className="text-[10px] text-[#F48FB1] font-bold uppercase tracking-wider">
            {(contactProfile?.currentStatus || contact.currentStatus) ? `Está ${(contactProfile?.currentStatus || contact.currentStatus)}` : 'Online'}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowMural(!showMural)}
            className={cn(
              "p-2 rounded-2xl transition-all",
              showMural ? "bg-white text-yellow-600" : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            <Star className={cn("w-6 h-6", showMural && "fill-current")} />
          </button>
          <button 
            onClick={callAttention}
            className="p-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-colors"
            title="Chamar Atenção"
          >
            <Bell className="w-6 h-6" />
          </button>
          {isClearAllowed && (
            <button 
              onClick={clearChat}
              className="p-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-colors"
              title="Limpar Conversa"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          )}
          {isMeetAllowed && (
            <button className="p-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-colors" onClick={startCall}>
              <Video className="w-6 h-6" />
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showMural && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-slate-100 overflow-hidden shadow-inner"
          >
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="bg-purple-50 p-3 rounded-2xl flex items-center gap-3">
                <Music className="w-5 h-5 text-purple-500" />
                <div className="overflow-hidden">
                  <p className="text-[10px] text-purple-400 font-bold uppercase">Música</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{(contactProfile?.favorites?.music || contact.favorites?.music) || '---'}</p>
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl flex items-center gap-3">
                <Gamepad className="w-5 h-5 text-blue-500" />
                <div className="overflow-hidden">
                  <p className="text-[10px] text-blue-400 font-bold uppercase">Jogo</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{(contactProfile?.favorites?.game || contact.favorites?.game) || '---'}</p>
                </div>
              </div>
              <div className="bg-pink-50 p-3 rounded-2xl flex items-center gap-3">
                <Palette className="w-5 h-5 text-pink-500" />
                <div className="overflow-hidden">
                  <p className="text-[10px] text-pink-400 font-bold uppercase">Cor</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{(contactProfile?.favorites?.color || contact.favorites?.color) || '---'}</p>
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded-2xl flex items-center gap-3">
                <Utensils className="w-5 h-5 text-orange-500" />
                <div className="overflow-hidden">
                  <p className="text-[10px] text-orange-400 font-bold uppercase">Comida</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{(contactProfile?.favorites?.food || contact.favorites?.food) || '---'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot Status Overlay */}
      {mascotEmoji && (contactProfile?.currentStatus || contact.currentStatus) && (
        <div className="bg-[#81D4FA]/10 p-3 flex items-center justify-center gap-3 border-b border-[#81D4FA]/20">
          <div className="text-3xl animate-bounce">
            {mascotEmoji}
          </div>
          <div className="bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
              {statusInfo?.icon}
              {(contactProfile?.name || contact.name)} está {(contactProfile?.currentStatus || contact.currentStatus)}!
            </p>
          </div>
        </div>
      )}

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
                  : "self-start bg-white text-slate-800 rounded-tl-none"
              )}>
                {msg.mediaType === 'image' ? (
                  <img src={msg.mediaUrl} className="rounded-xl mb-1 max-w-full" alt="" />
                ) : msg.mediaType === 'call' ? (
                  <div className="flex flex-col gap-3">
                    <div className={cn("flex items-center gap-3", msg.senderId === user.uid ? "text-white/80" : "text-slate-600")}>
                      <Video className="w-5 h-5" />
                      <span className="text-sm font-medium">Chamada de vídeo</span>
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
                  <p className="text-sm break-words">
                    {(msg.text || '').split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                      part.match(/^https?:\/\//) ? (
                        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-bold break-all">
                          {part}
                        </a>
                      ) : part
                    )}
                  </p>
                )}
                <p className={cn("text-[9px] mt-1 opacity-70 flex items-center gap-1", msg.senderId === user.uid ? "justify-end" : "justify-start")}>
                  {(msg as any).isPending && <Clock className="w-2 h-2 animate-spin" />}
                  {(msg as any).isPending ? 'Enviando...' : (
                    msg.timestamp && typeof msg.timestamp.toDate === 'function' 
                      ? format(msg.timestamp.toDate(), 'HH:mm') 
                      : (msg.timestamp instanceof Date && isValid(msg.timestamp))
                        ? format(msg.timestamp, 'HH:mm')
                        : (typeof msg.timestamp === 'string' && isValid(new Date(msg.timestamp)))
                          ? format(new Date(msg.timestamp), 'HH:mm')
                          : '...'
                  )}
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
            onClick={() => sendMessage()} 
            disabled={isSending || !inputText.trim()}
            className="p-3 bg-[#CE93D8] text-white rounded-full shadow-md disabled:opacity-50 flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
