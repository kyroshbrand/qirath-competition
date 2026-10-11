# All Karnataka Qirath Grand Competition 2026
### Presented by Reid & Premium – The Ultimate Groom Studio
*(Puttur • Thokkotu • B.C Road • Sullia)*

---

An ultra-premium, official state-level Quranic Recitation (Qirath) Competition platform built with an Islamic royal gold & emerald aesthetic, complete participant registration, follow-and-unlock community gate, and an **Easy-to-Manage Organizer Admin Dashboard** with direct **Supabase Database & Storage** integration.

![All Karnataka Qirath Competition](assets/hero_bg.jpg)

---

## 🌟 Key Features

### 1. Official & Eye-Catching Public Portal (`index.html`)
- **Royal Islamic Aesthetic**: Deep emerald mosque green and obsidian black marble palette, rich metallic gold accents, authentic Arabic Quranic calligraphy (`بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ`), and royal 3D emblems.
- **Presenter Branding**: Prominent Reid & Premium Groom Studio luxury identity highlighting all 4 branches (**Puttur, Thokkotu, B.C Road, Sullia**).
- **Official Competition Guidelines**: Categorization into Junior (5–12 yrs), Senior (13–18 yrs), and Open (19+ yrs), along with judging criteria (Tajweed, Husn al-Sawt, Waqf & Rhythm, Adab).
- **Streamlined 5-Step Registration**:
  1. **Participant Details**: Full Name, Age, Phone, WhatsApp, District, Address.
  2. **Nearest Branch**: One-click branch selector.
  3. **Recitation Video Upload**: Drag-and-drop video/audio upload with live video player preview.
  4. **Aadhaar Card Verification**: Clear photo upload with image preview.
  5. **Social Media Gate**: Direct links to follow Reid & Premium on Instagram & WhatsApp Channel, with screenshot upload unlocking the submit button.
- **Digital Hall Ticket / Registration Slip**: Unique registration ID generation (`AKQC-2026-XXXX`) with printable slip and one-click WhatsApp sharing.
- **Track Status**: Live search modal where participants can check their review status using their phone number or Registration ID.

### 2. "Easy to Manage" Organizer Admin Dashboard (`admin.html`)
- **Secure PIN Access**: Protected by an Organizer PIN (Password: `RP26`).
- **Live Metrics Counter**: Real-time counts for Total Registrations, Pending Reviews, Approved Entries, Shortlisted for Finale, and distribution across all 4 branches.
- **Comprehensive Filter & Search**: Search by name, registration ID, mobile, or surah. Filter by Branch, Status, and Category.
- **Interactive Review Dossier**:
  - Play recitation videos in the built-in video player.
  - Inspect Aadhaar cards with full-screen zoom.
  - Verify Instagram follow & WhatsApp channel join screenshots side-by-side.
  - Assign Judge Total Score (out of 100) and evaluation notes.
  - One-click Status update: **Approve**, **Shortlist for Grand Finale**, **Keep Pending**, or **Reject**.
  - One-click WhatsApp notification: Automatically opens WhatsApp with a pre-filled, personalized official notification message to the participant!
- **One-Click CSV / Excel Export**: Export all filtered participant data with video URLs, scores, and contacts for judges and offline tabulation.
- **Live Supabase Settings Modal**: Enter Supabase credentials right inside the browser without editing code!

---

## 🚀 Supabase Backend Setup (2 Minutes)

This project connects directly to **Supabase** for database records and file storage (videos, Aadhaar, screenshots).

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in/sign up.
2. Click **"New Project"**, pick a name (e.g., `qirath-competition`) and set a database password.

### Step 2: Run the SQL Schema
1. In your Supabase Dashboard, open the **SQL Editor** from the left sidebar.
2. Click **"New query"**.
3. Open [`supabase_schema.sql`](supabase_schema.sql) from this project, copy all its content, paste it into the SQL Editor, and click **"Run"**.
   - This automatically creates:
     - The `participants` table with indexing.
     - Row Level Security (RLS) policies for public insert and admin review.
     - Three public storage buckets: `qirath-videos`, `aadhaar-cards`, and `follow-proofs`.

### Step 3: Connect to the App
1. Go to **Project Settings &rarr; API** in your Supabase dashboard.
2. Copy your:
   - **Project URL** (e.g. `https://your-project-id.supabase.co`)
   - **Project API keys: `anon` public key** (starts with `eyJ...`)
3. Connect in either of two easy ways:
   - **Option A (In the Web UI):** Open `admin.html`, click **"⚙️ Supabase Settings"**, paste your URL and Anon Key, and click **"Save & Connect Live"**.
   - **Option B (In code):** Open [`supabase-config.js`](supabase-config.js) and paste them directly:
     ```javascript
     const SUPABASE_CONFIG = {
       url: "https://your-project-id.supabase.co",
       anonKey: "eyJhbGciOiJIUzI1NiIsIn...",
       adminPin: "RP26"
     };
     ```

> **Note on Demo Mode:** If Supabase is not connected yet, the application runs automatically in **Offline Demo Mode** using local storage with realistic sample data, so you can test everything immediately without errors!

---

## 🐙 How to Connect & Push Directly to GitHub

To push this repository to your GitHub account:

1. Open PowerShell / Terminal in this project directory:
   ```bash
   cd "c:\Users\Abdullahi Maqbool\project J"
   ```

2. Add all files and make the first commit:
   ```bash
   git add .
   git commit -m "All Karnataka Qirath Competition Official Portal & Admin Dashboard"
   ```

3. Create a new repository on [GitHub](https://github.com/new) (e.g., `qirath-competition`).

4. Link and push to your GitHub repository:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## 🌐 Free 1-Click Hosting (GitHub Pages / Vercel)

Because this web app uses pure HTML, Vanilla CSS, and modern JavaScript with client-side Supabase, it requires **zero build steps** and runs on any static host:

### Deploy on GitHub Pages:
1. In your GitHub repository, go to **Settings &rarr; Pages**.
2. Under **Build and deployment &rarr; Branch**, select `main` and `/ (root)`.
3. Click **Save**. Your site will be live at `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/` in 1 minute!

---

## 📁 Project Structure

```
project J/
├── index.html            # Main Official Public Registration & Competition Portal
├── admin.html            # Organizer Management Dashboard & Review Portal
├── styles.css            # Luxury Islamic Gold & Emerald CSS Design System
├── app.js                # Frontend Form Flow, Uploads & Hall Ticket Generator
├── admin.js              # Admin Table, Filter, Video Review, Score & CSV Exporter
├── supabase-config.js    # Supabase Client Init, Storage Uploads & Demo Fallback
├── supabase_schema.sql   # Complete Supabase PostgreSQL Schema & Storage Policies
├── assets/
│   ├── hero_bg.jpg       # Royal Islamic Grand Championship Background
│   ├── emblem.jpg        # 3D Gold Qirath Royal Competition Emblem
│   └── logo.jpg          # Reid & Premium Groom Studio Luxury Monogram Logo
└── README.md             # Complete Setup, Backend & GitHub Deployment Guide
```

---

*Presented by Reid & Premium – The Ultimate Groom Studio*  
*Puttur • Thokkotu • B.C Road • Sullia*
