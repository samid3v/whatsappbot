# AI Integration Guide - Gemini Flash

## ✅ Setup Complete

### What's Installed
- ✅ `@google/generative-ai` package
- ✅ `src/services/ai-analyzer.ts` service
- ✅ `.env` updated with `GEMINI_API_KEY`

---

## 🔑 Get Your Gemini API Key

1. Go to: https://makersuite.google.com/app/apikeys
2. Click "Create API Key"
3. Copy the key
4. Add to `.env`:
```
GEMINI_API_KEY=your_key_here
```

---

## 🎯 AI Functions Available

### 1. Detect Active Players
```typescript
const activePlayers = await aiAnalyzer.detectActivePlayers(messages, 5);
// Returns: ["player1", "player2", "player3", "player4", "player5"]
```

### 2. Parse Tournament Description
```typescript
const parsed = await aiAnalyzer.parseTournamentDescription("8 players knockout");
// Returns: { name: "Tournament", type: "se", max_players: 8 }
```

### 3. Detect Link Type
```typescript
const linkType = await aiAnalyzer.detectLinkType(url, "Check this clip");
// Returns: "allow" or "delete"
```

### 4. Generate Engagement Message
```typescript
const message = await aiAnalyzer.generateEngagementMessage("Gaming Group");
// Returns: "Karibu wote! Tunataka tournament leo? 🎮"
```

### 5. Analyze Player Activity
```typescript
const activity = await aiAnalyzer.analyzePlayerActivity(playerJid, matches);
// Returns: "Very Active", "Active", "Moderate", or "Inactive"
```

### 6. Predict Match Winner
```typescript
const prediction = await aiAnalyzer.predictMatchWinner(
  "Ahmed", player1Stats,
  "Mohamed", player2Stats
);
// Returns: "Ahmed will win! Better win rate 🎯"
```

### 7. Suggest Bracket Type
```typescript
const bracket = await aiAnalyzer.suggestBracketType(8, "competitive");
// Returns: "se", "de", or "rr"
```

### 8. Generate Tournament Announcement
```typescript
const announcement = await aiAnalyzer.generateTournamentAnnouncement(
  "Spring Cup", "se", 8
);
// Returns: "🏆 Spring Cup tournament is open! Join now! 🎮"
```

---

## 🚀 Next Steps - Commands to Update

### 1. Smart .tcr (Tournament Creation)
```typescript
// Before: .tcr "Spring Cup" se 8
// After: .tcr "8 players knockout"

registerCommand({
  name: 'tcr',
  execute: async (args, context) => {
    const { aiAnalyzer } = await import('../services/ai-analyzer');
    
    const description = args.join(' ');
    const parsed = await aiAnalyzer.parseTournamentDescription(description);
    
    const tournament = tournamentOps.create(
      parsed.name,
      parsed.type,
      1,
      parsed.max_players,
      context.senderJid
    );
    
    const announcement = await aiAnalyzer.generateTournamentAnnouncement(
      parsed.name,
      parsed.type,
      parsed.max_players || 8
    );
    
    await waClient.sendMessage(context.jid, announcement);
  }
});
```

### 2. Smart .request (AI Suggests Active Players)
```typescript
// Before: .request (shows top 5 from database)
// After: .request (AI analyzes recent chat, suggests active players)

registerCommand({
  name: 'request',
  execute: async (args, context) => {
    const { aiAnalyzer } = await import('../services/ai-analyzer');
    const { friendlyRequestManager } = await import('../services/friendly-request');
    
    // Get recent messages from group
    const recentMessages = await getGroupMessages(context.jid, 50);
    
    // AI detects active players
    const activePlayers = await aiAnalyzer.detectActivePlayers(recentMessages, 5);
    
    // Create request
    const requestId = friendlyRequestManager.createRequest(context.senderJid, context.jid);
    
    let message = `🎮 *Friendly Match Request*\n\n`;
    message += `${requesterName} is looking for a match!\n\n`;
    message += `👥 AI suggests active players:\n`;
    for (const player of activePlayers) {
      message += `  @${player}\n`;
    }
    message += `\n🆔 Request ID: ${requestId}`;
    
    await waClient.sendMessage(context.jid, message);
  }
});
```

### 3. Smart Link Detection
```typescript
// In message handler - detect and allow/delete links

if (context.hasLink) {
  const { aiAnalyzer } = await import('../services/ai-analyzer');
  
  const linkType = await aiAnalyzer.detectLinkType(
    context.linkUrl,
    context.messageText
  );
  
  if (linkType === 'delete') {
    // Delete spam link
    await waClient.deleteMessage(context.messageId);
    await waClient.sendMessage(context.jid, 
      `⚠️ Spam link removed`
    );
  }
  // else allow it (stream links, game clips, etc)
}
```

### 4. AI Group Engagement (Scheduled)
```typescript
// In index.ts - every 2 hours, if group is quiet

setInterval(async () => {
  const { aiAnalyzer } = await import('./services/ai-analyzer');
  
  // Check if group is quiet (less than 5 messages in last hour)
  const recentMessages = await getGroupMessages(groupJid, 5);
  
  if (recentMessages.length < 5) {
    // Group is quiet - send engagement message
    const message = await aiAnalyzer.generateEngagementMessage(groupName);
    await waClient.sendMessage(groupJid, message);
  }
}, 2 * 60 * 60 * 1000); // Every 2 hours
```

---

## 📊 Cost

**Gemini Flash Free Tier:**
- 15 requests per minute
- 1,500 requests per day
- Completely free

**Your usage estimate:**
- Activity detection: 1-2 per day
- Link detection: 5-10 per day
- Tournament parsing: 2-3 per day
- Engagement: 1 per day
- **Total: ~15 per day = WELL WITHIN FREE TIER**

---

## 🧪 Test the AI Service

```typescript
// Quick test in your code
import { aiAnalyzer } from './services/ai-analyzer';

// Test 1: Parse tournament
const parsed = await aiAnalyzer.parseTournamentDescription("8 players knockout");
console.log(parsed); // Should output: { name: "Tournament", type: "se", max_players: 8 }

// Test 2: Generate message
const msg = await aiAnalyzer.generateEngagementMessage("Gaming Group");
console.log(msg); // Should output Swahili message

// Test 3: Detect link
const linkType = await aiAnalyzer.detectLinkType("https://youtube.com/watch?v=xxx", "Check this clip");
console.log(linkType); // Should output: "allow"
```

---

## 🎯 Implementation Priority

1. **Smart .tcr** - Easiest, biggest impact
2. **Smart .request** - Needs message history
3. **Link detection** - Needs message handler update
4. **Group engagement** - Scheduled task

---

## ⚠️ Important Notes

- AI responses are cached for 5 minutes (Gemini feature)
- Always wrap in try-catch for error handling
- Test with your Gemini API key first
- Swahili support is built-in to Gemini Flash

---

## 📝 Next: Which command should we update first?

1. `.tcr` - Natural language tournament creation
2. `.request` - AI suggests active players
3. Link detection - Smart spam filtering
4. Group engagement - AI keeps group active

**Recommendation: Start with `.tcr` - it's the easiest and most impactful!**
