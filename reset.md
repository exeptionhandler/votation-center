# 🗑️ How to Clean/Reset Voting Results

## Method 1: Firebase Console (RECOMMENDED - Easiest)

### Steps:
1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: "character-voting-contest"
3. **Go to Realtime Database** → **Data** tab
4. **Delete the data**:
   - Click on the root "/" or "votes" node
   - Click the **⋮** (three dots) menu
   - Select **"Delete"**
   - Confirm deletion

### What gets deleted:
- All vote counts reset to 0
- All voter device IDs removed
- Total votes reset to 0

### Time: ~30 seconds

---

## Method 2: Add Admin Reset Button (Code Solution)

Add a hidden reset button that only you can access with a password.

### Add to your `app.js`:

```javascript
// Admin function to reset all votes (add at the end of app.js)
async function resetAllVotes(password) {
    // Simple password protection
    if (password !== 'admin123') {  // Change this password!
        alert('Incorrect password');
        return;
    }

    if (!confirm('Are you sure you want to reset ALL votes? This cannot be undone!')) {
        return;
    }

    try {
        // Reset all character votes to 0
        const updates = {};
        characters.forEach(char => {
            updates[`votes/${char.id}/count`] = 0;
            updates[`votes/${char.id}/voters`] = {};
        });
        updates['totalVotes'] = 0;

        await firebase.database().ref().update(updates);

        // Clear local storage for all users
        localStorage.clear();

        alert('✅ All votes have been reset!');
        location.reload();

    } catch (error) {
        console.error('Error resetting votes:', error);
        alert('❌ Failed to reset votes: ' + error.message);
    }
}

// Make it globally accessible (for console use)
window.resetAllVotes = resetAllVotes;
```

### How to use:
1. Open your website
2. Open browser console (F12)
3. Type: `resetAllVotes('admin123')`
4. Press Enter
5. Confirm the reset

---

## Method 3: Direct Firebase Database Edit

### Using Firebase REST API:

```bash
# Get your database URL from Firebase Console
DATABASE_URL="https://character-voting-contest-default-rtdb.firebaseio.com"

# Reset all votes (using curl)
curl -X DELETE "${DATABASE_URL}/votes.json"
curl -X PUT "${DATABASE_URL}/totalVotes.json" -d '0'
```

### Using Firebase CLI:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Delete all data
firebase database:remove /votes --project character-voting-contest
firebase database:set /totalVotes 0 --project character-voting-contest
```

---

## Method 4: Reset for Testing (Keep Structure)

If you want to reset votes but keep the database structure:

### Firebase Console:
1. Go to **Data** tab
2. Click on each character under `votes/`
3. Click on `count` → Edit → Set to `0`
4. Click on `voters` → Delete all children
5. Set `totalVotes` to `0`

---

## 🎯 Quick Comparison

| Method | Difficulty | Speed | Best For |
|--------|-----------|-------|----------|
| Firebase Console | ⭐ Easy | 30 sec | Quick resets |
| Admin Button | ⭐⭐ Medium | 5 min setup | Frequent resets |
| REST API | ⭐⭐⭐ Hard | 2 min | Automation |
| Manual Edit | ⭐⭐ Medium | 2 min | Precise control |

---

## 🛡️ Important Notes

### Before Resetting:
- **Backup your data** if you want to keep records
- **Notify users** if the contest is live
- **Clear browser cache** after reset

### After Resetting:
- All users can vote again
- Vote counts return to 0
- Device IDs are cleared
- Results update immediately for all users

### Automatic Backup (Optional):

```javascript
// Run this BEFORE resetting to backup
async function backupVotes() {
    const snapshot = await firebase.database().ref('votes').once('value');
    const data = snapshot.val();

    // Download as JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `votes-backup-${Date.now()}.json`;
    a.click();

    console.log('✅ Backup downloaded');
}

window.backupVotes = backupVotes;
```

---

## 🚀 Recommended Workflow for Your Contest

### Before the Contest:
1. Reset all votes: `resetAllVotes('admin123')`
2. Test with a few votes
3. Reset again: `resetAllVotes('admin123')`
4. Start the contest

### During the Contest:
- Monitor votes in Firebase Console
- Watch for suspicious activity

### After the Contest:
1. Backup results: `backupVotes()`
2. Take screenshots of final results
3. Announce winner
4. Reset for next contest: `resetAllVotes('admin123')`

---

## 🔐 Security Tip

If you add the reset button code, **CHANGE THE PASSWORD** from 'admin123' to something secure:

```javascript
if (password !== 'your-secret-password-here') {
```

**Never share this password publicly!**

---

## 💡 Pro Tip: Schedule Automatic Resets

For recurring contests, you can schedule automatic resets using Firebase Cloud Functions:

```javascript
// This would require Cloud Functions (paid Firebase plan)
exports.scheduledReset = functions.pubsub
    .schedule('every monday 00:00')
    .onRun(async (context) => {
        await admin.database().ref('votes').remove();
        await admin.database().ref('totalVotes').set(0);
        console.log('Votes reset automatically');
    });
```

---

**Need help with any of these methods? Let me know!** 🎉
