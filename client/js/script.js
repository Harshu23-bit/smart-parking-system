/* ============================================
ParkSmart — JavaScript
Typewriter, Animations, Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // TYPEWRITER EFFECT — "Cursor eating" animation
    // =============================================
    const typewriterEl = document.getElementById('typewriter');
    const cursorEl = document.getElementById('cursor');
    const phrases = [
        'Made Effortless.',
        'At Your Fingertips.',
        'In Real-Time.',
        'Without The Stress.',
        'Just a Tap Away.',
        'Redefined.'
    ];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typeSpeed = 80;
    const deleteSpeed = 45;
    const pauseAfterType = 2200;
    const pauseAfterDelete = 400;

    function typewrite() {
    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
        cursorEl.classList.remove('eating');

        charIndex++;
        typewriterEl.textContent = currentPhrase.substring(0, charIndex);

        if (charIndex >= currentPhrase.length) {
            isDeleting = true;
            setTimeout(typewrite, pauseAfterType);
            return;
        }

        setTimeout(typewrite, typeSpeed);

    } else {
        cursorEl.classList.add('eating');

        charIndex--;
        typewriterEl.textContent = currentPhrase.substring(0, charIndex);

        if (charIndex <= 0) {
            charIndex = 0;

            phraseIndex = (phraseIndex + 1) % phrases.length;
            isDeleting = false;

            cursorEl.classList.remove('eating');

            setTimeout(typewrite, pauseAfterDelete);
            return;
        }

        setTimeout(typewrite, deleteSpeed);
    }
}
    typewrite();


    // =============================================
    // NAVBAR SCROLL EFFECT
    // =============================================
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 60) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    });

    // =============================================
    // OWNER AUTHENTICATION GUARD (Homepage Navbar)
    // =============================================
    try {
        const ownerJwt = localStorage.getItem('parksmart_jwt_token');
        const dashLink = document.getElementById('home-nav-owner-dash');
        if (dashLink && ownerJwt) {
            dashLink.style.display = 'list-item';
        }
    } catch (e) {}

    // =============================================
    // HAMBURGER MENU
    // =============================================
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });


    // =============================================
    // SCROLL-TRIGGERED ANIMATIONS (Intersection Observer)
    // =============================================
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        observer.observe(card);
    });

    // Observe steps
    document.querySelectorAll('.step').forEach(step => {
        observer.observe(step);
    });

    // Observe spot cards
    document.querySelectorAll('.spot-card').forEach(card => {
        observer.observe(card);
    });


    // =============================================
    // COUNTER ANIMATION (Stats)
    // =============================================
    const statNumbers = document.querySelectorAll('.stat-number');
    let statsAnimated = false;

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !statsAnimated) {
                statsAnimated = true;
                animateCounters();
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }

    function animateCounters() {
        statNumbers.forEach(stat => {
            const target = parseInt(stat.dataset.target);
            const duration = 2000;
            const startTime = performance.now();

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out quad
                const eased = 1 - (1 - progress) * (1 - progress);
                const current = Math.floor(eased * target);

                stat.textContent = current.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    stat.textContent = target.toLocaleString();
                }
            }

            requestAnimationFrame(updateCounter);
        });
    }


    // =============================================
    // TIMELINE PROGRESS
    // =============================================
    const timelineProgress = document.getElementById('timeline-progress');
    
    if (timelineProgress) {
        const timelineObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    timelineProgress.style.height = '100%';
                }
            });
        }, { threshold: 0.2 });

        const howItWorks = document.getElementById('how-it-works');
        if (howItWorks) {
            timelineObserver.observe(howItWorks);
        }
    }


    // =============================================
    // FILTER BUTTONS (Spots)
    // =============================================
    const filterBtns = document.querySelectorAll('.filter-btn');
    const spotCards = document.querySelectorAll('.spot-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            spotCards.forEach((card, index) => {
                const type = card.dataset.type;
                const shouldShow = filter === 'all' || type === filter;

                if (shouldShow) {
                    card.style.display = '';
                    card.style.animation = `fadeInUp 0.5s var(--ease-out) ${index * 0.08}s both`;
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });


    // =============================================
    // SMOOTH SCROLL for nav links
    // =============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.length > 1) {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const offset = 80;
                    const position = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({
                        top: position,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });


    // =============================================
    // PARALLAX on Floating Shapes (subtle)
    // =============================================
    const shapes = document.querySelectorAll('.shape');
    
    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        shapes.forEach((shape, i) => {
            const speed = (i + 1) * 8;
            shape.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
    });


    // =============================================
    // EARNINGS CHART ANIMATION (on scroll)
    // =============================================
    const earningsCard = document.querySelector('.earnings-card');
    if (earningsCard) {
        const chartObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const bars = earningsCard.querySelectorAll('.chart-bar');
                    bars.forEach((bar, i) => {
                        bar.style.animationDelay = `${i * 0.1}s`;
                    });
                    chartObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        chartObserver.observe(earningsCard);
    }


    // =============================================
    // SCROLL INDICATOR HIDE
    // =============================================
    const scrollIndicator = document.getElementById('scroll-indicator');
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 200) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.pointerEvents = 'auto';
        }
    });

});
