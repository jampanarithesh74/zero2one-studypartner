# ZERO2ONE StudyPartner

A student-focused academic resource platform designed to simplify semester preparation through organized notes, PYQs, syllabus copies, and study materials.

🌐 Live Website:  
https://zero2one-studypartner.vercel.app

📷 Instagram:  
https://www.instagram.com/zero2one.study/

---

## 📚 Overview

ZERO2ONE StudyPartner is a lightweight and mobile-friendly academic platform built mainly for students preparing for semester exams.

The platform provides:
- Semester-wise resources
- Unit-wise notes
- PYQs (Previous Year Questions)
- Syllabus copies
- Subject materials
- Quick-access academic resources

The goal is to make exam preparation faster, cleaner, and more accessible for students.

---

# ✨ Features

- 📂 Semester-wise organization
- 📘 Unit-wise notes access
- 📄 PDF resource viewer
- 📱 Mobile responsive UI
- ⚡ Fast lightweight interface
- 📊 Visitor analytics integration
- 🔗 Google Drive fallback links
- 🛡️ Admin-controlled resource uploads
- 🎯 Designed for quick exam preparation

---

# 🧠 Current Architecture

```text
                    ┌─────────────────────┐
                    │      Students       │
                    └─────────┬───────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │ ZERO2ONE Frontend (UI) │
                 │ React + TypeScript     │
                 └─────────┬──────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼

┌───────────────────┐              ┌───────────────────┐
│ Supabase Database │              │ Supabase Storage  │
│ Metadata & Links  │              │ Optimized PDFs    │
└───────────────────┘              └───────────────────┘
         │
         ▼
┌────────────────────────┐
│ Google Drive Fallbacks │
│ Large Resource Backup  │
└────────────────────────┘
```

---

# 🛠️ Tech Stack

## Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

## Backend / Services
- Supabase
- Supabase Storage
- Vercel Deployment

## Analytics
- Vercel Analytics
- Vercel Speed Insights

---

# 📁 Resource Delivery System

The platform uses a hybrid delivery architecture:

## Primary Delivery
- Optimized PDFs served through Supabase Storage

## Fallback Delivery
- Google Drive backup links for large resources or heavy traffic periods

This helps:
- Reduce bandwidth pressure
- Improve reliability during exams
- Maintain access even under heavy traffic

---

# 🔐 Planned Features

- College-based authentication
- Student ID login system
- Multi-college support
- Admin dashboards
- Department-based management
- Resource contribution system
- Google Play Store release
- Custom domain support

---

# 📊 Project Goal

To build a scalable student academic ecosystem where students can:
- Access notes quickly
- Share quality resources
- Collaborate academically
- Prepare efficiently for exams

Built for students, by students.

---

# 🚀 Local Setup

```bash
git clone https://github.com/jampanarithesh74/zero2one-studypartner.git

cd zero2one-studypartner

npm install

npm run dev
```

---

# 📬 Contributions & Suggestions

Suggestions, feedback, and quality study resources are always welcome.

📩 Mail:
zero2onestudypartner@gmail.com

📷 Instagram:
https://www.instagram.com/zero2one.study/

---

# ⚠️ Disclaimer

Resources shared on the platform are intended purely for academic and educational purposes.

All study materials belong to their respective creators/contributors.

---

# 📈 Status

Currently active and expanding across semesters and departments.

More resources and features coming soon 🚀
