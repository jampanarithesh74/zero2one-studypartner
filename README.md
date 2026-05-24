# ZERO2ONE — Study Partner

<p align="center">
  <b>One Destination. Endless Possibilities.</b>
</p>

<p align="center">
  A student-built academic platform designed to simplify exam preparation through handwritten notes, PYQs, PDFs, Drive backups, and fast-access study resources.
</p>

---

# Overview

ZERO2ONE is a lightweight web platform created for engineering students to access academic resources quickly and efficiently.

The platform focuses on:
- Handwritten lecture notes
- Previous year question papers (PYQs)
- Subject-wise resource organization
- Mobile-first academic access
- Fast PDF previews
- Google Drive fallback support
- Clean and distraction-free UI

Built during exam season, the project was designed to solve a real student problem:

> Finding reliable study materials quickly without searching through multiple WhatsApp groups.

---

# Features

## Academic Resource System
- Subject-wise handwritten notes
- Organized semester structure
- PYQ support
- Direct PDF viewing
- Embedded preview system
- Google Drive backup access

## Smart Fallback Architecture
If embedded PDF previews fail or become slow:
- Students can instantly open Google Drive backups
- Resource access remains uninterrupted
- Large handwritten PDFs remain accessible during heavy traffic

## Mobile-First Experience
- Responsive UI
- Optimized for phones
- Minimal scrolling distractions
- Fast navigation between subjects
- Fullscreen PDF support

## Clean UI/UX
- Black + Orange themed interface
- Minimalist academic design
- Easy-to-read subject cards
- Modern navigation system

## Performance Optimizations
- Lightweight frontend deployment
- Reduced unnecessary API calls
- Optimized resource handling
- External fallback architecture for scalability

## Planned Features
- PDF rotation controls
- Search system
- Department-wise filtering
- User contribution system
- Better analytics dashboard
- Resource recommendation engine

---

# Tech Stack

## Frontend
- React
- Vite
- Tailwind CSS
- JavaScript

## Backend & Services
- Firebase
- Supabase
- Google Drive API

## Deployment
- Vercel

---

# Architecture

ZERO2ONE uses a hybrid resource delivery system.

## Supabase
Used for:
- Some PDF previews
- Lightweight backend operations
- Resource handling
- Database utilities

## Firebase
Used for:
- Drive link metadata
- Backup resource mapping
- Lightweight scalable retrieval

## Google Drive
Used for:
- Large handwritten notes
- High-bandwidth academic PDFs
- Backup access system

This architecture helps the platform remain functional even during heavy exam traffic.

---

# Why ZERO2ONE?

Engineering students often struggle with:
- Scattered resources
- Lost notes
- Broken Drive links
- Endless WhatsApp searching
- Poor mobile accessibility

ZERO2ONE was built to centralize everything into one fast-access platform.

---

# Initial Launch Stats

Within roughly the first day of deployment:
- 800+ visitors
- 1800+ page views
- Strong organic circulation
- Active late-night exam traffic
- Heavy handwritten note usage

The platform gained traction primarily through:
- Instagram
- WhatsApp group sharing
- Student word-of-mouth

---

# Screenshots

Add your screenshots here.

Example:

```md
![Homepage](./screenshots/home.png)
![Resources](./screenshots/resources.png)
![PDF Viewer](./screenshots/viewer.png)
