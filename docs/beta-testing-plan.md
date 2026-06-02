# Beta Testing Plan — v1.0

## Overview
- **Duration**: 30 days
- **Target**: 20–50 users
- **Goal**: Validate end-to-end learning experience before open launch
- **Success criteria**: 70% Day 7 retention, 50% Day 30 retention, NPS ≥ 30

## Tester Recruitment

### Profile
| Criteria | Target | Priority |
|----------|--------|----------|
| Native language | Hindi (60%), Spanish (20%), Other (20%) | High |
| English level | A1–A2 (beginner) | High |
| Age | 18–35 | Medium |
| Daily study time | ≥ 15 min/day | Medium |
| Smartphone | Android or iOS | Required |

### Sources
- Personal network referrals
- Language learning communities (Reddit r/languagelearning, Discord)
- University international student offices
- Language exchange apps (HelloTalk, Tandem)

### Onboarding Flow
1. Tester receives invite code via email
2. Opens app → enters invite code
3. Verifies email (optional for beta)
4. Grants consent (voice, data processing)
5. Completes profile (name, age, native language, goal)
6. Takes placement test (15–25 questions)
7. Receives personalized roadmap
8. Completes first guided lesson
9. Accesses conversation practice

## Testing Schedule

### Week 1: Core Experience
- [ ] Registration and onboarding
- [ ] Placement test accuracy
- [ ] Lesson generation quality
- [ ] Basic conversation (1-2 scenarios)
- [ ] Pronunciation feedback
- **Focus**: Does the basic flow work?

### Week 2: Depth
- [ ] Daily lesson streak maintenance
- [ ] Vocabulary review (SM-5)
- [ ] Multiple conversation scenarios
- [ ] Progress dashboard accuracy
- [ ] Error correction quality
- **Focus**: Does the learning loop function?

### Week 3: Reliability
- [ ] Session persistence (reconnect, continue)
- [ ] Performance under varied network conditions
- [ ] Content safety validation
- [ ] Cost tracking accuracy
- **Focus**: Does the system stay stable?

### Week 4: Polish
- [ ] Feedback collection and triage
- [ ] Bug fixes from weeks 1-3
- [ ] Performance optimization
- [ ] Final evaluation survey
- **Focus**: Is it ready for open launch?

## Data Collection

### Quantitative
| Metric | Tool | Frequency |
|--------|------|-----------|
| DAU | Monitoring dashboard | Daily |
| Lessons completed | Monitoring dashboard | Daily |
| Conversation minutes | Monitoring dashboard | Daily |
| Pronunciation score trend | Monitoring dashboard | Weekly |
| Retention (D1, D7, D30) | Monitoring dashboard | Milestone |
| Average session duration | Analytics | Weekly |
| Error rate | Error tracking | Real-time |

### Qualitative
| Data | Method | Frequency |
|------|--------|-----------|
| Bug reports | In-app feedback + form | Ongoing |
| Feature requests | In-app feedback | Ongoing |
| NPS score | Week 2 survey | Once |
| Usability issues | User interviews (5 users) | Week 2-3 |
| Lesson quality rating | In-lesson rating (1-5) | Per lesson |
| Conversation satisfaction | Post-conversation rating | Per session |

## Evaluation Survey (Week 4)

### System Usability Scale (SUS)
1. I think I would use this app frequently
2. I found the app unnecessarily complex
3. I thought the app was easy to use
4. I need support to use this app
5. The functions were well integrated
6. There was too much inconsistency
7. Most people would learn this app quickly
8. The app was very cumbersome to use
9. I felt confident using the app
10. I needed to learn a lot before starting

### Learning Outcomes
1. My English speaking confidence has improved
2. I can have simple conversations more easily
3. My pronunciation is clearer than before
4. I understand grammar concepts better
5. I have learned new vocabulary words
6. The lessons match my learning level
7. The AI tutor conversations feel natural
8. The pronunciation feedback is helpful

### Open Questions
1. What did you like most?
2. What was frustrating or confusing?
3. What feature would you add first?
4. Would you recommend this to a friend? Why/why not?
5. What would make you stop using this app?

## Communication Plan

| Frequency | Channel | Content |
|-----------|---------|---------|
| Day 1 | Email | Welcome, getting started guide |
| Day 3 | In-app | Tip: try conversation practice |
| Day 7 | Email | Week 1 summary, NPS survey |
| Day 14 | In-app | Progress milestone celebration |
| Day 21 | Email | Weekly tips, feature spotlight |
| Day 28 | Email | Final survey, thank you |
| Day 30 | Email | Beta wrap-up, next steps |

## Success Criteria

### Must-Have (Gate to Open Launch)
- [ ] Day 7 retention ≥ 70%
- [ ] Lesson completion rate ≥ 60%
- [ ] Average conversation minutes/user/day ≥ 5
- [ ] NPS ≥ 30
- [ ] Error rate < 2% (5xx)
- [ ] < 5 unresolved critical bugs

### Nice-to-Have
- [ ] Pronunciation improvement ≥ 10 points after 30 days
- [ ] DAU retention curve flattens by week 3
- [ ] > 50% of users complete placement test
- [ ] > 30% of users complete ≥ 3 conversations

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low user engagement | Medium | High | Weekly check-ins, in-app notifications |
| AI cost overrun | Low | Medium | Cost guard with daily alerts |
| AI quality issues | Medium | High | Content validation, human review queue |
| Server downtime | Low | High | Docker rollback, database backup |
| User data privacy | Low | Critical | GDPR consent, data encryption |
| Buggy initial release | Medium | Medium | Staged rollout (5 → 20 → 50 users) |
