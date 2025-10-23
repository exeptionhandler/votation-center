// app.js - Firebase Character Voting Contest
// Character data
const characters = [
    {
        id: "pam",
        name: "Pamela Salinas",
        category: "Donations",
        description: "The BEST hockey player in the world who gives back to the community.",
        achievement: "BIG funds raised for charity",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/hockeyplayer.png",
        votes: 0
    },
    {
        id: "perez",
        name: "Alexander Munyao", 
        category: "Donations",
        description: "He took part in a charity marathon.",
        achievement: "New record in a charity marathon",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/marathonist.png",
        votes: 0
    },
    {
        id: "nicole",
        name: "Menna Evans",
        category: "Donations", 
        description: "Here for a good cause, raising funds for those in need.",
        achievement: "Broke records in charity fundraising",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/charity.png",
        votes: 0
    },
    {
        id: "fabio",
        name: "Mr beast",
        category: "Donations",
        description: "The most generous person on the planet.",
        achievement: "2025 Philanthropist of the Year, 12,000,000 $ raised IN ONE DAY",
        image: "https://raw.githubusercontent.com/exeptionhandler/votation-center/refs/heads/main/assets/mr-beast.png",
        votes: 0
    }
];

// Configuration
const VOTE_GOAL = 100; // Set your voting goal here

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
        updateStatus('Connected', true);

        // Load votes and setup listeners
        setupListeners();
        await loadVotes();
        renderAll();

    } catch (error) {
        console.error('❌ Firebase failed:', error);
        updateStatus('Offline (Demo)', false);
        renderAll();
    }
}

// Update connection status
function updateStatus(message, isConnected) {
    const statusEl = document.getElementById('statusText');
    const indicatorEl = document.getElementById('statusIndicator');

    if (statusEl) statusEl.textContent = message;
    if (indicatorEl) {
        indicatorEl.style.color = isConnected ? '#10b981' : '#f59e0b';
    }

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
        updateVotingStatus(total);
    });

    console.log('✅ Listeners setup complete');
}

// Load initial votes
async function loadVotes() {
    if (!db) return;

    try {
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

// Vote for character with effects
async function vote(characterId, buttonElement) {
    const alreadyVoted = await checkVoted(characterId);
    if (alreadyVoted) {
        showModal('alreadyVotedModal');
        return;
    }

    // Get button and card for animations
    const button = buttonElement;
    const card = button.closest('.character-card');

    // Add voting animation
    button.classList.add('voting');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Voting...';
    card.classList.add('card-pulse');

    try {
        if (db) {
            const char = characters.find(c => c.id === characterId);
            const newCount = char.votes + 1;

            await db.ref('votes/' + characterId + '/count').set(newCount);
            await db.ref('votes/' + characterId + '/voters/' + deviceId).set({
                timestamp: Date.now()
            });

            const totalSnapshot = await db.ref('totalVotes').once('value');
            const currentTotal = totalSnapshot.val() || 0;
            await db.ref('totalVotes').set(currentTotal + 1);

            console.log('✅ Vote recorded');
        } else {
            const char = characters.find(c => c.id === characterId);
            char.votes++;
            localStorage.setItem('voted_' + characterId, 'true');
            renderAll();
        }

        // Success animations
        button.classList.remove('voting');
        button.classList.add('voted-success');
        button.innerHTML = '<i class="fas fa-check-circle"></i> Voted!';

        card.classList.remove('card-pulse');
        card.classList.add('card-success');

        createConfetti(card);

        setTimeout(() => {
            hasVoted = true;
            showModal('voteModal');
            disableButtons();
        }, 800);

    } catch (error) {
        console.error('❌ Vote failed:', error);
        button.classList.remove('voting');
        button.innerHTML = '<i class="fas fa-hand-paper"></i> Vote Now';
        card.classList.remove('card-pulse');
        showModal('firebaseErrorModal');
    }
}

// Create confetti effect
function createConfetti(card) {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd', '#00d2d3'];
    const confettiCount = 30;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.3 + 's';
        confetti.style.animationDuration = (Math.random() * 1 + 1.5) + 's';

        card.appendChild(confetti);
        setTimeout(() => confetti.remove(), 2000);
    }
}

// Update voting status with progress bar
function updateVotingStatus(totalVotes) {
    const percentage = Math.min((totalVotes / VOTE_GOAL) * 100, 100);

    const totalEl = document.getElementById('totalVotes');
    const progressFill = document.getElementById('progressFill');
    const goalEl = document.getElementById('voteGoal');

    if (totalEl) totalEl.textContent = totalVotes;
    if (goalEl) goalEl.textContent = VOTE_GOAL;

    if (progressFill) {
        progressFill.style.width = percentage + '%';

        // Add celebration when goal is reached
        if (percentage >= 100) {
            progressFill.style.background = 'linear-gradient(90deg, #FFD700, #FFA500)';
        }
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
                <button class="vote-button" onclick="vote('${char.id}', this)" 
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

// Update results section - IMPROVED VERSION
function updateResults() {
    const rankingsEl = document.getElementById('rankings');
    if (!rankingsEl) return;

    const sorted = [...characters].sort((a, b) => b.votes - a.votes);
    const totalVotes = characters.reduce((sum, c) => sum + c.votes, 0);

    // Update voting status
    updateVotingStatus(totalVotes);

    rankingsEl.innerHTML = sorted.map((char, index) => {
        const percentage = totalVotes > 0 ? (char.votes / totalVotes * 100).toFixed(1) : 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

        // Determine medal class for styling
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

        return `
            <div class="ranking-item ${index === 0 ? 'ranking-item--first' : ''} ${medalClass}" data-rank="${index + 1}">
                <div class="ranking-item__position">
                    <span class="medal-icon">${medal}</span>
                </div>
                <div class="ranking-item__avatar">
                    <img src="${char.image}" alt="${char.name}" class="avatar-img">
                </div>
                <div class="ranking-item__info">
                    <div class="ranking-item__header">
                        <span class="ranking-item__name">${char.name}</span>
                        <span class="ranking-item__votes-count">${char.votes} vote${char.votes !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="ranking-item__bar-container">
                        <div class="ranking-item__bar">
                            <div class="ranking-item__fill" style="width: ${percentage}%">
                                <span class="fill-shimmer"></span>
                            </div>
                        </div>
                        <span class="ranking-item__percentage">${percentage}%</span>
                    </div>
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
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Voted';
    });
}

// Setup modal event listeners
function setupModals() {
    document.getElementById('closeModalBtn')?.addEventListener('click', () => hideModal('voteModal'));
    document.getElementById('closeAlreadyVotedBtn')?.addEventListener('click', () => hideModal('alreadyVotedModal'));
    document.getElementById('closeFirebaseErrorBtn')?.addEventListener('click', () => hideModal('firebaseErrorModal'));

    document.querySelectorAll('.modal__overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.parentElement.classList.add('hidden');
        });
    });
}

// Add this function to app.js
async function resetDatabase() {
    if (!confirm('⚠️ WARNING: This will delete ALL voting data. Are you sure?')) {
        return;
    }
    
    try {
        // Delete all votes
        await db.ref('votes').remove();
        // Delete total votes
        await db.ref('totalVotes').set(0);
        
        console.log('✅ Database reset successfully');
        alert('Database has been reset!');
        
        // Reset local data
        characters.forEach(char => char.votes = 0);
        renderAll();
        
    } catch (error) {
        console.error('❌ Reset failed:', error);
        alert('Failed to reset database: ' + error.message);
    }
}

// Make it accessible from browser console
window.resetDatabase = resetDatabase;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Character Voting Contest...');
    setupModals();
    initApp();
});

// Global vote function
window.vote = vote;
