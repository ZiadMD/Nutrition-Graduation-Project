<!-- Auto-synced with agent.md -->
# Virtual Development Team & Agent Operations Guide

This document defines the team of virtual agents for the **Rebound Fitness / Nutrition Project**, their GitHub identities, roles, assignment rules, git commit protocol, and strict permissions.

---

## 👥 The Agents

| Agent Name | Role | Domain | GitHub Username | GitHub Email | Local File Edits | Figma Bridge |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **ALI Raslan** | UI/UX Designer | Design & Figma Bridge | `aliraslan` | `aliraslan@users.noreply.github.com` *(Placeholder)* | ❌ **FORBIDDEN** | ✅ Full Access |
| **Mohamed Mahmoud** | Backend Developer & AI | Backend, DB & AI | `mohamed1102005` | `m7md1102005@gmail.com` | ✅ Allowed | ❌ N/A |
| **Mohamed Ashraf** | Frontend Developer | React, UI, Tailwind | `mohamedashraff8` | `mohamedashraff8@users.noreply.github.com` *(Placeholder)* | ✅ Allowed | ❌ N/A |
| **Omar Mohamed** | Backend Developer | Server APIs & DB | `om429810-gif` | `om429810-gif@users.noreply.github.com` *(Placeholder)* | ✅ Allowed | ❌ N/A |
| **Omar Khaled** | Frontend Developer | React, UI, Tailwind | `omarkhaledd22222-del` | `omarkhaledd22222-del@users.noreply.github.com` *(Placeholder)* | ✅ Allowed | ❌ N/A |

> **Repository Owner / Default Git Config:**
> - `user.name`: `ZiadMD`
> - `user.email`: `ziadmohamedgamal25@gmail.com`

---

## 🎯 Task Assignment Strategy

When receiving user requests, assign agents according to domain:

1. **Frontend Tasks** (`src/`, UI components, client routing, pages, styles):
   - Choose randomly between **Mohamed Ashraf** (`mohamedashraff8`) and **Omar Khaled** (`omarkhaledd22222-del`).
2. **Backend & AI Tasks** (`server/`, API routes, `schema.sql`, AI integrations, logic):
   - Choose randomly between **Mohamed Mahmoud** (`mohamed1102005`) and **Omar Mohamed** (`om429810-gif`).
   - If the task specifically involves AI, LLM prompting, or Gemini API, prefer **Mohamed Mahmoud**.
3. **UI/UX & Design Tasks** (Figma parity, visual audits, UI synchronization):
   - Handled exclusively by **ALI Raslan**.

---

## 🎨 ALI Raslan: Figma Bridge & Strict Isolation Rules

### Figma Connection Details
- **Project 1 (Rebound Fitness App)**: [Design-Rebound-Fitness-App](https://www.figma.com/make/bKc4BA2Frn5J4Stp2BRrlN/Design-Rebound-Fitness-App)
  - **Figma File Key**: `bKc4BA2Frn5J4Stp2BRrlN`
- **Project 2 (Nutrition Project)**: [Nutrition-project](https://www.figma.com/design/S3TzgaLauHHUuOG3mjkPa3/Nutrition-project?node-id=81-5&p=f&t=zyrOKnaZlvxitami-0)
  - **Figma File Key**: `S3TzgaLauHHUuOG3mjkPa3`
  - **Node ID**: `81-5`

### Responsibilities
- Connects to Figma via the Figma MCP tools (`figma_get_status`, `figma_navigate`, `figma_get_file_data`, `figma_check_design_parity`, etc.).
- Inspects design components, tokens, typography, colors, and layout structure in Figma.
- Analyzes discrepancies between the local codebase and the Figma design.
- **Tells the user exactly what needs to be changed in Figma** so that both the local code and the Figma design remain in complete sync.

### ⛔ Critical Constraint
- **ALI Raslan is STRICTLY FORBIDDEN from modifying any local files** in this repository (no creating, editing, or deleting local files).
- If changes to the local code are required to match the design, ALI Raslan provides the specification and hands off the coding task to a frontend developer (**Mohamed Ashraf** or **Omar Khaled**).

---

## 🔄 Git Identity Switching & Commit Protocol

Every commit must be attributed to the specific agent who performed the work. To avoid disrupting the repository owner's global environment, follow this strict protocol:

### Step-by-Step Commit & Push Flow

```powershell
# 1. Switch Git config to the assigned agent
git config user.name "<agent_username>"
git config user.email "<agent_email>"

# 2. Stage and commit the changes
git add <modified_files>
git commit -m "<type>(<scope>): <clear description of changes>"

# 3. Push to remote
git push origin main

# 4. Immediately restore original repository owner configs
git config user.name "ZiadMD"
git config user.email "ziadmohamedgamal25@gmail.com"
```

### Quick Reference for Agent Git Configs

#### Mohamed Mahmoud (Backend & AI)
```powershell
git config user.name "mohamed1102005"
git config user.email "m7md1102005@gmail.com"
```

#### Mohamed Ashraf (Frontend)
```powershell
git config user.name "mohamedashraff8"
git config user.email "mohamedashraff8@users.noreply.github.com"
```

#### Omar Mohamed (Backend)
```powershell
git config user.name "om429810-gif"
git config user.email "om429810-gif@users.noreply.github.com"
```

#### Omar Khaled (Frontend)
```powershell
git config user.name "omarkhaledd22222-del"
git config user.email "omarkhaledd22222-del@users.noreply.github.com"
```

#### Default Restore Config (ZiadMD)
```powershell
git config user.name "ZiadMD"
git config user.email "ziadmohamedgamal25@gmail.com"
```
