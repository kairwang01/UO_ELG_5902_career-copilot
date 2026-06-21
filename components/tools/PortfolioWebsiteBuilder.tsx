import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Globe, Sparkles } from 'lucide-react';
import { generatePortfolioWebsite, generateProfessionalHeadshot } from '../../services/aiClient';
import type { PortfolioWebsiteResult, PortfolioContent, SkillBridgeProject, UserProfile } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { useToast } from '../Toast';
import { ToolError } from './ToolUtils';
import type { AppSession as Session } from '../../lib/data';
import {
  deletePortfolioDraft,
  loadPortfolioDraft,
  portfolioDraftResumeFingerprint,
  savePortfolioDraft,
  type PortfolioDraftDetails,
  type PortfolioDraftInput,
  type PortfolioDraftProject,
} from '../../services/portfolioDraft';

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Portfolio</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root { --primary: #2563eb; --secondary: #64748b; --dark: #1e293b; --light: #f8fafc; --accent: #f97316; --transition: all 0.3s ease; --surface-card: white; --header-bg: rgba(255, 255, 255, 0.95); }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        html { scroll-behavior: smooth; }
        body { background-color: var(--light); color: var(--dark); line-height: 1.6; }
        .container { width: 90%; max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        section { padding: 80px 0; }
        .section-title { text-align: center; margin-bottom: 50px; position: relative; }
        .section-title h2 { font-size: 2.5rem; color: var(--dark); margin-bottom: 15px; }
        .section-title::after { content: ''; position: absolute; width: 80px; height: 4px; background-color: var(--primary); bottom: -10px; left: 50%; transform: translateX(-50%); }
        .btn { display: inline-block; padding: 12px 28px; background-color: var(--primary); color: white; border-radius: 5px; text-decoration: none; font-weight: 600; transition: var(--transition); border: none; cursor: pointer; }
        .btn:hover { background-color: var(--dark); transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1); }
        header { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; background-color: var(--header-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 15px 0; }
        nav { display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.8rem; font-weight: 700; color: var(--primary); }
        .logo span { color: var(--accent); }
        .nav-links { display: flex; list-style: none; }
        .nav-links li { margin-left: 30px; }
        .nav-links a { text-decoration: none; color: var(--dark); font-weight: 500; transition: var(--transition); }
        .nav-links a:hover { color: var(--primary); }
        .menu-btn { display: none; font-size: 1.5rem; cursor: pointer; color: var(--dark); }
        .hero { padding-top: 150px; padding-bottom: 80px; display: flex; align-items: center; min-height: 100vh; }
        .hero .container > div { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 30px; }
        .hero-content { flex: 1; }
        .hero-content h1 { font-size: 3.5rem; margin-bottom: 20px; color: var(--dark); }
        .hero-content h1 span { color: var(--primary); }
        .hero-content p { font-size: 1.2rem; margin-bottom: 30px; color: var(--secondary); max-width: 500px; }
        .hero-image { flex: 1; text-align: center; max-width: 400px; }
        .profile-img { width: 350px; height: 350px; border-radius: 50%; object-fit: cover; border: 5px solid var(--primary); box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1); }
        .social-icons { margin-top: 20px; }
        .social-icons a { display: inline-block; width: 40px; height: 40px; background-color: var(--primary); color: white; border-radius: 50%; line-height: 40px; text-align: center; margin-right: 10px; transition: var(--transition); font-size: 1rem; }
        .social-icons a:hover { background-color: var(--accent); transform: translateY(-5px); }
        .about-content { display: flex; align-items: center; gap: 50px; }
        .about-text { width: 100%; }
        .about-text h3 { font-size: 2rem; margin-bottom: 20px; color: var(--dark); }
        .about-text p { margin-bottom: 15px; color: var(--secondary); }
        .skills-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 30px; }
        .skill { background-color: var(--surface-card, white); padding: 30px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05); transition: var(--transition); text-align: center; }
        .skill:hover { transform: translateY(-10px); box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1); }
        .skill i { font-size: 2.5rem; color: var(--primary); margin-bottom: 20px; }
        .skill h3 { font-size: 1.5rem; margin-bottom: 15px; color: var(--dark); }
        .skill p { color: var(--secondary); }
        .portfolio-filter { display: flex; justify-content: center; margin-bottom: 30px; flex-wrap: wrap; }
        .filter-btn { padding: 8px 20px; background-color: var(--surface-card, white); color: var(--dark); border: 1px solid #ddd; margin: 5px; cursor: pointer; border-radius: 5px; transition: var(--transition); font-weight: 500; }
        .filter-btn.active, .filter-btn:hover { background-color: var(--primary); color: white; border-color: var(--primary); }
        .portfolio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; }
        .portfolio-item { position: relative; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); height: 250px; }
        .portfolio-item img { width: 100%; height: 100%; object-fit: cover; transition: var(--transition); }
        .portfolio-item:hover img { transform: scale(1.1); }
        .portfolio-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(37, 99, 235, 0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transition: var(--transition); padding: 20px; text-align: center; }
        .portfolio-item:hover .portfolio-overlay { opacity: 1; }
        .portfolio-overlay h3 { color: white; font-size: 1.5rem; margin-bottom: 10px; }
        .portfolio-overlay p { color: rgba(255, 255, 255, 0.9); }
        .timeline { position: relative; max-width: 800px; margin: 0 auto; }
        .timeline::after { content: ''; position: absolute; width: 6px; background-color: #e2e8f0; top: 0; bottom: 0; left: 50%; margin-left: -3px; border-radius: 3px; }
        .timeline-item { position: relative; width: 50%; margin-bottom: 50px; }
        .timeline-item::after { content: ''; position: absolute; width: 20px; height: 20px; background-color: var(--surface-card, white); border: 4px solid var(--primary); top: 15px; border-radius: 50%; z-index: 1; }
        .timeline-item:nth-child(odd) { left: 0; padding-right: 50px; text-align: right; }
        .timeline-item:nth-child(odd)::after { right: -10px; }
        .timeline-item:nth-child(even) { left: 50%; padding-left: 50px; }
        .timeline-item:nth-child(even)::after { left: -10px; }
        .timeline-content { padding: 20px; background-color: var(--surface-card, white); border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
        .timeline-date { font-weight: 600; color: var(--primary); margin-bottom: 10px; font-size: 0.9rem; }
        .timeline-content h3 { margin-bottom: 5px; font-size: 1.2rem; color: var(--dark); }
        .timeline-content h3 + p { font-style: italic; color: var(--secondary); margin-bottom: 10px; font-size: 1rem; }
        .contact-container { display: grid; grid-template-columns: 1fr 1.5fr; gap: 50px; align-items: flex-start; }
        .contact-info { display: flex; flex-direction: column; }
        .contact-item { display: flex; align-items: flex-start; margin-bottom: 25px; }
        .contact-item i { font-size: 1.5rem; color: var(--primary); margin-right: 15px; width: 30px; text-align: center; }
        .contact-text h3 { margin-bottom: 5px; color: var(--dark); }
        .contact-text p { color: var(--secondary); }
        .contact-form { background-color: var(--surface-card, white); padding: 30px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05); }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: var(--dark); }
        .form-control { width: 100%; padding: 12px 15px; border: 1px solid #ddd; border-radius: 5px; font-size: 1rem; background-color: var(--light); color: var(--dark); }
        textarea.form-control { min-height: 150px; resize: vertical; }
        footer { background-color: var(--dark); color: white; padding: 50px 0 20px; text-align: center; }
        .footer-content { margin-bottom: 30px; }
        .footer-content h2 { font-size: 2rem; margin-bottom: 20px; }
        .footer-content p { max-width: 600px; margin: 0 auto 30px; }
        .copyright { padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.9rem; color: var(--secondary); }
        @media (max-width: 992px) {
            .hero .container > div { flex-direction: column-reverse; text-align: center; }
            .hero-content { padding-right: 0; margin-top: 40px; }
            .hero-content p { margin-left: auto; margin-right: auto; }
            .profile-img { width: 280px; height: 280px; }
            .timeline::after { left: 15px; }
            .timeline-item { width: 100%; padding-left: 50px; padding-right: 0; text-align: left !important; }
            .timeline-item:nth-child(even) { left: 0; }
            .timeline-item::after { left: 5px !important; }
            .contact-container { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
            .menu-btn { display: block; }
            .nav-links { position: fixed; top: 75px; left: -100%; width: 100%; height: calc(100vh - 75px); background-color: var(--light); flex-direction: column; align-items: center; justify-content: center; transition: var(--transition); }
            .nav-links.active { left: 0; }
            .nav-links li { margin: 15px 0; }
            .hero-content h1 { font-size: 2.5rem; }
            .section-title h2 { font-size: 2rem; }
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <nav>
                <div class="logo">Port<span>folio</span></div>
                <ul class="nav-links">
                    <li><a href="#home">Home</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#skills">Skills</a></li>
                    <li><a href="#portfolio">Portfolio</a></li>
                    <li><a href="#experience">Experience</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
                <div class="menu-btn"><i class="fas fa-bars"></i></div>
            </nav>
        </div>
    </header>

    <section id="home" class="hero">
        <div class="container">
            <div>
                <div class="hero-content">
                    <h1>Hi, I'm <span>Alex Johnson</span></h1>
                    <p>A passionate UI/UX Designer.</p>
                    <a href="#contact" class="btn">Get In Touch</a>
                    <div class="social-icons">
                        <!-- SOCIAL ICONS - HERO -->
                    </div>
                </div>
                <div class="hero-image">
                    <img src="PROFILE_IMAGE_SRC" alt="Profile Image" class="profile-img">
                </div>
            </div>
        </div>
    </section>

    <section id="about" class="about">
        <div class="container">
            <div class="section-title"><h2>About Me</h2></div>
            <div class="about-content">
                <div class="about-text">
                    <!-- BIO -->
                    <!-- PROFILE CTA -->
                </div>
            </div>
        </div>
    </section>

    <section id="skills" class="skills">
        <div class="container">
            <div class="section-title"><h2>My Skills</h2></div>
            <div class="skills-container">
                <!-- SKILLS -->
            </div>
        </div>
    </section>

    <section id="portfolio" class="portfolio">
        <div class="container">
            <div class="section-title"><h2>My Portfolio</h2></div>
            <div class="portfolio-filter">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="web">Web</button>
                <button class="filter-btn" data-filter="app">App</button>
                <button class="filter-btn" data-filter="branding">Branding</button>
            </div>
            <div class="portfolio-grid">
                <!-- PORTFOLIO ITEMS -->
            </div>
        </div>
    </section>

    <section id="experience" class="experience">
        <div class="container">
            <div class="section-title"><h2>Work Experience</h2></div>
            <div class="timeline">
                <!-- EXPERIENCE -->
            </div>
        </div>
    </section>

    <section id="contact" class="contact">
        <div class="container">
            <div class="section-title"><h2>Get In Touch</h2></div>
            <div class="contact-container">
                <div class="contact-info">
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <div class="contact-text">
                            <h3>Email</h3>
                            <p><!-- EMAIL --></p>
                        </div>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <div class="contact-text">
                            <h3>Phone</h3>
                            <p><!-- PHONE --></p>
                        </div>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div class="contact-text">
                            <h3>Location</h3>
                            <p><!-- LOCATION --></p>
                        </div>
                    </div>
                </div>
                <div class="contact-form">
                    <form>
                        <div class="form-group"><label for="name">Your Name</label><input type="text" id="name" class="form-control" placeholder="Enter your name"></div>
                        <div class="form-group"><label for="email">Your Email</label><input type="email" id="email" class="form-control" placeholder="Enter your email"></div>
                        <div class="form-group"><label for="subject">Subject</label><input type="text" id="subject" class="form-control" placeholder="Enter subject"></div>
                        <div class="form-group"><label for="message">Your Message</label><textarea id="message" class="form-control" placeholder="Enter your message"></textarea></div>
                        <a href="mailto:email@example.com" class="btn">Send Message</a>
                    </form>
                </div>
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="social-icons">
                    <!-- SOCIAL ICONS - FOOTER -->
                </div>
            </div>
            <div class="copyright"><p>&copy; 2023 Alex Johnson. All Rights Reserved.</p></div>
        </div>
    </footer>

    <script>
        const menuBtn = document.querySelector('.menu-btn');
        const navLinks = document.querySelector('.nav-links');
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', () => { navLinks.classList.toggle('active'); });
        }
        
        const filterBtns = document.querySelectorAll('.filter-btn');
        if (filterBtns.length > 0) {
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const filterValue = btn.getAttribute('data-filter');
                    document.querySelectorAll('.portfolio-item').forEach(item => {
                        const itemCategory = item.getAttribute('data-category');
                        if (filterValue === 'all' || itemCategory === filterValue) {
                            item.style.display = 'block';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            });
        }

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({ top: targetElement.offsetTop - 70, behavior: 'smooth' });
                    if (navLinks && navLinks.classList.contains('active')) { navLinks.classList.remove('active'); }
                }
            });
        });
    </script>
</body>
</html>
`;


const PORTFOLIO_TEMPLATES = [
  { key: 'sapphire', name: 'Sapphire', description: 'Professional & Corporate', colors: ['#2563eb', '#dbeafe', '#1e3a8a', '#93c5fd'] },
  { key: 'onyx', name: 'Onyx', description: 'Modern & Sleek Dark', colors: ['#3b82f6', '#111827', '#f3f4f6', '#374151'] },
  { key: 'quartz', name: 'Quartz', description: 'Clean & Minimalist Light', colors: ['#1f2937', '#ffffff', '#f9fafb', '#e5e7eb'] },
  { key: 'emerald', name: 'Emerald', description: 'Creative & Natural', colors: ['#10b981', '#f0fdf4', '#14532d', '#a7f3d0'] },
  { key: 'jasper', name: 'Jasper', description: 'Academic & Earthy', colors: ['#c2410c', '#fff7ed', '#7c2d12', '#fdba74'] },
];

const THEME_VARS: { [key: string]: { [key: string]: string } } = {
    sapphire: { '--primary': '#2563eb', '--secondary': '#64748b', '--dark': '#1e293b', '--light': '#f8fafc', '--accent': '#f97316', '--surface-card': '#ffffff', '--header-bg': 'rgba(248, 250, 252, 0.9)' },
    onyx: { '--primary': '#3b82f6', '--secondary': '#9ca3af', '--dark': '#f3f4f6', '--light': '#111827', '--accent': '#60a5fa', '--surface-card': '#1f2937', '--header-bg': 'rgba(17, 24, 39, 0.9)' },
    quartz: { '--primary': '#1f2937', '--secondary': '#6b7280', '--dark': '#111827', '--light': '#ffffff', '--accent': '#4b5563', '--surface-card': '#f9fafb', '--header-bg': 'rgba(255, 255, 255, 0.9)' },
    emerald: { '--primary': '#10b981', '--secondary': '#065f46', '--dark': '#064e3b', '--light': '#f0fdf4', '--accent': '#059669', '--surface-card': '#ffffff', '--header-bg': 'rgba(240, 253, 244, 0.9)' },
    jasper: { '--primary': '#c2410c', '--secondary': '#7c2d12', '--dark': '#431407', '--light': '#fff7ed', '--accent': '#9a3412', '--surface-card': '#ffffff', '--header-bg': 'rgba(255, 247, 237, 0.9)' },
};

const PREVIEW_SIZES: { [key: string]: string } = { desktop: '100%', tablet: '768px', mobile: '375px' };

interface HeadshotImage {
    mimeType: string;
    data: string;
}

interface Project {
  id: number;
  title: string;
  description: string;
  url: string;
  category: string;
  image?: HeadshotImage;
}

const compact = (value: string | null | undefined): string => value?.trim().replace(/\s+/g, ' ') ?? '';

const truncate = (value: string, maxLength: number): string => {
    const text = compact(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
};

const isBlankProject = (project: Project): boolean =>
    !compact(project.title) && !compact(project.description) && !compact(project.url);

const DEFAULT_PROJECT: Project = { id: 1, title: '', description: '', url: '', category: 'Web' };

const toDraftProject = (project: Project): PortfolioDraftProject => ({
    title: project.title,
    description: project.description,
    url: project.url,
    category: project.category,
});

const fromDraftProject = (project: PortfolioDraftProject, index: number): Project => ({
    id: Date.now() + index,
    title: project.title,
    description: project.description,
    url: project.url,
    category: project.category || 'Web',
});

const buildDraftSnapshot = (
    resumeFingerprint: string,
    content: PortfolioContent | null,
    details: PortfolioDraftDetails,
    projects: Project[],
): PortfolioDraftInput => ({
    resume_fingerprint: resumeFingerprint,
    content,
    details: {
        tagline: details.tagline,
        bio: details.bio,
        theme: details.theme,
    },
    projects: projects.map(toDraftProject),
});

const isMeaningfulDraft = (draft: PortfolioDraftInput): boolean => (
    Boolean(draft.content) ||
    Boolean(compact(draft.details.tagline)) ||
    Boolean(compact(draft.details.bio)) ||
    draft.projects.some(project => compact(project.title) || compact(project.description) || compact(project.url))
);

const serializeDraftSnapshot = (draft: PortfolioDraftInput): string => JSON.stringify(draft);

const buildTaglineFromContent = (content: PortfolioContent): string => {
    const currentRole = compact(content.experience?.[0]?.title);
    const categories = (content.skills ?? [])
        .map(skill => compact(skill.category))
        .filter(Boolean)
        .slice(0, 2);
    const base = currentRole || categories[0] || 'Professional Portfolio';
    const extras = categories.filter(category => category.toLowerCase() !== base.toLowerCase());
    return truncate([base, ...extras].join(' | '), 140);
};

const buildBioFromContent = (content: PortfolioContent): string => {
    const name = compact(content.fullName) || 'This professional';
    const recent = content.experience?.[0];
    const role = compact(recent?.title);
    const company = compact(recent?.company);
    const location = compact(content.contactLocation);
    const skillCategories = (content.skills ?? [])
        .map(skill => compact(skill.category))
        .filter(Boolean)
        .slice(0, 3);
    const strongestSkill = compact(content.skills?.[0]?.description);
    const strongestExperience = compact(recent?.description);

    const sentences = [
        role
            ? `${name} is a ${role}${company ? ` with experience at ${company}` : ''}${location ? `, based in ${location}` : ''}.`
            : `${name} brings a professional background${location ? ` based in ${location}` : ''}.`,
        skillCategories.length > 0 ? `Their work spans ${skillCategories.join(', ')}.` : '',
        strongestSkill || strongestExperience,
    ].filter(Boolean);

    return truncate(sentences.join(' '), 700);
};

const buildProjectsFromContent = (content: PortfolioContent): Project[] => {
    const explicitProjects = (content.projects ?? [])
        .filter(project => compact(project.title) || compact(project.description))
        .slice(0, 4)
        .map((project, index) => ({
            id: Date.now() + index,
            title: truncate(compact(project.title), 120),
            description: truncate(compact(project.description), 420),
            url: compact(project.url),
            category: truncate(compact(project.category) || 'Project', 60),
        }));

    if (explicitProjects.length > 0) return explicitProjects;

    const fromExperience = (content.experience ?? [])
        .filter(exp => compact(exp.title) || compact(exp.description))
        .slice(0, 3)
        .map((exp, index) => ({
            id: Date.now() + index,
            title: truncate([compact(exp.title), compact(exp.company)].filter(Boolean).join(' at '), 120),
            description: truncate(compact(exp.description), 420),
            url: '',
            category: 'Experience',
        }));

    if (fromExperience.length > 0) return fromExperience;

    const fromSkills = (content.skills ?? [])
        .filter(skill => compact(skill.category) || compact(skill.description))
        .slice(0, 3)
        .map((skill, index) => ({
            id: Date.now() + index,
            title: truncate(compact(skill.category), 120),
            description: truncate(compact(skill.description), 420),
            url: '',
            category: 'Skill Area',
        }));

    return fromSkills.length > 0
        ? fromSkills
        : [{ id: Date.now(), title: '', description: '', url: '', category: 'Web' }];
};

const resizeImage = (file: File, maxSize: number): Promise<{ mimeType: string; data: string; }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target?.result) return reject(new Error("FileReader error"));
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context'));
                
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                const base64Data = dataUrl.split(',')[1];
                if (base64Data) {
                    resolve({ mimeType: 'image/jpeg', data: base64Data });
                } else {
                    reject(new Error('Could not convert canvas to base64'));
                }
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result as string;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

interface BuildHtmlProps {
    content: PortfolioContent;
    branding: { tagline: string; bio: string; };
    projects: Project[];
    headshot: HeadshotImage | null;
}

// Helper functions for security
const escapeHtml = (unsafe: string | null | undefined): string => {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const escapeAttr = (unsafe: string | null | undefined): string => {
    if (!unsafe) return '';
    return escapeHtml(unsafe);
};

const normalizeExternalUrl = (unsafe: string | null | undefined): string => {
    const value = unsafe?.trim();
    if (!value) return '';
    if (/^(javascript|data|vbscript):/i.test(value)) return '';
    if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
    if (/^(www\.|[a-z0-9.-]+\.[a-z]{2,})(\/.*)?$/i.test(value)) return `https://${value}`;
    return '';
};

const buildInitialsAvatarDataUrl = (content: PortfolioContent): string => {
    const initials = `${content.firstName?.[0] ?? ''}${content.lastName?.[0] ?? ''}`.toUpperCase() || 'ME';
    const safeInitials = escapeHtml(initials);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" viewBox="0 0 350 350"><rect width="350" height="350" rx="175" fill="#2563eb"/><circle cx="175" cy="175" r="150" fill="#1d4ed8"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="96" font-weight="700" fill="#f8fafc">${safeInitials}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const buildProjectPlaceholderDataUrl = (project: Project): string => {
    const title = escapeHtml(project.title || project.category || 'Project');
    const category = escapeHtml(project.category || 'Portfolio item');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" rx="24" fill="#f8fafc"/><rect x="28" y="28" width="544" height="344" rx="18" fill="#e2e8f0"/><rect x="72" y="86" width="456" height="24" rx="12" fill="#2563eb"/><rect x="72" y="140" width="280" height="18" rx="9" fill="#64748b"/><text x="72" y="232" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="#0f172a">${title}</text><text x="72" y="282" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#475569">${category}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const buildHtml = ({ content, branding, projects, headshot }: BuildHtmlProps): string => {
    let html = HTML_TEMPLATE;
    
    // Simple text replacements
    html = html.replace(/Alex Johnson/g, escapeHtml(content.fullName));
    html = html.replace(/Port<span>folio<\/span>/g, `${escapeHtml(content.firstName)}<span>${escapeHtml(content.lastName)}</span>`);
    html = html.replace(/A passionate UI\/UX Designer./g, escapeHtml(branding.tagline));
    
    // Bio with newlines
    const escapedBio = escapeHtml(branding.bio);
    html = html.replace('<!-- BIO -->', `<p>${escapedBio.replace(/\n/g, '</p><p>')}</p>`);

    const linkedinUrl = normalizeExternalUrl(content.socials?.linkedin);
    html = html.replace(
        '<!-- PROFILE CTA -->',
        linkedinUrl
            ? `<a href="${escapeAttr(linkedinUrl)}" target="_blank" rel="noopener noreferrer" class="btn">View Profile on LinkedIn</a>`
            : ''
    );

    html = html.replace('<!-- EMAIL -->', escapeHtml(content.contactEmail || 'N/A'));
    html = html.replace('<a href="mailto:email@example.com" class="btn">Send Message</a>', `<a href="mailto:${escapeAttr(content.contactEmail)}" class="btn">Send Message</a>`);
    html = html.replace('<!-- PHONE -->', escapeHtml(content.contactPhone || 'N/A'));
    html = html.replace('<!-- LOCATION -->', escapeHtml(content.contactLocation || 'N/A'));
    html = html.replace(/&copy; \d{4} Alex Johnson/g, `&copy; ${new Date().getFullYear()} ${escapeHtml(content.fullName)}`);

    // Headshot
    const headshotSrc = headshot ? `data:${headshot.mimeType};base64,${headshot.data}` : buildInitialsAvatarDataUrl(content);
    html = html.replace('PROFILE_IMAGE_SRC', escapeAttr(headshotSrc));
    html = html.replace('alt="Profile Image"', `alt="${escapeAttr(`Profile image of ${content.fullName}`)}"`);

    // Social Icons
    const githubUrl = normalizeExternalUrl(content.socials?.github);
    const twitterUrl = normalizeExternalUrl(content.socials?.twitter);
    const socialIconsHtml = `
        ${linkedinUrl ? `<a href="${escapeAttr(linkedinUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-linkedin-in"></i></a>` : ''}
        ${githubUrl ? `<a href="${escapeAttr(githubUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i></a>` : ''}
        ${twitterUrl ? `<a href="${escapeAttr(twitterUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-twitter"></i></a>` : ''}
    `;
    html = html.replace('<!-- SOCIAL ICONS - HERO -->', socialIconsHtml);
    html = html.replace('<!-- SOCIAL ICONS - FOOTER -->', socialIconsHtml);

    // Skills
    const skillsHtml = content.skills.map(skill => `
        <div class="skill">
            <i class="${escapeAttr(skill.icon || 'fas fa-star')}"></i>
            <h3>${escapeHtml(skill.category)}</h3>
            <p>${escapeHtml(skill.description)}</p>
        </div>`).join('');
    html = html.replace('<!-- SKILLS -->', skillsHtml);

    // Experience
    const experienceHtml = content.experience.map(exp => `
        <div class="timeline-item">
            <div class="timeline-content">
                <div class="timeline-date">${escapeHtml(exp.date)}</div>
                <h3>${escapeHtml(exp.title)}</h3>
                <p>${escapeHtml(exp.company)}</p>
                <p>${escapeHtml(exp.description)}</p>
            </div>
        </div>`).join('');
    html = html.replace('<!-- EXPERIENCE -->', experienceHtml);

    // Projects
    const projectsHtml = projects.map(p => {
        const projectImageSrc = p.image ? `data:${p.image.mimeType};base64,${p.image.data}` : buildProjectPlaceholderDataUrl(p);
        const categorySlug = escapeAttr(p.category?.toLowerCase().trim().replace(/\s+/g, '-')) || 'web';
        const projectUrl = normalizeExternalUrl(p.url);
        const projectHref = projectUrl || '#portfolio';
        const projectTarget = projectUrl ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `
            <div class="portfolio-item" data-category="${categorySlug}">
                <a href="${escapeAttr(projectHref)}"${projectTarget} class="portfolio-overlay">
                    <h3>${escapeHtml(p.title)}</h3>
                    <p>${escapeHtml(p.description.substring(0, 100))}</p>
                </a>
                <img src="${escapeAttr(projectImageSrc)}" alt="${escapeAttr(p.title)}">
            </div>`;
    }).join('');
    html = html.replace('<!-- PORTFOLIO ITEMS -->', projectsHtml);
    
    // Dynamic Filter Buttons
    const categories = [...new Set(projects.map(p => p.category).filter(Boolean))];
    const filterButtonsHtml = `
        <button class="filter-btn active" data-filter="all">All</button>
        ${categories.map(cat => {
            const catSlug = escapeAttr(cat.toLowerCase().trim().replace(/\s+/g, '-'));
            return `<button class="filter-btn" data-filter="${catSlug}">${escapeHtml(cat)}</button>`;
        }).join('')}
    `;
    html = html.replace(/<div class="portfolio-filter">[\s\S]*?<\/div>/, `<div class="portfolio-filter">${filterButtonsHtml}</div>`);

    return html;
};

interface PortfolioWebsiteBuilderProps {
  resumeText: string;
  initialInput?: string;
  profile?: UserProfile | null;
  session?: Session | null;
  t: (key: string) => string;
}

const PortfolioWebsiteBuilder: React.FC<PortfolioWebsiteBuilderProps> = ({ resumeText, initialInput, profile, session, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioWebsiteResult | null>(null);
  const [portfolioContent, setPortfolioContent] = useState<PortfolioContent | null>(null);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  
  const [currentStep, setCurrentStep] = useState<'template' | 'details' | 'result'>('template');
  const [details, setDetails] = useState({ tagline: '', bio: '', theme: 'sapphire' });
  const [projects, setProjects] = useState<Project[]>([DEFAULT_PROJECT]);
  
  const [headshotStep, setHeadshotStep] = useState<'initial' | 'camera' | 'photo_uploaded' | 'generating' | 'generated' | 'final_selected'>('initial');
  // Headshot failures get their own state so the message shows next to the
  // headshot card instead of at the bottom of the long details form.
  const [headshotError, setHeadshotError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<HeadshotImage | null>(null);
  const [generatedImages, setGeneratedImages] = useState<HeadshotImage[]>([]);
  const [selectedHeadshot, setSelectedHeadshot] = useState<HeadshotImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const autoFillRunRef = useRef(0);
  const headshotRunRef = useRef(0);
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDraftRef = useRef('');
  const resumeFingerprint = useMemo(() => portfolioDraftResumeFingerprint(resumeText), [resumeText]);

  useEffect(() => () => {
    mountedRef.current = false;
    autoFillRunRef.current++;
    headshotRunRef.current++;
    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
  }, []);

  useEffect(() => {
    setPortfolioContent(null);
    setDetails(prev => ({ tagline: '', bio: '', theme: prev.theme }));
    setProjects([DEFAULT_PROJECT]);
    setResult(null);
    setCurrentStep('template');
    setDraftHydrated(false);
    lastSavedDraftRef.current = '';
  }, [resumeFingerprint]);

  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;

    if (!uid || !resumeText.trim()) {
      setDraftHydrated(true);
      setDraftStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    setDraftStatus('loading');
    loadPortfolioDraft(uid)
      .then((draft) => {
        if (cancelled) return;

        if (draft && draft.resume_fingerprint === resumeFingerprint) {
          setPortfolioContent(draft.content);
          setDetails(draft.details);
          setProjects(draft.projects.length > 0 ? draft.projects.map(fromDraftProject) : [DEFAULT_PROJECT]);
          setCurrentStep('details');
          lastSavedDraftRef.current = serializeDraftSnapshot({
            resume_fingerprint: draft.resume_fingerprint,
            content: draft.content,
            details: draft.details,
            projects: draft.projects,
          });
          setDraftStatus('saved');
        } else {
          setDraftStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setDraftStatus('error');
      })
      .finally(() => {
        if (!cancelled) setDraftHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [resumeFingerprint, resumeText, session?.user?.id]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!draftHydrated || !uid || !resumeText.trim()) return undefined;

    const draft = buildDraftSnapshot(resumeFingerprint, portfolioContent, details, projects);
    if (!isMeaningfulDraft(draft)) return undefined;

    const serializedDraft = serializeDraftSnapshot(draft);
    if (serializedDraft === lastSavedDraftRef.current) return undefined;

    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    setDraftStatus('saving');
    let cancelled = false;
    saveDraftTimerRef.current = setTimeout(() => {
      savePortfolioDraft(uid, draft)
        .then(() => {
          if (cancelled || !mountedRef.current) return;
          lastSavedDraftRef.current = serializedDraft;
          setDraftStatus('saved');
        })
        .catch(() => {
          if (!cancelled && mountedRef.current) setDraftStatus('error');
        });
    }, 900);

    return () => {
      cancelled = true;
      if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    };
  }, [details, draftHydrated, portfolioContent, projects, resumeFingerprint, resumeText, session?.user?.id]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (headshotStep === 'camera' && cameraStream && videoRef.current) {
        videoRef.current.srcObject = cameraStream;
        videoRef.current.play();
    }
  }, [headshotStep, cameraStream]);

  useEffect(() => {
    if (initialInput && draftHydrated) {
        try {
            const project: SkillBridgeProject = JSON.parse(initialInput);
            if(project.projectTitle && project.objective) {
                // If the first project is empty, replace it. Otherwise, add a new one.
                setProjects(prev => {
                    if(prev.length === 1 && !prev[0].title && !prev[0].description) {
                        return [{...prev[0], title: project.projectTitle, description: project.objective }];
                    }
                    return [...prev, { id: Date.now(), title: project.projectTitle, description: project.objective, url: '', category: 'Web' }]
                });
            }
        } catch (e) {
            console.error("Could not parse initial project for portfolio builder", e);
        }
    }
  }, [draftHydrated, initialInput]);

  const { addToast } = useToast();

  const runTool = async () => {
    if (loading) return; // guard re-entry: a paid generate must not double-fire
    if (!details.tagline || !details.bio) {
      setError(t('tool_portfolio_error_required'));
      return;
    }
    if (!portfolioContent && !resumeText.trim()) {
      setError(t('tool_portfolio_auto_fill_no_resume'));
      return;
    }
    const alive = begin();
    setError(null);
    const resumeSnapshot = resumeText;
    try {
      const extractedContent = portfolioContent ?? await generatePortfolioWebsite(resumeSnapshot);

      // Drop a result whose resume changed mid-flight (stale-resume guard).
      if (!alive() || resumeSnapshot !== resumeText) return;
      setPortfolioContent(extractedContent);

      const finalHtml = buildHtml({
        content: extractedContent,
        branding: details,
        projects: projects,
        headshot: selectedHeadshot
      });

      setResult({ htmlContent: finalHtml });
      setPreviewTheme(details.theme);
      setCurrentStep('result');
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleAutoFillFromResume = async () => {
    if (!resumeText.trim()) {
      setError(t('tool_portfolio_auto_fill_no_resume'));
      return;
    }
    const runId = ++autoFillRunRef.current;
    // Snapshot the resume this run is for: if the resume changes mid-flight, the
    // cache-clearing effect fires but the run-id guard alone wouldn't catch it,
    // so a stale result could repopulate the cache. Drop the run if it diverged.
    const resumeSnapshot = resumeText;
    setAutoFillLoading(true);
    setError(null);
    try {
      const extractedContent = await generatePortfolioWebsite(resumeSnapshot);
      if (!mountedRef.current || autoFillRunRef.current !== runId || resumeSnapshot !== resumeText) return;

      setPortfolioContent(extractedContent);
      setDetails(prev => ({
        ...prev,
        tagline: buildTaglineFromContent(extractedContent),
        bio: buildBioFromContent(extractedContent),
      }));
      setProjects(prev => {
        const canReplace = prev.length === 0 || prev.every(isBlankProject);
        return canReplace ? buildProjectsFromContent(extractedContent) : prev;
      });
      addToast(t('tool_portfolio_auto_fill_success'), 'success');
    } catch (err) {
      if (mountedRef.current && autoFillRunRef.current === runId) {
        setError(err instanceof Error ? err.message : t('tool_portfolio_auto_fill_error'));
      }
    } finally {
      if (mountedRef.current && autoFillRunRef.current === runId) setAutoFillLoading(false);
    }
  };

  // Bumped on each generate/cancel so a late (or cancelled) result is ignored —
  // the user can never be trapped on the "Generating…" spinner.
  const handleGenerateHeadshots = async () => {
    if (!uploadedImage) {
      setHeadshotError(t('tool_portfolio_photo_required'));
      return;
    }
    const runId = ++headshotRunRef.current;
    setHeadshotStep('generating');
    setHeadshotError(null);
    try {
        // Client watchdog: even if the call hangs, resolve to a retryable error.
        const results = await Promise.race([
            generateProfessionalHeadshot(uploadedImage.data),
            new Promise<string[]>((_, reject) =>
                setTimeout(() => reject(new Error(t('tool_portfolio_headshot_timeout'))), 120_000)),
        ]);
        if (!mountedRef.current || headshotRunRef.current !== runId) return; // cancelled / superseded
        if (!Array.isArray(results) || results.length === 0) {
          setHeadshotError(t('tool_portfolio_headshot_empty'));
          setHeadshotStep('photo_uploaded');
          return;
        }
        setGeneratedImages(results.map(imgData => ({ mimeType: 'image/jpeg', data: imgData })));
        setHeadshotStep('generated');
    } catch (err) {
        if (!mountedRef.current || headshotRunRef.current !== runId) return;
        setHeadshotError(err instanceof Error ? err.message : t('tool_portfolio_headshot_failed'));
        setHeadshotStep('photo_uploaded');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const resizedImage = await resizeImage(file, 800);
        if (!mountedRef.current) return;
        setUploadedImage(resizedImage);
        setHeadshotStep('photo_uploaded');
        setHeadshotError(null);
    } catch (err) {
        setHeadshotError(t('tool_portfolio_image_process_failed'));
        console.error(err);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setCameraStream(stream);
      setHeadshotStep('camera');
      setHeadshotError(null);
    } catch (err) {
      console.error("Camera Error:", err);
      setHeadshotError(t('tool_portfolio_camera_access_failed'));
    }
  };

  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const maxSize = 800;
      let { videoWidth: width, videoHeight: height } = video;

      if (width > height) {
          if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
          }
      } else {
          if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
          }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64String = dataUrl.split(',')[1];
      if (base64String) {
        setUploadedImage({ mimeType: 'image/jpeg', data: base64String });
      }
      setHeadshotStep('photo_uploaded');
      stopCameraStream();
    }
  };

  const resetHeadshotFlow = () => {
    setHeadshotStep('initial');
    setHeadshotError(null);
    setUploadedImage(null);
    setGeneratedImages([]);
    setSelectedHeadshot(null);
    stopCameraStream();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool();
  };
  
  const [resultTab, setResultTab] = useState<'preview' | 'code' | 'deploy'>('preview');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  const handleDetailChange = (field: keyof typeof details, value: string) => setDetails(prev => ({ ...prev, [field]: value }));
  const handleProjectChange = (id: number, field: string, value: string) => setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const addProject = () => setProjects(prev => [...prev, { id: Date.now(), title: '', description: '', url: '', category: 'Web' }]);
  const removeProject = (id: number) => setProjects(prev => prev.filter(p => p.id !== id));

  const clearSavedDraft = async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    try {
      await deletePortfolioDraft(uid);
      if (!mountedRef.current) return;
      lastSavedDraftRef.current = '';
      setPortfolioContent(null);
      setDetails(prev => ({ tagline: '', bio: '', theme: prev.theme }));
      setProjects([DEFAULT_PROJECT]);
      setResult(null);
      setCurrentStep('template');
      setDraftStatus('idle');
      addToast(t('tool_portfolio_draft_cleared'), 'success');
    } catch (err) {
      if (!mountedRef.current) return;
      setDraftStatus('error');
      setError(err instanceof Error ? err.message : t('tool_portfolio_draft_save_failed'));
    }
  };
  
  const handleProjectImageUpload = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const resizedImage = await resizeImage(file, 600);
        if (!mountedRef.current) return;
        setProjects(prev => prev.map(p => p.id === id ? { ...p, image: resizedImage } : p));
    } catch (err) {
        setError(t('tool_portfolio_image_process_failed'));
        console.error(err);
    }
  };
  
  const renderTemplateSelection = () => (
    <div className="space-y-8 animate-fade-in py-4">
        <div className="text-center">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{t('tool_portfolio_choose_style_title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{t('tool_portfolio_choose_style_subtitle')}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {PORTFOLIO_TEMPLATES.map(t_template => (
                <button 
                    key={t_template.key} 
                    onClick={() => {
                        handleDetailChange('theme', t_template.key);
                        setCurrentStep('details');
                    }}
                    className={`group relative text-left p-6 bg-white dark:bg-slate-800 border-2 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${details.theme === t_template.key ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10' : 'border-gray-200 dark:border-slate-700'}`}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                             <div className="flex -space-x-1">
                                {t_template.colors.map(c => <div key={c} className="h-4 w-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" style={{ backgroundColor: c }}></div>)}
                             </div>
                        </div>
                        {details.theme === t_template.key && (
                            <div className="bg-blue-600 text-white p-1 rounded-full shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </div>
                    
                    <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-1">{t_template.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t_template.description}</p>
                    
                    <div className="mt-auto flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm group-hover:translate-x-1 transition-transform">
                        <span>{t('tool_portfolio_select_template')}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </div>
                </button>
            ))}
        </div>
    </div>
  );
  
  const renderHeadshotGenerator = () => {
    switch (headshotStep) {
        case 'initial':
            return (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-700 text-center">
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">{t('tool_portfolio_headshot_desc')}</p>
                    <div className="flex justify-center gap-4">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 font-semibold">{t('tool_portfolio_upload_button')}</button>
                        <button type="button" onClick={startCamera} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 font-semibold">{t('tool_portfolio_camera_button')}</button>
                    </div>
                </div>
            );
        case 'camera':
            return (
                <div className="p-4 bg-black rounded-md border border-gray-800 text-center">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-md" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex justify-center gap-4 mt-3">
                        <button type="button" onClick={handleCapture} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('tool_portfolio_capture_button')}</button>
                        <button type="button" onClick={() => { stopCameraStream(); setHeadshotStep('initial'); }} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">{t('tool_portfolio_cancel_button')}</button>
                    </div>
                </div>
            );
        case 'photo_uploaded':
            if (!uploadedImage) return null;
            return (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-700 text-center">
                    <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`} alt="Uploaded headshot" className="w-40 h-40 object-cover rounded-full mx-auto shadow-lg border-4 border-gray-200 dark:border-slate-700 p-1" />
                    <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                        <button type="button" onClick={handleGenerateHeadshots} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">{t('tool_portfolio_generate_avatars_button')}</button>
                        <button type="button" onClick={() => { setSelectedHeadshot(uploadedImage); setHeadshotStep('final_selected'); }} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold">{t('tool_portfolio_use_photo_button')}</button>
                    </div>
                     <button type="button" onClick={resetHeadshotFlow} className="mt-3 text-sm text-gray-600 dark:text-slate-400 hover:underline">{t('tool_portfolio_change_photo_button')}</button>
                </div>
            );
        case 'generating':
             return (
                 <div className="text-center p-8">
                    <p className="text-xl text-gray-800 dark:text-gray-100 font-semibold mb-2">{t('tool_portfolio_generating_avatars_message') || 'Generating...'}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{t('tool_portfolio_generating_avatars_hint')}</p>
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
                    <button type="button" onClick={() => { headshotRunRef.current++; setHeadshotStep('photo_uploaded'); }} className="mt-6 text-sm text-gray-600 dark:text-slate-400 hover:underline">{t('tool_portfolio_cancel')}</button>
                 </div>
             );
        case 'generated':
            return (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-700 text-center">
                    <p className="font-semibold mb-3 dark:text-gray-100">{t('tool_portfolio_choose_avatar_title')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {generatedImages.map((img, i) => (
                            <button key={i} onClick={() => { setSelectedHeadshot(img); setHeadshotStep('final_selected'); }} className="border-2 border-transparent hover:border-blue-500 rounded-lg p-1 transition-all">
                                <img src={`data:${img.mimeType};base64,${img.data}`} alt={`Generated avatar ${i + 1}`} className="w-full h-auto object-cover rounded-md" />
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setHeadshotStep('photo_uploaded')} className="mt-3 text-sm text-gray-600 dark:text-slate-400 hover:underline">{t('tool_portfolio_try_again_button')}</button>
                </div>
            );
        case 'final_selected':
            if (!selectedHeadshot) return null;
            return (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md border dark:border-slate-700 text-center">
                    <p className="font-semibold mb-2 dark:text-gray-100">{t('tool_portfolio_selected_headshot_title')}</p>
                    <img src={`data:${selectedHeadshot.mimeType};base64,${selectedHeadshot.data}`} alt="Selected headshot" className="w-40 h-40 object-cover rounded-full mx-auto shadow-lg border-4 border-blue-500 p-1" />
                    <button type="button" onClick={() => { setGeneratedImages([]); setHeadshotStep('photo_uploaded'); }} className="mt-4 text-sm text-gray-600 dark:text-slate-400 hover:underline">{t('tool_portfolio_change_selection_button')}</button>
                </div>
            );
    }
  };


  const renderInput = () => {
    if (loading) return (
      <StagedLoader
        icon={<Globe />}
        accent="pink"
        title={t('tool_portfolio_building_title')}
        steps={[
          t('tool_portfolio_building_step1'),
          t('tool_portfolio_building_step2'),
          t('tool_portfolio_building_step3'),
          t('tool_portfolio_building_step4'),
        ]}
        onCancel={cancel}
      />
    );
    return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
            <button 
                onClick={() => setCurrentStep('template')}
                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                {t('tool_portfolio_back_to_styles')}
            </button>
            <div className="flex flex-wrap justify-end gap-2">
                {draftStatus !== 'idle' && (
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        draftStatus === 'error'
                            ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50'
                    }`}>
                        {draftStatus === 'loading' && t('tool_portfolio_draft_status_loading')}
                        {draftStatus === 'saving' && t('tool_portfolio_draft_status_saving')}
                        {draftStatus === 'saved' && t('tool_portfolio_draft_status_saved')}
                        {draftStatus === 'error' && t('tool_portfolio_draft_save_failed')}
                    </div>
                )}
                {session?.user?.id && (
                    <button
                        type="button"
                        onClick={clearSavedDraft}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {t('tool_portfolio_clear_draft_button')}
                    </button>
                )}
                <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800/50">
                    Template: {PORTFOLIO_TEMPLATES.find(t => t.key === details.theme)?.name}
                </div>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
            <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100">{t('tool_portfolio_step1_title')}</h4>
                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('tool_portfolio_auto_fill_note')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAutoFillFromResume}
                        disabled={autoFillLoading || loading || !resumeText.trim()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                    >
                        {autoFillLoading ? (
                            <span className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-blue-700 animate-spin dark:border-blue-900 dark:border-t-blue-300" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        <span>{autoFillLoading ? t('tool_portfolio_auto_fill_loading') : t('tool_portfolio_auto_fill_button')}</span>
                    </button>
                </div>
                <div className="space-y-4 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_tagline_label')}</label>
                        <input type="text" value={details.tagline} onChange={e => handleDetailChange('tagline', e.target.value)} placeholder={t('tool_portfolio_tagline_placeholder')} required className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_bio_label')}</label>
                        <textarea value={details.bio} onChange={e => handleDetailChange('bio', e.target.value)} rows={3} placeholder={t('tool_portfolio_bio_placeholder')} required className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white" />
                    </div>
                </div>
            </div>

            <div>
                <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-4">{t('tool_portfolio_step2_title')}</h4>
                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    {headshotError && (
                        <div role="alert" className="mb-4 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 animate-panel-expand">
                            {headshotError}
                        </div>
                    )}
                    {renderHeadshotGenerator()}
                </div>
            </div>

            <div>
                <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-4">{t('tool_portfolio_step3_title')}</h4>
                <div className="space-y-4">
                    {projects.map(p => (
                        <div key={p.id} className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
                            {projects.length > 1 && (
                                <button type="button" onClick={() => removeProject(p.id)} className="absolute top-4 right-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full h-8 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_project_title_label')}</label>
                                    <input type="text" value={p.title} onChange={e => handleProjectChange(p.id, 'title', e.target.value)} required className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_project_url_label')}</label>
                                    <input type="url" value={p.url} onChange={e => handleProjectChange(p.id, 'url', e.target.value)} placeholder={t('tool_portfolio_project_url_placeholder')} className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white" />
                                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{t('tool_portfolio_project_url_hint')}</p>
                                </div>
                            </div>
                            <div className="mt-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_project_category_label')}</label>
                                <input type="text" value={p.category} onChange={e => handleProjectChange(p.id, 'category', e.target.value)} required placeholder={t('tool_portfolio_project_category_placeholder')} className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white" />
                            </div>
                            <div className="mt-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_project_desc_label')}</label>
                                <textarea value={p.description} onChange={e => handleProjectChange(p.id, 'description', e.target.value)} rows={2} required className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white" />
                            </div>
                            <div className="mt-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('tool_portfolio_project_image_label')}</label>
                                <input type="file" accept="image/*" onChange={e => handleProjectImageUpload(p.id, e)} className="mt-1 block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30"/>
                            </div>
                        </div>
                    ))}
                    <button type="button" onClick={addProject} className="w-full py-4 px-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 font-bold transition-colors">
                        {t('tool_portfolio_add_project_button')}
                    </button>
                </div>
            </div>
            
            {error && <div className="text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-800/50">{error}</div>}
            
            <button type="submit" disabled={loading || autoFillLoading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all">
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    <span>{t('tool_portfolio_generate_button')}</span>
                </>
            </button>
        </form>
    </div>
    );
  };

  const mainViewRenderer = () => {
      if (currentStep === 'result') return renderResult();
      if (currentStep === 'template') return renderTemplateSelection();
      return renderInput();
  }

  const getModifiedHtmlContent = (originalHtml: string, themeKey: string | null): string => {
    if (!themeKey || !THEME_VARS[themeKey]) return originalHtml;
    const variables = THEME_VARS[themeKey];
    const rootStyle = `:root { ${Object.entries(variables).map(([key, value]) => `${key}: ${value};`).join(' ')} --transition: all 0.3s ease; }`;
    return originalHtml.replace(/:root\s*{[^}]+}/s, rootStyle);
  };

  const renderResult = () => {
    if (error) return <ToolError message={error} onRetry={() => { setError(null); setCurrentStep('details'); }} retryLabel="Back to details" />;
    if (!result || !previewTheme) return null;
    
    const { htmlContent } = result;
    const themedHtmlContent = getModifiedHtmlContent(htmlContent, previewTheme);

    const downloadHtml = () => {
      const element = document.createElement("a");
      const file = new Blob([themedHtmlContent], { type: 'text/html' });
      element.href = URL.createObjectURL(file);
      element.download = "showcase.html";
      document.body.appendChild(element);
      element.click();
      element.remove();
    };
    const copyToClipboard = () => navigator.clipboard.writeText(themedHtmlContent).then(() => addToast(t('tool_portfolio_copy_code_success'), 'success'), () => addToast(t('tool_portfolio_copy_code_fail'), 'error'));

    return (
      <div className="space-y-4">
        <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_portfolio_results_title')}</h4>
        <div className="border-b border-gray-200 dark:border-slate-800">
          <nav className="-mb-px flex space-x-6">
            <button onClick={() => setResultTab('preview')} className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${resultTab === 'preview' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'}`}>{t('tool_portfolio_tab_preview')}</button>
            <button onClick={() => setResultTab('deploy')} className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${resultTab === 'deploy' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'}`}>{t('tool_portfolio_tab_deploy')}</button>
            <button onClick={() => setResultTab('code')} className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${resultTab === 'code' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'}`}>{t('tool_portfolio_tab_code')}</button>
          </nav>
        </div>
        {resultTab === 'preview' && (
          <div>
            <div className="flex flex-wrap justify-center items-center gap-2 p-2 bg-gray-200/70 dark:bg-slate-800/50 rounded-md mb-3">
              {(['desktop', 'tablet', 'mobile'] as const).map(d => (
                <button key={d} onClick={() => setPreviewDevice(d)} className={`p-2 rounded-md transition-colors ${previewDevice === d ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title={t(`tool_portfolio_preview_device_${d}`)}>
                  {d === 'desktop' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                  {d === 'tablet' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                  {d === 'mobile' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H7z" /></svg>}
                </button>
              ))}
              <div className="h-6 border-l border-gray-300 dark:border-slate-700 mx-2"></div>
              {PORTFOLIO_TEMPLATES.map(t_template => (
                <button key={t_template.key} onClick={() => setPreviewTheme(t_template.key)} className={`p-1 border-2 rounded-md ${previewTheme === t_template.key ? 'border-blue-500' : 'border-transparent'}`} title={t_template.name}>
                  <div className="flex -space-x-1">{t_template.colors.map(c => <div key={c} className="h-4 w-4 rounded-full border border-white dark:border-slate-800" style={{ backgroundColor: c }}></div>)}</div>
                </button>
              ))}
            </div>
            <div className="mx-auto bg-gray-800 p-4 rounded-lg shadow-inner">
                 <iframe title="Showcase Preview" srcDoc={themedHtmlContent} className="w-full h-[60vh] border-0 bg-white transition-all duration-500 ease-in-out" style={{ maxWidth: PREVIEW_SIZES[previewDevice], margin: '0 auto' }} />
            </div>
          </div>
        )}
        {resultTab === 'deploy' && (
          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 space-y-6">
              <div>
                <h5 className="font-bold dark:text-gray-100">{t('tool_portfolio_deploy_step1_title')}</h5>
                <p className="text-sm mt-1 dark:text-slate-400">{t('tool_portfolio_deploy_step1_desc')}</p>
                <button onClick={downloadHtml} className="mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-colors">{t('tool_portfolio_deploy_download_button')}</button>
                <p className="text-sm mt-2 dark:text-slate-500">{t('tool_portfolio_deploy_step1_visit')} <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">Netlify Drop</a> {t('tool_portfolio_deploy_step1_visit_2')}</p>
              </div>
               <div>
                <h5 className="font-bold dark:text-gray-100">{t('tool_portfolio_deploy_step2_title')}</h5>
                <p className="text-sm mt-1 dark:text-slate-400">{t('tool_portfolio_deploy_step2_desc')}</p>
                 <a href="https://iot.caiot.co/" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 transition-colors">{t('tool_portfolio_deploy_open_lab_button')}</a>
              </div>
               <div>
                <h5 className="font-bold dark:text-gray-100">{t('tool_portfolio_deploy_step3_title')}</h5>
                <p className="text-sm mt-1 dark:text-slate-400">{t('tool_portfolio_deploy_step3_desc')}</p>
              </div>
          </div>
        )}
        {resultTab === 'code' && (
          <div>
            <div className="flex justify-end mb-2">
              <button onClick={copyToClipboard} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md text-sm hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">{t('tool_portfolio_copy_code_button')}</button>
            </div>
            <pre className="p-4 bg-gray-800 text-white rounded-lg h-[60vh] overflow-auto text-xs scrollbar-thin scrollbar-thumb-gray-600"><code className="language-html">{themedHtmlContent}</code></pre>
          </div>
        )}
      </div>
    );
  };

  return mainViewRenderer();
};

export default PortfolioWebsiteBuilder;
