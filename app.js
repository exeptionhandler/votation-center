// app.js
// Character data with Firebase structure
const characters = [
    {
        id: "pam",
        name: "The hockey player",
        category: "Donations",
        description: "The BEST hockey player in the world who gives back to the community.",
        achievement: "BIG funds raised for charity",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/hockeyplayer.jpg",
        votes: 0
    },
    {
        id: "perez",
        name: "The marathonist",
        category: "Donations",
        description: "He took part in a charity marathon.",
        achievement: "Completed a full marathon for a good cause",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/marathonist.jpg",
        votes: 0
    },
    {
        id: "nicole",
        name: "The raiser",
        category: "Donations",
        description: "Here for a good cause, raising funds for those in need.",
        achievement: "Broke records in charity fundraising",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/charity.jpg",
        votes: 0
    },
    {
        id: "fabio",
        name: "Mr beast",
        category: "Donations",
        description: "The most generous person on the planet.",
        achievement: "2025 Philanthropist of the Year, 12,000,000 $ raised IN ONE DAY",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/mr-beast.jpg",
        votes: 0
    }
];

// Application state
let app;
let database;
let hasVoted = false;
let deviceId = '';
let totalVotes = 0;
let isConnected = false;
let votingListeners = [];
let useFirebase = false;
let mockData = {};

// DOM elements
const charactersGrid = document.getElementById('charactersGrid');
const totalVotesElement = document.getElementById('totalVotes');
const progressFill = document.getElementById('progressFill');
const rankingsContainer = document.getElementById('rankings');
const firebaseStatus = document.getElementById('firebaseStatus');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const syncStatus = document.getElementById('syncStatus');
const syncIcon = document.getElementById('syncIcon');
const syncText = document.getElementById('syncText');
const voteModal = document.getElementById('voteModal');
const alreadyVotedModal = document.getElementById('alreadyVotedModal');
const firebaseErrorModal = document.getElementById('firebaseErrorModal');
const confettiContainer = document.getElementById('confettiContainer');

// Device fingerprinting function
function generateDeviceId() {
    // Create a device fingerprint using various browser characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
    
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown'
    ].join('|');
    
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return 'device_' + Math.abs(hash).toString(36);
}

// Mock Firebase functions for demo mode
const mockFirebase = {
    data: {
        votes: {
            mario: { count: 0, voters: {} },
            naruto: { count: 0, voters: {} },
            deadpool: { count: 0, voters: {} },
            pikachu: { count: 0, voters: {} }
        },
        totalVotes: 0,
        lastUpdated: Date.now()
    },
    
    listeners: [],
    
    ref: (path) => ({ path }),
    
    get: async (ref) => ({
        exists: () => true,
        val: () => {
            if (ref.path.includes('votes/') && ref.path.includes('/count')) {
                const characterId = ref.path.split('/')[1];
                return mockFirebase.data.votes[characterId]?.count || 0;
            }
            if (ref.path === 'totalVotes') {
                return mockFirebase.data.totalVotes;
            }
            return mockFirebase.data;
        }
    }),
    
    set: async (ref, value) => {
        console.log('Mock Firebase set:', ref.path, value);
        return Promise.resolve();
    },
    
    onValue: (ref, callback) => {
        const listener = { ref, callback };
        mockFirebase.listeners.push(listener);
        
        // Immediately call with current value
        setTimeout(() => {
            if (ref.path.includes('votes/') && ref.path.includes('/count')) {
                const characterId = ref.path.split('/')[1];
                callback({ val: () => mockFirebase.data.votes[characterId]?.count || 0 });
            } else if (ref.path === 'totalVotes') {
                callback({ val: () => mockFirebase.data.totalVotes });
            } else if (ref.path === '.info/connected') {
                callback({ val: () => true });
            }
        }, 100);
        
        return listener;
    },
    
    runTransaction: async (ref, updateFunction) => {
        if (ref.path.includes('votes/')) {
            const characterId = ref.path.split('/')[1];
            const currentData = mockFirebase.data.votes[characterId];
            
            try {
                const newData = updateFunction(currentData);
                if (newData) {
                    mockFirebase.data.votes[characterId] = newData;
                    // Trigger listeners
                    mockFirebase.triggerListeners(`votes/${characterId}/count`, newData.count);
                    return { committed: true };
                }
            } catch (error) {
                throw error;
            }
        } else if (ref.path === 'totalVotes') {
            const currentTotal = mockFirebase.data.totalVotes;
            const newTotal = updateFunction(currentTotal);
            mockFirebase.data.totalVotes = newTotal;
            mockFirebase.triggerListeners('totalVotes', newTotal);
            return { committed: true };
        }
        return { committed: false };
    },
    
    triggerListeners: (path, value) => {
        mockFirebase.listeners.forEach(listener => {
            if (listener.ref.path === path) {
                listener.callback({ val: () => value });
            }
        });
    },
    
    serverTimestamp: () => Date.now()
};

// Update connection status
function updateConnectionStatus(connected, message = '') {
    isConnected = connected;
    const indicator = statusIndicator;
    const text = statusText;
    
    if (connected) {
        indicator.className = 'status-indicator connected';
        indicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Connected to Firebase</span>';
        updateSyncStatus('synced');
    } else {
        indicator.className = 'status-indicator disconnected';
        indicator.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>' + (message || 'Using Demo Mode') + '</span>';
        updateSyncStatus('error');
    }
}

// Update sync status
function updateSyncStatus(status) {
    const syncEl = syncStatus;
    const iconEl = syncIcon;
    const textEl = syncText;
    
    syncEl.className = `sync-status ${status}`;
    
    switch (status) {
        case 'syncing':
            iconEl.className = 'fas fa-sync-alt';
            textEl.textContent = 'Syncing...';
            break;
        case 'synced':
            iconEl.className = 'fas fa-check';
            textEl.textContent = useFirebase ? 'Synced' : 'Demo Mode';
            break;
        case 'error':
            iconEl.className = 'fas fa-exclamation-triangle';
            textEl.textContent = useFirebase ? 'Sync Error' : 'Demo Mode';
            break;
    }
}

// Initialize Firebase and application
async function initializeFirebaseApp() {
    try {
        updateConnectionStatus(false, 'Connecting...');
        
        if (window.firebase) {
            // Try to initialize real Firebase
            try {
                app = window.firebase.initializeApp(firebaseConfig);
                database = window.firebase.getDatabase(app);
                
                // Test connection with timeout
                const testPromise = window.firebase.get(window.firebase.ref(database, '.info/connected'));
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout')), 5000)
                );
                
                await Promise.race([testPromise, timeoutPromise]);
                
                useFirebase = true;
                updateConnectionStatus(true);
                
                // Setup real Firebase listeners
                setupFirebaseListeners();
                
                console.log('Connected to real Firebase');
                
            } catch (error) {
                console.warn('Real Firebase connection failed, using demo mode:', error.message);
                throw error;
            }
        } else {
            throw new Error('Firebase SDK not available');
        }
        
    } catch (error) {
        console.log('Using demo mode for Firebase functionality');
        useFirebase = false;
        
        // Use mock Firebase
        updateConnectionStatus(false, 'Demo Mode Active');
        setupMockFirebaseListeners();
    }
    
    // Initialize device ID
    deviceId = generateDeviceId();
    
    // Load initial data
    await loadInitialData();
    
    // Check voting status
    await checkVotingStatus();
    
    // Render UI
    renderCharacters();
    updateResults();
    
    console.log('Application initialized successfully');
}

// Setup real Firebase listeners
function setupFirebaseListeners() {
    // Connection status
    const connectedRef = window.firebase.ref(database, '.info/connected');
    window.firebase.onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val() === true;
        updateConnectionStatus(connected, connected ? '' : 'Disconnected');
    });
    
    setupVotingListeners();
}

// Setup mock Firebase listeners
function setupMockFirebaseListeners() {
    // Simulate connection
    setTimeout(() => {
        updateConnectionStatus(false, 'Demo Mode Active');
    }, 1000);
    
    setupVotingListeners();
}

// Setup real-time listeners for voting data
function setupVotingListeners() {
    const firebase = useFirebase ? window.firebase : mockFirebase;
    
    // Listen to total votes
    const totalVotesRef = firebase.ref(database, 'totalVotes');
    const totalVotesListener = firebase.onValue(totalVotesRef, (snapshot) => {
        const newTotal = snapshot.val() || 0;
        if (newTotal !== totalVotes) {
            totalVotes = newTotal;
            updateTotalVotesDisplay();
        }
    });
    votingListeners.push(totalVotesListener);
    
    // Listen to individual character votes
    characters.forEach(character => {
        const characterRef = firebase.ref(database, `votes/${character.id}/count`);
        const characterListener = firebase.onValue(characterRef, (snapshot) => {
            const newCount = snapshot.val() || 0;
            if (newCount !== character.votes) {
                const oldCount = character.votes;
                character.votes = newCount;
                updateCharacterVoteDisplay(character.id, oldCount, newCount);
            }
        });
        votingListeners.push(characterListener);
    });
    
    console.log('Real-time listeners set up');
}

// Load initial data
async function loadInitialData() {
    try {
        if (useFirebase) {
            // Load from Firebase
            const snapshot = await window.firebase.get(window.firebase.ref(database, 'votes'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                characters.forEach(character => {
                    character.votes = data[character.id]?.count || 0;
                });
            }
            
            const totalSnapshot = await window.firebase.get(window.firebase.ref(database, 'totalVotes'));
            totalVotes = totalSnapshot.val() || 0;
        } else {
            // Load from localStorage for persistence in demo mode
            const savedVotes = localStorage.getItem('characterVotes');
            if (savedVotes) {
                const votesData = JSON.parse(savedVotes);
                characters.forEach(character => {
                    character.votes = votesData[character.id] || 0;
                    mockFirebase.data.votes[character.id].count = character.votes;
                });
                calculateTotalVotes();
                mockFirebase.data.totalVotes = totalVotes;
            }
        }
    } catch (error) {
        console.error('Error loading initial data:', error);
        // Fallback to localStorage
        const savedVotes = localStorage.getItem('characterVotes');
        if (savedVotes) {
            const votesData = JSON.parse(savedVotes);
            characters.forEach(character => {
                character.votes = votesData[character.id] || 0;
            });
            calculateTotalVotes();
        }
    }
}

// Calculate total votes
function calculateTotalVotes() {
    totalVotes = characters.reduce((sum, character) => sum + character.votes, 0);
}

// Check if device has already voted
async function checkVotingStatus() {
    try {
        // Check localStorage first
        hasVoted = localStorage.getItem('hasVoted') === 'true';
        
        if (useFirebase) {
            // Verify with Firebase
            const promises = characters.map(async (character) => {
                const votersRef = window.firebase.ref(database, `votes/${character.id}/voters/${deviceId}`);
                const snapshot = await window.firebase.get(votersRef);
                return snapshot.exists();
            });
            
            const results = await Promise.all(promises);
            const hasVotedInFirebase = results.some(result => result);
            
            if (hasVotedInFirebase && !hasVoted) {
                hasVoted = true;
                localStorage.setItem('hasVoted', 'true');
            }
        }
        
        if (hasVoted) {
            disableVoteButtons();
        }
        
    } catch (error) {
        console.error('Error checking voting status:', error);
        // Fall back to localStorage
        hasVoted = localStorage.getItem('hasVoted') === 'true';
        if (hasVoted) {
            disableVoteButtons();
        }
    }
}

// Handle voting with Firebase transaction or mock
async function vote(characterId) {
    if (hasVoted) {
        showAlreadyVotedModal();
        return;
    }
    
    updateSyncStatus('syncing');
    
    try {
        const firebase = useFirebase ? window.firebase : mockFirebase;
        
        // Use transaction to ensure atomic vote counting
        const characterRef = firebase.ref(database, `votes/${characterId}`);
        const totalRef = firebase.ref(database, 'totalVotes');
        
        await firebase.runTransaction(characterRef, (currentData) => {
            if (currentData === null) {
                return {
                    count: 1,
                    voters: { [deviceId]: true }
                };
            }
            
            // Check if device already voted
            if (currentData.voters && currentData.voters[deviceId]) {
                throw new Error('Device already voted');
            }
            
            return {
                count: (currentData.count || 0) + 1,
                voters: {
                    ...(currentData.voters || {}),
                    [deviceId]: true
                }
            };
        });
        
        // Update total votes
        await firebase.runTransaction(totalRef, (currentTotal) => {
            return (currentTotal || 0) + 1;
        });
        
        // Save to localStorage for persistence
        if (!useFirebase) {
            const votesData = {};
            characters.forEach(character => {
                votesData[character.id] = character.votes;
            });
            localStorage.setItem('characterVotes', JSON.stringify(votesData));
        }
        
        // Mark as voted locally
        hasVoted = true;
        localStorage.setItem('hasVoted', 'true');
        
        // Show success feedback
        showVoteSuccessModal();
        triggerConfetti();
        disableVoteButtons();
        
        updateSyncStatus('synced');
        console.log(`Vote cast for ${characterId}`);
        
    } catch (error) {
        console.error('Voting error:', error);
        updateSyncStatus('error');
        
        if (error.message === 'Device already voted') {
            hasVoted = true;
            localStorage.setItem('hasVoted', 'true');
            showAlreadyVotedModal();
            disableVoteButtons();
        } else {
            showFirebaseError('Failed to cast vote: ' + error.message);
        }
    }
}

// Render character cards
function renderCharacters() {
    charactersGrid.innerHTML = '';
    
    characters.forEach((character, index) => {
        const characterCard = createCharacterCard(character, index);
        charactersGrid.appendChild(characterCard);
    });
}

// Create character card element
function createCharacterCard(character, index) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.setAttribute('data-character-id', character.id);
    
    const percentage = totalVotes > 0 ? ((character.votes / totalVotes) * 100).toFixed(1) : 0;
    
    card.innerHTML = `
        <img src="${character.image}" alt="${character.name}" class="character-image" onerror="this.src='https://via.placeholder.com/400x400/1FB8CD/FFFFFF?text=${encodeURIComponent(character.name)}'">
        <h3 class="character-name">${character.name}</h3>
        <p class="character-category">${character.category}</p>
        <p class="character-description">${character.description}</p>
        <div class="character-achievement">
            <i class="fas fa-star achievement-icon"></i>
            ${character.achievement}
        </div>
        <div class="vote-section">
            <div class="vote-count">
                <i class="fas fa-heart"></i>
                <span class="vote-number" data-character="${character.id}">${character.votes}</span>
            </div>
            <div class="vote-percentage" data-character="${character.id}">${percentage}%</div>
            <button class="btn btn--primary vote-btn" onclick="vote('${character.id}')" ${hasVoted ? 'disabled' : ''}>
                <i class="fas fa-vote-yea"></i>
                ${hasVoted ? 'Voted!' : `Vote for ${character.name}`}
            </button>
        </div>
    `;
    
    return card;
}

// Update character vote display with animation
function updateCharacterVoteDisplay(characterId, oldCount, newCount) {
    const voteNumber = document.querySelector(`[data-character="${characterId}"].vote-number`);
    const votePercentage = document.querySelector(`[data-character="${characterId}"].vote-percentage`);
    const characterCard = document.querySelector(`[data-character-id="${characterId}"]`);
    
    if (voteNumber && newCount !== oldCount) {
        // Animate vote count change
        voteNumber.classList.add('updating');
        voteNumber.textContent = newCount;
        
        // Add real-time update animation to card
        if (characterCard) {
            characterCard.classList.add('real-time-update');
            setTimeout(() => {
                characterCard.classList.remove('real-time-update');
            }, 300);
        }
        
        setTimeout(() => {
            voteNumber.classList.remove('updating');
        }, 500);
        
        // Update percentage
        if (votePercentage) {
            calculateTotalVotes(); // Recalculate total
            const percentage = totalVotes > 0 ? ((newCount / totalVotes) * 100).toFixed(1) : 0;
            votePercentage.textContent = `${percentage}%`;
        }
        
        // Update rankings
        setTimeout(() => {
            updateResults();
        }, 100);
    }
}

// Update total votes display
function updateTotalVotesDisplay() {
    if (totalVotesElement) {
        totalVotesElement.textContent = totalVotes;
        updateProgressBar();
        updateAllPercentages();
    }
}

// Update all percentages
function updateAllPercentages() {
    characters.forEach(character => {
        const votePercentage = document.querySelector(`[data-character="${character.id}"].vote-percentage`);
        if (votePercentage) {
            const percentage = totalVotes > 0 ? ((character.votes / totalVotes) * 100).toFixed(1) : 0;
            votePercentage.textContent = `${percentage}%`;
        }
    });
}

// Update progress bar
function updateProgressBar() {
    if (progressFill) {
        const maxVotes = Math.max(...characters.map(c => c.votes), 1);
        const progressPercentage = totalVotes > 0 ? Math.min((totalVotes / (maxVotes * 4)) * 100, 100) : 0;
        progressFill.style.width = `${progressPercentage}%`;
    }
}

// Update results and rankings
function updateResults() {
    updateRankings();
    updateCharacterRankings();
}

// Update rankings display
function updateRankings() {
    if (!rankingsContainer) return;
    
    const sortedCharacters = [...characters].sort((a, b) => b.votes - a.votes);
    
    rankingsContainer.innerHTML = '';
    
    sortedCharacters.forEach((character, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        const position = index + 1;
        let positionIcon = '';
        
        switch (position) {
            case 1:
                positionIcon = '<i class="fas fa-trophy" style="color: #ffd700;"></i>';
                break;
            case 2:
                positionIcon = '<i class="fas fa-medal" style="color: #c0c0c0;"></i>';
                break;
            case 3:
                positionIcon = '<i class="fas fa-award" style="color: #cd7f32;"></i>';
                break;
            default:
                positionIcon = position;
        }
        
        const percentage = totalVotes > 0 ? ((character.votes / totalVotes) * 100).toFixed(1) : 0;
        
        rankingItem.innerHTML = `
            <div class="ranking-position">${positionIcon}</div>
            <div class="ranking-character">${character.name}</div>
            <div class="ranking-votes">${character.votes} votes (${percentage}%)</div>
        `;
        
        rankingsContainer.appendChild(rankingItem);
    });
}

// Update character cards with ranking indicators
function updateCharacterRankings() {
    const sortedCharacters = [...characters].sort((a, b) => b.votes - a.votes);
    
    // Remove existing ranking elements
    document.querySelectorAll('.ranking-badge, .trophy-icon').forEach(el => el.remove());
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.remove('winner', 'second-place', 'third-place');
    });
    
    sortedCharacters.forEach((character, index) => {
        const characterCard = document.querySelector(`[data-character-id="${character.id}"]`);
        if (characterCard && totalVotes > 0) {
            const position = index + 1;
            
            // Add ranking badge
            const rankingBadge = document.createElement('div');
            rankingBadge.className = 'ranking-badge';
            
            // Add trophy icon
            const trophyIcon = document.createElement('div');
            trophyIcon.className = 'trophy-icon';
            
            switch (position) {
                case 1:
                    characterCard.classList.add('winner');
                    rankingBadge.classList.add('first');
                    rankingBadge.innerHTML = '<i class="fas fa-crown"></i>';
                    trophyIcon.classList.add('gold');
                    trophyIcon.innerHTML = '<i class="fas fa-trophy"></i>';
                    break;
                case 2:
                    characterCard.classList.add('second-place');
                    rankingBadge.classList.add('second');
                    rankingBadge.innerHTML = '<i class="fas fa-medal"></i>';
                    trophyIcon.classList.add('silver');
                    trophyIcon.innerHTML = '<i class="fas fa-medal"></i>';
                    break;
                case 3:
                    characterCard.classList.add('third-place');
                    rankingBadge.classList.add('third');
                    rankingBadge.innerHTML = '<i class="fas fa-award"></i>';
                    trophyIcon.classList.add('bronze');
                    trophyIcon.innerHTML = '<i class="fas fa-award"></i>';
                    break;
                default:
                    rankingBadge.textContent = position;
            }
            
            if (position <= 3) {
                characterCard.appendChild(rankingBadge);
                characterCard.appendChild(trophyIcon);
            }
        }
    });
}

// Disable all vote buttons
function disableVoteButtons() {
    document.querySelectorAll('.vote-btn').forEach(button => {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-check"></i> Voted!';
        button.classList.remove('btn--primary');
        button.classList.add('btn--secondary');
    });
}

// Modal functions
function showVoteSuccessModal() {
    voteModal.classList.remove('hidden');
}

function showAlreadyVotedModal() {
    alreadyVotedModal.classList.remove('hidden');
}

function showFirebaseError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    firebaseErrorModal.classList.remove('hidden');
}

function hideModal(modal) {
    modal.classList.add('hidden');
}

// Confetti animation
function triggerConfetti() {
    const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            createConfettiPiece(colors[Math.floor(Math.random() * colors.length)]);
        }, i * 50);
    }
}

function createConfettiPiece(color) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = color;
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
    
    confettiContainer.appendChild(confetti);
    
    setTimeout(() => {
        if (confetti.parentNode) {
            confetti.parentNode.removeChild(confetti);
        }
    }, 5000);
}

// Setup event listeners
function setupEventListeners() {
    // Modal close buttons
    document.getElementById('modalClose')?.addEventListener('click', () => {
        hideModal(voteModal);
    });
    
    document.getElementById('alreadyVotedClose')?.addEventListener('click', () => {
        hideModal(alreadyVotedModal);
    });
    
    document.getElementById('firebaseErrorClose')?.addEventListener('click', () => {
        hideModal(firebaseErrorModal);
        // Try to reconnect
        if (!isConnected && useFirebase) {
            location.reload();
        }
    });
    
    // Modal overlay clicks
    document.getElementById('modalOverlay')?.addEventListener('click', () => {
        hideModal(voteModal);
    });
    
    document.getElementById('alreadyVotedOverlay')?.addEventListener('click', () => {
        hideModal(alreadyVotedModal);
    });
    
    document.getElementById('firebaseErrorOverlay')?.addEventListener('click', () => {
        hideModal(firebaseErrorModal);
    });
    
    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal(voteModal);
            hideModal(alreadyVotedModal);
            hideModal(firebaseErrorModal);
        }
    });
}

// Initialize application
function initializeApp() {
    if (window.firebaseLoaded || !window.firebase) {
        initializeFirebaseApp();
        setupEventListeners();
    } else {
        // Wait for Firebase to load
        window.initializeApp = () => {
            initializeFirebaseApp();
            setupEventListeners();
        };
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);

// Development helper functions
window.resetVotes = async function() {
    if (confirm('Are you sure you want to reset all votes? This will affect all users.')) {
        try {
            if (useFirebase) {
                const resetData = {
                    votes: {
                        mario: { count: 0, voters: {} },
                        naruto: { count: 0, voters: {} },
                        deadpool: { count: 0, voters: {} },
                        pikachu: { count: 0, voters: {} }
                    },
                    totalVotes: 0,
                    lastUpdated: window.firebase ? window.firebase.serverTimestamp() : Date.now()
                };
                
                await window.firebase.set(window.firebase.ref(database), resetData);
            }
            
            // Reset local data
            localStorage.removeItem('hasVoted');
            localStorage.removeItem('characterVotes');
            
            // Reset characters
            characters.forEach(character => {
                character.votes = 0;
                mockFirebase.data.votes[character.id].count = 0;
                mockFirebase.data.votes[character.id].voters = {};
            });
            
            totalVotes = 0;
            mockFirebase.data.totalVotes = 0;
            hasVoted = false;
            
            location.reload();
        } catch (error) {
            console.error('Error resetting votes:', error);
            alert('Error resetting votes: ' + error.message);
        }
    }
};

window.getVotingStats = async function() {
    try {
        if (useFirebase) {
            const snapshot = await window.firebase.get(window.firebase.ref(database));
            console.log('Current voting data:', snapshot.val());
            return snapshot.val();
        } else {
            console.log('Current demo data:', {
                characters: characters.map(c => ({ id: c.id, name: c.name, votes: c.votes })),
                totalVotes,
                hasVoted,
                deviceId
            });
            return mockFirebase.data;
        }
    } catch (error) {
        console.error('Error getting stats:', error);
    }
};

// Export for debugging
window.debugVoting = {
    characters,
    deviceId: () => deviceId,
    hasVoted: () => hasVoted,
    isConnected: () => isConnected,
    totalVotes: () => totalVotes,
    useFirebase: () => useFirebase
};