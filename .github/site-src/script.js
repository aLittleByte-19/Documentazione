    // 1. Gestione sezioni principali (cambiare sezione con i pulsanti)
    const sections = {
        candidatura: document.getElementById('candidatura'),
        rtb: document.getElementById('rtb'),
        pb: document.getElementById('pb'),
        contatti: document.getElementById('contatti'),
        about: document.getElementById('about')
    };
    
    const navButtons = document.querySelectorAll('.nav-btn');
    
    function showSection(sectionId) {
        // Nascondi tutte le sezioni
        for (const key in sections) {
            if (sections[key]) {
                sections[key].classList.remove('active-section');
            }
        }
        // Mostra la sezione selezionata
        if (sections[sectionId]) {
            sections[sectionId].classList.add('active-section');
        }
    }
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section');
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            showSection(sectionId);
        });
    });
    
    // 2. Gestione dropdown interni (menu a tendina dentro ogni sezione)
    // Questa funzione gestisce sia i dropdown statici che quelli generati dinamicamente
    function initDropdowns() {
        const innerDropdowns = document.querySelectorAll('.inner-dropdown');
        
        innerDropdowns.forEach(dropdown => {
            // Rimuovi eventuali listener esistenti per evitare duplicati
            const header = dropdown.querySelector('.inner-dropdown-header');
            if (header && !dropdown.hasAttribute('data-listener')) {
                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('active');
                });
                dropdown.setAttribute('data-listener', 'true');
            }
        });
    }
    
    // Inizializza i dropdown all'avvio
    initDropdowns();
    
    // Quando lo script aggiorna il DOM, possiamo chiamare initDropdowns() di nuovo
    // Per ora usiamo MutationObserver per rilevare cambiamenti dinamici
    const observer = new MutationObserver(function(mutations) {
        initDropdowns();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // 3. Gestione tema chiaro/scuro
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    
    // Controlla se c'è una preferenza salvata nel localStorage
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
        }
    });
    
    // 4. Scroll to top
    const scrollBtn = document.getElementById('scrollTop');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });
    
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });