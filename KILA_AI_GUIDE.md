# 🤖 Kila AI Coach - Complete Guide

## Who is Kila?

**Kila** is your AI coach that:
- 🧠 Learns your group's chat patterns
- 🗣️ Speaks Swahili and English
- ⚽ Suggests matches and tournaments
- 🎯 Responds naturally to group needs
- 💪 Motivates players to engage

**Name meaning:** "Kila" = "Every" in Swahili (representing it's in every match)

---

## 🎯 How Kila Works

### 1. **Learns Chat Flow**
Kila monitors your group and learns:
- What language you speak (Swahili, English, or mixed)
- What topics you care about (matches, tournaments, scores)
- When you're most active (peak hours)
- Who's active in the group

### 2. **Responds Naturally**
When you mention "Kila", it responds based on:
- Your group's language preference
- Recent chat topics
- Group activity patterns

### 3. **Suggests Actions**
Kila suggests what to do next:
- "Want a friendly match?" → `.request`
- "Create a tournament?" → `.tcr`
- "Record your score?" → `.pvpscores`

---

## 💬 How to Call Kila

### In Swahili:
```
"Kila, tunataka friendly match"
→ Kila hapa! 🎮 Karibu kuomba: .request

"Kila, tournament leo?"
→ Kila hapa! 🏆 Tunataka tournament? .tcr "jina" se 8

"Kila, nani anataka kucheza?"
→ Kila hapa! ⚽ Karibu kuomba friendly: .request
```

### In English:
```
"Kila, we want a friendly match"
→ Kila here! 🎮 Request one: .request

"Kila, tournament today?"
→ Kila here! 🏆 Want a tournament? .tcr "name" se 8

"Kila, who wants to play?"
→ Kila here! ⚽ Request a friendly: .request
```

### Mixed (Swahili + English):
```
"Kila, tunataka match leo"
→ Kila responds in mixed language

"Kila, tournament kwa 8 players"
→ Kila understands both languages
```

---

## 🎮 Example Conversations

### Scenario 1: Friendly Match Request
```
User: "Kila, I want a friendly match"
Kila: "Kila here! 🎮 Request a friendly match: .request"
User: ".request"
Kila: "🎮 Friendly Match Request
      Ahmed is looking for a match!
      
      👥 AI suggests active players:
      @Mohamed
      @Hassan
      @Fatima
      @Ali
      @Zainab
      
      🆔 Request ID: 1"
```

### Scenario 2: Tournament Creation
```
User: "Kila, 8 players knockout tournament"
Kila: "Kila here! 🏆 Creating tournament..."
Kila: "🏆 Spring Cup 🏆
      
      Kila here! 🎮
      
      Tournament: Knockout
      Players: 8
      
      Join now: .tj 1 "Your Squad Name""
```

### Scenario 3: Match Result
```
User: "Kila, Ahmed beat Mohamed 3:1"
Kila: "Nice! Record your result! 📊
      
      Ahmed vs Mohamed: 3:1
      
      Result recorded! 📊"
```

### Scenario 4: Quiet Group
```
[Group is quiet for 2 hours]
Kila: "Everyone! Ready to play? 🎮
      
      It's game time! ⚽
      
      💡 Request a friendly match: .request"
```

---

## 🧠 What Kila Learns

### Language Detection
```
Swahili words: karibu, kila, watu, kucheza, matokeo, leo, saa
English words: match, tournament, friendly, score, leaderboard, play

Kila learns which language your group prefers
```

### Topic Tracking
```
Topics Kila tracks:
- friendly (friendly matches)
- tournament (tournaments)
- match (general matches)
- score (recording results)
- leaderboard (rankings)
- challenge (daily challenges)
- stats (player statistics)
```

### Activity Patterns
```
Kila learns:
- Peak activity hours (when group is most active)
- Active users (who talks the most)
- Message frequency (how often group chats)
- Common interests (what topics come up)
```

---

## 🎯 Kila Commands (Indirect)

You don't call Kila directly with commands. Instead, you mention Kila and it responds:

### Mention Kila for:
```
"Kila, friendly match"
→ Suggests .request

"Kila, tournament"
→ Suggests .tcr

"Kila, score"
→ Suggests .pvpscores

"Kila, leaderboard"
→ Suggests .pvplb

"Kila, help"
→ Shows available commands
```

---

## 📊 Kila's Group Analysis

### Check Group Status
```
.kila status
→ Shows:
  - Active users count
  - Total messages
  - Language preference
  - Top topics
  - Peak activity hours
  - Suggested next action
```

### Example Output:
```
📊 Group Activity Summary

👥 Active users: 12
💬 Messages: 245
🗣️ Language: Swahili
🎯 Top topics: friendly, tournament, score
⏰ Peak hours: 18:00, 19:00, 20:00

💡 Suggestion: Request a friendly match: .request
```

---

## 🌍 Language Support

### Swahili
```
Greetings: "Kila hapa!", "Habari!", "Jambo!"
Motivations: "Karibu wote!", "Hii ni saa ya kucheza!"
Encouragements: "Sawa!", "Nzuri sana!", "Umefanya vizuri!"
```

### English
```
Greetings: "Kila here!", "Hey!", "What's up!"
Motivations: "Everyone!", "It's game time!"
Encouragements: "Nice!", "Great!", "You did great!"
```

### Mixed
```
Kila automatically switches between languages
based on what your group uses most
```

---

## 🚀 Integration Examples

### In Message Handler
```typescript
import { kilaPersonality } from './services/kila-personality';
import { chatFlowAnalyzer } from './services/chat-flow-analyzer';

// When message arrives
if (context.messageText.toLowerCase().includes('kila')) {
  const response = await kilaPersonality.processMessage({
    groupJid: context.jid,
    senderJid: context.senderJid,
    messageText: context.messageText,
    language: chatFlowAnalyzer.getGroupLanguage(context.jid)
  });
  
  if (response) {
    await waClient.sendMessage(context.jid, response);
  }
}
```

### Scheduled Engagement
```typescript
// Every 2 hours, if group is quiet
setInterval(async () => {
  const response = await kilaPersonality.engageQuietGroup(groupJid);
  await waClient.sendMessage(groupJid, response);
}, 2 * 60 * 60 * 1000);
```

### Tournament Creation
```typescript
const announcement = await kilaPersonality.respondToTournamentCreation(
  "Spring Cup",
  "se",
  8,
  language
);
await waClient.sendMessage(groupJid, announcement);
```

---

## 💡 Pro Tips

1. **Mention Kila naturally** - "Kila, we want to play" works better than ".kila command"
2. **Mix languages** - Kila understands Swahili + English mixed
3. **Let Kila learn** - The more you chat, the better Kila understands your group
4. **Use suggestions** - Kila suggests commands based on what your group needs
5. **Peak hours** - Kila knows when your group is most active

---

## 🎮 Example Group Flow

```
18:00 - Group starts chatting
Kila learns: "Group is active at 6 PM"

18:15 - Someone says "Kila, friendly match?"
Kila responds: "Kila here! 🎮 Request one: .request"

18:20 - User: ".request"
Kila: "🎮 Friendly Match Request
       AI suggests active players..."

19:00 - Group is quiet
Kila: "Everyone! Ready to play? 🎮"

19:05 - Someone says "Kila, tournament?"
Kila: "Kila here! 🏆 Create one: .tcr"

20:00 - Peak hour, lots of activity
Kila learns: "Peak hour is 8 PM"
```

---

## 🔧 Configuration

In `.env`:
```
AI_NAME=Kila
AI_PERSONALITY=friendly_coach
GEMINI_API_KEY=your_key_here
```

---

## ✨ What Makes Kila Special

✅ **Learns your group** - Understands patterns and preferences
✅ **Bilingual** - Swahili and English
✅ **Natural responses** - Feels like a real coach
✅ **Proactive** - Engages quiet groups
✅ **Helpful** - Suggests commands based on context
✅ **Friendly** - Motivates and encourages players
✅ **Smart** - Uses AI to understand intent

---

## 🎯 Next Steps

1. Add your Gemini API key to `.env`
2. Integrate Kila into message handler
3. Start mentioning "Kila" in your group
4. Watch Kila learn your group's patterns
5. Enjoy smarter, more engaging gameplay!

---

**Kila is ready to coach your group! 🏆⚽🎮**
