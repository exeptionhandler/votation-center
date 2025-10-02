// app.js - Firebase Character Voting Contest
// Configuration and characters
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

// Global variables
let db = null;
let hasVoted = false;
let deviceId = '';

// Generate device ID
function generateDeviceId() {
    let stored = localStorage.getItem('device_id');
    if (stored) return stored;

    const id = 'dev_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('device_id', id);
    return id;
}

// Initialize Firebase
async function initApp() {
    try {
        deviceId = generateDeviceId();

        // Initialize Firebase (compat API)
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();

        console.log('✅ Firebase initialized');
        updateStatus('Connected to Firebase', true);

        // Load votes and setup listeners
        setupListeners();
        await loadVotes();
        renderAll();

    } catch (error) {
        console.error('❌ Firebase failed:', error);
        updateStatus('Demo Mode (Firebase failed)', false);
        renderAll(); // Render with zero votes
    }
}

// Update connection status
function updateStatus(message, isConnected) {
    const statusEl = document.getElementById('statusText');
    const indicatorEl = document.getElementById('statusIndicator');

    if (statusEl) statusEl.textContent = message;
    if (indicatorEl) {
        indicatorEl.className = isConnected ? 'status-indicator connected' : 'status-indicator disconnected';
    }

    // Hide status after 2 seconds if connected
    if (isConnected) {
        setTimeout(() => {
            const statusContainer = document.getElementById('firebaseStatus');
            if (statusContainer) statusContainer.style.display = 'none';
        }, 2000);
    }
}

// Setup real-time listeners
function setupListeners() {
    if (!db) return;

    // Listen to votes for each character
    characters.forEach(char => {
        db.ref('votes/' + char.id + '/count').on('value', (snapshot) => {
            const newCount = snapshot.val() || 0;
            if (char.votes !== newCount) {
                char.votes = newCount;
                updateCharacterDisplay(char.id);
                updateResults();
            }
        });
    });

    // Listen to total votes
    db.ref('totalVotes').on('value', (snapshot) => {
        const total = snapshot.val() || 0;
        const totalEl = document.getElementById('totalVotes');
        if (totalEl) totalEl.textContent = total;
    });

    console.log('✅ Listeners setup complete');
}

// Load initial votes
async function loadVotes() {
    if (!db) return;

    try {
        // Load each character's votes
        const promises = characters.map(async (char) => {
            const snapshot = await db.ref('votes/' + char.id + '/count').once('value');
            char.votes = snapshot.val() || 0;
        });

        await Promise.all(promises);
        console.log('✅ Votes loaded');

    } catch (error) {
        console.error('Error loading votes:', error);
    }
}

// Check if device already voted
async function checkVoted(characterId) {
    if (!db) return localStorage.getItem('voted_' + characterId) === 'true';

    try {
        const snapshot = await db.ref('votes/' + characterId + '/voters/' + deviceId).once('value');
        return snapshot.exists();
    } catch (error) {
        return localStorage.getItem('voted_' + characterId) === 'true';
    }
}

// Vote for character
async function vote(characterId) {
    // Check if already voted
    const alreadyVoted = await checkVoted(characterId);
    if (alreadyVoted) {
        showModal('alreadyVotedModal');
        return;
    }

    try {
        if (db) {
            // Vote with Firebase
            const char = characters.find(c => c.id === characterId);
            const newCount = char.votes + 1;

            // Update vote count
            await db.ref('votes/' + characterId + '/count').set(newCount);

            // Mark device as voted  
            await db.ref('votes/' + characterId + '/voters/' + deviceId).set({
                timestamp: Date.now()
            });

            // Update total votes
            const totalSnapshot = await db.ref('totalVotes').once('value');
            const currentTotal = totalSnapshot.val() || 0;
            await db.ref('totalVotes').set(currentTotal + 1);

            console.log('✅ Vote recorded in Firebase');
        } else {
            // Local voting (demo mode)
            const char = characters.find(c => c.id === characterId);
            char.votes++;
            localStorage.setItem('voted_' + characterId, 'true');
            renderAll();
        }

        hasVoted = true;
        showModal('voteModal');
        disableButtons();

    } catch (error) {
        console.error('❌ Vote failed:', error);
        showModal('firebaseErrorModal');
    }
}

// Render everything
function renderAll() {
    renderCharacters();
    updateResults();
}

// Render character cards
function renderCharacters() {
    const grid = document.getElementById('charactersGrid');
    if (!grid) return;

    grid.innerHTML = '';

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'character-card';

        card.innerHTML = `
            <div class="character-card__image">
                <img src="${char.image}" alt="${char.name}" 
                     onerror="this.src='https://via.placeholder.com/400x400/4299e1/white?text=${encodeURIComponent(char.name)}'">
                <div class="character-card__badge">${char.category}</div>
            </div>
            <div class="character-card__content">
                <h3 class="character-card__name">${char.name}</h3>
                <p class="character-card__description">${char.description}</p>
                <div class="character-card__achievement">
                    <i class="fas fa-trophy"></i>
                    <span>${char.achievement}</span>
                </div>
                <div class="character-card__votes">
                    <i class="fas fa-vote-yea"></i>
                    <span id="votes-${char.id}">${char.votes} votes</span>
                </div>
                <button class="vote-button" onclick="vote('${char.id}')" 
                        ${hasVoted ? 'disabled' : ''}>
                    <i class="fas fa-hand-paper"></i>
                    ${hasVoted ? 'Voted' : 'Vote Now'}
                </button>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Update character display
function updateCharacterDisplay(characterId) {
    const char = characters.find(c => c.id === characterId);
    const votesEl = document.getElementById('votes-' + characterId);
    if (votesEl && char) {
        votesEl.textContent = char.votes + ' votes';
    }
}

// Update results section
function updateResults() {
    const rankingsEl = document.getElementById('rankings');
    if (!rankingsEl) return;

    const sorted = [...characters].sort((a, b) => b.votes - a.votes);
    const totalVotes = characters.reduce((sum, c) => sum + c.votes, 0);

    // Update total votes display
    const totalEl = document.getElementById('totalVotes');
    if (totalEl) totalEl.textContent = totalVotes;

    // Update rankings
    rankingsEl.innerHTML = sorted.map((char, index) => {
        const percentage = totalVotes > 0 ? (char.votes / totalVotes * 100).toFixed(1) : 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';

        return `
            <div class="ranking-item ${index === 0 ? 'ranking-item--first' : ''}">
                <div class="ranking-item__position">${medal}</div>
                <div class="ranking-item__info">
                    <span class="ranking-item__name">${char.name}</span>
                    <div class="ranking-item__bar">
                        <div class="ranking-item__fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="ranking-item__stats">
                    <span class="ranking-item__votes">${char.votes}</span>
                    <span class="ranking-item__percentage">${percentage}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
}

// Hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

// Disable vote buttons
function disableButtons() {
    document.querySelectorAll('.vote-button').forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Voted';
    });
}

// Setup modal event listeners
function setupModals() {
    // Close buttons
    document.getElementById('closeModalBtn')?.addEventListener('click', () => hideModal('voteModal'));
    document.getElementById('closeAlreadyVotedBtn')?.addEventListener('click', () => hideModal('alreadyVotedModal'));
    document.getElementById('closeFirebaseErrorBtn')?.addEventListener('click', () => hideModal('firebaseErrorModal'));

    // Overlay clicks
    document.querySelectorAll('.modal__overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.parentElement.classList.add('hidden');
        });
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Character Voting Contest...');
    setupModals();
    initApp();
});

// Global vote function for onclick
window.vote = vote;
